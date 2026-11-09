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

  test(`mood ${nome}: 7 colori dei giorni, scritta sopra almeno 4,5:1, colore sulla superficie almeno 3:1 (salvo pastelli con contorno)`, () => {
    const superficie = token(css, "superficie");
    for (let n = 1; n <= 7; n++) {
      const g = token(css, `giorno-${n}`), su = token(css, `su-giorno-${n}`);
      assert.ok(contrasto(g, su) >= 4.5, `${nome}, giorno ${n}: scritta ${su} su ${g} = ${contrasto(g, su).toFixed(2)}`);
      // eccezione dichiarata dal mood (--giorni-pastello: 1): i colori dei giorni sono pastelli sempre con contorno d'inchiostro, mai testo
      if (!/--giorni-pastello:\s*1/.test(css)) {
        assert.ok(contrasto(g, superficie) >= 3, `${nome}, giorno ${n}: ${g} sulla superficie ${superficie} = ${contrasto(g, superficie).toFixed(2)}`);
      }
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
  for (const p of ["scheda.html", "anteprima.html"]) {
    for (const f of MOOD) assert.ok(leggi(p).includes(`href="/mood/${f}"`), `${p} deve caricare mood/${f}`);
  }
  // l'elenco ufficiale (api/mood.js) e i file css coincidono, e l'anteprima del trainer accetta gli stessi mood
  const ufficiali = require("../mood").MOOD.map((m) => m.id);
  assert.deepEqual([...ufficiali].sort(), MOOD.map((f) => f.replace(".css", "")).sort(), "api/mood.js e web/mood/*.css devono coincidere");
  const anteprima = leggi("anteprima.js").match(/MOOD_ESISTENTI = \[([^\]]+)\]/)[1].match(/"([a-z]+)"/g).map((x) => x.replace(/"/g, ""));
  assert.deepEqual([...anteprima].sort(), [...ufficiali].sort(), "anteprima.js deve accettare gli stessi mood di api/mood.js");
  for (const m of require("../mood").MOOD) assert.ok(m.nome && m.descrizione, `${m.id}: nome e descrizione`);
  assert.match(leggi("scheda-server.js"), /setAttribute\("data-mood"/);
  assert.match(leggi("anteprima.js"), /setAttribute\("data-mood"/);
  const modello = fs.readFileSync(path.join(WEB, "..", "modello-scheda.html"), "utf8");
  assert.doesNotMatch(modello, /mood/, "la scheda scaricabile resta senza mood");
  assert.doesNotMatch(leggi("scheda.js"), /<\/script/i);
});

test("i colori dei giorni di sistema.css (editor delle schede) sono gli stessi del mood Lena", () => {
  const sistema = leggi("sistema.css"), lena = leggi("mood/lena.css");
  for (let i = 1; i <= 7; i++) {
    assert.equal(token(sistema, `giorno-${i}`).toLowerCase(), token(lena, `giorno-${i}`).toLowerCase(), `giorno ${i}`);
    assert.equal(token(sistema, `su-giorno-${i}`).toLowerCase(), token(lena, `su-giorno-${i}`).toLowerCase(), `scritta sul giorno ${i}`);
  }
});

test("i mood che il cliente può scegliere (api/mood.js) hanno tutti il loro css e il loro link nella scheda; scheda-server.js li prende dal server", () => {
  const { MOOD: scelte, PREDEFINITO } = require("../mood");
  assert.ok(scelte.some((m) => m.id === PREDEFINITO));
  const server = leggi("scheda-server.js"), html = leggi("scheda.html");
  for (const m of scelte) {
    assert.ok(MOOD.includes(`${m.id}.css`), `manca web/mood/${m.id}.css`);
    assert.ok(m.nome && m.descrizione, `${m.id}: servono nome e descrizione`);
    assert.ok(html.includes(`/mood/${m.id}.css`), `scheda.html non carica ${m.id}`);
  }
  assert.match(server, /md\.json\.disponibili/, "scheda-server.js deve prendere i mood validi da /api/me/mood, non da una lista copiata");
});
