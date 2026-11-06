// Test "end to end": avviano una copia vera del server e la chiamano con fetch, come farà il frontend.
// Usano il database di sviluppo ma creano dati propri (email ...@test.lena con un codice unico
// per ogni esecuzione) e alla fine li cancellano tutti.
// Si lanciano con:  npm test   (dalla cartella api, con il database Docker acceso)

const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { VERSIONE_INFORMATIVA, VERSIONE_CONDIZIONI_PT } = require("../config");
const CONSENSO = { accettaInformativa: true, versioneInformativa: VERSIONE_INFORMATIVA };
const { creaApp } = require("../app");

const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const email = (nome) => `${nome}.${RUN}@test.lena`;
const PASSWORD_PT = "PasswordDiProva123";
const PASSWORD_CLIENTE = "ClienteProva2026";

let server, BASE;

// ---------- aiuti ----------

function avvia(app) {
  return new Promise((ok) => {
    const s = app.listen(0, () => ok(s));   // porta 0 = "dammene una libera"
  });
}

// Una "sessione" ricorda il cookie come un browser e lo rimanda a ogni richiesta
function sessione(base = () => BASE) {
  let cookie = null;
  const chiama = async (metodo, percorso, corpo) => {
    const headers = {};
    if (corpo !== undefined) headers["Content-Type"] = "application/json";
    if (cookie) headers.Cookie = cookie;
    const res = await fetch(base() + percorso, {
      method: metodo, headers, body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    });
    const setCookie = res.headers.getSetCookie();
    for (const c of setCookie) {
      if (!c.startsWith("lena_sessione=")) continue;
      const valore = c.split(";")[0];
      cookie = valore === "lena_sessione=" ? null : valore;
    }
    const testo = await res.text();
    let json = null;
    try { json = JSON.parse(testo); } catch {}
    return { stato: res.status, json, headers: res.headers, setCookie };
  };
  chiama.cookie = () => cookie;
  return chiama;
}

async function creaPtNelDb(nomeEmail, nome) {
  const hash = await bcrypt.hash(PASSWORD_PT, 4);   // costo basso: è solo per i test, così sono veloci
  const u = await db.query(
    "INSERT INTO utente (email, password_hash, ruolo) VALUES ($1, $2, 'pt') RETURNING id", [email(nomeEmail), hash]);
  await db.query("INSERT INTO pt (utente_id, nome) VALUES ($1, $2)", [u.rows[0].id, nome]);
  await db.query("INSERT INTO consenso (utente_id, tipo, versione) VALUES ($1, 'condizioni_pt', $2)", [u.rows[0].id, VERSIONE_CONDIZIONI_PT]);
  return u.rows[0].id;
}

// Una scheda realistica, con la stessa forma che produce convertitore-test.html
function datiProva(nome, cognome) {
  return {
    inizio: "2026-10-26",
    settimane: 5,
    info: {
      titolo: "Programma forza e tonificazione", nome, cognome,
      obiettivo: "Tonificazione", sedute: 2, nota_durata: "4 settimane + 1 di scarico",
    },
    riscaldamento: {
      voce: "Riscaldamento", durata: "10'", istruzione: "2 giri senza pausa",
      esercizi: [["Jumping jack", null], ["Cat cow", "https://example.com/catcow"]],
    },
    giorni: [
      {
        id: "A", titolo_originale: "GIORNO A (gambe e glutei)", focus: "Gambe e glutei",
        stretching: ["Stretching", "5-10'"], titolo: "Giorno A",
        colore: "D49A9A", chiaro: "F6E9E7", scuro: "A86A6B",
        blocchi: [
          { tipo: "esercizio", nome: "Squat con bilanciere", serie: "4", rip: "10", rec: "1'30\"",
            video: "https://example.com/squat", note: null, schema: ["4x10"], progressione: "+2,5 kg a settimana" },
          { tipo: "esercizio", nome: "Hip thrust", serie: "3", rip: "12", rec: "1'", video: null, note: null, schema: null, progressione: null },
          { tipo: "circuito", formato: "EMOM 10'", rec: null, esercizi: [
            { nome: "Affondi", rip: "10", video: null }, { nome: "Kettlebell swing", rip: "15", video: null } ] },
        ],
      },
      {
        id: "B", titolo_originale: "GIORNO B (parte alta)", focus: "Parte alta",
        stretching: null, titolo: "Giorno B",
        colore: "9DB5A0", chiaro: "E8EFE8", scuro: "62806A",
        blocchi: [
          { tipo: "esercizio", nome: "Lat machine", serie: "4", rip: "10", rec: "1'30\"", video: null, note: "presa larga", schema: null, progressione: null },
        ],
      },
    ],
  };
}

