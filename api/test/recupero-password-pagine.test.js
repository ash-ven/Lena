// Il recupero della password: pagine e file (senza database).
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const WEB = path.join(__dirname, "..", "..", "web");
const API = path.join(__dirname, "..");
const w = (f) => fs.readFileSync(path.join(WEB, f), "utf8");

test("il login rimanda al recupero; le due pagine esistono e hanno i campi giusti", () => {
  assert.match(w("login.html"), /href="\/password-dimenticata\.html"/);
  assert.match(w("password-dimenticata.html"), /id="email"/);
  assert.match(w("password-dimenticata.js"), /\/api\/auth\/password-dimenticata/);
  assert.match(w("nuova-password.html"), /autocomplete="new-password"/);
  assert.match(w("nuova-password.js"), /\/api\/auth\/nuova-password/);
  // la risposta è uguale per tutti: la pagina non dice mai se l'email ha un account
  assert.match(w("password-dimenticata.js"), /Se questa email ha un account/);
  assert.doesNotMatch(w("password-dimenticata.js"), /non esiste|non è registrata|nessun account/i);
});

test("migrazione 10, posta e README sono al loro posto", () => {
  const sql = fs.readFileSync(path.join(API, "..", "db", "initdb", "10_reimposta_password.sql"), "utf8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS reimposta_password/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS sessioni_dal/);
  assert.match(fs.readFileSync(path.join(API, "posta.js"), "utf8"), /NODE_ENV === "production"/);
  assert.match(fs.readFileSync(path.join(API, "README.md"), "utf8"), /Recupero della password/);
});
