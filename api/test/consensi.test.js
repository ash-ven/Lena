// Test dei consensi: l'informativa per i clienti e le condizioni d'uso per i professionisti.
const fs = require("node:fs");
const path = require("node:path");
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { CONSENSO, VERSIONE_INFORMATIVA, VERSIONE_CONDIZIONI_PT, email, PASSWORD, avvia, sessione, creaPt, datiProva, pulisci, db } = require("./comune");   // per primo: legge .env
const { creaApp } = require("../app");

let server, BASE;
const S = (n) => sessione(() => BASE);
const ptOk = S(), ptNuovo = S(), anonimo = S(), cliente = S();

before(async () => {
  server = await avvia(creaApp({ limiteAccesso: 1000 }));
  BASE = `http://localhost:${server.address().port}`;
  await creaPt("pt-ok", "PT che ha accettato", true);
  await creaPt("pt-nuovo", "PT al primo accesso", false);
  for (const [s, n] of [[ptOk, "pt-ok"], [ptNuovo, "pt-nuovo"]]) assert.equal((await s("POST", "/api/auth/login", { email: email(n), password: PASSWORD })).stato, 200);
});
after(async () => {
  assert.equal(await pulisci(), 0);
  await new Promise((ok) => server.close(ok));
  await db.end();
});

const righeConsensi = async (emailUtente) => (await db.query(
  "SELECT c.tipo, c.versione, c.accettato_il FROM consenso c JOIN utente u ON u.id = c.utente_id WHERE u.email = $1 ORDER BY c.id", [emailUtente])).rows;

// ---------- le versioni stanno in un posto solo ----------

test("le versioni correnti sono pubbliche e vengono da api/config.js (e da nessun altro file)", async () => {
  const r = await anonimo("GET", "/api/privacy/versioni");
  assert.equal(r.stato, 200);
  assert.deepEqual(r.json, { informativa_cliente: VERSIONE_INFORMATIVA, condizioni_pt: VERSIONE_CONDIZIONI_PT });
  // la stringa della versione non deve comparire scritta in altri file del sito o del server: cambiarla in config.js basta
  const cartelle = [path.join(__dirname, ".."), path.join(__dirname, "..", "..", "web")];
  for (const dir of cartelle) {
    for (const f of fs.readdirSync(dir).filter((x) => /\.(js|html)$/.test(x))) {
      if (f === "config.js") continue;
      assert.ok(!fs.readFileSync(path.join(dir, f), "utf8").includes(VERSIONE_INFORMATIVA), `${f} contiene la versione scritta a mano`);
    }
  }
});

// ---------- registrazione del cliente ----------

test("registrazione senza consenso (assente, false, testo, versione sbagliata): rifiutata, e non nasce niente", async () => {
  const c = (await ptOk("POST", "/api/clienti", { nome: "Ada", cognome: "Consenso" })).json;
  const codice = (await ptOk("POST", `/api/clienti/${c.id}/invito`)).json.codice;
  const mail = email("ada");
  const base = { codice, email: mail, password: "PasswordCliente1" };
  const casi = [
    [{ ...base }, "CONSENSO_MANCANTE"],
    [{ ...base, accettaInformativa: false, versioneInformativa: VERSIONE_INFORMATIVA }, "CONSENSO_MANCANTE"],
    [{ ...base, accettaInformativa: "true", versioneInformativa: VERSIONE_INFORMATIVA }, "CONSENSO_MANCANTE"],
    [{ ...base, accettaInformativa: 1, versioneInformativa: VERSIONE_INFORMATIVA }, "CONSENSO_MANCANTE"],
    [{ ...base, accettaInformativa: true }, "VERSIONE_INFORMATIVA_CAMBIATA"],
    [{ ...base, accettaInformativa: true, versioneInformativa: "una-versione-vecchia" }, "VERSIONE_INFORMATIVA_CAMBIATA"],
  ];
  for (const [corpo, codiceAtteso] of casi) {
    const r = await anonimo("POST", "/api/auth/registra-cliente", corpo);
    assert.equal(r.stato, 400, JSON.stringify(corpo).slice(0, 80));
    assert.equal(r.json.codice, codiceAtteso);
    assert.equal(anonimo.cookie(), null, "nessun accesso concesso");
  }
  assert.equal((await db.query("SELECT count(*)::int n FROM utente WHERE email = $1", [mail])).rows[0].n, 0, "nessun account creato");
  assert.equal((await db.query("SELECT count(*)::int n FROM invito WHERE cliente_id = $1 AND usato_il IS NULL", [c.id])).rows[0].n, 1, "l'invito non è stato consumato");

  // con il consenso, lo stesso invito funziona e il consenso è salvato con versione e data
  const prima = Date.now();
  const ok = await cliente("POST", "/api/auth/registra-cliente", { ...base, ...CONSENSO });
  assert.equal(ok.stato, 201);
  const righe = await righeConsensi(mail);
  assert.equal(righe.length, 1);
  assert.equal(righe[0].tipo, "informativa_cliente");
  assert.equal(righe[0].versione, VERSIONE_INFORMATIVA);
  assert.ok(Math.abs(new Date(righe[0].accettato_il).getTime() - prima) < 15000, "data di accettazione ≈ adesso");
});

