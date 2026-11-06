// Test dei rischi chiusi nel backend (sessione legata al database, crea-pt, CSP in sviluppo/produzione)
// e delle rotte per l'area del PT (elenco arricchito, GET /clienti/:id).

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const { CONSENSO, email, PASSWORD, avvia, sessione, creaPt, datiProva, pulisci, db } = require("./comune");   // per primo: legge .env
const { creaApp } = require("../app");

let server, BASE;
const A = sessione(() => BASE), B = sessione(() => BASE), cliente = sessione(() => BASE), anonimo = sessione(() => BASE);
const S = {};   // id creati durante i test

before(async () => {
  server = await avvia(creaApp({ limiteAccesso: 1000 }));
  BASE = `http://localhost:${server.address().port}`;
  S.a = await creaPt("pt-a", "PT A");
  S.b = await creaPt("pt-b", "PT B");
  assert.equal((await A("POST", "/api/auth/login", { email: email("pt-a"), password: PASSWORD })).stato, 200);
  assert.equal((await B("POST", "/api/auth/login", { email: email("pt-b"), password: PASSWORD })).stato, 200);
});
after(async () => {
  assert.equal(await pulisci(), 0, "la pulizia finale deve togliere tutti gli utenti di test");
  await new Promise((ok) => server.close(ok));
  await db.end();
});

// ---------- il cookie vale solo finché l'utente esiste ----------

test("dopo la cancellazione dell'utente il vecchio cookie non vale più (401), e il ruolo è quello del database", async () => {
  const t = sessione(() => BASE);
  const nuovo = await creaPt("pt-temporaneo", "PT temporaneo");
  assert.equal((await t("POST", "/api/auth/login", { email: email("pt-temporaneo"), password: PASSWORD })).stato, 200);
  assert.equal((await t("GET", "/api/clienti")).stato, 200);

  // il ruolo cambia nel database: vale subito quello nuovo, anche se il "pass" dice ancora "pt"
  await db.query("UPDATE utente SET ruolo = 'cliente' WHERE id = $1", [nuovo.utenteId]);
  assert.equal((await t("GET", "/api/clienti")).stato, 403);
  await db.query("UPDATE utente SET ruolo = 'pt' WHERE id = $1", [nuovo.utenteId]);
  assert.equal((await t("GET", "/api/clienti")).stato, 200);

  // l'utente viene cancellato: il cookie (firma ancora valida) non apre più niente
  await db.query("DELETE FROM utente WHERE id = $1", [nuovo.utenteId]);
  for (const [metodo, percorso] of [["GET", "/api/clienti"], ["GET", "/api/auth/me"], ["POST", "/api/clienti"], ["GET", "/api/me/scheda"], ["PUT", "/api/schede/1/registrazioni"]]) {
    assert.equal((await t(metodo, percorso, metodo === "GET" ? undefined : {})).stato, 401, `${metodo} ${percorso}`);
  }
});

test("un cliente cancellato non entra più con il vecchio cookie (401, non 404)", async () => {
  const c = (await A("POST", "/api/clienti", { nome: "Da", cognome: "Cancellare" })).json;
  await A("POST", `/api/clienti/${c.id}/schede`, { dati: datiProva("Da", "Cancellare") });
  const codice = (await A("POST", `/api/clienti/${c.id}/invito`)).json.codice;
  const k = sessione(() => BASE);
  assert.equal((await k("POST", "/api/auth/registra-cliente", { ...CONSENSO, codice, email: email("cliente-cancellato"), password: "PasswordCliente1" })).stato, 201);
  assert.equal((await k("GET", "/api/me/scheda")).stato, 200);
  assert.equal((await A("DELETE", `/api/clienti/${c.id}`)).stato, 204);
  assert.equal((await k("GET", "/api/me/scheda")).stato, 401);
});

// ---------- CSP: sviluppo e produzione ----------

test("CSP: in sviluppo senza «upgrade-insecure-requests», in produzione con; tutto il resto identico", async () => {
  const intestazione = async (produzione) => {
    const s = await avvia(creaApp({ produzione }));
    try {
      const r = await fetch(`http://localhost:${s.address().port}/login.html`);
      await r.arrayBuffer();
      return r.headers.get("content-security-policy");
    } finally { await new Promise((ok) => s.close(ok)); }
  };
  const sviluppo = await intestazione(false);
  const produzione = await intestazione(true);

  assert.doesNotMatch(sviluppo, /upgrade-insecure-requests/);
  assert.match(produzione, /upgrade-insecure-requests/);
  // a parte quella direttiva, le due regole sono uguali, parola per parola
  const senza = (csp) => csp.split(";").map((x) => x.trim()).filter((x) => x && x !== "upgrade-insecure-requests").sort().join(";");
  assert.equal(senza(sviluppo), senza(produzione));
  for (const csp of [sviluppo, produzione]) {
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /script-src 'self'(;|$)/);
    assert.match(csp, /script-src-attr 'none'/);
    assert.match(csp, /object-src 'none'/);
    assert.doesNotMatch(csp, /unsafe-eval|script-src[^;]*unsafe-inline/);
  }
});

