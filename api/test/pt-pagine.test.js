// Test delle pagine dell'area del PT: servite, senza colori scritti a mano, accessibili (etichette e contrasto dei colori).
const path = require("node:path");
const fs = require("node:fs");
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { avvia, db } = require("./comune");   // per primo: legge .env
const { creaApp } = require("../app");

const WEB = path.join(__dirname, "..", "..", "web");
const leggi = (f) => fs.readFileSync(path.join(WEB, f), "utf8");
let server, BASE;
before(async () => { server = await avvia(creaApp()); BASE = `http://localhost:${server.address().port}`; });
after(async () => { await new Promise((ok) => server.close(ok)); await db.end(); });

test("le pagine e i file dell'area del PT rispondono 200", async () => {
  for (const [url, tipo] of [["/pt.html", "text/html"], ["/pt-cliente.html", "text/html"], ["/pt-cliente.html?id=1", "text/html"], ["/pt.css", "text/css"],
    ["/pt.js", "javascript"], ["/pt-cliente.js", "javascript"], ["/pt-comune.js", "javascript"], ["/pt-converti.js", "javascript"],
    ["/pt-progressi.js", "javascript"], ["/progressi.js", "javascript"]]) {
    const r = await fetch(BASE + url);
    assert.equal(r.status, 200, url);
    assert.ok(r.headers.get("content-type").includes(tipo), url);
    await r.arrayBuffer();
  }
});

test("area del PT: colori e font solo come variabili; i testi si inseriscono sempre come testo, mai come HTML", () => {
  const colore = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/;
  assert.doesNotMatch(leggi("pt.css"), colore, "pt.css ha un colore scritto a mano");
  assert.doesNotMatch(leggi("pt.css"), /font-family\s*:\s*(?!var\()/, "pt.css ha un font scritto a mano");
  for (const f of ["pt.js", "pt-cliente.js", "pt-comune.js", "pt-converti.js", "pt-progressi.js", "progressi.js"]) {
    const js = leggi(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    assert.doesNotMatch(js, colore, `${f}: colore scritto a mano`);
    assert.doesNotMatch(js, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/, `${f}: i testi vanno sempre inseriti come testo`);
  }
  for (const f of ["pt.html", "pt-cliente.html"]) {
    const html = leggi(f).replace(/<meta name="theme-color"[^>]*>/g, "");
    assert.doesNotMatch(html, colore, `${f}: colore scritto a mano`);
    assert.doesNotMatch(html, /style="/, `${f}: stile scritto nella pagina`);
  }
});

test("accessibilità: ogni campo ha la sua etichetta, ogni pulsante un testo, lingua e viewport dichiarati", () => {
  for (const f of ["pt.html", "pt-cliente.html", "login.html", "registrati.html"]) {
    const html = leggi(f);
    for (const m of html.matchAll(/<input\b([^>]*)>/g)) {
      if (/type="(hidden|submit|button)"/.test(m[1])) continue;
      const id = (m[1].match(/\bid="([^"]+)"/) || [])[1];
      assert.ok(id, `${f}: un campo senza id: ${m[0].slice(0, 60)}`);
      const conLabel = new RegExp(`<label[^>]*\\bfor="${id}"`).test(html) || new RegExp(`<label[^>]*>(?:(?!</label>)[\\s\\S])*<input[^>]*\\bid="${id}"`).test(html);
      assert.ok(conLabel || /aria-label=/.test(m[1]), `${f}: il campo «${id}» non ha una label`);
    }
    for (const m of html.matchAll(/<button\b[^>]*>([^<]*)<\/button>/g)) assert.ok(m[1].trim().length > 0, `${f}: pulsante senza testo`);
    assert.match(html, /<html lang="it">/);
    assert.match(html, /<meta name="viewport"/);
    assert.match(html, /<title>[^<]+<\/title>/);
  }
});

// ---- contrasto dei colori (WCAG: testo normale ≥ 4,5:1, elementi grafici ≥ 3:1) ----
function coloriDelTema() {
  const mappa = {};
  for (const m of leggi("tema.css").matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) mappa[m[1]] = m[2];
  return mappa;
}
function luminanza(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrasto = (a, b) => { const [x, y] = [luminanza(a), luminanza(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test("contrasto dei colori dell'area del PT: testo almeno 4,5:1, contorno del focus almeno 3:1", () => {
  const c = coloriDelTema();
  const coppie = [
    ["colore-testo", "colore-carta"], ["colore-testo", "colore-sfondo"], ["colore-testo", "colore-accento-chiaro"], ["colore-testo", "colore-avviso-sfondo"],
    ["colore-testo-secondario", "colore-carta"], ["colore-testo-secondario", "colore-sfondo"],
    ["colore-su-accento", "colore-azione"], ["colore-su-accento", "colore-pericolo"],
    ["colore-azione", "colore-carta"], ["colore-azione", "colore-sfondo"],
    ["colore-ok-testo", "colore-ok-sfondo"], ["colore-avviso-testo", "colore-avviso-sfondo"], ["colore-errore-testo", "colore-errore-sfondo"], ["colore-errore-testo", "colore-carta"],
  ];
  for (const [a, b] of coppie) {
    assert.ok(c[a] && c[b], `variabile mancante: ${a} o ${b}`);
    assert.ok(contrasto(c[a], c[b]) >= 4.5, `${a} (${c[a]}) su ${b} (${c[b]}): ${contrasto(c[a], c[b]).toFixed(2)}:1, serve almeno 4,5:1`);
  }
  for (const sfondo of ["colore-carta", "colore-sfondo"]) {
    assert.ok(contrasto(c["colore-azione"], c[sfondo]) >= 3, `il contorno del focus (colore-azione) deve vedersi su ${sfondo}`);
  }
});