test("il consenso sta nella stessa transazione della registrazione: se la registrazione fallisce non resta nessun consenso", async () => {
  const c = (await ptOk("POST", "/api/clienti", { nome: "Bea", cognome: "Doppione" })).json;
  const codice = (await ptOk("POST", `/api/clienti/${c.id}/invito`)).json.codice;
  const prima = (await db.query("SELECT count(*)::int n FROM consenso")).rows[0].n;
  // l'email esiste già (quella del PT): 409, e il numero di consensi non cambia
  const r = await anonimo("POST", "/api/auth/registra-cliente", { codice, email: email("pt-ok"), password: "PasswordCliente1", ...CONSENSO });
  assert.equal(r.stato, 409);
  // anche un invito sbagliato non lascia consensi
  const r2 = await anonimo("POST", "/api/auth/registra-cliente", { codice: "inventato", email: email("bea"), password: "PasswordCliente1", ...CONSENSO });
  assert.equal(r2.stato, 400);
  assert.equal((await db.query("SELECT count(*)::int n FROM consenso")).rows[0].n, prima + 0, "nessun consenso in più");
});

test("lo stesso consenso non si duplica (vincolo utente + tipo + versione)", async () => {
  const u = (await db.query("SELECT id FROM utente WHERE email = $1", [email("ada")])).rows[0].id;
  await assert.rejects(() => db.query("INSERT INTO consenso (utente_id, tipo, versione) VALUES ($1, 'informativa_cliente', $2)", [u, VERSIONE_INFORMATIVA]), /duplicate key|unique/i);
  await assert.rejects(() => db.query("INSERT INTO consenso (utente_id, tipo, versione) VALUES ($1, 'tipo_inventato', 'x')", [u]), /check/i, "il tipo è limitato a quelli previsti");
});

// ---------- condizioni d'uso del professionista ----------

test("un PT che non ha accettato le condizioni è bloccato (403 con codice) su tutte le rotte dell'area, ma può entrare e leggere il suo stato", async () => {
  assert.equal((await ptNuovo("GET", "/api/auth/me")).stato, 200, "il login e /me funzionano");
  const bloccate = [
    ["GET", "/api/clienti"], ["POST", "/api/clienti", { nome: "A", cognome: "B" }], ["GET", "/api/clienti/1"], ["GET", "/api/clienti/1/schede"],
    ["POST", "/api/clienti/1/invito"], ["POST", "/api/clienti/1/schede", { dati: {} }], ["GET", "/api/clienti/1/esporta"], ["DELETE", "/api/clienti/1"],
    ["GET", "/api/schede/1"], ["GET", "/api/schede/1/registrazioni"],
  ];
  for (const [metodo, percorso, corpo] of bloccate) {
    const r = await ptNuovo(metodo, percorso, corpo);
    assert.equal(r.stato, 403, `${metodo} ${percorso}`);
    assert.equal(r.json.codice, "CONDIZIONI_DA_ACCETTARE");
  }
  const st = await ptNuovo("GET", "/api/privacy/condizioni-pt");
  assert.deepEqual(st.json, { versione: VERSIONE_CONDIZIONI_PT, accettate: false });
  assert.equal((await ptOk("GET", "/api/clienti")).stato, 200, "chi ha accettato non è toccato");
});

