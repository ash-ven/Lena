// Test delle pagine servite dal server (cartella web/) e delle regole di sicurezza del sito.
// Non servono dati nel database: controllano file, intestazioni e risposte.

const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });

const fs = require("node:fs");
const http = require("node:http");
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const db = require("../db");
const { creaApp } = require("../app");

const RADICE = path.join(__dirname, "..", "..");
const WEB = path.join(RADICE, "web");
let server, BASE, PORTA;

before(async () => {
  server = await new Promise((ok) => { const s = creaApp().listen(0, () => ok(s)); });
  PORTA = server.address().port;
  BASE = `http://localhost:${PORTA}`;
});
after(async () => {
  await new Promise((ok) => server.close(ok));
  await db.end();
});

const leggi = (f) => fs.readFileSync(path.join(WEB, f), "utf8");
const paginePubbliche = fs.readdirSync(WEB).filter((f) => f.endsWith(".html"));

// Una richiesta "grezza": fetch() sistema da solo i percorsi con «..», qui invece li mandiamo com'è
function richiestaGrezza(percorso) {
  return new Promise((ok, no) => {
    http.get({ host: "localhost", port: PORTA, path: percorso }, (res) => { res.resume(); res.on("end", () => ok(res.statusCode)); }).on("error", no);
  });
}

// ---------- le pagine rispondono ----------

test("le pagine e i file del sito rispondono 200 con il tipo giusto", async () => {
  const attesi = {
    "/": "text/html", "/index.html": "text/html", "/login.html": "text/html", "/registrati.html": "text/html",
    "/scheda.html": "text/html", "/pt.html": "text/html", "/404.html": "text/html",
    "/tema.css": "text/css", "/pagine.css": "text/css", "/scheda.css": "text/css", "/sistema.css": "text/css", "/tema.js": "javascript",
    "/api.js": "javascript", "/login.js": "javascript", "/registrati.js": "javascript", "/scheda.js": "javascript",
    "/scheda-server.js": "javascript", "/sincronizza.js": "javascript", "/registrazioni.js": "javascript",
    "/index.js": "javascript", "/pt.js": "javascript", "/favicon.svg": "image/svg+xml",
  };
  for (const [url, tipo] of Object.entries(attesi)) {
    const r = await fetch(BASE + url);
    assert.equal(r.status, 200, url);
    assert.ok(r.headers.get("content-type").includes(tipo), `${url}: tipo ${r.headers.get("content-type")}`);
    await r.arrayBuffer();
  }
});

test("la pagina di registrazione si apre anche con il codice nell'indirizzo", async () => {
  const r = await fetch(BASE + "/registrati.html?codice=abc123");
  assert.equal(r.status, 200);
  assert.match(await r.text(), /Crea il tuo accesso/);
});

test("/api/qualcosa-che-non-esiste risponde JSON 404 (mai una pagina web), con ogni metodo", async () => {
  for (const metodo of ["GET", "POST", "PUT", "DELETE"]) {
    const r = await fetch(BASE + "/api/qualcosa-che-non-esiste", { method: metodo, headers: { Accept: "text/html" } });
    assert.equal(r.status, 404, metodo);
    assert.match(r.headers.get("content-type"), /application\/json/, metodo);
    assert.deepEqual(await r.json(), { errore: "Indirizzo non trovato" });
  }
  // anche se esiste un file con quel nome: /api vince sempre
  const r = await fetch(BASE + "/api/login.html", { headers: { Accept: "text/html" } });
  assert.equal(r.status, 404);
  assert.match(r.headers.get("content-type"), /application\/json/);
});

