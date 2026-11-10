// Il service worker di Lena: fa aprire l'app più in fretta e mostra una pagina chiara quando manca la rete.
// REGOLA: non salva MAI dati delle persone. Non tocca le richieste all'API (schede, valori, account), né gli indirizzi con
// parametri (possono contenere i codici di invito o di recupero password). Tiene solo una copia dei file del sito
// (pagine, stili, script, immagini), che sono uguali per tutti.
const VERSIONE = "lena-v1";
const OFFLINE = "/offline.html";
const DA_SUBITO = [OFFLINE, "/sistema.css", "/pagine.css", "/tema.js", "/favicon.svg", "/logo/lena-logo-scuro.svg", "/logo/lena-logo-chiaro.svg"];
const TIPI = ["document", "style", "script", "image", "font"];

self.addEventListener("install", (ev) => {
  ev.waitUntil(caches.open(VERSIONE).then((c) => c.addAll(DA_SUBITO)));
  self.skipWaiting();
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil((async () => {
    for (const nome of await caches.keys()) if (nome !== VERSIONE) await caches.delete(nome);
    await self.clients.claim();
  })());
});

// Prima la rete (così dopo ogni aggiornamento del sito si vede subito la versione nuova), la copia solo se la rete non c'è
async function reteOCopia(richiesta) {
  try {
    const risposta = await fetch(richiesta);
    const senzaCopie = /no-store/i.test(risposta.headers.get("Cache-Control") || "");
    if (risposta.ok && risposta.type === "basic" && !risposta.redirected && !senzaCopie) {
      const cache = await caches.open(VERSIONE);
      cache.put(richiesta, risposta.clone());
    }
    return risposta;
  } catch (e) {
    const copia = await caches.match(richiesta);
    if (copia) return copia;
    if (richiesta.mode === "navigate") return (await caches.match(OFFLINE)) || Response.error();
    return Response.error();
  }
}

self.addEventListener("fetch", (ev) => {
  const r = ev.request;
  if (r.method !== "GET") return;
  const url = new URL(r.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;   // i dati delle persone non si copiano mai
  if (url.search) return;                         // niente indirizzi con parametri (codici di invito e di recupero)
  if (r.mode !== "navigate" && !TIPI.includes(r.destination)) return;   // i download (per esempio il modello Excel) no
  ev.respondWith(reteOCopia(r));
});
