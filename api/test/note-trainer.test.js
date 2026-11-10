// Le note private del trainer su un cliente: le rotte (con database). Le pagine sono in note-trainer-pagine.test.js.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { avvia, db, sessione, email, PASSWORD, creaPt, pulisci } = require("./comune");
const { creaApp } = require("../app");

let server, BASE, pt1, pt2, cl;
before(async () => {
  server = await avvia(creaApp({ limiteAccesso: 1000 })); BASE = `http://localhost:${server.address().port}`;
  await creaPt("note-pt1", "Trainer Note Uno"); await creaPt("note-pt2", "Trainer Note Due");
  pt1 = sessione(() => BASE); pt2 = sessione(() => BASE);
  assert.equal((await pt1("POST", "/api/auth/login", { email: email("note-pt1"), password: PASSWORD })).stato, 200);
  assert.equal((await pt2("POST", "/api/auth/login", { email: email("note-pt2"), password: PASSWORD })).stato, 200);
  cl = (await pt1("POST", "/api/clienti", { nome: "Nora", cognome: "Note" })).json;
});
after(async () => { await new Promise((ok) => server.close(ok)); await pulisci(); await db.end(); });

test("note: vuote all'inizio; si salvano, si leggono, si cancellano; testo pulito dagli spazi ai bordi", async () => {
  const vuote = await pt1("GET", `/api/clienti/${cl.id}/note`);
  assert.equal(vuote.stato, 200); assert.equal(vuote.json.testo, ""); assert.equal(vuote.json.aggiornateIl, null);
  const s = await pt1("PUT", `/api/clienti/${cl.id}/note`, { testo: "  Vuole dimagrire.\r\nPreferisce la sera.  " });
  assert.equal(s.stato, 200); assert.equal(s.json.testo, "Vuole dimagrire.\nPreferisce la sera."); assert.ok(s.json.aggiornateIl);
  assert.equal((await pt1("GET", `/api/clienti/${cl.id}/note`)).json.testo, "Vuole dimagrire.\nPreferisce la sera.");
  const via = await pt1("PUT", `/api/clienti/${cl.id}/note`, { testo: "   " });
  assert.equal(via.json.testo, ""); assert.equal(via.json.aggiornateIl, null);
});

test("note: limiti (2000 caratteri, solo testo, niente caratteri di controllo) e non contano come attività del cliente", async () => {
  const prima = (await db.query("SELECT ultima_attivita FROM cliente WHERE id = $1", [cl.id])).rows[0].ultima_attivita;
  assert.equal((await pt1("PUT", `/api/clienti/${cl.id}/note`, { testo: "a".repeat(2001) })).stato, 400);
  assert.equal((await pt1("PUT", `/api/clienti/${cl.id}/note`, { testo: 12345 })).stato, 400);
  assert.equal((await pt1("PUT", `/api/clienti/${cl.id}/note`, { testo: "ok\u0000no" })).stato, 400);
  assert.equal((await pt1("PUT", `/api/clienti/${cl.id}/note`, { testo: "a".repeat(2000) })).stato, 200);
  const dopo = (await db.query("SELECT ultima_attivita FROM cliente WHERE id = $1", [cl.id])).rows[0].ultima_attivita;
  assert.deepEqual(dopo, prima);
});

test("note: le vede solo il trainer del cliente; compaiono nell'esportazione dei dati del cliente", async () => {
  await pt1("PUT", `/api/clienti/${cl.id}/note`, { testo: "Nota di prova per l'esportazione" });
  assert.equal((await pt2("GET", `/api/clienti/${cl.id}/note`)).stato, 404);
  assert.equal((await pt2("PUT", `/api/clienti/${cl.id}/note`, { testo: "intruso" })).stato, 404);
  assert.equal((await sessione(() => BASE)("GET", `/api/clienti/${cl.id}/note`)).stato, 401);
  assert.equal((await pt1("GET", `/api/clienti/${cl.id}/note`)).json.testo, "Nota di prova per l'esportazione");
  const esp = await pt1("GET", `/api/clienti/${cl.id}/esporta`);
  assert.equal(esp.stato, 200);
  assert.equal(esp.json.cliente.note_del_trainer, "Nota di prova per l'esportazione");
  // le note non finiscono nell'elenco dei clienti
  const elenco = await pt1("GET", "/api/clienti");
  assert.ok(!JSON.stringify(elenco.json).includes("Nota di prova"));
});
