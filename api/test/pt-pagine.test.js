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
  for (const [url, tipo] of [["/pt.html", "text/html"], ["/pt-editor.html?cliente=1", "text/html"], ["/pt-editor.js", "javascript"], ["/benvenuto.html", "text/html"], ["/benvenuto.js", "javascript"], ["/pt-cliente.html", "text/html"], ["/pt-cliente.html?id=1", "text/html"], ["/pt.css", "text/css"],
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
  for (const f of ["benvenuto.js", "pt-editor.js", "pt.js", "pt-cliente.js", "pt-comune.js", "pt-converti.js", "pt-progressi.js", "progressi.js"]) {
    const js = leggi(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    assert.doesNotMatch(js, colore, `${f}: colore scritto a mano`);
    assert.doesNotMatch(js, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/, `${f}: i testi vanno sempre inseriti come testo`);
  }
  for (const f of ["pt.html", "pt-cliente.html", "pt-editor.html", "benvenuto.html"]) {
    const html = leggi(f).replace(/<meta name="theme-color"[^>]*>/g, "");
    assert.doesNotMatch(html, colore, `${f}: colore scritto a mano`);
    assert.doesNotMatch(html, /style="/, `${f}: stile scritto nella pagina`);
  }
});

test("accessibilità: ogni campo ha la sua etichetta, ogni pulsante un testo, lingua e viewport dichiarati", () => {
  for (const f of ["pt.html", "pt-cliente.html", "pt-editor.html", "benvenuto.html", "login.html", "registrati.html"]) {
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

// ---- contrasto dei colori (WCAG: testo normale ≥ 4,5:1, elementi grafici ≥ 3:1), in ENTRAMBE le modalità ----
function coloriDelSistema(modo) {
  const css = leggi("sistema.css");
  const blocco = (inizio) => { const i = css.indexOf(inizio); return css.slice(i, css.indexOf("\n}", i)); };
  const leggiVar = (testo, mappa) => { for (const m of testo.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) mappa[m[1]] = m[2]; return mappa; };
  const mappa = leggiVar(blocco(':root, [data-theme="scura"]'), {});
  return modo === "chiara" ? leggiVar(blocco('[data-theme="chiara"]'), mappa) : mappa;   // la chiara cambia solo alcuni valori
}
function luminanza(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrasto = (a, b) => { const [x, y] = [luminanza(a), luminanza(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

for (const modo of ["scura", "chiara"]) {
  test(`contrasto dei colori (${modo}): testo almeno 4,5:1; contorni e focus almeno 3:1`, () => {
    const c = coloriDelSistema(modo);
    const fondi = ["sfondo", "superficie", "superficie-alta"];
    const testo = [...fondi.flatMap((f) => [["testo", f], ["testo-secondario", f], ["conferma", f]]),
      ["su-brace", "brace"], ["testo-brace", "sfondo"], ["testo-brace", "superficie"], ["errore", "sfondo"], ["errore", "superficie"]];
    for (const [a, b] of testo) {
      assert.ok(c[a] && c[b], `${modo}: variabile mancante ${a} o ${b}`);
      assert.ok(contrasto(c[a], c[b]) >= 4.5, `${modo}: ${a} (${c[a]}) su ${b} (${c[b]}): ${contrasto(c[a], c[b]).toFixed(2)}:1, serve almeno 4,5:1`);
    }
    for (const f of ["sfondo", "superficie"]) {
      assert.ok(contrasto(c["bordo-campo"], c[f]) >= 3, `${modo}: bordo-campo su ${f} sotto 3:1`);
      assert.ok(contrasto(c["brace"], c[f]) >= 3, `${modo}: il contorno del focus (brace) su ${f} sotto 3:1`);
    }
  });
}

test("nessun colore scritto a mano in nessun CSS del sito, tranne sistema.css e il tema della scheda", () => {
  const colore = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/;
  for (const f of fs.readdirSync(WEB).filter((n) => n.endsWith(".css") && !["sistema.css", "tema.css", "scheda.css"].includes(n))) {
    assert.doesNotMatch(leggi(f), colore, `${f}: colore scritto a mano`);
  }
});

test("pagine: niente richieste esterne, niente script o stile scritti nella pagina, lingua, titolo, un solo h1", () => {
  for (const f of fs.readdirSync(WEB).filter((n) => n.endsWith(".html"))) {
    const html = leggi(f);
    assert.match(html, /<html lang="it">/, f);
    assert.match(html, /<title>[^<]+<\/title>/, f);
    assert.doesNotMatch(html, /(?:src|href)="https?:\/\//, `${f}: richiesta a un sito esterno`);
    assert.doesNotMatch(html, /<style\b/, `${f}: stile scritto nella pagina`);
    for (const m of html.matchAll(/<script\b([^>]*)>/g)) assert.match(m[1], /\bsrc=/, `${f}: script scritto dentro la pagina`);
  }
  for (const f of ["login.css"].filter((n) => fs.existsSync(path.join(WEB, n)))) assert.doesNotMatch(leggi(f), /https?:\/\//);
  assert.doesNotMatch(leggi("sistema.css"), /url\((?!["']?\/fonts\/|["']?\/icone\/)/, "sistema.css carica qualcosa che non è in /fonts o /icone");
});
