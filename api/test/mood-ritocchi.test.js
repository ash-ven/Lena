// Ritocchi ai mood (11/11): bilanciere sempre simmetrico, striscia di Tatami, velluto, animazione finale. Senza database.
const path = require("node:path");
const fs = require("node:fs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const web = (f) => fs.readFileSync(path.join(__dirname, "..", "..", "web", f), "utf8");

test("Old School: un disco per blocco su OGNI lato, così il bilanciere è simmetrico anche con blocchi dispari", () => {
  const js = web("scheda.js"), css = web("mood/oldschool.css");
  assert.match(js, /MOOD === "oldschool"\) return \[el\("span",\{class:"lato sx"\}, g\.blocchi\.map\(tappa\)\), el\("span",\{class:"lato dx"\}, g\.blocchi\.map\(tappa\)\)\]/);
  assert.doesNotMatch(css, /nth-child\((odd|even)\)/, "niente più dischi alternati a destra e a sinistra");
  assert.match(css, /\.lato\.sx \{ flex-direction: row-reverse; \}/);
});

test("Tatami: la striscia di avanzamento ha un riquadro per blocco, niente cintura con nodo e nastrini", () => {
  const css = web("mood/tatami.css");
  assert.match(css, /tatami-pennellata/);
  assert.doesNotMatch(css, /tatami-stringe|tatami-nastrino/);
  assert.doesNotMatch(css, /\.avanzamento::(before|after)/);
});

test("Velluto: il fondo ha riflesso e pelo del tessuto, e la barra in alto è lo stesso tessuto del fondo", () => {
  const css = web("mood/velluto.css");
  assert.match(css, /\[data-mood="velluto"\] body,\s*\[data-mood="velluto"\] \.barra \{/);
  assert.match(css, /repeating-linear-gradient\(45deg/);
  assert.match(css, /background-attachment: fixed;/);
});

test("«Inizia allenamento»: finendo, si torna alla scheda e l'animazione del completamento riparte e si porta in vista", () => {
  const js = web("scheda.js");
  assert.match(js, /chiudiAllenamento\(\); festeggia\(\); return;/);
  assert.match(js, /function festeggia\(\)/);
  assert.match(js, /b\.classList\.remove\("appena"\); void b\.offsetWidth; b\.classList\.add\("appena"\);/);
  assert.match(js, /prefers-reduced-motion: reduce/);
});
