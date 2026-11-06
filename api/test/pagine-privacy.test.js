// Le pagine dell'informativa e delle condizioni: controllano la STRUTTURA (versione, link, accessibilità),
// non le parole. Quando il testo segnaposto verrà sostituito con quello vero, questi test continuano a passare.
const path = require("node:path");
const fs = require("node:fs");
const { test } = require("node:test");
const assert = require("node:assert/strict");

const WEB = path.join(__dirname, "..", "..", "web");
const leggi = (f) => fs.readFileSync(path.join(WEB, f), "utf8");

test("informativa e condizioni: mostrano la versione, hanno un titolo e usano il tema del sito", () => {
  for (const f of ["privacy.html", "condizioni-pt.html"]) {
    const html = leggi(f);
    assert.match(html, /<h1[^>]*>[^<]+<\/h1>/, `${f}: manca il titolo`);
    assert.match(html, /id="versione"/, `${f}: manca la riga con la versione`);
    assert.match(html, /href="\/sistema\.css"/, `${f}: non usa il sistema grafico`);
    assert.match(html, /<html lang="it">/);
    assert.doesNotMatch(html, /style="/, `${f}: stile scritto nella pagina`);
    assert.ok(!/#[0-9a-fA-F]{3,8}/.test(html.replace(/<meta name="theme-color"[^>]*>/, "")), `${f}: colore scritto a mano`);
    for (const m of html.matchAll(/<script\b([^>]*)>/g)) assert.match(m[1], /\bsrc=/, `${f}: script scritto dentro la pagina`);
  }
  // la versione la scrive il codice leggendola dal server: nelle pagine non c'è scritta a mano
  assert.match(leggi("privacy.js"), /\/api\/privacy\/versioni/);
  assert.match(leggi("condizioni-pt.js"), /\/api\/privacy\/versioni/);
});

test("informativa: ha almeno 8 sezioni (titolare, responsabile, dati, finalità, durata, destinatari, diritti, hosting); finché è un segnaposto i campi da compilare sono in evidenza", () => {
  const html = leggi("privacy.html");
  assert.ok((html.match(/<h2\b/g) || []).length >= 8, "un'informativa ha almeno 8 sezioni");
  // questo controllo vale SOLO finché il testo è ancora il segnaposto: sostituito con quello vero, non si applica più
  if (/TESTO DA SOSTITUIRE/.test(html)) {
    assert.ok((html.match(/class="segnaposto"/g) || []).length >= 8, "i campi da compilare devono essere evidenziati");
    assert.match(leggi("pt.css"), /\.segnaposto\s*\{/);
  }
});

test("link all'informativa a piè di pagina in login, registrazione, scheda e area del PT; le condizioni anche nell'area del PT", () => {
  for (const f of ["login.html", "registrati.html", "scheda.html", "pt.html", "pt-cliente.html"]) {
    assert.match(leggi(f), /<footer class="piede-legale">[^]*href="\/privacy\.html"/, `${f}: manca il link all'informativa`);
  }
  for (const f of ["pt.html", "pt-cliente.html"]) assert.match(leggi(f), /href="\/condizioni-pt\.html"/, `${f}: manca il link alle condizioni`);
});