// ---------- preparazione e pulizia ----------

const ptA = sessione(), ptB = sessione(), cliente = sessione(), anonimo = sessione();
const stato = {};   // id creati durante i test, condivisi tra un test e l'altro

before(async () => {
  server = await avvia(creaApp({ limiteAccesso: 1000 }));   // limite alto: qui si fanno tanti login
  BASE = `http://localhost:${server.address().port}`;
  stato.ptAUtente = await creaPtNelDb("pt-a", "PT A di prova");
  stato.ptBUtente = await creaPtNelDb("pt-b", "PT B di prova");
});

after(async () => {
  // cancellando gli utenti dei PT, a cascata se ne vanno pt, clienti, schede, registrazioni, inviti;
  // gli account dei clienti hanno anche loro un'email di test e vengono cancellati dalla stessa query
  await db.query("DELETE FROM utente WHERE email LIKE $1", [`%.${RUN}@test.lena`]);
  const resti = await db.query("SELECT count(*)::int AS n FROM utente WHERE email LIKE $1", [`%.${RUN}@test.lena`]);
  assert.equal(resti.rows[0].n, 0, "la pulizia finale deve togliere tutti gli utenti di test");
  await new Promise((ok) => server.close(ok));
  await db.end();
});

// ---------- login ----------

test("login corretto: 200, id e ruolo, cookie httpOnly e sameSite lax", async () => {
  const r = await ptA("POST", "/api/auth/login", { email: email("pt-a"), password: PASSWORD_PT });
  assert.equal(r.stato, 200);
  assert.deepEqual(r.json, { id: stato.ptAUtente, ruolo: "pt" });
  const c = r.setCookie.find((x) => x.startsWith("lena_sessione="));
  assert.ok(c, "deve arrivare il cookie lena_sessione");
  assert.match(c, /HttpOnly/i);
  assert.match(c, /SameSite=Lax/i);
  assert.doesNotMatch(c, /Secure/i, "in sviluppo (senza https) il cookie non è Secure");

  const b = await ptB("POST", "/api/auth/login", { email: ` ${email("pt-b").toUpperCase()} `, password: PASSWORD_PT });
  assert.equal(b.stato, 200, "l'email si confronta senza maiuscole e spazi");
});

test("login sbagliato: 401 con lo stesso messaggio per password errata ed email inesistente", async () => {
  const a = await anonimo("POST", "/api/auth/login", { email: email("pt-a"), password: "sbagliata-123" });
  const b = await anonimo("POST", "/api/auth/login", { email: email("nessuno"), password: "sbagliata-123" });
  const c = await anonimo("POST", "/api/auth/login");
  assert.equal(a.stato, 401);
  assert.equal(b.stato, 401);
  assert.equal(c.stato, 401, "anche senza corpo: 401, non 500");
  assert.equal(a.json.errore, b.json.errore);
  assert.equal(anonimo.cookie(), null);
});

test("/me: con cookie restituisce l'email, senza o con cookie falso 401", async () => {
  const me = await ptA("GET", "/api/auth/me");
  assert.equal(me.stato, 200);
  assert.equal(me.json.email, email("pt-a"));
  assert.equal(me.json.ruolo, "pt");

  assert.equal((await anonimo("GET", "/api/auth/me")).stato, 401);
  const falso = await fetch(BASE + "/api/auth/me", { headers: { Cookie: "lena_sessione=eyJhbGciOiJub25lIn0.eyJpZCI6MSwicnVvbG8iOiJwdCJ9." } });
  assert.equal(falso.status, 401, "un token senza firma valida viene rifiutato");
});

