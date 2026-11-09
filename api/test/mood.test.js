// Test dei mood della scheda del cliente (web/mood/): i colori dei giorni sono leggibili e la scheda carica il mood.
// Non serve il database: legge solo i file.
const path = require("node:path");
const fs = require("node:fs");
const { test } = require("node:test");
const assert = require("node:assert/strict");

const WEB = path.join(__dirname, "..", "..", "web");
const leggi = (f) => fs.readFileSync(path.join(WEB, f), "utf8");

function luminanza(hex) {
  const c = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrasto(a, b) {
  const [x, y] = [luminanza(a), luminanza(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
function token(css, nome) {
  const m = css.match(new RegExp(`--${nome}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(m, `manca --${nome}`);
  return m[1];
}

const MOOD = fs.readdirSync(path.join(WEB, "mood")).filter((f) => f.endsWith(".css"));

test("c'è almeno il mood predefinito «lena»", () => {
  assert.ok(MOOD.includes("lena.css"));
});

for (const f of MOOD) {
  const nome = f.replace(".css", "");
  const css = leggi(`mood/${f}`);

  test(`mood ${nome}: 7 colori dei giorni, scritta della testata almeno 4,5:1, colore sulla superficie almeno 3:1`, () => {
    const superficie = token(css, "superficie");
    for (let n = 1; n <= 7; n++) {
      const g = token(css, `giorno-${n}`), su = token(css, `su-giorno-${n}`);
      assert.ok(contrasto(g, su) >= 4.5, `${nome}, giorno ${n}: scritta ${su} su ${g} = ${contrasto(g, su).toFixed(2)}`);
      assert.ok(contrasto(g, superficie) >= 3, `${nome}, giorno ${n}: ${g} sulla superficie ${superficie} = ${contrasto(g, superficie).toFixed(2)}`);
    }
  });

  test(`mood ${nome}: testo principale e secondario leggibili su sfondo e superficie; nessun font esterno`, () => {
    for (const fondo of ["sfondo", "superficie"]) {
      for (const t of ["testo", "testo-secondario"]) {
        const c = contrasto(token(css, t), token(css, fondo));
        assert.ok(c >= 4.5, `${nome}: ${t} su ${fondo} = ${c.toFixed(2)}`);
      }
    }
    assert.doesNotMatch(css, /url\(\s*["']?https?:/i, `${nome}: risorsa esterna`);
    assert.doesNotMatch(css, /@import/i, `${nome}: @import`);
    assert.match(css, /prefers-reduced-motion/, `${nome}: deve fermare le animazioni con «riduci movimento»`);
  });
}

test("la scheda del cliente e l'anteprima caricano il mood; la scheda scaricabile no", () => {
  for (const p of ["scheda.html", "anteprima.html"]) assert.match(leggi(p), /href="\/mood\/lena\.css"/, p);
  assert.match(leggi("scheda-server.js"), /setAttribute\("data-mood"/);
  assert.match(leggi("anteprima.js"), /setAttribute\("data-mood"/);
  const modello = fs.readFileSync(path.join(WEB, "..", "modello-scheda.html"), "utf8");
  assert.doesNotMatch(modello, /mood/, "la scheda scaricabile resta senza mood");
  assert.doesNotMatch(leggi("scheda.js"), /<\/script/i);
});