test("un indirizzo del sito che non esiste: pagina 404 gentile per il browser, JSON per i programmi", async () => {
  const web = await fetch(BASE + "/pagina-che-non-esiste", { headers: { Accept: "text/html,application/xhtml+xml" } });
  assert.equal(web.status, 404);
  assert.match(web.headers.get("content-type"), /text\/html/);
  assert.match(await web.text(), /Pagina non trovata/);

  const prog = await fetch(BASE + "/pagina-che-non-esiste", { headers: { Accept: "application/json" } });
  assert.equal(prog.status, 404);
  assert.deepEqual(await prog.json(), { errore: "Indirizzo non trovato" });

  const post = await fetch(BASE + "/boh", { method: "POST" });
  assert.equal(post.status, 404);
  assert.match(post.headers.get("content-type"), /application\/json/);
});

test("dal sito non si può leggere nulla fuori dalla cartella web/ (segreti, codice, .env)", async () => {
  const tentativi = ["/../.env", "/../api/.env", "/%2e%2e/api/.env", "/..%2fapi%2f.env", "/..%5capi%5c.env", "/tema.css/../../api/.env",
    "/.env", "/../package.json", "/../db/initdb/01_schema.sql", "/%2e%2e%2f%2e%2e%2fWindows%2fwin.ini", "/..\\..\\api\\.env"];
  for (const p of tentativi) {
    const stato = await richiestaGrezza(p);
    assert.ok(stato === 404 || stato === 400 || stato === 403, `${p} doveva essere rifiutato, invece ${stato}`);
  }
});

// ---------- intestazioni di sicurezza ----------

test("intestazioni di sicurezza su pagine e file", async () => {
  for (const url of ["/login.html", "/scheda.js", "/pagina-che-non-esiste"]) {
    const r = await fetch(BASE + url);
    await r.arrayBuffer();
    const csp = r.headers.get("content-security-policy");
    assert.ok(csp, `${url}: manca la Content-Security-Policy`);
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /script-src 'self'(;|$)/, `${url}: gli script devono poter venire solo dal nostro sito`);
    assert.match(csp, /script-src-attr 'none'/, `${url}: niente gestori di eventi scritti nell'HTML`);
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /frame-ancestors 'self'/);
    assert.equal(r.headers.get("x-content-type-options"), "nosniff");
    assert.equal(r.headers.get("referrer-policy"), "no-referrer");
    assert.equal(r.headers.get("x-powered-by"), null);
  }
});

test("la CSP non è stata allentata: niente 'unsafe-inline' né 'unsafe-eval' per gli script, niente indirizzi esterni per script e connessioni", async () => {
  const r = await fetch(BASE + "/login.html");
  await r.arrayBuffer();
  const csp = r.headers.get("content-security-policy");
  const direttiva = (nome) => (csp.split(";").map((x) => x.trim()).find((x) => x.startsWith(nome + " ")) || "");
  assert.doesNotMatch(direttiva("script-src"), /unsafe-inline|unsafe-eval|https?:|\*/);
  assert.doesNotMatch(direttiva("default-src"), /unsafe-inline|unsafe-eval|https?:|\*/);
  assert.equal(direttiva("connect-src"), "", "connect-src non definito: vale default-src 'self', cioè solo il nostro sito");
  assert.doesNotMatch(direttiva("img-src"), /https?:|\*/);
});

test("le risposte dell'API non vanno mai tenute in memoria dal browser (dati di salute)", async () => {
  for (const url of ["/api/salute", "/api/auth/me", "/api/me/scheda", "/api/non-esiste"]) {
    const r = await fetch(BASE + url);
    await r.arrayBuffer();
    assert.equal(r.headers.get("cache-control"), "no-store", url);
  }
});

// ---------- controlli sul codice delle pagine (GDPR: niente richieste a terzi) ----------

