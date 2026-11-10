// Gli appunti del trainer su un cliente (separati dalle note): le rotte (con database). Le pagine sono in appunti-trainer-pagine.test.js.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { avvia, db, sessione, email, PASSWORD, creaPt, pulisci } = require("./comune");
const { creaApp } = require("../app");

let server, BASE, pt1, pt2, cl;
before(async () => {
  server = await avvia(creaApp({ limiteAccesso: 1000 })); BASE = `http://localhost:${server.address().port}`;
  await creaPt("app-pt1", "Trainer Appunti Uno"); await creaPt("app-pt2", "Trainer Appunti Due");
  pt1 = sessione(() => BASE); pt2 = sessione(() => BASE);
  assert.equal((await pt1("POST", "/api/auth/login", { email: email("app-pt1"), password: PASSWORD })).stato, 200);
  assert.equal((await pt2("POST", "/api/auth/login", { email: email("app-pt2"), password: PASSWORD })).stato, 200);
  cl = (await pt1("POST", "/api/clienti", { nome: "Anita", cognome: "Appunti" })).json;
});
after(async () => { await new Promise((ok) => server.close(ok)); await pulisci(); await db.end(); });

test("appunti: vuoti all'inizio; si salvano, si leggono, si cancellano; sono distinti dalle note", async () => {
  const v = await pt1("GET", `/api/clienti/${cl.id}/appunti`);
  assert.equal(v.stato, 200); assert.equal(v.json.testo, ""); assert.equal(v.json.aggiornatiIl, null);
  const s = await pt1("PUT", `/api/clienti/${cl.id}/appunti`, { testo: "  Preferisce la sera.\r\nNon ama gli affondi.  " });
  assert.equal(s.stato, 200); assert.equal(s.json.testo, "Preferisce la sera.\nNon ama gli affondi."); assert.ok(s.json.aggiornatiIl);
  assert.equal((await pt1("GET", `/api/clienti/${cl.id}/note`)).json.testo, "", "le note non cambiano");
  assert.equal((await pt1("PUT", `/api/clienti/${cl.id}/appunti`, { testo: "   " })).json.testo, "");
});

test("appunti: limiti (4000 caratteri, solo testo, niente caratteri di controllo)", async () => {
  assert.equal((await pt1("PUT", `/api/clienti/${cl.id}/appunti`, { testo: "a".repeat(4001) })).stato, 400);
  assert.equal((await pt1("PUT", `/api/clienti/${cl.id}/appunti`, { testo: 7 })).stato, 400);
  assert.equal((await pt1("PUT", `/api/clienti/${cl.id}/appunti`, { testo: "no\u0000" })).stato, 400);
  assert.equal((await pt1("PUT", `/api/clienti/${cl.id}/appunti`, { testo: "a".repeat(4000) })).stato, 200);
});

test("appunti: li vede solo il trainer del cliente e NON compaiono nell'esportazione dei dati", async () => {
  const segreto = "APPUNTO-RISERVATO-123";
  await pt1("PUT", `/api/clienti/${cl.id}/appunti`, { testo: segreto });
  assert.equal((await pt2("GET", `/api/clienti/${cl.id}/appunti`)).stato, 404);
  assert.equal((await pt2("PUT", `/api/clienti/${cl.id}/appunti`, { testo: "intruso" })).stato, 404);
  assert.equal((await sessione(() => BASE)("GET", `/api/clienti/${cl.id}/appunti`)).stato, 401);
  assert.equal((await pt1("GET", `/api/clienti/${cl.id}/appunti`)).json.testo, segreto);
  const esp = await pt1("GET", `/api/clienti/${cl.id}/esporta`);
  assert.equal(esp.stato, 200);
  assert.ok(!JSON.stringify(esp.json).includes(segreto), "gli appunti non vanno nell'esportazione");
  assert.ok(!JSON.stringify(esp.json).includes("appunti_trainer"));
});

test("appunti: spariscono con il cliente", async () => {
  const c2 = (await pt1("POST", "/api/clienti", { nome: "Bruno", cognome: "Via" })).json;
  await pt1("PUT", `/api/clienti/${c2.id}/appunti`, { testo: "da cancellare" });
  assert.equal((await pt1("DELETE", `/api/clienti/${c2.id}`)).stato, 204);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM cliente WHERE id = $1", [c2.id])).rows[0].n, 0);
});