// ---------- clienti e schede ----------

test("il PT crea clienti e carica schede; schede non valide rifiutate con 400", async () => {
  const a1 = await ptA("POST", "/api/clienti", { nome: "Anna", cognome: "Rossi" });
  assert.equal(a1.stato, 201);
  stato.clienteA1 = a1.json.id;
  const s = await ptA("POST", `/api/clienti/${stato.clienteA1}/schede`, { dati: datiProva("Anna", "Rossi") });
  assert.equal(s.stato, 201);
  stato.schedaA1 = s.json.id;

  const b1 = await ptB("POST", "/api/clienti", { nome: "Bruno", cognome: "Bianchi" });
  stato.clienteB1 = b1.json.id;
  stato.schedaB1 = (await ptB("POST", `/api/clienti/${stato.clienteB1}/schede`, { dati: datiProva("Bruno", "Bianchi") })).json.id;

  assert.equal((await ptA("POST", "/api/clienti", { nome: "", cognome: "X" })).stato, 400);

  const rotte = [
    (d) => { d.inizio = "26/10/2026"; },
    (d) => { d.inizio = "2026-02-30"; },
    (d) => { d.settimane = 0; },
    (d) => { d.settimane = "5"; },
    (d) => { delete d.info; },
    (d) => { delete d.riscaldamento; },
    (d) => { d.giorni = []; },
    (d) => { d.giorni[1].id = "A"; },
    (d) => { d.giorni[0].id = "A B"; },
    (d) => { d.giorni[0].colore = "red;}"; },
    (d) => { d.giorni[0].blocchi = null; },
    (d) => { d.giorni[0].blocchi[2].esercizi = undefined; },
  ];
  for (const rompi of rotte) {
    const d = datiProva("Anna", "Rossi");
    rompi(d);
    const r = await ptA("POST", `/api/clienti/${stato.clienteA1}/schede`, { dati: d });
    assert.equal(r.stato, 400, `doveva essere rifiutata: ${rompi}`);
  }
  assert.equal((await ptA("POST", `/api/clienti/${stato.clienteA1}/schede`, { dati: [1, 2] })).stato, 400);
});

test("il PT legge l'elenco delle schede (senza JSON pesante) e la scheda completa", async () => {
  const elenco = await ptA("GET", `/api/clienti/${stato.clienteA1}/schede`);
  assert.equal(elenco.stato, 200);
  assert.equal(elenco.json.length, 1);
  assert.equal(elenco.json[0].titolo, "Programma forza e tonificazione");
  assert.equal(elenco.json[0].inizio, "2026-10-26", "la data deve restare il 26, non diventare il 25");
  assert.equal(elenco.json[0].dati, undefined, "l'elenco non contiene i dati completi");

  const s = await ptA("GET", `/api/schede/${stato.schedaA1}`);
  assert.equal(s.stato, 200);
  assert.deepEqual(s.json.dati, datiProva("Anna", "Rossi"));
});

test("un PT non vede né modifica i clienti e le schede di un altro PT (sempre 404)", async () => {
  const lista = await ptA("GET", "/api/clienti");
  assert.ok(!lista.json.some((c) => c.id === stato.clienteB1), "nell'elenco di A non c'è il cliente di B");

  const B = stato.clienteB1, SB = stato.schedaB1;
  const tentativi = [
    ["GET", `/api/clienti/${B}/schede`],
    ["POST", `/api/clienti/${B}/schede`, { dati: datiProva("X", "Y") }],
    ["POST", `/api/clienti/${B}/invito`],
    ["GET", `/api/clienti/${B}/esporta`],
    ["DELETE", `/api/clienti/${B}`],
    ["GET", `/api/schede/${SB}`],
    ["GET", `/api/schede/${SB}/registrazioni`],
    ["GET", "/api/clienti/999999999/schede"],
    ["GET", "/api/schede/abc"],
  ];
  for (const [metodo, percorso, corpo] of tentativi) {
    const r = await ptA(metodo, percorso, corpo);
    assert.equal(r.stato, 404, `${metodo} ${percorso} doveva dare 404`);
  }
  const ancora = await db.query("SELECT count(*)::int AS n FROM scheda WHERE cliente_id = $1", [B]);
  assert.equal(ancora.rows[0].n, 1, "il cliente di B e la sua scheda sono intatti");
});

