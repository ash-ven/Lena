// Test della conservazione dei dati: calcolo delle scadenze, modalità prova, cancellazione, ultima attività, «rapporto concluso».
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { CONSENSO, email, PASSWORD, avvia, sessione, creaPt, datiProva, pulisci, db } = require("./comune");   // per primo: legge .env
const { creaApp } = require("../app");
const { mesiConservazione, MESI_CONSERVAZIONE_DEFAULT } = require("../config");
const { sottraiMesi, limite, motivoScadenza, trovaScaduti, eseguiPulizia } = require("../conservazione");

const data = (s) => new Date(s);
const giorni = (n) => new Date(Date.now() - n * 864e5);

// ---------- calcolo delle scadenze (senza database) ----------

test("sottrarre mesi a una data: giorno del mese, fine mese, anno bisestile, cambio anno", () => {
  assert.equal(sottraiMesi(data("2026-11-06T10:00:00Z"), 24).toISOString(), "2024-11-06T10:00:00.000Z");
  assert.equal(sottraiMesi(data("2026-03-31T00:00:00Z"), 1).toISOString(), "2026-02-28T00:00:00.000Z", "31 marzo - 1 mese = 28 febbraio");
  assert.equal(sottraiMesi(data("2028-03-31T00:00:00Z"), 1).toISOString(), "2028-02-29T00:00:00.000Z", "anno bisestile");
  assert.equal(sottraiMesi(data("2026-01-15T00:00:00Z"), 2).toISOString(), "2025-11-15T00:00:00.000Z", "attraversa l'anno");
  assert.equal(sottraiMesi(data("2026-11-06T00:00:00Z"), 120).toISOString(), "2016-11-06T00:00:00.000Z");
  assert.equal(limite(data("2026-11-06T00:00:00Z"), 12).toISOString(), "2025-11-06T00:00:00.000Z");
});

test("chi è scaduto: con rapporto concluso conta la data di conclusione, altrimenti l'ultima attività", () => {
  const lim = data("2024-11-06T00:00:00Z");
  const scaduto = (c) => motivoScadenza(c, lim);
  assert.equal(scaduto({ ultima_attivita: "2025-01-01T00:00:00Z", rapporto_finito_il: null }), null, "attivo di recente");
  assert.equal(scaduto({ ultima_attivita: "2024-11-07T00:00:00Z", rapporto_finito_il: null }), null, "un giorno prima del limite: non ancora");
  assert.equal(scaduto({ ultima_attivita: "2024-11-06T00:00:00Z", rapporto_finito_il: null }), null, "esattamente sul limite: non ancora (serve «più vecchio»)");
  const inattivo = scaduto({ ultima_attivita: "2024-11-05T23:59:59Z", rapporto_finito_il: null });
  assert.equal(inattivo.motivo, "nessuna attività");
  assert.equal(scaduto({ ultima_attivita: "2020-01-01T00:00:00Z", rapporto_finito_il: "2025-06-01T00:00:00Z" }), null,
    "rapporto concluso da poco: non si cancella, anche se l'ultima attività è vecchia");
  const concluso = scaduto({ ultima_attivita: "2026-01-01T00:00:00Z", rapporto_finito_il: "2024-01-01T00:00:00Z" });
  assert.equal(concluso.motivo, "rapporto concluso");
  assert.equal(concluso.data.toISOString(), "2024-01-01T00:00:00.000Z");
});

test("MESI_CONSERVAZIONE: default 24, numeri validi accettati, il resto rifiutato con un messaggio chiaro", () => {
  assert.equal(MESI_CONSERVAZIONE_DEFAULT, 24);
  assert.equal(mesiConservazione({}), 24);
  assert.equal(mesiConservazione({ MESI_CONSERVAZIONE: "" }), 24);
  assert.equal(mesiConservazione({ MESI_CONSERVAZIONE: "12" }), 12);
  assert.equal(mesiConservazione({ MESI_CONSERVAZIONE: " 36 " }), 36);
  for (const male of ["0", "-3", "abc", "12.5", "121", "1e2", "12 mesi"]) {
    assert.throws(() => mesiConservazione({ MESI_CONSERVAZIONE: male }), /MESI_CONSERVAZIONE/, male);
  }
  const esempio = fs.readFileSync(path.join(__dirname, "..", ".env.example"), "utf8");
  assert.match(esempio, /^MESI_CONSERVAZIONE=24$/m, "il valore di esempio è scritto in .env.example");
});

