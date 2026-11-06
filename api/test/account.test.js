// Test dei diritti del cliente: scaricare i propri dati e cancellare il proprio account.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { CONSENSO, VERSIONE_INFORMATIVA, email, PASSWORD, avvia, sessione, creaPt, datiProva, pulisci, db } = require("./comune");   // per primo: legge .env
const { creaApp } = require("../app");

let server, BASE;
const S = () => sessione(() => BASE);
const pt1 = S(), pt2 = S(), anonimo = S();
const PW_CLIENTE = "PasswordCliente1";
const C = {};   // clienti di prova: { nome → { sessione, clienteId, utenteId, schedaId } }

// Crea un cliente del PT dato, con scheda, qualche progresso e la registrazione (con consenso)
async function nuovoCliente(ptSess, chiave, nome, cognome) {
  const cl = (await ptSess("POST", "/api/clienti", { nome, cognome })).json;
  const sch = (await ptSess("POST", `/api/clienti/${cl.id}/schede`, { dati: datiProva(nome, cognome) })).json.id;
  const codice = (await ptSess("POST", `/api/clienti/${cl.id}/invito`)).json.codice;
  const s = S();
  const reg = await s("POST", "/api/auth/registra-cliente", { ...CONSENSO, codice, email: email(chiave), password: PW_CLIENTE });
  assert.equal(reg.stato, 201);
  await s("PUT", `/api/schede/${sch}/registrazioni`, { voci: [{ tipo: "kg", chiave: "1|A|1", valore: `${chiave.length}0` }, { tipo: "fatto", chiave: "1|A|1", valore: "1" }] });
  C[chiave] = { s, clienteId: cl.id, utenteId: reg.json.id, schedaId: sch, nome, cognome };
  return C[chiave];
}
const conta = async (sql, par) => (await db.query(sql, par)).rows[0].n;
const tracce = async (c) => ({
  utente: await conta("SELECT count(*)::int n FROM utente WHERE id = $1", [c.utenteId]),
  cliente: await conta("SELECT count(*)::int n FROM cliente WHERE id = $1", [c.clienteId]),
  schede: await conta("SELECT count(*)::int n FROM scheda WHERE cliente_id = $1", [c.clienteId]),
  registrazioni: await conta("SELECT count(*)::int n FROM registrazione WHERE scheda_id = $1", [c.schedaId]),
  inviti: await conta("SELECT count(*)::int n FROM invito WHERE cliente_id = $1", [c.clienteId]),
  consensi: await conta("SELECT count(*)::int n FROM consenso WHERE utente_id = $1", [c.utenteId]),
});
const ZERO = { utente: 0, cliente: 0, schede: 0, registrazioni: 0, inviti: 0, consensi: 0 };

before(async () => {
  server = await avvia(creaApp({ limiteAccesso: 1000 }));
  BASE = `http://localhost:${server.address().port}`;
  await creaPt("pt-uno", "PT Uno"); await creaPt("pt-due", "PT Due");
  assert.equal((await pt1("POST", "/api/auth/login", { email: email("pt-uno"), password: PASSWORD })).stato, 200);
  assert.equal((await pt2("POST", "/api/auth/login", { email: email("pt-due"), password: PASSWORD })).stato, 200);
  await nuovoCliente(pt1, "anna", "Anna", "Prima");
  await nuovoCliente(pt1, "bruno", "Bruno", "Secondo");
  await nuovoCliente(pt2, "carla", "Carla", "Altrui");
  await nuovoCliente(pt1, "elia", "Elia", "Limite");
});
after(async () => {
  assert.equal(await pulisci(), 0);
  await new Promise((ok) => server.close(ok));
  await db.end();
});

// ---------- scaricare i miei dati ----------

