// Rinominare un cliente e cancellare una singola scheda: le rotte (con database). Le pagine sono in rinomina-cancella-pagine.test.js.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { avvia, db, sessione, email, PASSWORD, creaPt, datiProva, pulisci } = require("./comune");
const { creaApp } = require("../app");

let server, BASE, pt1, pt2, cl;
before(async () => {
  server = await avvia(creaApp({ limiteAccesso: 1000 })); BASE = `http://localhost:${server.address().port}`;
  await creaPt("rin-pt1", "Trainer Rin Uno"); await creaPt("rin-pt2", "Trainer Rin Due");
  pt1 = sessione(() => BASE); pt2 = sessione(() => BASE);
  assert.equal((await pt1("POST", "/api/auth/login", { email: email("rin-pt1"), password: PASSWORD })).stato, 200);
  assert.equal((await pt2("POST", "/api/auth/login", { email: email("rin-pt2"), password: PASSWORD })).stato, 200);
  cl = (await pt1("POST", "/api/clienti", { nome: "Mria", cognome: "Rosi" })).json;
});
after(async () => { await new Promise((ok) => server.close(ok)); await pulisci(); await db.end(); });

test("rinomina: cambia il cliente e il nome dentro le sue schede; controlli sui dati e sul proprietario", async () => {
  const s = await pt1("POST", `/api/clienti/${cl.id}/schede`, { dati: datiProva("Mria", "Rosi") });
  assert.equal(s.stato, 201);
  const ok = await pt1("PUT", `/api/clienti/${cl.id}/nome`, { nome: "  Maria ", cognome: "Rossi" });
  assert.equal(ok.stato, 200); assert.deepEqual(ok.json, { nome: "Maria", cognome: "Rossi" });
  const riga = (await db.query("SELECT nome, cognome FROM cliente WHERE id = $1", [cl.id])).rows[0];
  assert.deepEqual(riga, { nome: "Maria", cognome: "Rossi" });
  const info = (await db.query("SELECT dati->'info' AS info FROM scheda WHERE cliente_id = $1", [cl.id])).rows[0].info;
  assert.equal(info.nome, "Maria"); assert.equal(info.cognome, "Rossi");
  for (const corpo of [{}, { nome: "", cognome: "X" }, { nome: "X", cognome: "   " }, { nome: 5, cognome: "X" }, { nome: "a".repeat(101), cognome: "X" }, { nome: "A\u0000", cognome: "X" }])
    assert.equal((await pt1("PUT", `/api/clienti/${cl.id}/nome`, corpo)).stato, 400);
  assert.equal((await pt2("PUT", `/api/clienti/${cl.id}/nome`, { nome: "Intruso", cognome: "X" })).stato, 404);
  assert.equal((await sessione(() => BASE)("PUT", `/api/clienti/${cl.id}/nome`, { nome: "A", cognome: "B" })).stato, 401);
});

test("cancella scheda: toglie solo quella e i suoi valori; il cliente torna alla precedente; solo il trainer proprietario", async () => {
  const a = (await pt1("POST", `/api/clienti/${cl.id}/schede`, { dati: datiProva("Maria", "Rossi") })).json;
  const b = (await pt1("POST", `/api/clienti/${cl.id}/schede`, { dati: datiProva("Maria", "Rossi") })).json;
  for (const sc of [a, b]) await db.query("INSERT INTO registrazione (scheda_id, tipo, chiave, valore) VALUES ($1,'kg','prova','50')", [sc.id]);
  assert.equal((await pt2("DELETE", `/api/schede/${b.id}`)).stato, 404);
  const d = await pt1("DELETE", `/api/schede/${b.id}`);
  assert.equal(d.stato, 200);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM scheda WHERE id = $1", [b.id])).rows[0].n, 0);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM registrazione WHERE scheda_id = $1", [b.id])).rows[0].n, 0);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM registrazione WHERE scheda_id = $1", [a.id])).rows[0].n, 1);
  assert.equal((await pt1("DELETE", `/api/schede/${b.id}`)).stato, 404);
  assert.equal((await sessione(() => BASE)("DELETE", `/api/schede/${a.id}`)).stato, 401);
});
