// I dati del titolare (il trainer) che compaiono nell'informativa dei suoi clienti. Pagine e rotte (con database).
const fs = require("node:fs");
const path = require("node:path");
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { avvia, db, sessione, email, PASSWORD, CONSENSO, VERSIONE_CONDIZIONI_PT, pulisci } = require("./comune");
const { creaApp } = require("../app");

const w = (f) => fs.readFileSync(path.join(__dirname, "..", "..", "web", f), "utf8");

test("pagine: il profilo ha i campi del titolare; l'informativa li riempie da sola; la registrazione passa il codice; i responsabili sono scritti", () => {
  const h = w("pt-profilo.html");
  for (const id of ["t-nome", "t-indirizzo", "t-email", "modulo-titolare"]) assert.match(h, new RegExp(`id="${id}"`));
  assert.match(w("pt-profilo.js"), /\/api\/pt\/titolare/);
  const info = w("privacy.html");
  for (const k of ["nome", "indirizzo", "email"]) assert.match(info, new RegExp(`data-titolare="${k}"`));
  assert.match(w("privacy.js"), /\/api\/privacy\/titolare\?codice=/);
  assert.match(w("privacy.js"), /\/api\/me\/titolare/);
  assert.match(w("registrati.js"), /privacy\.html\?codice=/);
  assert.match(info + w("condizioni-pt.html"), /lenapersonaltrainerapp@gmail\.com/);
  // niente più segnaposto "da compilare" per i dati di chi gestisce Lena
  assert.doesNotMatch(info + w("condizioni-pt.html"), /NOME DI CHI GESTISCE LENA|EMAIL DI CONTATTO DEL RESPONSABILE/);
  assert.match(fs.readFileSync(path.join(__dirname, "..", "..", "db", "initdb", "11_titolare.sql"), "utf8"), /titolare_email/);
});

let server, BASE;
before(async () => { server = await avvia(creaApp({ limiteAccesso: 1000, limiteIscrizionePt: 1000 })); BASE = `http://localhost:${server.address().port}`; });
after(async () => { await new Promise((ok) => server.close(ok)); await pulisci(); await db.end(); });

test("giro completo: PT appena iscritto non può invitare; compila i dati; l'informativa del cliente mostra il suo trainer", async () => {
  const pt = sessione(() => BASE);
  const reg = await pt("POST", "/api/auth/registra-pt", { nome: "Trainer Titolare", email: email("tit-pt"), password: PASSWORD });
  assert.equal(reg.stato, 201);
  await db.query("INSERT INTO consenso (utente_id, tipo, versione) VALUES ($1, 'condizioni_pt', $2)", [reg.json.id, VERSIONE_CONDIZIONI_PT]);

  const vuoto = await pt("GET", "/api/pt/titolare");
  assert.equal(vuoto.stato, 200); assert.equal(vuoto.json.completo, false);

  const cl = await pt("POST", "/api/clienti", { nome: "Anna", cognome: "Titolare" });
  assert.equal(cl.stato, 201);
  const bloccato = await pt("POST", `/api/clienti/${cl.json.id}/invito`);
  assert.equal(bloccato.stato, 409); assert.equal(bloccato.json.codice, "DATI_TITOLARE_MANCANTI");

  // dati incompleti o sbagliati: rifiutati
  assert.equal((await pt("PUT", "/api/pt/titolare", { nome: "Studio Prova", indirizzo: "", email: "a@b.it" })).stato, 400);
  // una lettera, un numero o la sola via non bastano: servono via e numero, CAP e città
  for (const indirizzo of ["x", "1", "Via Roma 1", "Via Roma 1, Torino", "Via Roma, 10121 Torino", "10121 Torino", "Via Roma 1, 10121"])
    assert.equal((await pt("PUT", "/api/pt/titolare", { nome: "Studio Prova", indirizzo, email: "a@b.it" })).stato, 400, indirizzo);
  assert.equal((await pt("PUT", "/api/pt/titolare", { nome: "S", indirizzo: "Via Roma 1, 10121 Torino", email: "a@b.it" })).stato, 400);
  assert.equal((await pt("PUT", "/api/pt/titolare", { nome: "Studio Prova", indirizzo: "Via Roma 1, 10121 Torino", email: "boh" })).stato, 400);
  const ok = await pt("PUT", "/api/pt/titolare", { nome: " Studio Prova ", indirizzo: "Via Roma 1, 10121 Torino", email: email("privacy").toUpperCase() });
  assert.equal(ok.stato, 200); assert.equal(ok.json.completo, true); assert.equal(ok.json.nome, "Studio Prova"); assert.equal(ok.json.email, email("privacy"));

  const inv = await pt("POST", `/api/clienti/${cl.json.id}/invito`);
  assert.equal(inv.stato, 201);

  // prima di registrarsi: l'informativa si legge con il codice dell'invito, senza accesso
  const anonimo = sessione(() => BASE);
  const t = await anonimo("GET", `/api/privacy/titolare?codice=${encodeURIComponent(inv.json.codice)}`);
  assert.equal(t.stato, 200); assert.deepEqual(t.json, { nome: "Studio Prova", indirizzo: "Via Roma 1, 10121 Torino", email: email("privacy") });
  assert.equal((await anonimo("GET", "/api/privacy/titolare?codice=sbagliato")).stato, 404);
  assert.equal((await anonimo("GET", "/api/privacy/titolare")).stato, 404);
  assert.equal((await anonimo("GET", "/api/me/titolare")).stato, 401);

  // dopo la registrazione: lo vede dal suo account (e il codice, ormai usato, non vale più)
  const cliente = sessione(() => BASE);
  const rc = await cliente("POST", "/api/auth/registra-cliente", { codice: inv.json.codice, email: email("tit-cliente"), password: PASSWORD, ...CONSENSO });
  assert.equal(rc.stato, 201);
  const mio = await cliente("GET", "/api/me/titolare");
  assert.equal(mio.stato, 200); assert.equal(mio.json.nome, "Studio Prova");
  assert.equal((await anonimo("GET", `/api/privacy/titolare?codice=${encodeURIComponent(inv.json.codice)}`)).stato, 404);
  // un PT non usa la rotta del cliente
  assert.equal((await pt("GET", "/api/me/titolare")).stato, 403);
});
