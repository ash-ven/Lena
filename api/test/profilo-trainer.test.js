// Il profilo del trainer (testo e foto) e la sua visione da parte dei clienti.
const path = require("node:path");
const fs = require("node:fs");
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const { avvia, db, sessione, creaPt, email, PASSWORD, pulisci } = require("./comune");
const { creaApp } = require("../app");

const WEB = path.join(__dirname, "..", "..", "web");
const leggi = (f) => fs.readFileSync(path.join(WEB, f), "utf8");
let server, BASE;
let pt1, pt2;
before(async () => {
  server = await avvia(creaApp());
  BASE = `http://localhost:${server.address().port}`;
  pt1 = await creaPt("prof-pt1", "Trainer Uno");
  pt2 = await creaPt("prof-pt2", "Trainer Due");
});
after(async () => { await pulisci(); await new Promise((ok) => server.close(ok)); await db.end(); });

// Un JPEG "abbastanza vero": inizia con FF D8 FF, finisce con FF D9 (il server controlla questo)
const jpeg = (n = 300) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(n, 7), Buffer.from([0xff, 0xd9])]);

async function creaClienteConAccount(nomeEmail, pt) {
  const hash = await bcrypt.hash(PASSWORD, 4);
  const u = await db.query("INSERT INTO utente (email, password_hash, ruolo) VALUES ($1, $2, 'cliente') RETURNING id", [email(nomeEmail), hash]);
  await db.query("INSERT INTO cliente (pt_id, utente_id, nome, cognome) VALUES ($1, $2, 'Anna', 'Prova')", [pt.ptId, u.rows[0].id]);
}
async function entra(nomeEmail) {
  const s = sessione(() => BASE);
  const r = await s("POST", "/api/auth/login", { email: email(nomeEmail), password: PASSWORD });
  assert.equal(r.stato, 200);
  return s;
}
const mettiFoto = async (s, corpo, tipo = "image/jpeg") => {
  const res = await fetch(BASE + "/api/pt/foto", { method: "PUT", headers: { "Content-Type": tipo, Cookie: s.cookie() }, body: corpo });
  let json = null; try { json = await res.json(); } catch (e) { /* senza corpo */ }
  return { stato: res.status, json };
};

test("senza login 401; un cliente non può usare le rotte del trainer (403)", async () => {
  const anonimo = sessione(() => BASE);
  for (const [m, u] of [["GET", "/api/pt/profilo"], ["PUT", "/api/pt/profilo"], ["GET", "/api/pt/foto"], ["DELETE", "/api/pt/foto"]]) assert.equal((await anonimo(m, u, m === "PUT" ? {} : undefined)).stato, 401, u);
  await creaClienteConAccount("prof-cli1", pt1);
  const c = await entra("prof-cli1");
  assert.equal((await c("GET", "/api/pt/profilo")).stato, 403);
  assert.equal((await mettiFoto(c, jpeg())).stato, 403);
});

test("il trainer salva e rilegge nome, presentazione e contatto; vuoti restano vuoti", async () => {
  const s = await entra("prof-pt1");
  let r = await s("GET", "/api/pt/profilo");
  assert.equal(r.stato, 200); assert.equal(r.json.nome, "Trainer Uno"); assert.equal(r.json.bio, ""); assert.equal(r.json.haFoto, false);
  r = await s("PUT", "/api/pt/profilo", { nome: "  Marco Rossi ", bio: "Preparatore atletico.\nSeguo i miei clienti da 8 anni.", contatto: "marco@esempio.it" });
  assert.equal(r.stato, 200); assert.equal(r.json.nome, "Marco Rossi"); assert.match(r.json.bio, /\n/);
  r = await s("PUT", "/api/pt/profilo", { nome: "Marco Rossi", bio: "", contatto: "" });
  assert.equal(r.json.bio, ""); assert.equal(r.json.contatto, "");
});

test("validazione: nome obbligatorio, lunghezze massime, niente caratteri di controllo", async () => {
  const s = await entra("prof-pt1");
  for (const corpo of [{ nome: "" }, { nome: "   " }, { nome: "x".repeat(101) }, { nome: "ok", bio: "y".repeat(501) }, { nome: "ok", contatto: "z".repeat(101) },
    { nome: "ok", contatto: "due\nrighe" }, { nome: "ok\u0000" }, { nome: 5 }, { nome: "ok", bio: { a: 1 } }]) {
    assert.equal((await s("PUT", "/api/pt/profilo", corpo)).stato, 400, JSON.stringify(corpo));
  }
  assert.equal((await s("PUT", "/api/pt/profilo", { nome: "ok", bio: "y".repeat(500) })).stato, 200);
});

