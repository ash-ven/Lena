// La libreria degli esercizi: si riempie da sola dalle schede salvate e propone nome + video la volta dopo.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { avvia, db, sessione, creaPt, email, PASSWORD, pulisci, datiProva } = require("./comune");
const { creaApp } = require("../app");
const { chiaveNome, eserciziDellaScheda } = require("../libreria");

let server, BASE, pt, s, altro, s2, cl;
before(async () => {
  server = await avvia(creaApp()); BASE = `http://localhost:${server.address().port}`;
  pt = await creaPt("lib-pt", "Trainer Libreria"); altro = await creaPt("lib-altro", "Altro Trainer");
  s = sessione(() => BASE); s2 = sessione(() => BASE);
  assert.equal((await s("POST", "/api/auth/login", { email: email("lib-pt"), password: PASSWORD })).stato, 200);
  assert.equal((await s2("POST", "/api/auth/login", { email: email("lib-altro"), password: PASSWORD })).stato, 200);
  cl = (await db.query("INSERT INTO cliente (pt_id, nome, cognome) VALUES ($1, 'Lia', 'Libreria') RETURNING id", [pt.ptId])).rows[0].id;
});
after(async () => { await pulisci(); await new Promise((ok) => server.close(ok)); await db.end(); });

test("il nome si confronta senza maiuscole, accenti e spazi doppi", () => {
  assert.equal(chiaveNome("  Pressè   PIANA "), "presse piana");
  assert.equal(chiaveNome(null), "");
});

test("prende gli esercizi da blocchi, circuiti e riscaldamento, una volta sola ciascuno", () => {
  const d = datiProva();
  d.riscaldamento = { voce: "Riscaldamento", durata: "5'", istruzione: "", esercizi: [["Cat cow", "https://esempio.it/cat"], ["Squat", null]] };
  d.giorni = [{ ...d.giorni[0], blocchi: [
    { tipo: "esercizio", nome: "Squat", serie: 4, rip: "10", rec: "90", video: "https://esempio.it/squat", note: null, schema: null, progressione: null },
    { tipo: "circuito", formato: "EMOM 10'", rec: null, esercizi: [{ nome: "squat ", rip: "10", video: null }, { nome: "Burpees", rip: "8", video: null }] },
  ] }];
  const l = eserciziDellaScheda(d);
  assert.deepEqual(l.map((e) => e.chiave).sort(), ["burpees", "cat cow", "squat"]);
  assert.equal(l.find((e) => e.chiave === "squat").video, "https://esempio.it/squat");   // vale la versione col video
});

test("salvare una scheda riempie la libreria; si cerca per pezzo di nome; i video si ricordano", async () => {
  const d = datiProva("Lia", "Libreria");
  d.giorni = [{ ...d.giorni[0], blocchi: [
    { tipo: "esercizio", nome: "Squat bulgaro", serie: 3, rip: "8", rec: "60", video: "https://esempio.it/bulgaro", note: null, schema: null, progressione: null },
    { tipo: "esercizio", nome: "Stacco rumeno", serie: 3, rip: "8", rec: "60", video: null, note: null, schema: null, progressione: null },
  ] }];
  assert.equal((await s("POST", `/api/clienti/${cl}/schede`, { dati: d })).stato, 201);
  let r = (await s("GET", "/api/pt/esercizi?q=BULGARO")).json;
  assert.equal(r.length, 1); assert.equal(r[0].nome, "Squat bulgaro"); assert.equal(r[0].video, "https://esempio.it/bulgaro");
  assert.equal((await s("GET", "/api/pt/esercizi?q=stac")).json[0].video, null);

  // seconda scheda: stesso esercizio SENZA video → il video vecchio resta; con video nuovo → lo sostituisce
  d.giorni[0].blocchi[0].video = null;
  await s("POST", `/api/clienti/${cl}/schede`, { dati: d });
  r = (await s("GET", "/api/pt/esercizi?q=bulgaro")).json;
  assert.equal(r[0].video, "https://esempio.it/bulgaro"); assert.equal(r[0].usi, 2);
  d.giorni[0].blocchi[0].video = "https://esempio.it/nuovo";
  await s("POST", `/api/clienti/${cl}/schede`, { dati: d });
  assert.equal((await s("GET", "/api/pt/esercizi?q=bulgaro")).json[0].video, "https://esempio.it/nuovo");
});

test("la libreria è privata: un altro trainer non vede nulla; senza testo l'elenco è vuoto; serve il login", async () => {
  assert.deepEqual((await s2("GET", "/api/pt/esercizi?q=squat")).json, []);
  assert.deepEqual((await s("GET", "/api/pt/esercizi?q=")).json, []);
  assert.equal((await sessione(() => BASE)("GET", "/api/pt/esercizi?q=squat")).stato, 401);
});

test("i caratteri speciali della ricerca (% e _) non fanno da jolly", async () => {
  assert.deepEqual((await s("GET", "/api/pt/esercizi?q=%25")).json, []);
  assert.deepEqual((await s("GET", "/api/pt/esercizi?q=_")).json, []);
});
