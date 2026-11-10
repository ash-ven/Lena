// Gli appunti del trainer: pagina, script e migrazione (senza database).
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const assert = require("node:assert/strict");

const radice = path.join(__dirname, "..", "..");
const w = (f) => fs.readFileSync(path.join(radice, "web", f), "utf8");

test("pagine: la pagina del cliente ha la sezione «Appunti per me» e dice che non vanno nel file del cliente", () => {
  const h = w("pt-cliente.html");
  for (const id of ["appunti-testo", "appunti-salva", "appunti-conta", "appunti-salute", "appunti-esito"]) assert.match(h, new RegExp(`id="${id}"`));
  assert.match(h, /Non entra nel file che il cliente può scaricare/);
  assert.match(w("pt-note.js"), /"appunti"/);
  assert.match(w("pt-note.js"), /LenaParoleSalute/);
  assert.match(w("condizioni-pt.html"), /Appunti per me/);
  assert.match(fs.readFileSync(path.join(radice, "db", "initdb", "13_appunti_trainer.sql"), "utf8"), /appunti_trainer/);
});

test("appunti: nessuna esportazione li include", () => {
  for (const f of ["operazioni.js", "me.js", "clienti.js"]) {
    const codice = fs.readFileSync(path.join(radice, "api", f), "utf8");
    const dentroEsporta = codice.split("\n").filter((r) => /SELECT/.test(r) && /appunti_trainer/.test(r));
    assert.ok(f === "clienti.js" ? dentroEsporta.length >= 1 : dentroEsporta.length === 0, `${f}: gli appunti compaiono dove non dovrebbero`);
  }
});