test("foto: un JPEG si salva e si rilegge uguale; si rimuove", async () => {
  const s = await entra("prof-pt1");
  const originale = jpeg(500);
  let r = await mettiFoto(s, originale);
  assert.equal(r.stato, 200); assert.equal(r.json.haFoto, true);
  const g = await fetch(BASE + "/api/pt/foto", { headers: { Cookie: s.cookie() } });
  assert.equal(g.status, 200); assert.equal(g.headers.get("content-type"), "image/jpeg");
  assert.ok(Buffer.from(await g.arrayBuffer()).equals(originale));
  r = await s("DELETE", "/api/pt/foto");
  assert.equal(r.json.haFoto, false);
  assert.equal((await fetch(BASE + "/api/pt/foto", { headers: { Cookie: s.cookie() } })).status, 404);
});

test("foto: rifiuta ciò che non è un JPEG, il tipo sbagliato e i file troppo grandi", async () => {
  const s = await entra("prof-pt1");
  assert.equal((await mettiFoto(s, Buffer.from("<script>alert(1)</script>".repeat(10)))).stato, 415);   // dichiarato JPEG ma non lo è
  assert.equal((await mettiFoto(s, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(300)]))).stato, 415);   // un PNG
  assert.equal((await mettiFoto(s, jpeg(), "image/png")).stato, 415);   // tipo dichiarato diverso: il lettore del corpo non lo legge, quindi il server vede un corpo vuoto
  assert.equal((await mettiFoto(s, jpeg(500 * 1024))).stato, 413);
  assert.equal((await mettiFoto(s, Buffer.from([0xff, 0xd8, 0xff]))).stato, 415);   // troppo corta
});

test("il cliente vede il profilo e la foto del SUO trainer, non quelli di un altro", async () => {
  const s1 = await entra("prof-pt1");
  await s1("PUT", "/api/pt/profilo", { nome: "Marco Rossi", bio: "Bio uno", contatto: "uno@esempio.it" });
  await mettiFoto(s1, jpeg(200));
  const s2 = await entra("prof-pt2");
  await s2("PUT", "/api/pt/profilo", { nome: "Altro Trainer", bio: "Bio due", contatto: "due@esempio.it" });

  const c = await entra("prof-cli1");   // cliente di pt1
  let r = await c("GET", "/api/me/trainer");
  assert.equal(r.stato, 200); assert.equal(r.json.nome, "Marco Rossi"); assert.equal(r.json.haFoto, true);
  assert.ok(!JSON.stringify(r.json).includes("Altro Trainer"));
  const f = await fetch(BASE + "/api/me/trainer/foto", { headers: { Cookie: c.cookie() } });
  assert.equal(f.status, 200); assert.equal(f.headers.get("content-type"), "image/jpeg");

  await creaClienteConAccount("prof-cli2", pt2);   // cliente di pt2: nessuna foto, e vede il SUO trainer
  const c2 = await entra("prof-cli2");
  r = await c2("GET", "/api/me/trainer");
  assert.equal(r.json.nome, "Altro Trainer"); assert.equal(r.json.haFoto, false);
  assert.equal((await c2("GET", "/api/me/trainer/foto")).stato, 404);
});

test("le rotte del cliente sono solo per i clienti; l'API non si fa tenere in memoria dal browser", async () => {
  const t = await entra("prof-pt1");
  assert.equal((await t("GET", "/api/me/trainer")).stato, 403);
  const r = await t("GET", "/api/pt/profilo");
  assert.match(r.headers.get("cache-control"), /no-store/);
});

test("cancellare il trainer toglie anche il suo profilo e la sua foto", async () => {
  const x = await creaPt("prof-pt3", "Da Cancellare");
  const s = await entra("prof-pt3");
  await mettiFoto(s, jpeg());
  await db.query("DELETE FROM utente WHERE id = $1", [x.utenteId]);
  assert.equal((await db.query("SELECT 1 FROM pt WHERE id = $1", [x.ptId])).rowCount, 0);
});

test("pagine: profilo del trainer e account del cliente (etichette, titolo, niente HTML dai dati)", async () => {
  assert.equal((await fetch(BASE + "/pt-profilo.html")).status, 200);
  assert.equal((await fetch(BASE + "/profilo-comune.js")).status, 200);
  const html = leggi("pt-profilo.html");
  for (const id of ["p-nome", "p-bio", "p-contatto", "p-foto"]) assert.match(html, new RegExp(`<label for="${id}"`), `manca l'etichetta di ${id}`);
  assert.match(html, /<h1[^>]*>[^<]+<\/h1>/);
  for (const f of ["pt-profilo.js", "profilo-comune.js", "account.js"]) {
    const js = leggi(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    assert.doesNotMatch(js, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/, `${f}: i testi vanno sempre inseriti come testo`);
    assert.doesNotMatch(js, /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/, `${f}: colore scritto a mano`);
  }
  assert.match(leggi("account.html"), /profilo-comune\.js/);
});