// ---------- invito e registrazione ----------

test("flusso completo: invito → registrazione → login cliente → propria scheda → registrazioni → il PT le legge", async () => {
  const inv = await ptA("POST", `/api/clienti/${stato.clienteA1}/invito`);
  assert.equal(inv.stato, 201);
  assert.match(inv.json.codice, /^[A-Za-z0-9_-]{43}$/);
  const giorni = (new Date(inv.json.scade_il) - Date.now()) / 864e5;
  assert.ok(giorni > 6.9 && giorni <= 7, "scade tra 7 giorni");
  stato.codiceA1 = inv.json.codice;

  const salvato = await db.query("SELECT codice_hash FROM invito WHERE cliente_id = $1", [stato.clienteA1]);
  assert.notEqual(salvato.rows[0].codice_hash, inv.json.codice, "nel database c'è solo l'impronta del codice");
  assert.equal(salvato.rows[0].codice_hash.length, 64);

  const reg = await cliente("POST", "/api/auth/registra-cliente",
    { ...CONSENSO, codice: stato.codiceA1, email: ` ${email("anna").toUpperCase()} `, password: PASSWORD_CLIENTE });
  assert.equal(reg.stato, 201);
  assert.equal(reg.json.ruolo, "cliente");
  assert.ok(cliente.cookie(), "dopo la registrazione è già dentro (cookie)");
  const me = await cliente("GET", "/api/auth/me");
  assert.equal(me.json.email, email("anna"), "email salvata minuscola e senza spazi");
  stato.utenteAnna = me.json.id;

  // esce e rientra con email e password
  assert.equal((await cliente("POST", "/api/auth/logout")).stato, 200);
  assert.equal(cliente.cookie(), null);
  assert.equal((await cliente("GET", "/api/auth/me")).stato, 401);
  const login = await cliente("POST", "/api/auth/login", { email: email("anna"), password: PASSWORD_CLIENTE });
  assert.equal(login.stato, 200);

  const mia = await cliente("GET", "/api/me/scheda");
  assert.equal(mia.stato, 200);
  assert.equal(mia.json.scheda.id, stato.schedaA1);
  assert.equal(mia.json.scheda.inizio, "2026-10-26");
  assert.equal(mia.json.scheda.dati.giorni.length, 2);
  assert.deepEqual(mia.json.registrazioni, []);

  const voci = [
    { tipo: "kg", chiave: "1|A|1", valore: "60" },
    { tipo: "rip", chiave: "1|A|1", valore: "10-10-9-8" },
    { tipo: "serie", chiave: "1|A|1", valore: 4 },
    { tipo: "fatto", chiave: "1|A|1", valore: 1 },
    { tipo: "kg", chiave: "1|A|3|1", valore: "16" },
    { tipo: "fatto", chiave: "1|A|R|0", valore: "1" },
    { tipo: "fatto", chiave: "1|A|S", valore: "1" },
    { tipo: "kg", chiave: "5|B|1", valore: "35,5" },
  ];
  const put = await cliente("PUT", `/api/schede/${stato.schedaA1}/registrazioni`, { voci });
  assert.equal(put.stato, 200);
  assert.deepEqual(put.json, { salvate: 8, cancellate: 0 });

  // aggiornare (upsert) e cancellare con valore vuoto
  const put2 = await cliente("PUT", `/api/schede/${stato.schedaA1}/registrazioni`, {
    voci: [{ tipo: "kg", chiave: "1|A|1", valore: "62,5" }, { tipo: "fatto", chiave: "1|A|S", valore: "" }],
  });
  assert.deepEqual(put2.json, { salvate: 1, cancellate: 1 });

  const pt = await ptA("GET", `/api/schede/${stato.schedaA1}/registrazioni`);
  assert.equal(pt.stato, 200);
  assert.equal(pt.json.length, 7);
  assert.equal(pt.json.find((v) => v.tipo === "kg" && v.chiave === "1|A|1").valore, "62,5");
  assert.ok(!pt.json.some((v) => v.chiave === "1|A|S"));

  const mia2 = await cliente("GET", "/api/me/scheda");
  assert.equal(mia2.json.registrazioni.length, 7, "il cliente ritrova i suoi progressi");

  const elenco = await ptA("GET", "/api/clienti");
  assert.equal(elenco.json.find((c) => c.id === stato.clienteA1).registrato, true);
});

