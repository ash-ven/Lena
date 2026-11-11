// Il riepilogo allenamento (l'omino): conteggi, livelli e completezza dei disegni. Non servono dati nel database.
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const Omino = require("../../web/omino.js");
const Dati = require("../../web/omino-dati.js");
const { MUSCOLI } = require("../../web/muscoli.js");

const WEB = path.join(__dirname, "..", "..", "web");
const leggi = (f) => fs.readFileSync(path.join(WEB, f), "utf8");
const es = (nome) => ({ tipo: "esercizio", nome, serie: "3", rip: "10", rec: "60" });

test("ci sono le quattro figure (uomo e donna, davanti e dietro), ognuna con immagine e sagoma", () => {
  for (const c of ["m-davanti", "m-dietro", "f-davanti", "f-dietro"]) {
    assert.ok(Dati[c], c);
    for (const f of [`omino/${c}.webp`, `omino/${c}-sagoma.png`]) assert.ok(fs.existsSync(path.join(WEB, f)), f);
    assert.ok(Dati[c].w > 300 && Dati[c].w <= 402 && Dati[c].h === 1024, `${c}: misure`);
    assert.ok(Dati[c].cx > 100 && Dati[c].cx < Dati[c].w);
  }
});

test("ogni tracciato appartiene a un muscolo che esiste", () => {
  const ids = new Set(MUSCOLI.map((m) => m.id));
  for (const [c, f] of Object.entries(Dati)) {
    for (const [m, tracciati] of Object.entries(f.parti)) {
      assert.ok(ids.has(m), `${c}: «${m}» non è un muscolo di muscoli.js`);
      assert.ok(tracciati.length >= 1 && tracciati.every((d) => /^M[\d.,LC -]+Z$/.test(d)), `${c}/${m}: tracciato non valido`);
    }
  }
});

test("tutti e 19 i muscoli si vedono in almeno una vista, per l'uomo e per la donna", () => {
  for (const sesso of ["m", "f"]) {
    const visti = new Set([...Omino.muscoliVisibili(`${sesso}-davanti`), ...Omino.muscoliVisibili(`${sesso}-dietro`)]);
    for (const m of MUSCOLI) assert.ok(visti.has(m.id), `${sesso}: «${m.id}» non si vede da nessuna parte`);
  }
});

test("conteggi: contano gli esercizi dei blocchi e dei circuiti, non riscaldamento e stretching", () => {
  const giorni = [{
    id: "A", titolo: "Giorno A", stretching: ["Stretching", "5'"], riscaldamento: { esercizi: [["Squat", ""]] },
    blocchi: [es("Panca piana"), es("Croci ai cavi"), es("Squat"),
      { tipo: "circuito", formato: "EMOM 10'", rec: "/", esercizi: [{ nome: "Plank" }, { nome: "Panca piana" }] }],
  }];
  const n = Omino.conteggi(giorni);
  assert.equal(n.petto, 3, "panca, croci e panca nel circuito");
  assert.equal(n.quadricipiti, 1, "solo lo squat dei blocchi, non quello del riscaldamento");
  assert.equal(n.addome, 1);
  assert.equal(n.polpacci, undefined);
  assert.deepEqual(Omino.conteggi([]), {});
  assert.deepEqual(Omino.conteggi(undefined), {});
});

test("più esercizi sullo stesso muscolo = più luminoso", () => {
  const poco = Omino.livelli({ petto: 1, dorsali: 3 }, false);
  assert.ok(poco.dorsali > poco.petto);
  assert.deepEqual(Omino.livelli({ petto: 1, bicipiti: 2, tricipiti: 3, glutei: 4, femorali: 5, addome: 9 }, false),
    { petto: 1, bicipiti: 2, tricipiti: 3, glutei: 4, femorali: 5, addome: Omino.LIVELLI });
});

test("tutta la scheda: i livelli sono relativi al muscolo più allenato, da 1 a 5", () => {
  const l = Omino.livelli({ petto: 12, dorsali: 6, bicipiti: 1 }, true);
  assert.equal(l.petto, Omino.LIVELLI);
  assert.ok(l.dorsali > l.bicipiti);
  assert.equal(l.bicipiti, 1);
  for (const v of Object.values(l)) assert.ok(v >= 1 && v <= Omino.LIVELLI);
});

