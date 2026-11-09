// L'iscrizione dei trainer dall'app: pagina, link dal login e rotta (con database).
const fs = require("node:fs");
const path = require("node:path");
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { avvia, db, sessione, email, PASSWORD, pulisci } = require("./comune");
const { creaApp } = require("../app");

const w = (f) => fs.readFileSync(path.join(__dirname, "..", "..", "web", f), "utf8");

test("la pagina di iscrizione trainer ha i campi giusti e chiama la rotta giusta", () => {
  const h = w("registrati-pt.html");
  assert.match(h, /id="nome"/); assert.match(h, /id="email"/);
  assert.match(h, /autocomplete="new-password"/);
  assert.match(h, /src="\/registrati-pt\.js"/);
  assert.match(w("registrati-pt.js"), /\/api\/auth\/registra-pt/);
  assert.match(w("registrati-pt.js"), /paginaDopoLogin\("pt"\)/);
  // il login da trainer rimanda all'iscrizione (e non c'è più la frase «li attiva chi gestisce Lena»)
  assert.match(w("login.js"), /registrati-pt\.html/);
  assert.doesNotMatch(w("login.js"), /li attiva chi gestisce/);
});

let server, BASE;
before(async () => { server = await avvia(creaApp({ limiteAccesso: 1000, limiteIscrizionePt: 1000 })); BASE = `http://localhost:${server.address().port}`; });
after(async () => { delete process.env.REGISTRAZIONE_PT; await new Promise((ok) => server.close(ok)); await pulisci(); await db.end(); });

test("iscrizione trainer: crea utente pt + riga pt, apre la sessione, rifiuta email doppia e dati sbagliati", async () => {
  const s = sessione(() => BASE);
  const ok = { nome: "  Trainer Nuovo ", email: email("iscr-pt").toUpperCase(), password: PASSWORD };
  const r = await s("POST", "/api/auth/registra-pt", ok);
  assert.equal(r.stato, 201); assert.equal(r.json.ruolo, "pt");
  assert.ok(s.cookie(), "deve essere già dentro");
  const riga = await db.query("SELECT p.nome, u.ruolo FROM pt p JOIN utente u ON u.id = p.utente_id WHERE u.email = $1", [email("iscr-pt")]);
  assert.equal(riga.rows[0].nome, "Trainer Nuovo"); assert.equal(riga.rows[0].ruolo, "pt");

  assert.equal((await sessione(() => BASE)("POST", "/api/auth/registra-pt", ok)).stato, 409);
  const altro = sessione(() => BASE);
  assert.equal((await altro("POST", "/api/auth/registra-pt", { ...ok, email: email("iscr-pt2"), nome: "" })).stato, 400);
  assert.equal((await altro("POST", "/api/auth/registra-pt", { ...ok, email: email("iscr-pt2"), password: "corta" })).stato, 400);
  assert.equal((await altro("POST", "/api/auth/registra-pt", { ...ok, email: "boh" })).stato, 400);
  assert.equal(altro.cookie(), null);
});

test("con REGISTRAZIONE_PT=chiusa l'iscrizione risponde 403 e non crea nulla", async () => {
  process.env.REGISTRAZIONE_PT = "chiusa";
  try {
    const r = await sessione(() => BASE)("POST", "/api/auth/registra-pt", { nome: "X", email: email("iscr-chiusa"), password: PASSWORD });
    assert.equal(r.stato, 403); assert.equal(r.json.codice, "ISCRIZIONE_CHIUSA");
    assert.equal((await db.query("SELECT count(*)::int AS n FROM utente WHERE email = $1", [email("iscr-chiusa")])).rows[0].n, 0);
  } finally { delete process.env.REGISTRAZIONE_PT; }
});
