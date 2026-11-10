// L'app sul telefono (PWA): manifest, icone, service worker e pagine. Senza database.
const fs = require("node:fs");
const path = require("node:path");
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

const WEB = path.join(__dirname, "..", "..", "web");
const leggi = (f) => fs.readFileSync(path.join(WEB, f), "utf8");
const tutte = fs.readdirSync(WEB).filter((f) => f.endsWith(".html"));

test("manifest: nome, avvio, schermo intero e tre icone che esistono davvero (PNG della misura dichiarata)", () => {
  const m = JSON.parse(leggi("manifest.webmanifest"));
  assert.equal(m.name, "Lena"); assert.equal(m.start_url, "/"); assert.equal(m.scope, "/"); assert.equal(m.display, "standalone");
  assert.match(m.theme_color, /^#[0-9A-Fa-f]{6}$/); assert.match(m.background_color, /^#[0-9A-Fa-f]{6}$/);
  const scopi = m.icons.map((i) => i.purpose).sort();
  assert.deepEqual(scopi, ["any", "any", "maskable"]);
  for (const i of m.icons) {
    const b = fs.readFileSync(path.join(WEB, i.src.replace(/^\//, "")));
    assert.equal(b.subarray(1, 4).toString(), "PNG", `${i.src}: non è un PNG`);
    const [l, a] = [b.readUInt32BE(16), b.readUInt32BE(20)];
    assert.equal(`${l}x${a}`, i.sizes, `${i.src}: misura diversa da quella dichiarata`);
  }
  const apple = fs.readFileSync(path.join(WEB, "icone-app", "apple-touch-icon.png"));
  assert.equal(apple.readUInt32BE(16), 180);
});

test("ogni pagina (tranne anteprima e offline) collega il manifest; dove c'è api.js c'è anche pwa.js, dopo", () => {
  for (const f of tutte) {
    if (f === "anteprima.html" || f === "offline.html") continue;
    const h = leggi(f);
    assert.match(h, /<link rel="manifest" href="\/manifest\.webmanifest">/, `${f}: manca il manifest`);
    assert.match(h, /<link rel="apple-touch-icon" href="\/icone-app\/apple-touch-icon\.png">/, `${f}: manca l'icona per iPhone`);
    if (h.includes('src="/api.js"')) {
      assert.ok(h.indexOf('src="/pwa.js"') > h.indexOf('src="/api.js"'), `${f}: pwa.js deve venire dopo api.js`);
    }
  }
  // il riquadro per installare c'è nell'account del cliente e nel profilo del trainer, nascosto di partenza
  for (const f of ["account.html", "pt-profilo.html"]) assert.match(leggi(f), /id="installa" hidden/, `${f}: manca il riquadro «Metti Lena sul telefono»`);
  assert.match(leggi("pwa.js"), /serviceWorker\.register\("\/sw\.js"\)/);
});

test("service worker: non tocca mai l'API, gli indirizzi con parametri, i metodi diversi da GET e i siti esterni", () => {
  const sw = leggi("sw.js");
  assert.match(sw, /if \(r\.method !== "GET"\) return;/);
  assert.match(sw, /url\.pathname\.startsWith\("\/api\/"\)\) return;/);
  assert.match(sw, /if \(url\.search\) return;/);
  assert.match(sw, /url\.origin !== self\.location\.origin\) return;/);
  assert.match(sw, /no-store/);                 // non copia ciò che il server dice di non conservare
  assert.match(sw, /!risposta\.redirected/);    // una risposta dopo un reindirizzamento non si può riusare per una pagina
  assert.doesNotMatch(sw, /https?:\/\//);
  assert.match(leggi("offline.html"), /Riprova/);
  // la pagina offline e i file che le servono sono tra quelli salvati subito
  for (const f of ["/offline.html", "/sistema.css", "/pagine.css", "/tema.js"]) assert.ok(sw.includes(`"${f}"`), `${f}: non è nell'elenco iniziale`);
  for (const f of ["offline.html", "sistema.css", "pagine.css", "tema.js"]) assert.ok(fs.existsSync(path.join(WEB, f)));
});

test("service worker: su un browser finto salva solo file del sito e lascia passare tutto il resto", async () => {
  const salvati = new Map(); const ascoltatori = {};
  const risposta = (corpo, extra = {}) => ({ ok: true, type: "basic", redirected: false, headers: { get: () => "" }, clone() { return this; }, corpo, ...extra });
  const finto = {
    location: { origin: "https://lena.test" },
    addEventListener: (nome, fn) => { ascoltatori[nome] = fn; },
    skipWaiting() {}, clients: { claim: async () => {} },
  };
  const cache = { put: (r, res) => salvati.set(r.url, res), addAll: async () => {} };
  const cachesFinte = { open: async () => cache, keys: async () => [], delete: async () => {}, match: async (r) => salvati.get(typeof r === "string" ? "https://lena.test" + r : r.url) };
  let reteSu = true;
  const fetchFinto = async (r) => { if (!reteSu) throw new Error("offline"); return risposta("rete:" + r.url); };
  new Function("self", "caches", "fetch", "Response", "URL", leggi("sw.js"))(finto, cachesFinte, fetchFinto, { error: () => "errore-di-rete" }, URL);

  const prova = async (url, extra = {}) => {
    let risposto = null;
    const ev = { request: { url, method: "GET", mode: "cors", destination: "script", ...extra }, respondWith: (p) => { risposto = p; } };
    ascoltatori.fetch(ev);
    return risposto ? await risposto : "lasciata-passare";
  };
  assert.equal(await prova("https://lena.test/api/me/scheda"), "lasciata-passare");
  assert.equal(await prova("https://lena.test/registrati.html?codice=segreto", { mode: "navigate", destination: "document" }), "lasciata-passare");
  assert.equal(await prova("https://lena.test/api.js", { method: "POST" }), "lasciata-passare");
  assert.equal(await prova("https://altro.sito/x.js"), "lasciata-passare");
  assert.equal(await prova("https://lena.test/modello-scheda-lena.xlsx", { destination: "" }), "lasciata-passare");
  // un file del sito: va in rete e se ne tiene una copia; senza rete si serve la copia
  const prima = await prova("https://lena.test/api.js");
  assert.equal(prima.corpo, "rete:https://lena.test/api.js");
  assert.ok(salvati.has("https://lena.test/api.js"));
  assert.ok(![...salvati.keys()].some((k) => k.includes("/api/") || k.includes("?")));
  reteSu = false;
  const dopo = await prova("https://lena.test/api.js");
  assert.equal(dopo.corpo, "rete:https://lena.test/api.js");
  // una pagina mai vista, senza rete: la pagina «offline» (se c'è) altrimenti errore
  salvati.set("https://lena.test/offline.html", risposta("OFFLINE"));
  const nav = await prova("https://lena.test/pt.html", { mode: "navigate", destination: "document" });
  assert.equal(nav.corpo, "OFFLINE");
});