test("«Scarica i miei dati»: contiene tutto ciò che riguarda me (anagrafica, schede, progressi, consensi con date) e nient'altro", async () => {
  const r = await C.anna.s("GET", "/api/me/esporta");
  assert.equal(r.stato, 200);
  assert.match(r.headers.get("content-disposition"), /attachment/);
  const d = r.json;
  assert.equal(d.cliente.nome, "Anna");
  assert.equal(d.cliente.cognome, "Prima");
  assert.equal(d.cliente.email, email("anna"));
  assert.equal(d.schede.length, 1);
  assert.equal(d.schede[0].id, C.anna.schedaId);
  assert.deepEqual(d.schede[0].registrazioni.map((x) => `${x.tipo}:${x.chiave}:${x.valore}`).sort(), ["fatto:1|A|1:1", "kg:1|A|1:40"]);
  assert.equal(d.consensi.length, 1);
  assert.equal(d.consensi[0].tipo, "informativa_cliente");
  assert.equal(d.consensi[0].versione, VERSIONE_INFORMATIVA);
  assert.ok(new Date(d.consensi[0].accettato_il).getTime() > Date.now() - 60000);
  assert.ok(d.esportato_il);

  // niente degli altri, niente di segreto
  const testo = r.testo;
  for (const altro of ["bruno", "elia", "carla"]) {
    assert.ok(!testo.includes(email(altro)), `ci sono dati di ${altro}`);
    assert.ok(!testo.includes(C[altro].cognome), `ci sono dati di ${altro}`);
  }
  assert.ok(!/password|hash|codice_hash|JWT/i.test(testo), "non devono comparire password, impronte o segreti");
});

test("l'esportazione del cliente e quella del professionista hanno la stessa forma (una sola logica)", async () => {
  const mia = (await C.bruno.s("GET", "/api/me/esporta")).json;
  const delPt = (await pt1("GET", `/api/clienti/${C.bruno.clienteId}/esporta`)).json;
  assert.deepEqual(Object.keys(mia).sort(), Object.keys(delPt).sort());
  assert.deepEqual(mia.cliente, delPt.cliente);
  assert.deepEqual(mia.schede, delPt.schede);
  assert.deepEqual(mia.consensi, delPt.consensi);
});

test("l'esportazione è solo per il cliente loggato", async () => {
  assert.equal((await anonimo("GET", "/api/me/esporta")).stato, 401);
  assert.equal((await pt1("GET", "/api/me/esporta")).stato, 403);
});

// ---------- cancellare il mio account ----------

test("cancellare l'account: serve la conferma e la password giusta; con quella sbagliata non si cancella niente", async () => {
  const c = C.anna;
  const prima = await tracce(c);
  assert.ok(prima.utente && prima.cliente && prima.schede && prima.registrazioni && prima.inviti && prima.consensi, "all'inizio c'è tutto");

  assert.equal((await c.s("DELETE", "/api/me/account", { password: PW_CLIENTE })).stato, 400, "senza conferma");
  assert.equal((await c.s("DELETE", "/api/me/account", { password: PW_CLIENTE, conferma: "true" })).stato, 400, "conferma non booleana");
  const errata = await c.s("DELETE", "/api/me/account", { password: "PasswordSbagliata", conferma: true });
  assert.equal(errata.stato, 403);
  assert.equal(errata.json.codice, "PASSWORD_ERRATA");
  assert.equal((await c.s("DELETE", "/api/me/account", { conferma: true })).stato, 403, "senza password");
  assert.deepEqual(await tracce(c), prima, "dopo i tentativi sbagliati non è cambiato niente");
  assert.equal((await c.s("GET", "/api/me/scheda")).stato, 200, "e la sessione vale ancora");
});