test("accettare le condizioni: versione sbagliata rifiutata, versione giusta sblocca, ripetere non duplica", async () => {
  assert.equal((await ptNuovo("POST", "/api/privacy/condizioni-pt", {})).stato, 409);
  const vecchia = await ptNuovo("POST", "/api/privacy/condizioni-pt", { versione: "una-versione-vecchia" });
  assert.equal(vecchia.stato, 409);
  assert.equal(vecchia.json.codice, "VERSIONE_CAMBIATA");
  assert.equal((await ptNuovo("GET", "/api/clienti")).stato, 403, "ancora bloccato");

  const ok = await ptNuovo("POST", "/api/privacy/condizioni-pt", { versione: VERSIONE_CONDIZIONI_PT });
  assert.equal(ok.stato, 200);
  assert.deepEqual(ok.json, { versione: VERSIONE_CONDIZIONI_PT, accettate: true });
  assert.equal((await ptNuovo("GET", "/api/clienti")).stato, 200, "sbloccato");
  assert.equal((await ptNuovo("POST", "/api/privacy/condizioni-pt", { versione: VERSIONE_CONDIZIONI_PT })).stato, 200);
  const righe = await righeConsensi(email("pt-nuovo"));
  assert.equal(righe.length, 1);
  assert.deepEqual([righe[0].tipo, righe[0].versione], ["condizioni_pt", VERSIONE_CONDIZIONI_PT]);
});

test("nuova versione delle condizioni = riaccettazione obbligatoria", async () => {
  // si simula il passaggio di versione: nel database risulta accettata solo una versione precedente
  await db.query("UPDATE consenso SET versione = 'versione-precedente' WHERE utente_id = (SELECT id FROM utente WHERE email = $1) AND tipo = 'condizioni_pt'", [email("pt-ok")]);
  const r = await ptOk("GET", "/api/clienti");
  assert.equal(r.stato, 403);
  assert.equal(r.json.codice, "CONDIZIONI_DA_ACCETTARE");
  assert.equal((await ptOk("GET", "/api/privacy/condizioni-pt")).json.accettate, false);
  assert.equal((await ptOk("POST", "/api/privacy/condizioni-pt", { versione: VERSIONE_CONDIZIONI_PT })).stato, 200);
  assert.equal((await ptOk("GET", "/api/clienti")).stato, 200);
  assert.equal((await righeConsensi(email("pt-ok"))).length, 2, "resta anche la traccia della versione precedente");
});

test("un cliente o chi non è loggato non può accettare le condizioni; le rotte del cliente non sono toccate dalle condizioni del PT", async () => {
  assert.equal((await cliente("GET", "/api/privacy/condizioni-pt")).stato, 403);
  assert.equal((await cliente("POST", "/api/privacy/condizioni-pt", { versione: VERSIONE_CONDIZIONI_PT })).stato, 403);
  assert.equal((await anonimo("GET", "/api/privacy/condizioni-pt")).stato, 401);
  assert.equal((await anonimo("POST", "/api/privacy/condizioni-pt", { versione: VERSIONE_CONDIZIONI_PT })).stato, 401);
  // il cliente "Ada" (registrata prima) può leggere la sua scheda senza aver accettato niente come PT
  const c = (await ptOk("GET", "/api/clienti")).json.find((x) => x.cognome === "Consenso");
  await ptOk("POST", `/api/clienti/${c.id}/schede`, { dati: datiProva("Ada", "Consenso") });
  assert.equal((await cliente("GET", "/api/me/scheda")).stato, 200);
});

test("le pagine: la registrazione ha la casella e il link all'informativa; la schermata delle condizioni esiste", async () => {
  const reg = await (await fetch(BASE + "/registrati.html")).text();
  assert.match(reg, /id="accetta"/);
  assert.match(reg, /href="\/privacy\.html"/);
  for (const url of ["/privacy.html", "/condizioni-pt.html"]) assert.equal((await fetch(BASE + url)).status, 200, url);
  const js = fs.readFileSync(path.join(__dirname, "..", "..", "web", "registrati.js"), "utf8");
  assert.match(js, /accettaInformativa: true/);
});