// ---------- con il database ----------

let server, BASE;
const pt = sessione(() => BASE), altroPt = sessione(() => BASE), anonimo = sessione(() => BASE);
const K = {};   // clienti di prova

before(async () => {
  server = await avvia(creaApp({ limiteAccesso: 1000 }));
  BASE = `http://localhost:${server.address().port}`;
  await creaPt("pt-cons", "PT conservazione"); await creaPt("pt-altro", "Altro PT");
  assert.equal((await pt("POST", "/api/auth/login", { email: email("pt-cons"), password: PASSWORD })).stato, 200);
  assert.equal((await altroPt("POST", "/api/auth/login", { email: email("pt-altro"), password: PASSWORD })).stato, 200);
  // quattro clienti, con date scelte da noi: vecchio inattivo, concluso da tempo, concluso da poco, attivo
  for (const [chiave, nome] of [["vecchio", "Vera"], ["concluso", "Carlo"], ["recente", "Rita"], ["attivo", "Aldo"]]) {
    const c = (await pt("POST", "/api/clienti", { nome, cognome: "Conservazione" })).json;
    const s = (await pt("POST", `/api/clienti/${c.id}/schede`, { dati: datiProva(nome, "Conservazione") })).json.id;
    K[chiave] = { id: c.id, schedaId: s };
  }
  await db.query("UPDATE cliente SET ultima_attivita = $2 WHERE id = $1", [K.vecchio.id, giorni(900)]);                        // ~30 mesi fa
  await db.query("UPDATE cliente SET rapporto_finito_il = $2, ultima_attivita = $2 WHERE id = $1", [K.concluso.id, giorni(800)]); // concluso ~26 mesi fa
  await db.query("UPDATE cliente SET rapporto_finito_il = $2, ultima_attivita = $3 WHERE id = $1", [K.recente.id, giorni(20), giorni(1000)]);
});
after(async () => {
  assert.equal(await pulisci(), 0);
  await new Promise((ok) => server.close(ok));
  await db.end();
});
const tutti = () => [K.vecchio.id, K.concluso.id, K.recente.id, K.attivo.id];
const esiste = async (id) => (await db.query("SELECT count(*)::int n FROM cliente WHERE id = $1", [id])).rows[0].n;

test("trovaScaduti: elenca chi è scaduto e perché, e non tocca nessuno", async () => {
  const r = await trovaScaduti({ mesi: 24, soloIds: tutti() });
  assert.deepEqual(r.scaduti.map((c) => [c.id, c.motivo]).sort(), [[K.concluso.id, "rapporto concluso"], [K.vecchio.id, "nessuna attività"]].sort());
  for (const id of tutti()) assert.equal(await esiste(id), 1, "trovarli non li cancella");
  // con un periodo più lungo (48 mesi) non è scaduto nessuno
  assert.equal((await trovaScaduti({ mesi: 48, soloIds: tutti() })).scaduti.length, 0);
  // con un periodo più corto (1 mese) lo è anche il rapporto concluso 20 giorni fa? no: 20 giorni < 1 mese
  const corto = (await trovaScaduti({ mesi: 1, soloIds: tutti() })).scaduti.map((c) => c.id);
  assert.ok(corto.includes(K.vecchio.id) && corto.includes(K.concluso.id) && !corto.includes(K.recente.id));
  // il "tempo" si può simulare: tra 3 anni anche il rapporto concluso da poco sarebbe scaduto
  const futuro = await trovaScaduti({ adesso: new Date(Date.now() + 3 * 365 * 864e5), mesi: 24, soloIds: tutti() });
  assert.ok(futuro.scaduti.some((c) => c.id === K.recente.id));
});

