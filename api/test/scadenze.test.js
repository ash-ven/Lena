// Scadenza delle schede: l'ultimo giorno è inizio + settimane*7 - 1; i giorni che mancano si contano dall'«oggi» italiano.
const path = require("node:path");
const fs = require("node:fs");
const vm = require("node:vm");
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { avvia, db, sessione, creaPt, email, PASSWORD, pulisci } = require("./comune");
const { creaApp } = require("../app");

const WEB = path.join(__dirname, "..", "..", "web");
let server, BASE, pt, s;
const clienti = {};
before(async () => {
  server = await avvia(creaApp()); BASE = `http://localhost:${server.address().port}`;
  pt = await creaPt("sc-pt", "Trainer Scadenze");
  s = sessione(() => BASE);
  assert.equal((await s("POST", "/api/auth/login", { email: email("sc-pt"), password: PASSWORD })).stato, 200);
});
after(async () => { await pulisci(); await new Promise((ok) => server.close(ok)); await db.end(); });

// Crea un cliente con una scheda che finisce tra "giorniAllaFine" giorni (negativo = già finita), di "settimane" settimane
async function cliente(nome, giorniAllaFine, settimane = 4) {
  const c = await db.query("INSERT INTO cliente (pt_id, nome, cognome) VALUES ($1, $2, 'Scadenza') RETURNING id", [pt.ptId, nome]);
  await db.query(
    `INSERT INTO scheda (cliente_id, inizio, settimane, dati)
     VALUES ($1, (now() AT TIME ZONE 'Europe/Rome')::date + $2::int - ($3::int * 7 - 1), $3, '{}')`, [c.rows[0].id, giorniAllaFine, settimane]);
  clienti[nome] = c.rows[0].id;
}
const leggi = async () => Object.fromEntries((await s("GET", "/api/clienti")).json.map((x) => [x.nome, x]));

test("l'elenco dice quanti giorni mancano alla fine della scheda più recente", async () => {
  await cliente("Dieci", 10); await cliente("Oggi", 0); await cliente("Ieri", -1); await cliente("Lontana", 40, 8);
  const c = await leggi();
  assert.equal(c.Dieci.giorni_alla_scadenza, 10); assert.equal(c.Oggi.giorni_alla_scadenza, 0); assert.equal(c.Ieri.giorni_alla_scadenza, -1);
  assert.equal(c.Lontana.giorni_alla_scadenza, 40);
  assert.ok(c.Dieci.scheda_scade_il);
});

test("conta la scheda più RECENTE, non la più vecchia", async () => {
  await cliente("DueSchede", -30);
  await db.query(`INSERT INTO scheda (cliente_id, inizio, settimane, dati, creata_il)
    VALUES ($1, (now() AT TIME ZONE 'Europe/Rome')::date, 4, '{}', now() + interval '1 minute')`, [clienti.DueSchede]);
  assert.equal((await leggi()).DueSchede.giorni_alla_scadenza, 27);
});

test("senza schede non c'è nessuna scadenza", async () => {
  const c = await db.query("INSERT INTO cliente (pt_id, nome, cognome) VALUES ($1, 'Vuoto', 'Scadenza') RETURNING id", [pt.ptId]);
  const x = (await s("GET", `/api/clienti/${c.rows[0].id}`)).json;
  assert.equal(x.giorni_alla_scadenza, null); assert.equal(x.scheda_scade_il, null);
});

// Il testo si decide nel browser (web/pt-comune.js): lo si prova caricando quel file in un ambiente finto
test("i testi delle scadenze: domani, oggi, tra N giorni, scaduta da N giorni; oltre 14 giorni niente", () => {
  const ctx = { window: {}, document: {}, Lena: {}, location: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(WEB, "pt-comune.js"), "utf8"), ctx);
  const f = (g, extra = {}) => ctx.window.LenaPt.scadenza({ schede: 1, giorni_alla_scadenza: g, scheda_scade_il: "2026-12-01", ...extra });
  assert.equal(f(10).testo, "scade tra 10 giorni");
  assert.equal(f(2).testo, "scade tra 2 giorni");
  assert.equal(f(1).testo, "scade domani");
  assert.equal(f(0).testo, "scade oggi");
  assert.equal(f(-1).testo, "scaduta da 1 giorno");
  assert.equal(f(-5).testo, "scaduta da 5 giorni"); assert.equal(f(-5).scaduta, true);
  assert.equal(f(14).testo, "scade tra 14 giorni");
  assert.equal(f(15), null);
  assert.equal(f(3, { rapporto_finito_il: "2026-10-01" }), null, "rapporto concluso: niente avvisi");
  assert.equal(f(3, { schede: 0 }), null);
  assert.equal(f(null), null);
});

test("la pagina dei clienti ha la sezione «Schede in scadenza»", () => {
  assert.match(fs.readFileSync(path.join(WEB, "pt.html"), "utf8"), /id="elenco-scadenze"/);
});
