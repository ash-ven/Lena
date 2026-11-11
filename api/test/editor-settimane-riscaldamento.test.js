// Editor: suggerimenti sotto il campo, video ricordato, progressione settimana per settimana, riscaldamento per giorno. Senza database.
const path = require("node:path");
const fs = require("node:fs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { statoDaDati } = require("../../web/da-scheda.js");
const { erroreScheda } = require("../../web/valida-scheda.js");
const { eserciziDellaScheda } = require("../libreria");

const web = (f) => fs.readFileSync(path.join(__dirname, "..", "..", "web", f), "utf8");
const esempio = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "esempio", "scheda-esempio.json"), "utf8"));
const copia = () => JSON.parse(JSON.stringify(esempio.dati || esempio));

test("suggerimenti: niente datalist del browser, elenco proprio sotto il campo e largo come il campo", () => {
  assert.doesNotMatch(web("pt-editor.html"), /datalist/);
  const js = web("pt-editor.js"), css = web("pt.css");
  assert.doesNotMatch(js, /datalist|list: o\.lista/);
  assert.match(js, /role: "listbox"/);
  assert.match(js, /setAttribute\("role", "combobox"\)/);
  assert.match(js, /ev\.key === "ArrowDown"/);
  assert.match(js, /ev\.key === "Escape"/);
  assert.match(css, /\.combo\{position:relative\}/);
  assert.match(css, /\.suggerimenti\{position:absolute;top:100%;left:0;right:0/, "si apre verso il basso e ha la larghezza del campo");
});

test("video ricordato: si ricompila anche quando la ricerca risponde dopo l'ultima lettera, e vale subito nel resto della scheda", () => {
  const js = web("pt-editor.js");
  assert.match(js, /function proponiVideo\(input, oggetto\)/);
  assert.match(js, /proponiVideo\(input, oggetto\);   \/\/ la risposta può arrivare dopo l'ultima lettera/);
  assert.match(js, /locali\.set\(nome, v\)/);
  assert.match(js, /locali\.get\(k\) \|\| \(conosciuti\.get\(k\) \|\| \{\}\)\.video/);
});

test("progressione per settimana: la scelta è fuori da «Altro» e accetta 6x6 poi 6x7", () => {
  const js = web("pt-editor.js");
  assert.match(js, /Serie e ripetizioni cambiano ogni settimana/);
  assert.match(js, /cambia, schema,\s*campoVideo\(b\)/, "la scelta sta sull'esercizio, non nascosta");
  assert.match(js, /"Altro: note e progressione"/);
  assert.match(js, /\.replace\(\/\[×\*\]\/g, "x"\)/, "anche «6×7» va bene");
  // lo schema che l'editor costruisce passa il controllo ed è quello che la scheda mostra settimana per settimana
  const dati = copia();
  const g = dati.giorni[0];
  const b = g.blocchi.find((x) => x.tipo === "esercizio");
  b.schema = ["6x6", "6x7", "6x8"]; b.serie = "6"; b.rip = "6";
  assert.equal(erroreScheda(dati), null);
  const s = statoDaDati(dati, "2030-01-02");
  const bs = s.giorni[0].blocchi.find((x) => x.tipo === "esercizio");
  assert.equal(bs.perSettimana, true);
  assert.deepEqual(bs.schema.slice(0, 3), ["6x6", "6x7", "6x8"]);
});

test("riscaldamento per giorno: validazione, ritorno nel modulo, libreria e scheda del cliente", () => {
  const dati = copia();
  assert.equal(statoDaDati(dati, "2030-01-02").riscPerGiorno, false);
  dati.giorni[1].riscaldamento = { voce: "Riscaldamento", durata: "8'", istruzione: "Solo spalle", esercizi: [["Band pull apart", "https://example.com/v"]] };
  assert.equal(erroreScheda(dati), null);
  const s = statoDaDati(dati, "2030-01-02");
  assert.equal(s.riscPerGiorno, true);
  assert.equal(s.giorni[1].risc.durata, "8'");
  assert.equal(s.giorni[1].risc.esercizi[0].nome, "Band pull apart");
  assert.equal(s.giorni[0].risc, undefined, "un giorno senza riscaldamento suo usa quello comune");
  assert.ok(eserciziDellaScheda(dati).some((e) => e.nome === "Band pull apart" && e.video === "https://example.com/v"));
  const rotto = copia(); rotto.giorni[0].riscaldamento = { esercizi: "no" };
  assert.match(erroreScheda(rotto), /giorno .*riscaldamento/);
  const rotto2 = copia(); rotto2.giorni[0].riscaldamento = { esercizi: [["Ok", "javascript:alert(1)"]] };
  assert.match(erroreScheda(rotto2), /riscaldamento/);
  assert.match(web("scheda.js"), /const R = g\.riscaldamento \|\| DATI\.riscaldamento/);
  assert.match(web("pt-editor.js"), /Uguale per tutti i giorni/);
});
