// I log del server non devono MAI contenere dati personali: corpi delle richieste, email, password, dati delle schede,
// parti dell'indirizzo dopo il «?», cookie. Il test avvia un server vero, gli manda richieste piene di "marcatori"
// (parole inventate e riconoscibili) e controlla che nei log non compaia neanche uno.
const path = require("node:path");
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { CONSENSO, email, PASSWORD, sessione, creaPt, datiProva, pulisci, db } = require("./comune");   // per primo: legge .env

const API = path.join(__dirname, "..");
const marcatore = (nome) => `MARCATORE${nome}${Date.now().toString(36)}`;
const M = {
  password: marcatore("PASSWORD"), emailNuova: `${marcatore("EMAIL").toLowerCase()}.${require("./comune").RUN}@test.lena`.replace("marcatore", "marcatore"),
  titolo: marcatore("TITOLO"), valore: marcatore("VALORE"), query: marcatore("QUERY"), corpo: marcatore("CORPO"),
  nomeCliente: marcatore("NOMECLIENTE"), segretoDb: marcatore("SEGRETODB"),
};

// Avvia un server vero su una porta libera e ne raccoglie TUTTO ciò che scrive
function avviaServer(env = {}) {
  return new Promise((ok, no) => {
    const porta = 3100 + Math.floor(Math.random() * 800);
    const figlio = spawn("node", ["server.js"], { cwd: API, env: { ...process.env, PORT: String(porta), ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let log = "";
    figlio.stdout.on("data", (d) => { log += d; });
    figlio.stderr.on("data", (d) => { log += d; });
    const t0 = Date.now();
    const attesa = setInterval(async () => {
      if (Date.now() - t0 > 15000) { clearInterval(attesa); figlio.kill(); return no(new Error("il server non è partito: " + log)); }
      try { await fetch(`http://localhost:${porta}/api/salute`); clearInterval(attesa); ok({ porta, log: () => log, ferma: () => new Promise((f) => { figlio.once("exit", f); figlio.kill(); }) }); } catch (e) { /* non ancora pronto */ }
    }, 200);
  });
}
const nessunMarcatore = (log, quali = Object.values(M)) => {
  for (const m of quali) assert.ok(!log.includes(m), `nei log compare «${m}»:\n${log.slice(-1500)}`);
  assert.ok(!/eyJ[A-Za-z0-9_-]{10,}\./.test(log), "nei log compare un token di sessione");
  assert.ok(!/lena_sessione/.test(log), "nei log compare il cookie di sessione");
};

after(async () => { await pulisci().catch(() => {}); await db.end(); });

test("server normale: richieste con dati personali, errori di lettura e errori del database → nessun dato nei log", async () => {
  await creaPt("pt-log", "PT log");
  const srv = await avviaServer();
  try {
    const base = `http://localhost:${srv.porta}`;
    const pt = sessione(() => base);
    assert.equal((await pt("POST", "/api/auth/login", { email: email("pt-log"), password: PASSWORD })).stato, 200);
    // flusso normale con marcatori ovunque
    const c = (await pt("POST", "/api/clienti", { nome: M.nomeCliente, cognome: "Log" })).json;
    const dati = datiProva("Log", "Prova"); dati.info.titolo = M.titolo;
    const sid = (await pt("POST", `/api/clienti/${c.id}/schede`, { dati })).json.id;
    const codice = (await pt("POST", `/api/clienti/${c.id}/invito`)).json.codice;
    const cl = sessione(() => base);
    assert.equal((await cl("POST", "/api/auth/registra-cliente", { ...CONSENSO, codice, email: M.emailNuova, password: M.password })).stato, 201);
    assert.equal((await cl("PUT", `/api/schede/${sid}/registrazioni`, { voci: [{ tipo: "kg", chiave: "1|A|1", valore: M.valore.slice(0, 40) }] })).stato, 200);
    await cl("POST", "/api/auth/login", { email: M.emailNuova, password: "sbagliata-" + M.password });
    await fetch(`${base}/api/me/scheda?token=${M.query}&email=${M.emailNuova}`, { headers: { Cookie: cl.cookie() } });

    // corpo non valido (JSON rotto che contiene un marcatore): l'errore di lettura porta con sé il testo ricevuto
    const rotto = await fetch(`${base}/api/auth/login?x=${M.query}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: `{"email":"a@b.it","password":"${M.corpo}"` });
    assert.equal(rotto.status, 400);
    // errore del database (il carattere nullo non è ammesso nei testi): il messaggio dell'errore può contenere il valore
    const nullo = await cl("PUT", `/api/schede/${sid}/registrazioni`, { voci: [{ tipo: "kg", chiave: "1|A|1", valore: `${M.valore}\u0000` }] });
    assert.ok([400, 500].includes(nullo.stato));
    const nullo2 = await pt("POST", "/api/clienti", { nome: `${M.nomeCliente}\u0000`, cognome: "x" });
    assert.ok([400, 500].includes(nullo2.stato), String(nullo2.stato));
    // corpo troppo grande
    const grande = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "a@b.it", password: M.corpo + "x".repeat(1.2 * 1024 * 1024) }) });
    assert.equal(grande.status, 413);
    await new Promise((ok) => setTimeout(ok, 300));

    const log = srv.log();
    assert.match(log, /API Lena su http/, "il server ha scritto almeno la riga di avvio");
    nessunMarcatore(log);
    assert.ok(!log.includes(M.emailNuova.split("@")[0]), "nei log compare l'email");
    assert.ok(!/postgres:\/\/[^\s]*:[^\s@]+@/.test(log), "nei log compare l'indirizzo del database con la password");
  } finally { await srv.ferma(); }
});

test("database non raggiungibile: l'errore si registra senza dati della richiesta né della configurazione", async () => {
  const srv = await avviaServer({ DATABASE_URL: `postgres://utente:${M.segretoDb}@localhost:1/lena` });
  try {
    const base = `http://localhost:${srv.porta}`;
    const r = await fetch(`${base}/api/auth/login?x=${M.query}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: M.emailNuova, password: M.password }) });
    assert.equal(r.status, 500);
    assert.deepEqual(await r.json(), { errore: "Errore del server" });
    await fetch(`${base}/api/salute`);
    await new Promise((ok) => setTimeout(ok, 300));
    const log = srv.log();
    assert.match(log, /\[errore\]/, "l'errore viene comunque registrato, così chi gestisce il server lo vede");
    nessunMarcatore(log);
  } finally { await srv.ferma(); }
});

test("nel codice del server nessuna istruzione di log stampa corpi, intestazioni, cookie o l'indirizzo completo", () => {
  for (const f of fs.readdirSync(API).filter((x) => x.endsWith(".js"))) {
    if (/^(crea-|carica-|pulizia)/.test(f)) continue;   // strumenti da riga di comando: scrivono nel terminale di chi li lancia
    const righe = fs.readFileSync(path.join(API, f), "utf8").split("\n");
    righe.forEach((r, i) => {
      if (!/console\.(log|error|warn|info|debug)/.test(r)) return;
      assert.doesNotMatch(r, /req\.(body|headers|cookies|query|originalUrl|url)\b/, `${f}:${i + 1} stampa dati della richiesta: ${r.trim()}`);
      assert.doesNotMatch(r, /console\.\w+\(\s*err\s*\)/, `${f}:${i + 1} stampa un oggetto errore intero: ${r.trim()}`);
    });
  }
});
