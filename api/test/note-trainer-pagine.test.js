// Le note private del trainer: pagina e testi legali (senza database).
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const assert = require("node:assert/strict");

const w = (f) => fs.readFileSync(path.join(__dirname, "..", "..", "web", f), "utf8");

test("pagine: la pagina del cliente ha le note, avvisa sui dati di salute e i testi legali le citano", () => {
  const h = w("pt-cliente.html");
  for (const id of ["note-testo", "note-salva", "note-conta", "note-info"]) assert.match(h, new RegExp(`id="${id}"`));
  assert.match(h, /Note condivise/);
  assert.match(h, /Il cliente le può leggere in qualsiasi momento/);
  assert.doesNotMatch(h, /Note private/);
  assert.match(w("pt-note.js"), /\/note/);
  assert.match(w("pt-note.js"), /data-info/);
  assert.match(w("pt-cliente.js"), /LenaPtNote\.avvia\(id\)/);
  assert.match(w("privacy.html"), /Le note del tuo professionista/);
  assert.match(w("privacy.html"), /Note del tuo trainer/);
  assert.match(w("condizioni-pt.html"), /Note condivise con il cliente/);
  assert.match(fs.readFileSync(path.join(__dirname, "..", "..", "db", "initdb", "12_note_trainer.sql"), "utf8"), /note_trainer/);
});
