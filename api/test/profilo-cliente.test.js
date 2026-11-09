// Il profilo del cliente: la sua foto, visibile a lui e al SUO trainer; esportata e cancellata con i suoi dati.
const path = require("node:path");
const fs = require("node:fs");
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const { avvia, db, sessione, creaPt, email, PASSWORD, pulisci } = require("./comune");
const { creaApp } = require("../app");

const WEB = path.join(__dirname, "..", "..", "web");
const leggi = (f) => fs.readFileSync(path.join(WEB, f), "utf8");
let server, BASE, pt1, pt2, c1, c2;
const jpeg = (n = 300) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(n, 9), Buffer.from([0xff, 0xd9])]);

async function creaCliente(nomeEmail, pt, nome) {
  const hash = await bcrypt.hash(PASSWORD, 4);
  const u = await db.query("INSERT INTO utente (email, password_hash, ruolo) VALUES ($1, $2, 'cliente') RETURNING id", [email(nomeEmail), hash]);
  const c = await db.query("INSERT INTO cliente (pt_id, utente_id, nome, cognome) VALUES ($1, $2, $3, 'Prova') RETURNING id", [pt.ptId, u.rows[0].id, nome]);
  return { utenteId: u.rows[0].id, clienteId: c.rows[0].id };
}
async function entra(nomeEmail) {
  const s = sessione(() => BASE);
  assert.equal((await s("POST", "/api/auth/login", { email: email(nomeEmail), password: PASSWORD })).stato, 200);
  return s;
}
const mettiFoto = async (s, corpo, tipo = "image/jpeg") => {
  const res = await fetch(BASE + "/api/me/foto", { method: "PUT", headers: { "Content-Type": tipo, Cookie: s.cookie() }, body: corpo });
  let json = null; try { json = await res.json(); } catch (e) { /* senza corpo */ }
  return { stato: res.status, json };
};
const scaricaDelPt = (s, id) => fetch(`${BASE}/api/clienti/${id}/foto`, { headers: { Cookie: s.cookie() } });

before(async () => {
  server = await avvia(creaApp()); BASE = `http://localhost:${server.address().port}`;
  pt1 = await creaPt("pc-pt1", "Trainer Uno"); pt2 = await creaPt("pc-pt2", "Trainer Due");
  c1 = await creaCliente("pc-cli1", pt1, "Anna"); c2 = await creaCliente("pc-cli2", pt2, "Bruno");
});
after(async () => { await pulisci(); await new Promise((ok) => server.close(ok)); await db.end(); });

test("il cliente legge il suo profilo; senza login 401; il trainer non usa le rotte del cliente", async () => {
  const s = await entra("pc-cli1");
  const r = await s("GET", "/api/me/profilo");
  assert.equal(r.stato, 200); assert.equal(r.json.nome, "Anna"); assert.equal(r.json.cognome, "Prova"); assert.equal(r.json.haFoto, false); assert.equal(r.json.inizio, null);
  assert.equal((await sessione(() => BASE)("GET", "/api/me/profilo")).stato, 401);
  const t = await entra("pc-pt1");
  assert.equal((await t("GET", "/api/me/profilo")).stato, 403);
  assert.equal((await mettiFoto(t, jpeg())).stato, 403);
});

test("«in allenamento dal» è l'inizio della scheda più vecchia", async () => {
  await db.query("INSERT INTO scheda (cliente_id, inizio, settimane, dati) VALUES ($1, '2026-10-05', 8, '{}'), ($1, '2026-09-01', 4, '{}')", [c1.clienteId]);
  const s = await entra("pc-cli1");
  assert.match(String((await s("GET", "/api/me/profilo")).json.inizio), /2026-09-01/);
});

test("foto: il cliente la carica, la rilegge uguale, la rimuove", async () => {
  const s = await entra("pc-cli1");
  const originale = jpeg(400);
  const r = await mettiFoto(s, originale);
  assert.equal(r.stato, 200); assert.equal(r.json.haFoto, true);
  const g = await fetch(BASE + "/api/me/foto", { headers: { Cookie: s.cookie() } });
  assert.equal(g.status, 200); assert.equal(g.headers.get("content-type"), "image/jpeg");
  assert.ok(Buffer.from(await g.arrayBuffer()).equals(originale));
  assert.equal((await s("DELETE", "/api/me/foto")).json.haFoto, false);
  assert.equal((await fetch(BASE + "/api/me/foto", { headers: { Cookie: s.cookie() } })).status, 404);
});

test("foto: rifiuta ciò che non è un JPEG, il tipo sbagliato e i file troppo grandi", async () => {
  const s = await entra("pc-cli1");
  assert.equal((await mettiFoto(s, Buffer.from("<script>x</script>".repeat(20)))).stato, 415);
  assert.equal((await mettiFoto(s, jpeg(), "image/png")).stato, 415);
  assert.equal((await mettiFoto(s, jpeg(500 * 1024))).stato, 413);
});

