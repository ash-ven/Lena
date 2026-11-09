// Il recupero della password: link per email, monouso, a scadenza; le vecchie sessioni smettono di valere. Con il database.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { avvia, db, sessione, creaPt, email, PASSWORD, pulisci } = require("./comune");
const { creaApp } = require("../app");
const { usaInvio } = require("../posta");

let server, BASE, pt, spediti;
const attendi = async (cond, ms = 3000) => { const fine = Date.now() + ms; while (Date.now() < fine) { if (cond()) return true; await new Promise((r) => setTimeout(r, 25)); } return cond(); };
const codiceDa = (testo) => /codice=([\w-]+)/.exec(testo)[1];

before(async () => {
  server = await avvia(creaApp({ limiteAccesso: 1000, limiteRecupero: 1000 })); BASE = `http://localhost:${server.address().port}`;
  pt = await creaPt("rec-pt", "Trainer Recupero");
  spediti = [];
  usaInvio(async (m) => { spediti.push(m); return { inviata: true }; });
});
after(async () => { usaInvio(null); await new Promise((ok) => server.close(ok)); await pulisci(); await db.end(); });

const azzera = () => db.query("DELETE FROM reimposta_password WHERE utente_id = $1", [pt.utenteId]);

test("email non valida: errore; email sconosciuta: stessa risposta ma nessuna email", async () => {
  const s = sessione(() => BASE);
  assert.equal((await s("POST", "/api/auth/password-dimenticata", { email: "boh" })).stato, 400);
  const r = await s("POST", "/api/auth/password-dimenticata", { email: email("non-esiste") });
  assert.equal(r.stato, 200); assert.deepEqual(r.json, { ok: true });
  await new Promise((ok) => setTimeout(ok, 300));
  assert.equal(spediti.length, 0);
});

test("giro completo: email col link, nuova password, il link non si riusa, la vecchia password non vale più", async () => {
  const s = sessione(() => BASE);
  assert.equal((await s("POST", "/api/auth/login", { email: email("rec-pt"), password: PASSWORD })).stato, 200);   // sessione aperta PRIMA del cambio
  assert.equal((await s("GET", "/api/auth/me")).stato, 200);
  await new Promise((ok) => setTimeout(ok, 1100));   // l'orario dell'accesso è in secondi: il cambio deve venire dopo

  const r = await sessione(() => BASE)("POST", "/api/auth/password-dimenticata", { email: email("rec-pt").toUpperCase() });
  assert.equal(r.stato, 200);
  assert.ok(await attendi(() => spediti.length === 1), "l'email doveva partire");
  assert.equal(spediti[0].a, email("rec-pt"));
  assert.match(spediti[0].testo, /\/nuova-password\.html\?codice=/);
  const codice = codiceDa(spediti[0].testo);
  // nel database non c'è il codice, solo la sua impronta
  assert.equal((await db.query("SELECT count(*)::int AS n FROM reimposta_password WHERE codice_hash = $1", [codice])).rows[0].n, 0);

  const nuova = sessione(() => BASE);
  assert.equal((await nuova("POST", "/api/auth/nuova-password", { codice, password: "corta" })).stato, 400);
  assert.equal((await nuova("POST", "/api/auth/nuova-password", { codice: "sbagliato", password: "UnaNuovaPassword99" })).stato, 400);
  assert.equal((await nuova("POST", "/api/auth/nuova-password", { codice, password: "UnaNuovaPassword99" })).stato, 200);
  assert.equal((await nuova("POST", "/api/auth/nuova-password", { codice, password: "UnAltraPassword99" })).stato, 400);   // monouso

  assert.equal((await sessione(() => BASE)("POST", "/api/auth/login", { email: email("rec-pt"), password: PASSWORD })).stato, 401);
  assert.equal((await sessione(() => BASE)("POST", "/api/auth/login", { email: email("rec-pt"), password: "UnaNuovaPassword99" })).stato, 200);
  assert.equal((await s("GET", "/api/auth/me")).stato, 401, "l'accesso aperto prima del cambio non deve valere più");
  const dopo = sessione(() => BASE);
  await dopo("POST", "/api/auth/login", { email: email("rec-pt"), password: "UnaNuovaPassword99" });
  assert.equal((await dopo("GET", "/api/auth/me")).stato, 200, "un accesso nuovo, subito dopo il cambio, vale");
});

test("link scaduto non vale; due richieste ravvicinate mandano una sola email; un nuovo link annulla il vecchio", async () => {
  await azzera(); spediti.length = 0;
  const s = sessione(() => BASE);
  await s("POST", "/api/auth/password-dimenticata", { email: email("rec-pt") });
  assert.ok(await attendi(() => spediti.length === 1));
  await s("POST", "/api/auth/password-dimenticata", { email: email("rec-pt") });
  await new Promise((ok) => setTimeout(ok, 400));
  assert.equal(spediti.length, 1, "entro 2 minuti non si manda un'altra email");
  const c1 = codiceDa(spediti[0].testo);
  await db.query("UPDATE reimposta_password SET scade_il = now() - interval '1 minute' WHERE utente_id = $1", [pt.utenteId]);
  assert.equal((await s("POST", "/api/auth/nuova-password", { codice: c1, password: "UnaNuovaPassword77" })).stato, 400, "scaduto");

  // passati i 2 minuti, un nuovo link annulla il precedente
  await db.query("UPDATE reimposta_password SET creato_il = now() - interval '10 minutes', scade_il = now() + interval '50 minutes' WHERE utente_id = $1", [pt.utenteId]);
  await s("POST", "/api/auth/password-dimenticata", { email: email("rec-pt") });
  assert.ok(await attendi(() => spediti.length === 2));
  const c2 = codiceDa(spediti[1].testo);
  assert.equal((await s("POST", "/api/auth/nuova-password", { codice: c1, password: "UnaNuovaPassword77" })).stato, 400, "il vecchio link non vale più");
  assert.equal((await s("POST", "/api/auth/nuova-password", { codice: c2, password: "UnaNuovaPassword77" })).stato, 200);
});

test("le richieste di recupero hanno un limite per indirizzo", async () => {
  const stretto = await avvia(creaApp({ limiteRecupero: 2 }));
  try {
    const url = `http://localhost:${stretto.address().port}/api/auth/password-dimenticata`;
    const chiedi = () => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email("nessuno") }) });
    assert.equal((await chiedi()).status, 200); assert.equal((await chiedi()).status, 200);
    assert.equal((await chiedi()).status, 429);
  } finally { await new Promise((ok) => stretto.close(ok)); }
});
