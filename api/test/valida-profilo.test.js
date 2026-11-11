// Controlli sui dati del profilo del trainer (senza database).
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { erroreNome, erroreIndirizzo, erroreContatto } = require("../../web/valida-profilo");
const web = (f) => fs.readFileSync(path.join(__dirname, "..", "..", "web", f), "utf8");

test("nome: servono almeno due lettere", () => {
  for (const n of ["", "a", "1", "A.", "  7 "]) assert.ok(erroreNome(n), n);
  for (const n of ["Al", "Marco Rossi", "Studio Fit", "Élodie"]) assert.equal(erroreNome(n), null, n);
});

test("indirizzo del titolare: via e numero, CAP e città (non basta la sola via)", () => {
  for (const a of ["", "x", "1", "Via Roma", "Via Roma 12", "Via Roma 12, Milano", "Via Roma, 20121 Milano", "20121 Milano", "Via Roma 12, 20121", "Via Roma 12, 20121 M", "V 1, 20121 Milano", "Via Roma 12, 2012 Milano"])
    assert.ok(erroreIndirizzo(a), `«${a}» non dovrebbe passare`);
  for (const a of ["Via Roma 12, 20121 Milano", "Via Roma 12 20121 Milano", "Piazza del Duomo snc, 50122 Firenze", "Via dell'Industria 3/B, 10121 Torino (TO)", "Corso Vittorio Emanuele II 108, 00186 Roma"])
    assert.equal(erroreIndirizzo(a), null, a);
});

test("contatto: vuoto, email oppure telefono vero", () => {
  for (const c of ["", "   ", "marco@esempio.it", "+39 333 123 4567", "333 1234567", "02-1234567", "(02) 1234 5678"]) assert.equal(erroreContatto(c), null, c);
  for (const c of ["a", "1", "123", "marco@", "marco@esempio", "ciao", "12345", "+39 33", "@marco_trainer"]) assert.ok(erroreContatto(c), c);
});

test("il profilo usa gli stessi controlli nel browser e nel server", () => {
  assert.match(web("pt-profilo.html"), /<script src="\/valida-profilo\.js"><\/script>\s*<script src="\/profilo-comune\.js">/);
  const js = web("pt-profilo.js");
  assert.match(js, /LenaValidaProfilo\.erroreIndirizzo/);
  assert.match(js, /LenaValidaProfilo\.erroreContatto/);
  const srv = fs.readFileSync(path.join(__dirname, "..", "profilo-trainer.js"), "utf8");
  assert.match(srv, /require\("\.\.\/web\/valida-profilo"\)/);
  assert.match(srv, /erroreIndirizzo\(indirizzo\)/);
  assert.match(srv, /erroreContatto\(contatto\)/);
});