test("registrazioni: validazione, il PT non può scrivere, scheda altrui 404", async () => {
  const P = `/api/schede/${stato.schedaA1}/registrazioni`;
  const sbagliate = [
    { voci: [{ tipo: "peso", chiave: "1|A|1", valore: "1" }] },
    { voci: [{ tipo: "kg", chiave: "1-A-1", valore: "1" }] },
    { voci: [{ tipo: "kg", chiave: "6|A|1", valore: "1" }] },         // la scheda ha 5 settimane
    { voci: [{ tipo: "kg", chiave: "1|C|1", valore: "1" }] },         // il giorno C non esiste
    { voci: [{ tipo: "serie", chiave: "1|A|1", valore: "tre" }] },
    { voci: [{ tipo: "fatto", chiave: "1|A|1", valore: "sì" }] },
    { voci: [{ tipo: "kg", chiave: "1|A|1", valore: "x".repeat(41) }] },
    { voci: [{ tipo: "kg", chiave: "1|A|1", valore: { a: 1 } }] },
    { voci: [] },
    {},
    { voci: Array.from({ length: 201 }, () => ({ tipo: "kg", chiave: "1|A|1", valore: "1" })) },
  ];
  for (const corpo of sbagliate) {
    const r = await cliente("PUT", P, corpo);
    assert.equal(r.stato, 400, `doveva essere rifiutato: ${JSON.stringify(corpo).slice(0, 80)}`);
  }
  // una voce sbagliata in mezzo: non si salva niente (transazione / controllo prima)
  const misto = await cliente("PUT", P, { voci: [{ tipo: "kg", chiave: "2|A|2", valore: "20" }, { tipo: "kg", chiave: "zz", valore: "1" }] });
  assert.equal(misto.stato, 400);
  const c = await db.query("SELECT count(*)::int AS n FROM registrazione WHERE scheda_id = $1 AND chiave = '2|A|2'", [stato.schedaA1]);
  assert.equal(c.rows[0].n, 0);

  assert.equal((await cliente("PUT", P, { voci: Array.from({ length: 200 }, (_, i) => ({ tipo: "kg", chiave: `2|A|${i}`, valore: "1" })) })).stato, 200, "200 voci vanno bene");
  assert.equal((await ptA("PUT", P, { voci: [{ tipo: "kg", chiave: "1|A|1", valore: "1" }] })).stato, 403, "il PT legge ma non scrive");
  assert.equal((await cliente("PUT", `/api/schede/${stato.schedaB1}/registrazioni`, { voci: [{ tipo: "kg", chiave: "1|A|1", valore: "1" }] })).stato, 404);
});

test("il cliente non può usare le rotte da PT (403)", async () => {
  const tentativi = [
    ["GET", "/api/clienti"],
    ["POST", "/api/clienti", { nome: "X", cognome: "Y" }],
    ["GET", `/api/clienti/${stato.clienteA1}/schede`],
    ["POST", `/api/clienti/${stato.clienteA1}/invito`],
    ["GET", `/api/clienti/${stato.clienteA1}/esporta`],
    ["DELETE", `/api/clienti/${stato.clienteA1}`],
    ["GET", `/api/schede/${stato.schedaA1}`],
    ["GET", `/api/schede/${stato.schedaA1}/registrazioni`],
  ];
  for (const [metodo, percorso, corpo] of tentativi) {
    assert.equal((await cliente(metodo, percorso, corpo)).stato, 403, `${metodo} ${percorso}`);
  }
  assert.equal((await ptA("GET", "/api/me/scheda")).stato, 403, "e il PT non usa le rotte da cliente");
  assert.equal((await anonimo("GET", "/api/clienti")).stato, 401, "senza login: 401");
});