test("nessuna pagina ha script scritti dentro l'HTML né gestori di eventi inline né javascript:", () => {
  for (const f of paginePubbliche) {
    const html = leggi(f);
    for (const m of html.matchAll(/<script\b([^>]*)>/gi)) {
      assert.match(m[1], /\bsrc="[^"]+"/, `${f}: c'è uno <script> senza src (script scritto dentro la pagina)`);
    }
    assert.doesNotMatch(html, /\son[a-z]+\s*=\s*["']/i, `${f}: gestore di eventi scritto nell'HTML (onclick=...)`);
    assert.doesNotMatch(html, /javascript:/i, `${f}: indirizzo javascript:`);
  }
});

test("nessun file del sito chiama indirizzi esterni (niente CDN, font o librerie di terzi)", () => {
  const file = fs.readdirSync(WEB).filter((f) => /\.(html|css|js|svg)$/.test(f));
  assert.ok(file.length >= 15);
  for (const f of file) {
    const testo = leggi(f);
    // gli indirizzi ammessi sono solo quelli che NON fanno richieste: lo spazio dei nomi di un file SVG
    const esterni = [...testo.matchAll(/https?:\/\/[^\s"'`)<>]+/g)].map((m) => m[0]).filter((u) => u !== "http://www.w3.org/2000/svg")
      // «https://…» nei suggerimenti e nei messaggi d'errore non è un indirizzo: conta solo ciò che ha un nome di sito
      .filter((u) => /^https?:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+/i.test(u))
    // UNICA eccezione: il collegamento «Manda su WhatsApp» dell'invito (pt-cliente.js). Non fa nessuna richiesta: è un link che il trainer
    // sceglie di aprire con un clic, e contiene solo il messaggio che sta per mandare.
    .filter((u) => !(f === "pt-cliente.js" && u.startsWith("https://wa.me/")));
    // esempi.com compare solo come testo di esempio nei commenti della documentazione, non in questi file: se compare è un errore
    assert.deepEqual(esterni, [], `${f}: contiene indirizzi esterni`);
    assert.doesNotMatch(testo, /@import|url\(\s*["']?https?:/i, `${f}: importa risorse esterne`);
  }
});

test("ogni file a cui una pagina rimanda esiste davvero", () => {
  for (const f of paginePubbliche) {
    const html = leggi(f);
    for (const m of html.matchAll(/(?:src|href)="(\/[^"#?]*)"/g)) {
      if (m[1] === "/") continue;
      assert.ok(fs.existsSync(path.join(WEB, m[1])), `${f} rimanda a ${m[1]}, che non esiste`);
    }
  }
  // il modello della scheda scaricabile rimanda a web/...: il convertitore deve poterli trovare
  const modello = fs.readFileSync(path.join(RADICE, "modello-scheda.html"), "utf8");
  for (const m of modello.matchAll(/(?:src|href)="(web\/[^"]+)"/g)) assert.ok(fs.existsSync(path.join(RADICE, m[1])), `modello-scheda.html rimanda a ${m[1]}`);
  assert.ok((modello.match(/(?:src|href)="web\//g) || []).length === 3, "il modello deve rimandare a tema.css, scheda.css e scheda.js");
});

test("scheda.js non contiene la sequenza che chiude un tag script (romperebbe la scheda scaricabile)", () => {
  for (const f of ["scheda.js", "scheda.css", "tema.css"]) assert.doesNotMatch(leggi(f), /<\/script/i, f);
});

test("colori e font delle pagine nuove stanno SOLO in sistema.css (la scheda ha il suo tema.css)", () => {
  const colore = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/;
  const font = /font-family\s*:\s*(?!var\()/;
  assert.match(leggi("sistema.css"), /--sfondo/);
  assert.match(leggi("sistema.css"), /--font-titoli/);
  assert.match(leggi("tema.css"), /--scheda-font-titoli/);
  assert.doesNotMatch(leggi("pagine.css"), colore, "pagine.css ha un colore scritto a mano");
  assert.doesNotMatch(leggi("pagine.css"), font, "pagine.css ha un font scritto a mano");
  for (const f of paginePubbliche) {
    // l'unica eccezione ammessa è il colore della barra del browser (meta theme-color), che non può usare variabili
    const html = leggi(f).replace(/<meta name="theme-color"[^>]*>/g, "");
    assert.doesNotMatch(html, colore, `${f}: colore scritto a mano`);
    assert.doesNotMatch(html, /style="[^"]*(color|font)/i, `${f}: stile di colore o font scritto nella pagina`);
  }
  for (const f of ["login.js", "registrati.js", "index.js", "pt.js", "api.js", "scheda-server.js"]) {
    assert.doesNotMatch(leggi(f), colore, `${f}: colore scritto a mano`);
  }
});

test("la scheda del sito non ha più dati incollati: li prende dal server", () => {
  const html = leggi("scheda.html");
  assert.doesNotMatch(html, /const DATI|__DATI__/);
  assert.match(leggi("scheda-server.js"), /\/api\/me\/scheda/);
});

// ---------- convertitore dentro il sito ----------

test("file del convertitore e dell'anteprima: si servono e la libreria Excel è quella dichiarata (versione e impronta SHA-256)", async () => {
  for (const [url, tipo] of [["/anteprima.html", "text/html"], ["/anteprima.js", "javascript"], ["/convertitore.js", "javascript"],
    ["/valida-scheda.js", "javascript"], ["/vendor/xlsx.full.min.js", "javascript"], ["/vendor/LEGGIMI.txt", "text/plain"], ["/vendor/xlsx-LICENSE.txt", "text/plain"]]) {
    const r = await fetch(BASE + url);
    assert.equal(r.status, 200, url);
    assert.ok(r.headers.get("content-type").includes(tipo), `${url}: ${r.headers.get("content-type")}`);
    await r.arrayBuffer();
  }
  const note = fs.readFileSync(path.join(WEB, "vendor", "LEGGIMI.txt"), "utf8");
  const impronta = require("node:crypto").createHash("sha256").update(fs.readFileSync(path.join(WEB, "vendor", "xlsx.full.min.js"))).digest("hex");
  assert.ok(note.includes(impronta), "l'impronta scritta in vendor/LEGGIMI.txt non coincide con il file: la libreria è stata cambiata senza aggiornare le note");
  assert.match(note, /Versione:\s+0\.20\.3/);
  assert.match(note, /Apache-2\.0/);
  assert.match(fs.readFileSync(path.join(WEB, "vendor", "xlsx.full.min.js"), "utf8"), /version="0\.20\.3"/, "il file è davvero la versione dichiarata");
});

test("nessuna pagina (nuova o vecchia) carica script o stili da siti esterni", () => {
  for (const f of [path.join(RADICE, "convertitore-test.html"), path.join(RADICE, "modello-scheda.html"), ...paginePubbliche.map((p) => path.join(WEB, p))]) {
    const html = fs.readFileSync(f, "utf8");
    for (const m of html.matchAll(/<(?:script|link|img|iframe)\b[^>]*\b(?:src|href)="([^"]+)"/gi)) {
      assert.doesNotMatch(m[1], /^(?:https?:)?\/\//i, `${path.basename(f)} carica ${m[1]} da fuori`);
    }
  }
});

test("l'anteprima accetta messaggi solo dalla stessa origine E solo dalla pagina che la contiene, e non usa srcdoc", () => {
  const js = leggi("anteprima.js");
  const codice = js.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");   // senza i commenti: contano solo le istruzioni
  assert.match(js, /ev\.origin !== ORIGINE/);
  assert.match(js, /ev\.source !== window\.parent/);
  assert.match(js, /postMessage\(messaggio, ORIGINE\)/, "le risposte vanno solo alla nostra origine, mai a \"*\"");
  assert.doesNotMatch(js, /postMessage\([^)]*["']\*["']\)/);
  assert.doesNotMatch(codice, /srcdoc|innerHTML|eval\(|new Function/);
  assert.match(js, /erroreScheda\(m\.dati\)/, "i dati ricevuti passano lo stesso controllo del server");
});

test("scheda.js: niente innerHTML con dati, indirizzi solo http/https/blob, colori solo esadecimali", () => {
  const js = leggi("scheda.js");
  assert.equal((js.match(/innerHTML/g) || []).length, 1, "innerHTML solo dentro el(), per le icone fisse");
  assert.match(js, /\^\(https\?:\|blob:\)/);
  assert.match(js, /\^\[0-9A-Fa-f\]\{6\}\$/);
});
