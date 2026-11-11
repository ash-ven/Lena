// Il cliente legge le «Note condivise» del suo trainer (e mai gli «Appunti per me»): le rotte (con database).
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const { avvia, db, sessione, creaPt, email, PASSWORD, pulisci } = require("./comune");
const { creaApp } = require("../app");

let server, BASE, pt1, pt2, cliente1, cliente2, sPt1, sC1, sC2;
async function creaCliente(nomeEmail, pt, nome) {
  const hash = await bcrypt.hash(PASSWORD, 4);
  const u = await db.query("INSERT INTO utente (email, password_hash, ruolo) VALUES ($1, $2, 'cliente') RETURNING id", [email(nomeEmail), hash]);
  const c = await db.query("INSERT INTO cliente (pt_id, utente_id, nome, cognome) VALUES ($1, $2, $3, 'Prova') RETURNING id", [pt.ptId, u.rows[0].id, nome]);
  return c.rows[0].id;
}
before(async () => {
  server = await avvia(creaApp({ limiteAccesso: 1000 })); BASE = `http://localhost:${server.address().port}`;
  pt1 = await creaPt("nc-pt1", "Trainer Nota Uno"); pt2 = await creaPt("nc-pt2", "Trainer Nota Due");
  cliente1 = await creaCliente("nc-cli1", pt1, "Nina"); cliente2 = await creaCliente("nc-cli2", pt2, "Omar");
  sPt1 = sessione(() => BASE); sC1 = sessione(() => BASE); sC2 = sessione(() => BASE);
  assert.equal((await sPt1("POST", "/api/auth/login", { email: email("nc-pt1"), password: PASSWORD })).stato, 200);
  assert.equal((await sC1("POST", "/api/auth/login", { email: email("nc-cli1"), password: PASSWORD })).stato, 200);
  assert.equal((await sC2("POST", "/api/auth/login", { email: email("nc-cli2"), password: PASSWORD })).stato, 200);
});
after(async () => { await new Promise((ok) => server.close(ok)); await pulisci(); await db.end(); });

test("note condivise: il cliente non vede niente finché il trainer non scrive; poi le legge, aggiornate", async () => {
  const vuote = await sC1("GET", "/api/me/note");
  assert.equal(vuote.stato, 200); assert.equal(vuote.json.testo, ""); assert.equal(vuote.json.aggiornateIl, null);
  assert.equal((await sPt1("PUT", `/api/clienti/${cliente1}/note`, { testo: "Preferisce allenarsi la sera." })).stato, 200);
  const lette = await sC1("GET", "/api/me/note");
  assert.equal(lette.json.testo, "Preferisce allenarsi la sera."); assert.ok(lette.json.aggiornateIl);
});

test("note condivise: ogni cliente vede solo le sue; gli appunti del trainer non si vedono mai; serve il login da cliente", async () => {
  await sPt1("PUT", `/api/clienti/${cliente1}/appunti`, { testo: "APPUNTO-SOLO-PER-IL-TRAINER" });
  assert.ok(!JSON.stringify((await sC1("GET", "/api/me/note")).json).includes("APPUNTO-SOLO"));
  assert.equal((await sC2("GET", "/api/me/note")).json.testo, "", "l'altro cliente non vede le note di Nina");
  assert.equal((await sessione(() => BASE)("GET", "/api/me/note")).stato, 401);
  assert.equal((await sPt1("GET", "/api/me/note")).stato, 403);
});