test("inviti: riusato, scaduto, sbagliato o sostituito → rifiutati con lo stesso messaggio", async () => {
  const altra = sessione();
  const prova = (codice, nome) => altra("POST", "/api/auth/registra-cliente", { ...CONSENSO, codice, email: email(nome), password: PASSWORD_CLIENTE });

  const riusato = await prova(stato.codiceA1, "riuso");
  assert.equal(riusato.stato, 400);
  const messaggio = riusato.json.errore;

  assert.equal((await ptA("POST", `/api/clienti/${stato.clienteA1}/invito`)).stato, 409, "cliente già registrato: niente nuovo invito");

  // invito scaduto: lo "invecchiamo" direttamente nel database
  const invB = await ptB("POST", `/api/clienti/${stato.clienteB1}/invito`);
  await db.query("UPDATE invito SET scade_il = now() - interval '1 minute' WHERE cliente_id = $1", [stato.clienteB1]);
  const scaduto = await prova(invB.json.codice, "scaduto");
  assert.equal(scaduto.stato, 400);
  assert.equal(scaduto.json.errore, messaggio);

  const sbagliato = await prova("codice-inventato-che-non-esiste", "sbagliato");
  assert.equal(sbagliato.json.errore, messaggio);

  // un nuovo invito annulla il vecchio
  const vecchio = (await ptB("POST", `/api/clienti/${stato.clienteB1}/invito`)).json.codice;
  const nuovo = (await ptB("POST", `/api/clienti/${stato.clienteB1}/invito`)).json.codice;
  assert.equal((await prova(vecchio, "vecchio")).json.errore, messaggio);

  // con il codice nuovo: password corta e email già usata vengono rifiutate senza consumare l'invito
  const corta = await altra("POST", "/api/auth/registra-cliente", { ...CONSENSO, codice: nuovo, email: email("bruno"), password: "corta" });
  assert.equal(corta.stato, 400);
  const giaUsata = await altra("POST", "/api/auth/registra-cliente", { ...CONSENSO, codice: nuovo, email: email("pt-a"), password: PASSWORD_CLIENTE });
  assert.equal(giaUsata.stato, 409);
  const ok = await altra("POST", "/api/auth/registra-cliente", { ...CONSENSO, codice: nuovo, email: email("bruno"), password: PASSWORD_CLIENTE });
  assert.equal(ok.stato, 201, "l'invito era ancora valido dopo i tentativi sbagliati");

  const nessunUtente = await db.query("SELECT count(*)::int AS n FROM utente WHERE email = ANY($1)",
    [[email("riuso"), email("scaduto"), email("sbagliato"), email("vecchio")]]);
  assert.equal(nessunUtente.rows[0].n, 0, "nessun account creato con inviti non validi");
});

test("cliente registrato senza schede: /api/me/scheda dà 404", async () => {
  const a2 = await ptA("POST", "/api/clienti", { nome: "Carla", cognome: "Verdi" });
  const codice = (await ptA("POST", `/api/clienti/${a2.json.id}/invito`)).json.codice;
  const carla = sessione();
  await carla("POST", "/api/auth/registra-cliente", { ...CONSENSO, codice, email: email("carla"), password: PASSWORD_CLIENTE });
  assert.equal((await carla("GET", "/api/me/scheda")).stato, 404);
});

// ---------- GDPR ----------

test("esportazione: tutti i dati del cliente in un file JSON, senza l'impronta degli inviti", async () => {
  const r = await ptA("GET", `/api/clienti/${stato.clienteA1}/esporta`);
  assert.equal(r.stato, 200);
  assert.match(r.headers.get("content-disposition"), /attachment/);
  assert.equal(r.json.cliente.nome, "Anna");
  assert.equal(r.json.cliente.email, email("anna"));
  assert.equal(r.json.schede.length, 1);
  assert.deepEqual(r.json.schede[0].dati, datiProva("Anna", "Rossi"));
  assert.ok(r.json.schede[0].registrazioni.length >= 7);
  assert.equal(r.json.inviti.length, 1);
  assert.ok(!JSON.stringify(r.json).includes("codice_hash"));
  assert.ok(!JSON.stringify(r.json).includes("password"));
});