test("senza indicazioni, la modalità segue NODE_ENV", async () => {
  const prima = process.env.NODE_ENV;
  try {
    for (const [valore, attesa] of [["production", true], ["development", false], [undefined, false]]) {
      if (valore === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = valore;
      const s = await avvia(creaApp());
      const r = await fetch(`http://localhost:${s.address().port}/login.html`);
      await r.arrayBuffer();
      await new Promise((ok) => s.close(ok));
      assert.equal(/upgrade-insecure-requests/.test(r.headers.get("content-security-policy")), attesa, `NODE_ENV=${valore}`);
    }
  } finally { if (prima === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = prima; }
});

// ---------- crea-pt.js ----------

test("crea-pt.js: rifiuta email e password non valide senza creare nulla; accetta quelle buone", async () => {
  const script = path.join(__dirname, "..", "crea-pt.js");
  // si contano solo gli indirizzi di QUESTO test: gli altri file girano in parallelo e creano utenti per conto loro
  const conta = async () => (await db.query("SELECT count(*)::int AS n FROM utente WHERE email = ANY($1)", [[email("cli"), "non-una-email"]])).rows[0].n;
  const lancia = (...args) => {
    try { return { codice: 0, uscita: execFileSync("node", [script, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) }; }
    catch (e) { return { codice: e.status, uscita: String(e.stdout) + String(e.stderr) }; }
  };
  const prima = await conta();
  const lunga = "x".repeat(73);
  const casi = [
    [["non-una-email", PASSWORD, "Nome"], /email non sembra valida/],
    [[email("cli"), "corta", "Nome"], /troppo corta/],
    [[email("cli"), "x".repeat(9), "Nome"], /troppo corta/],
    [[email("cli"), lunga, "Nome"], /troppo lunga/],
    [[email("cli"), "è".repeat(40), "Nome"], /troppo lunga/],   // 40 lettere ma 80 byte: bcrypt ne legge solo 72
    [[email("cli"), PASSWORD, "   "], /Uso:|nome non può essere vuoto/],
    [[email("cli"), PASSWORD, "N".repeat(101)], /troppo lungo/],
  ];
  for (const [args, atteso] of casi) {
    const r = lancia(...args);
    assert.equal(r.codice, 1, JSON.stringify(args).slice(0, 60));
    assert.match(r.uscita, atteso);
  }
  assert.equal(await conta(), prima, "nessun account creato dai casi sbagliati");

  const buono = lancia(` ${email("pt-cli").toUpperCase()} `, "x".repeat(10), "PT da riga di comando");
  assert.equal(buono.codice, 0, buono.uscita);
  const r = await db.query("SELECT email, ruolo FROM utente WHERE email = $1", [email("pt-cli")]);
  assert.equal(r.rows[0].ruolo, "pt", "email salvata minuscola e senza spazi");
  assert.equal(lancia(email("pt-cli"), PASSWORD, "Doppione").codice, 1, "la stessa email due volte: rifiutata");
  assert.match(lancia(email("pt-cli"), PASSWORD, "Doppione").uscita, /Esiste già un account/);
});

// ---------- elenco arricchito e GET /api/clienti/:id ----------

test("elenco clienti: un cliente nuovo parte da zero in ogni campo", async () => {
  const c = (await A("POST", "/api/clienti", { nome: "Elena", cognome: "Bianchi" })).json;
  S.cliente = c.id;
  const elenco = (await A("GET", "/api/clienti")).json;
  const mio = elenco.find((x) => x.id === c.id);
  assert.deepEqual({ ...mio, creato_il: typeof mio.creato_il }, {
    id: c.id, nome: "Elena", cognome: "Bianchi", creato_il: "string", registrato: false, schede: 0,
    scheda_recente_id: null, ultimo_progresso: null, invito_scade_il: null, invito_attivo: false,
  });
});

test("elenco clienti e GET /:id: schede, scheda più recente, invito, registrazione, ultimo progresso", async () => {
  const id = S.cliente;
  const stato = async () => {
    const [dalla_lista] = [(await A("GET", "/api/clienti")).json.find((x) => x.id === id)];
    const singolo = (await A("GET", `/api/clienti/${id}`)).json;
    assert.deepEqual(singolo, dalla_lista, "la pagina del cliente e l'elenco dicono la stessa cosa");
    return singolo;
  };

  const s1 = (await A("POST", `/api/clienti/${id}/schede`, { dati: datiProva("Elena", "Bianchi") })).json.id;
  let st = await stato();
  assert.equal(st.schede, 1); assert.equal(st.scheda_recente_id, s1);
  const s2 = (await A("POST", `/api/clienti/${id}/schede`, { dati: datiProva("Elena", "Bianchi") })).json.id;
  st = await stato();
  assert.equal(st.schede, 2); assert.equal(st.scheda_recente_id, s2, "la più recente è l'ultima caricata");
  S.scheda = s2;

  // invito: attivo, con scadenza a 7 giorni; un secondo invito sostituisce il primo
  const inv = (await A("POST", `/api/clienti/${id}/invito`)).json;
  st = await stato();
  assert.equal(st.invito_attivo, true);
  assert.equal(new Date(st.invito_scade_il).getTime(), new Date(inv.scade_il).getTime());
  assert.equal(st.registrato, false);
  await db.query("UPDATE invito SET scade_il = now() - interval '1 minute' WHERE cliente_id = $1", [id]);
  st = await stato();
  assert.equal(st.invito_attivo, false, "un invito scaduto non è più attivo");
  assert.equal(st.invito_scade_il, null);

  // registrazione del cliente
  const codice = (await A("POST", `/api/clienti/${id}/invito`)).json.codice;
  assert.equal((await cliente("POST", "/api/auth/registra-cliente", { ...CONSENSO, codice, email: email("elena"), password: "PasswordCliente1" })).stato, 201);
  st = await stato();
  assert.equal(st.registrato, true);
  assert.equal(st.invito_attivo, false, "invito usato: non è più attivo");
  assert.equal(st.ultimo_progresso, null, "nessun progresso ancora");

  // progressi: la data dell'ultimo salvataggio
  const prima = Date.now();
  assert.equal((await cliente("PUT", `/api/schede/${s2}/registrazioni`, { voci: [{ tipo: "kg", chiave: "1|A|1", valore: "40" }] })).stato, 200);
  st = await stato();
  assert.ok(Math.abs(new Date(st.ultimo_progresso).getTime() - prima) < 15000, "data dell'ultimo salvataggio ≈ adesso");
  assert.equal((await A("GET", `/api/schede/${s1}/registrazioni`)).json.length, 0, "i progressi sono sulla scheda 2");
});

test("l'isolamento tra PT: elenco e pagina del cliente (404, non 403)", async () => {
  const elencoB = (await B("GET", "/api/clienti")).json;
  assert.ok(!elencoB.some((x) => x.id === S.cliente), "B non vede i clienti di A");
  const bc = (await B("POST", "/api/clienti", { nome: "Bruno", cognome: "Neri" })).json;
  assert.ok((await A("GET", "/api/clienti")).json.every((x) => x.id !== bc.id), "A non vede quelli di B");

  assert.equal((await B("GET", `/api/clienti/${S.cliente}`)).stato, 404);
  assert.equal((await A("GET", `/api/clienti/${bc.id}`)).stato, 404);
  for (const id of ["999999999", "0", "-1", "abc", "1.5", "1e3", "'", "1%20OR%201=1"]) {
    assert.equal((await A("GET", `/api/clienti/${id}`)).stato, 404, id);
  }
  // le informazioni riservate non sono comparse nelle risposte
  const mio = (await A("GET", `/api/clienti/${S.cliente}`)).json;
  assert.equal(JSON.stringify(mio).includes("password"), false);
  assert.equal(JSON.stringify(mio).includes("hash"), false);
});

test("GET /api/clienti/:id: il cliente riceve 403, chi non è loggato 401", async () => {
  assert.equal((await cliente("GET", `/api/clienti/${S.cliente}`)).stato, 403);
  assert.equal((await cliente("GET", "/api/clienti")).stato, 403);
  assert.equal((await anonimo("GET", `/api/clienti/${S.cliente}`)).stato, 401);
  assert.equal((await anonimo("GET", "/api/clienti")).stato, 401);
});

test("l'elenco è ordinato per cognome e nome", async () => {
  await A("POST", "/api/clienti", { nome: "Zoe", cognome: "Abati" });
  await A("POST", "/api/clienti", { nome: "Aldo", cognome: "Abati" });
  const nomi = (await A("GET", "/api/clienti")).json.map((c) => `${c.cognome} ${c.nome}`);
  assert.deepEqual(nomi, [...nomi].sort((x, y) => x.localeCompare(y, "it")));
  assert.ok(nomi.indexOf("Abati Aldo") < nomi.indexOf("Abati Zoe"));
});