test("il trainer vede la foto dei SUOI clienti e l'elenco dice chi ce l'ha; un altro trainer riceve 404", async () => {
  const s = await entra("pc-cli1");
  await mettiFoto(s, jpeg(250));
  const t1 = await entra("pc-pt1"), t2 = await entra("pc-pt2");
  const elenco = (await t1("GET", "/api/clienti")).json;
  assert.equal(elenco.find((x) => x.id === c1.clienteId).ha_foto, true);
  assert.ok(!("foto" in elenco[0]), "l'elenco non contiene i byte della foto");
  const f = await scaricaDelPt(t1, c1.clienteId);
  assert.equal(f.status, 200); assert.equal(f.headers.get("content-type"), "image/jpeg");
  assert.equal((await scaricaDelPt(t2, c1.clienteId)).status, 404);   // cliente di un altro trainer
  assert.equal((await scaricaDelPt(sessione(() => BASE), c1.clienteId)).status, 401);
  assert.equal((await scaricaDelPt(s, c1.clienteId)).status, 403);   // un cliente non usa le rotte del trainer
  const un = (await t1("GET", `/api/clienti/${c1.clienteId}`)).json;
  assert.equal(un.ha_foto, true); assert.ok(un.in_allenamento_dal);
});

test("la foto è nei dati esportati e sparisce con la cancellazione dell'account", async () => {
  const s = await entra("pc-cli1");
  const dati = (await s("GET", "/api/me/esporta")).json;
  assert.equal(Buffer.from(dati.cliente.foto_jpeg_base64, "base64").length, jpeg(250).length);
  const x = await creaCliente("pc-cli3", pt1, "Carla");
  const sx = await entra("pc-cli3");
  await mettiFoto(sx, jpeg());
  assert.equal((await sx("DELETE", "/api/me/account", { password: PASSWORD, conferma: true })).stato, 204);
  assert.equal((await db.query("SELECT 1 FROM cliente WHERE id = $1", [x.clienteId])).rowCount, 0);
});

test("pagine: l'account del cliente ha il caricamento della foto con etichetta; niente HTML dai dati", async () => {
  const html = leggi("account.html");
  assert.match(html, /<label for="mia-foto"/);
  assert.match(leggi("pt-cliente.html"), /avatar-cliente/);
  for (const f of ["account.js", "pt.js", "pt-cliente.js", "profilo-comune.js"]) {
    const js = leggi(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    assert.doesNotMatch(js, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/, f);
  }
});

test("un cliente SENZA scheda entra comunque: la scheda non c'è (404) ma il profilo, il trainer e i dati sono raggiungibili", async () => {
  const s = await entra("pc-cli1");   // questo cliente non ha ancora nessuna scheda in questo punto, oppure la ha: lo rendiamo certo
  await db.query("DELETE FROM scheda WHERE cliente_id = $1", [c1.clienteId]);
  assert.equal((await s("GET", "/api/me/scheda")).stato, 404);
  assert.equal((await s("GET", "/api/me/profilo")).stato, 200);
  assert.equal((await s("GET", "/api/me/trainer")).stato, 200);
  assert.equal((await s("GET", "/api/me/esporta")).stato, 200);
  // senza scheda si va alla pagina di benvenuto; con la scheda c'è l'icona del profilo nella testata
  const js = leggi("scheda-server.js");
  assert.match(js, /sch\.stato === 404\) return location\.replace\("\/benvenuto\.html"\)/);
  assert.match(js, /profilo-icona[\s\S]*\/account\.html/);
  assert.match(leggi("benvenuto.js"), /\/api\/me\/trainer/);
  // la scheda non si apre da sola: dopo l'accesso si va sempre alla pagina di casa
  for (const f of ["login.js", "registrati.js", "index.js"]) assert.doesNotMatch(leggi(f), /"\/scheda\.html"/, `${f} non deve mandare dritto alla scheda`);
  assert.doesNotMatch(leggi("benvenuto.js"), /location\.replace\("\/scheda\.html"\)/);
  assert.match(leggi("benvenuto.html"), /href="\/scheda\.html"[^>]*>Apri la scheda/);
});

test("dopo l'uscita si torna alla schermata iniziale, non al login", () => {
  assert.match(leggi("api.js"), /location\.replace\("\/"\);[^\n]*uscita/);
});

test("mood della scheda: predefinito «lena», il cliente lo cambia, valori inventati rifiutati, il trainer non usa la rotta", async () => {
  const { MOOD, PREDEFINITO } = require("../mood");
  const s = await entra("pc-cli1");
  const r = await s("GET", "/api/me/mood");
  assert.equal(r.stato, 200); assert.equal(r.json.mood, PREDEFINITO); assert.deepEqual(r.json.disponibili.map((m) => m.id), MOOD.map((m) => m.id));
  const altro = MOOD.find((m) => m.id !== PREDEFINITO).id;
  assert.equal((await s("PUT", "/api/me/mood", { mood: altro })).json.mood, altro);
  assert.equal((await s("GET", "/api/me/mood")).json.mood, altro);
  assert.equal((await s("PUT", "/api/me/mood", { mood: "../etc" })).stato, 400);
  assert.equal((await s("PUT", "/api/me/mood", {})).stato, 400);
  assert.equal((await s("GET", "/api/me/mood")).json.mood, altro, "dopo un rifiuto resta la scelta precedente");
  assert.equal((await (await entra("pc-cli2"))("GET", "/api/me/mood")).json.mood, PREDEFINITO, "la scelta è di ognuno");
  assert.equal((await sessione(() => BASE)("GET", "/api/me/mood")).stato, 401);
  assert.equal((await (await entra("pc-pt1"))("GET", "/api/me/mood")).stato, 403);
});