test("cancellazione del cliente: spariscono cliente, account, schede, registrazioni e inviti", async () => {
  const id = stato.clienteA1;
  const del = await ptA("DELETE", `/api/clienti/${id}`);
  assert.equal(del.stato, 204);

  const conta = async (sql, p) => (await db.query(sql, p)).rows[0].n;
  assert.equal(await conta("SELECT count(*)::int AS n FROM cliente WHERE id = $1", [id]), 0);
  assert.equal(await conta("SELECT count(*)::int AS n FROM utente WHERE id = $1", [stato.utenteAnna]), 0);
  assert.equal(await conta("SELECT count(*)::int AS n FROM scheda WHERE id = $1", [stato.schedaA1]), 0);
  assert.equal(await conta("SELECT count(*)::int AS n FROM registrazione WHERE scheda_id = $1", [stato.schedaA1]), 0);
  assert.equal(await conta("SELECT count(*)::int AS n FROM invito WHERE cliente_id = $1", [id]), 0);

  assert.equal((await cliente("GET", "/api/auth/me")).stato, 401, "il vecchio cookie non porta più a nessun account");
  assert.equal((await cliente("GET", "/api/me/scheda")).stato, 401, "l'account non esiste più: il cookie non vale");
  assert.equal((await cliente("POST", "/api/auth/login", { email: email("anna"), password: PASSWORD_CLIENTE })).stato, 401);
  assert.equal((await ptA("DELETE", `/api/clienti/${id}`)).stato, 404, "una seconda volta: non esiste più");
  assert.equal(await conta("SELECT count(*)::int AS n FROM cliente WHERE id = $1", [stato.clienteB1]), 1, "il cliente di B non è toccato");
});

// ---------- sicurezza ----------

test("errori: JSON rotto 400, indirizzo inesistente 404, nessun dettaglio tecnico", async () => {
  const rotto = await fetch(BASE + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{rotto" });
  assert.equal(rotto.status, 400);
  const testo = await rotto.text();
  assert.doesNotMatch(testo, /at .*\.js|SyntaxError/, "niente stack trace al client");
  assert.equal((await anonimo("GET", "/api/non-esiste")).stato, 404);
  const h = (await anonimo("GET", "/api/salute")).headers;
  assert.equal(h.get("x-powered-by"), null, "helmet nasconde che è Express");
  assert.equal(h.get("x-content-type-options"), "nosniff");
});

test("limite tentativi: dopo 10 login sbagliati dallo stesso IP arriva 429, anche con la password giusta", async () => {
  // una copia del server con i limiti veri (quella principale ha un limite alto per i test)
  const s = await avvia(creaApp());
  const base = `http://localhost:${s.address().port}`;
  const prova = sessione(() => base);
  try {
    for (let i = 1; i <= 10; i++) {
      const r = await prova("POST", "/api/auth/login", { email: email("pt-a"), password: `sbagliata-${i}` });
      assert.equal(r.stato, 401, `tentativo ${i}`);
    }
    const bloccato = await prova("POST", "/api/auth/login", { email: email("pt-a"), password: "sbagliata-11" });
    assert.equal(bloccato.stato, 429);
    const giusta = await prova("POST", "/api/auth/login", { email: email("pt-a"), password: PASSWORD_PT });
    assert.equal(giusta.stato, 429, "bloccato anche con la password giusta finché non passa il tempo");
    assert.equal((await prova("POST", "/api/auth/registra-cliente", { ...CONSENSO, codice: "x", email: email("y"), password: "x" })).stato, 429,
      "il limite vale anche per la registrazione");
    assert.equal((await prova("GET", "/api/salute")).stato, 200, "le altre rotte restano accessibili");
  } finally {
    await new Promise((ok) => s.close(ok));
  }
});