test("il riepilogo allenamento è nella home, tra «La tua scheda» e «Il tuo trainer», e non nella scheda", () => {
  const home = leggi("benvenuto.html");
  const a = home.indexOf('id="sezione-scheda"'), b = home.indexOf('id="sezione-riepilogo"'), c = home.indexOf('id="sezione-trainer"');
  assert.ok(a > 0 && b > a && c > b, "ordine delle sezioni");
  assert.match(home, /href="\/omino\.css"/);
  for (const f of ["/muscoli.js", "/omino-dati.js", "/omino.js"]) assert.ok(home.includes(`src="${f}"`), `benvenuto.html non carica ${f}`);
  assert.ok(home.indexOf('src="/omino.js"') < home.indexOf('src="/benvenuto.js"'));
  assert.match(leggi("benvenuto.js"), /riepilogo\.aggiorna\(c, r\.json\.registrazioni\)/);
  assert.doesNotMatch(leggi("scheda.html"), /omino/i);
  assert.doesNotMatch(leggi("scheda-server.js"), /omino/i);
  assert.doesNotMatch(leggi("scheda.js"), /omino/i, "scheda.js (usata anche dalla scheda scaricabile) non deve conoscere l'omino");
});

test("allenamenti: un giorno di una settimana con almeno un esercizio fatto, dal più recente", () => {
  const DATI = { giorni: [
    { id: "A", titolo: "Giorno A", blocchi: [es("Panca piana"), es("Squat"), { tipo: "circuito", esercizi: [{ nome: "Plank" }] }] },
    { id: "B", titolo: "Giorno B", blocchi: [es("Lat machine")] },
  ] };
  const r = (tipo, chiave, valore, quando) => ({ tipo, chiave, valore, aggiornata_il: quando });
  const reg = [
    r("fatto", "1|A|1", "1", "2026-11-10T10:00:00Z"),
    r("serie", "1|A|2", "2", "2026-11-10T10:05:00Z"),
    r("kg", "1|A|1", "50", "2026-11-10T10:30:00Z"),            // solo i kg non contano come esercizio fatto
    r("fatto", "1|A|R|0", "1", "2026-11-10T09:00:00Z"),        // riscaldamento: no
    r("fatto", "1|A|S", "1", "2026-11-10T11:00:00Z"),          // stretching: no
    r("fatto", "2|B|1", "1", "2026-11-12T10:00:00Z"),
    r("fatto", "1|B|1", "", "2026-11-13T10:00:00Z"),           // spunta tolta: no
    r("fatto", "1|Z|1", "1", "2026-11-14T10:00:00Z"),          // giorno che non esiste più: no
    r("serie", "3|A|1", "0", "2026-11-15T10:00:00Z"),          // zero serie: no
  ];
  const lista = Omino.allenamenti(DATI, reg);
  assert.deepEqual(lista.map((x) => `${x.sett}${x.giorno.id}`), ["2B", "1A"]);
  assert.equal(lista[1].esercizi, 2);
  assert.equal(lista[1].n.petto, 1);
  assert.equal(lista[1].n.quadricipiti, 1);
  assert.equal(lista[0].n.dorsali >= 1 || lista[0].n.schiena >= 1 || Object.keys(lista[0].n).length > 0, true);
  assert.deepEqual(Omino.allenamenti(DATI, []), []);
  assert.deepEqual(Omino.allenamenti(null, undefined), []);
});

test("omino.js e omino.css: niente colori scritti a mano, niente innerHTML", () => {
  const colore = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/;
  assert.doesNotMatch(leggi("omino.css"), colore, "omino.css ha un colore scritto a mano");
  assert.doesNotMatch(leggi("omino.js"), colore, "omino.js ha un colore scritto a mano");
  assert.doesNotMatch(leggi("omino.js"), /innerHTML|eval\(|new Function/);
});

test("«Fine allenamento» riporta alla home solo sul sito, dopo aver inviato i progressi", () => {
  assert.match(leggi("scheda.js"), /k\.endsWith\("\|S"\) && mem\.fatti\[c\] && ARCHIVIO && ARCHIVIO\.fineAllenamento/);
  assert.match(leggi("scheda-server.js"), /fineAllenamento\(\)[\s\S]{0,80}sincronizzaOra\(\)\)[\s\S]{0,40}\/benvenuto\.html/);
});
