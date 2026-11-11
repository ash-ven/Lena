// La home (scelta trainer / cliente) e il controllo sul tipo di account al login.
const path = require("node:path");
const fs = require("node:fs");
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const { avvia, db, sessione, creaPt, email, PASSWORD, pulisci } = require("./comune");
const { creaApp } = require("../app");

const WEB = path.join(__dirname, "..", "..", "web");
const leggi = (f) => fs.readFileSync(path.join(WEB, f), "utf8");
let server, BASE;
before(async () => { server = await avvia(creaApp()); BASE = `http://localhost:${server.address().port}`; });
after(async () => { await pulisci(); await new Promise((ok) => server.close(ok)); await db.end(); });

async function creaClienteSenzaPt(nome) {
  const hash = await bcrypt.hash(PASSWORD, 4);
  await db.query("INSERT INTO utente (email, password_hash, ruolo) VALUES ($1, $2, 'cliente')", [email(nome), hash]);
}

test("la home ha i due ingressi (trainer e cliente), un solo h1, e non nasconde nulla a chi non ha JavaScript", () => {
  const html = leggi("index.html");
  assert.match(html, /href="\/login\.html\?ruolo=pt"/);
  assert.match(html, /href="\/login\.html\?ruolo=cliente"/);
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
  assert.match(html, /<noscript>[\s\S]*ruolo=pt[\s\S]*ruolo=cliente[\s\S]*<\/noscript>/);
});

test("la frase della home: quattro frasi, scelte a caso all'apertura; la prima è anche nell'HTML", () => {
  const js = leggi("index.js"), html = leggi("index.html");
  const frasi = [...js.match(/const FRASI = \[([\s\S]*?)\];/)[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.equal(frasi.length, 4);
  assert.equal(new Set(frasi).size, 4);
  assert.match(js, /Math\.random\(\)/);
  assert.ok(html.includes(`<p class="home-frase">${frasi[0]}</p>`), "il testo senza JavaScript deve essere la prima frase");
  assert.ok(!html.includes("in ordine."));
});

test("la home e il login rispondono 200", async () => {
  for (const url of ["/", "/login.html?ruolo=pt", "/login.html?ruolo=cliente"]) assert.equal((await fetch(BASE + url)).status, 200, url);
});

test("login dalla porta giusta: entra; senza porta: entra come prima", async () => {
  await creaPt("pt-home", "Trainer Home");
  await creaClienteSenzaPt("cli-home");
  for (const [nome, ruolo] of [["pt-home", "pt"], ["cli-home", "cliente"]]) {
    const a = sessione(() => BASE);
    const r = await a("POST", "/api/auth/login", { email: email(nome), password: PASSWORD, ruolo });
    assert.equal(r.stato, 200); assert.equal(r.json.ruolo, ruolo); assert.ok(a.cookie());
    const b = sessione(() => BASE);
    assert.equal((await b("POST", "/api/auth/login", { email: email(nome), password: PASSWORD })).stato, 200);
  }
});

test("login dalla porta sbagliata: 403, nessuna sessione aperta, e dice di che tipo è l'account", async () => {
  const a = sessione(() => BASE);
  const r = await a("POST", "/api/auth/login", { email: email("pt-home"), password: PASSWORD, ruolo: "cliente" });
  assert.equal(r.stato, 403); assert.equal(r.json.codice, "RUOLO_SBAGLIATO"); assert.equal(r.json.ruolo, "pt");
  assert.equal(a.cookie(), null);
  assert.equal((await a("GET", "/api/auth/me")).stato, 401);
  const b = sessione(() => BASE);
  const r2 = await b("POST", "/api/auth/login", { email: email("cli-home"), password: PASSWORD, ruolo: "pt" });
  assert.equal(r2.stato, 403); assert.equal(b.cookie(), null);
});

test("porta sbagliata + password sbagliata: 401 uguale agli altri (non si scopre chi ha un account)", async () => {
  const a = sessione(() => BASE);
  const r = await a("POST", "/api/auth/login", { email: email("pt-home"), password: "SbagliataSbagliata1", ruolo: "cliente" });
  assert.equal(r.stato, 401);
  const r2 = await a("POST", "/api/auth/login", { email: email("non-esiste"), password: "SbagliataSbagliata1", ruolo: "cliente" });
  assert.equal(r2.stato, 401); assert.equal(r.json.errore, r2.json.errore);
});

test("ruolo non valido: 400", async () => {
  const a = sessione(() => BASE);
  for (const ruolo of ["admin", "", 5, {}]) assert.equal((await a("POST", "/api/auth/login", { email: email("pt-home"), password: PASSWORD, ruolo })).stato, 400, JSON.stringify(ruolo));
});

test("una stessa email non può essere sia trainer sia cliente (vincolo del database)", async () => {
  await assert.rejects(
    db.query("INSERT INTO utente (email, password_hash, ruolo) VALUES ($1, 'x', 'cliente')", [email("pt-home")]),
    (e) => e.code === "23505");
  await assert.rejects(
    db.query("INSERT INTO utente (email, password_hash, ruolo) VALUES ($1, 'x', 'pt')", [email("cli-home")]),
    (e) => e.code === "23505");
});

test("login.js: manda il ruolo scelto e gestisce la porta sbagliata", () => {
  const js = leggi("login.js");
  assert.match(js, /ruolo \? \{ email, password, ruolo \}/);
  assert.match(js, /RUOLO_SBAGLIATO/);
});