test("modalità --prova (anche senza argomenti): elenca soltanto e non cancella; argomenti sbagliati rifiutati", async () => {
  const script = path.join(__dirname, "..", "pulizia.js");
  const lancia = (...a) => {
    try { return { codice: 0, uscita: execFileSync("node", [script, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) }; }
    catch (e) { return { codice: e.status, uscita: String(e.stdout) + String(e.stderr) }; }
  };
  for (const args of [[], ["--prova"]]) {
    const r = lancia(...args);
    assert.equal(r.codice, 0, r.uscita);
    assert.match(r.uscita, /Conservazione: 24 mesi/);
    assert.match(r.uscita, new RegExp(`id ${K.vecchio.id}: Vera Conservazione .*nessuna attività`));
    assert.match(r.uscita, new RegExp(`id ${K.concluso.id}: Carlo Conservazione .*rapporto concluso`));
    assert.ok(!r.uscita.includes(`id ${K.attivo.id}:`) && !r.uscita.includes(`id ${K.recente.id}:`), "gli altri non sono elencati");
    assert.match(r.uscita, /MODALITÀ PROVA/);
    assert.match(r.uscita, /Non ho toccato niente/);
  }
  for (const id of tutti()) assert.equal(await esiste(id), 1);

  for (const args of [["--esegui", "--prova"], ["--cancella"], ["--prova", "x"]]) {
    const r = lancia(...args);
    assert.equal(r.codice, 1, args.join(" "));
    assert.match(r.uscita, /Uso: node pulizia\.js/);
  }
  for (const id of tutti()) assert.equal(await esiste(id), 1, "gli argomenti sbagliati non cancellano");
  // un valore di configurazione sbagliato ferma lo script senza fare niente
  try { execFileSync("node", [script], { encoding: "utf8", env: { ...process.env, MESI_CONSERVAZIONE: "abc" }, stdio: ["ignore", "pipe", "pipe"] }); assert.fail("doveva fermarsi"); }
  catch (e) { assert.equal(e.status, 1); assert.match(String(e.stdout) + String(e.stderr), /MESI_CONSERVAZIONE deve essere/); }
});

test("eseguiPulizia: cancella solo gli scaduti (con schede e account) e lascia gli altri intatti", async () => {
  // il "concluso" ha anche un account e dei progressi: devono sparire con lui
  const codice = (await pt("POST", `/api/clienti/${K.concluso.id}/invito`)).json.codice;
  const s = sessione(() => BASE);
  assert.equal((await s("POST", "/api/auth/registra-cliente", { ...CONSENSO, codice, email: email("carlo"), password: "PasswordCliente1" })).stato, 201);
  await s("PUT", `/api/schede/${K.concluso.schedaId}/registrazioni`, { voci: [{ tipo: "kg", chiave: "1|A|1", valore: "50" }] });
  await db.query("UPDATE cliente SET rapporto_finito_il = $2, ultima_attivita = $2 WHERE id = $1", [K.concluso.id, giorni(800)]);   // il salvataggio sopra aveva rinfrescato la data
  const utenteCarlo = (await db.query("SELECT id FROM utente WHERE email = $1", [email("carlo")])).rows[0].id;

  const r = await eseguiPulizia({ mesi: 24, soloIds: tutti() });
  assert.deepEqual(r.cancellati.map((c) => c.id).sort(), [K.concluso.id, K.vecchio.id].sort());
  assert.deepEqual(r.falliti, []);
  for (const id of [K.vecchio.id, K.concluso.id]) assert.equal(await esiste(id), 0);
  for (const id of [K.recente.id, K.attivo.id]) assert.equal(await esiste(id), 1, "gli altri restano");
  const resti = await db.query(`SELECT (SELECT count(*) FROM utente WHERE id = $1)::int u, (SELECT count(*) FROM scheda WHERE id = $2)::int s,
    (SELECT count(*) FROM registrazione WHERE scheda_id = $2)::int r, (SELECT count(*) FROM consenso WHERE utente_id = $1)::int k`, [utenteCarlo, K.concluso.schedaId]);
  assert.deepEqual(resti.rows[0], { u: 0, s: 0, r: 0, k: 0 }, "account, scheda, progressi e consensi cancellati insieme al cliente");
  assert.equal((await s("GET", "/api/me/scheda")).stato, 401, "il suo vecchio cookie non vale più");
  assert.equal((await eseguiPulizia({ mesi: 24, soloIds: tutti() })).cancellati.length, 0, "rilanciata non trova più niente");
});

// ---------- ultima attività ----------

test("l'ultima attività si aggiorna quando il cliente salva un valore e quando il professionista carica una scheda", async () => {
  const c = K.attivo;
  const leggi = async () => new Date((await db.query("SELECT ultima_attivita FROM cliente WHERE id = $1", [c.id])).rows[0].ultima_attivita).getTime();
  await db.query("UPDATE cliente SET ultima_attivita = $2 WHERE id = $1", [c.id, giorni(100)]);
  assert.ok(Date.now() - (await leggi()) > 99 * 864e5);

  await pt("POST", `/api/clienti/${c.id}/schede`, { dati: datiProva("Aldo", "Conservazione") });
  assert.ok(Date.now() - (await leggi()) < 15000, "caricare una scheda è un'attività");

  const codice = (await pt("POST", `/api/clienti/${c.id}/invito`)).json.codice;
  const s = sessione(() => BASE);
  await s("POST", "/api/auth/registra-cliente", { ...CONSENSO, codice, email: email("aldo"), password: "PasswordCliente1" });
  await db.query("UPDATE cliente SET ultima_attivita = $2 WHERE id = $1", [c.id, giorni(100)]);
  const sched = (await s("GET", "/api/me/scheda")).json.scheda.id;
  assert.equal((await s("PUT", `/api/schede/${sched}/registrazioni`, { voci: [{ tipo: "kg", chiave: "1|A|1", valore: "20" }] })).stato, 200);
  assert.ok(Date.now() - (await leggi()) < 15000, "salvare un valore è un'attività");

  // una richiesta rifiutata non conta come attività
  await db.query("UPDATE cliente SET ultima_attivita = $2 WHERE id = $1", [c.id, giorni(100)]);
  assert.equal((await s("PUT", `/api/schede/${sched}/registrazioni`, { voci: [{ tipo: "peso", chiave: "x", valore: "1" }] })).stato, 400);
  assert.ok(Date.now() - (await leggi()) > 99 * 864e5, "un salvataggio rifiutato non cambia la data");
});

// ---------- rapporto concluso ----------

test("«Rapporto concluso»: si segna, si vede nell'elenco, si annulla; solo il PT del cliente può farlo", async () => {
  const c = K.recente;   // è già concluso da 20 giorni
  const stato = async () => (await pt("GET", `/api/clienti/${c.id}`)).json;
  assert.ok((await stato()).rapporto_finito_il, "già concluso");

  const riapri = await pt("PUT", `/api/clienti/${c.id}/rapporto`, { concluso: false });
  assert.equal(riapri.stato, 200);
  assert.equal(riapri.json.rapporto_finito_il, null);
  assert.equal((await stato()).rapporto_finito_il, null, "riaperto: reversibile");
  assert.ok((await pt("GET", "/api/clienti")).json.find((x) => x.id === c.id).ultima_attivita, "ultima_attivita compare nell'elenco");

  const prima = Date.now();
  const chiudi = await pt("PUT", `/api/clienti/${c.id}/rapporto`, { concluso: true });
  assert.equal(chiudi.stato, 200);
  assert.ok(Math.abs(new Date(chiudi.json.rapporto_finito_il).getTime() - prima) < 15000);
  const data1 = (await stato()).rapporto_finito_il;
  await new Promise((ok) => setTimeout(ok, 30));
  await pt("PUT", `/api/clienti/${c.id}/rapporto`, { concluso: true });
  assert.equal((await stato()).rapporto_finito_il, data1, "segnarlo due volte non cambia la data di conclusione");

  for (const corpo of [{}, { concluso: "true" }, { concluso: 1 }, null]) assert.equal((await pt("PUT", `/api/clienti/${c.id}/rapporto`, corpo === null ? undefined : corpo)).stato, 400);
  assert.equal((await altroPt("PUT", `/api/clienti/${c.id}/rapporto`, { concluso: false })).stato, 404, "un altro professionista: 404");
  assert.ok((await stato()).rapporto_finito_il, "e non ha cambiato niente");
  assert.equal((await anonimo("PUT", `/api/clienti/${c.id}/rapporto`, { concluso: true })).stato, 401);
});

test("la pagina del cliente ha il pulsante «Rapporto concluso»", () => {
  const web = path.join(__dirname, "..", "..", "web");
  assert.match(fs.readFileSync(path.join(web, "pt-cliente.html"), "utf8"), /id="rapporto-bottone"/);
  assert.match(fs.readFileSync(path.join(web, "pt-comune.js"), "utf8"), /Rapporto concluso il/);
});