test("cancellare l'account: sparisce tutto, il vecchio cookie non vale più, gli altri non sono toccati", async () => {
  const c = C.anna;
  const cookieVecchio = c.s.cookie();
  const bruno = await tracce(C.bruno), carla = await tracce(C.carla);
  const contiPt = await conta("SELECT count(*)::int n FROM cliente WHERE pt_id IN (SELECT id FROM pt WHERE utente_id = (SELECT id FROM utente WHERE email = $1))", [email("pt-uno")]);

  const r = await c.s("DELETE", "/api/me/account", { password: PW_CLIENTE, conferma: true });
  assert.equal(r.stato, 204);
  assert.equal(c.s.cookie(), null, "il cookie viene tolto");
  assert.deepEqual(await tracce(c), ZERO, "non resta nulla nel database: utente, cliente, schede, progressi, inviti, consensi");

  // il cookie vecchio (con la firma ancora valida) non apre più niente
  const vecchio = async (percorso) => (await fetch(BASE + percorso, { headers: { Cookie: cookieVecchio } })).status;
  assert.equal(await vecchio("/api/me/scheda"), 401);
  assert.equal(await vecchio("/api/auth/me"), 401);
  assert.equal(await vecchio("/api/me/esporta"), 401);
  assert.equal((await anonimo("POST", "/api/auth/login", { email: email("anna"), password: PW_CLIENTE })).stato, 401, "nemmeno con la password si rientra");

  // gli altri sono intatti
  assert.deepEqual(await tracce(C.bruno), bruno);
  assert.deepEqual(await tracce(C.carla), carla);
  assert.equal((await C.bruno.s("GET", "/api/me/scheda")).stato, 200);
  assert.equal(await conta("SELECT count(*)::int n FROM cliente WHERE pt_id IN (SELECT id FROM pt WHERE utente_id = (SELECT id FROM utente WHERE email = $1))", [email("pt-uno")]), contiPt - 1,
    "al professionista manca solo quel cliente");
  assert.ok(!(await pt1("GET", "/api/clienti")).json.some((x) => x.id === C.anna.clienteId), "il professionista non lo vede più");
  assert.equal((await pt1("GET", `/api/clienti/${C.anna.clienteId}`)).stato, 404);
});

test("la cancellazione fatta dal professionista toglie anche i consensi del cliente (stessa logica)", async () => {
  const c = C.bruno;
  assert.equal(await conta("SELECT count(*)::int n FROM consenso WHERE utente_id = $1", [c.utenteId]), 1);
  assert.equal((await pt1("DELETE", `/api/clienti/${c.clienteId}`)).stato, 204);
  assert.deepEqual(await tracce(c), ZERO);
  assert.equal((await pt2("DELETE", `/api/clienti/${C.carla.clienteId}`)).stato, 204);
  assert.deepEqual(await tracce(C.carla), ZERO);
});

test("la riconferma della password ha un limite: 5 tentativi sbagliati, poi 429 (anche con la password giusta); per utente", async () => {
  const c = C.elia;
  for (let i = 1; i <= 5; i++) {
    const r = await c.s("DELETE", "/api/me/account", { password: `sbagliata-${i}`, conferma: true });
    assert.equal(r.stato, 403, `tentativo ${i}`);
  }
  const bloccato = await c.s("DELETE", "/api/me/account", { password: PW_CLIENTE, conferma: true });
  assert.equal(bloccato.stato, 429);
  assert.equal(await conta("SELECT count(*)::int n FROM utente WHERE id = $1", [c.utenteId]), 1, "bloccato: l'account c'è ancora");
  assert.equal((await c.s("GET", "/api/me/scheda")).stato, 200, "il resto del sito funziona");
  assert.equal((await c.s("GET", "/api/me/esporta")).stato, 200, "e scaricare i dati resta possibile");
});

test("le pagine dell'account esistono, sono accessibili e collegate dalla scheda", async () => {
  const fs = require("node:fs"), path = require("node:path");
  const web = path.join(__dirname, "..", "..", "web");
  for (const f of ["account.html", "account-cancellato.html"]) assert.equal((await fetch(`${BASE}/${f}`)).status, 200, f);
  const html = fs.readFileSync(path.join(web, "account.html"), "utf8");
  for (const id of ["esporta", "password", "conferma", "cancella"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /<label[^>]*for="password"/);
  assert.match(html, /autocomplete="current-password"/);
  assert.match(fs.readFileSync(path.join(web, "scheda-server.js"), "utf8"), /\/account\.html/);
});
