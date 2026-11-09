// I mood che il cliente può scegliere per la sua scheda: questo è l'ELENCO UFFICIALE (id, nome mostrato, descrizione).
// L'estetica di ognuno è in web/mood/<id>.css. Per aggiungerne uno: il file css, una riga qui, e i test
// (api/test/mood.test.js) controllano da soli che file, elenco e pagine siano allineati.
// Gli id non si cambiano dopo che qualcuno li ha scelti: sono salvati nel database (cliente.mood).
const MOOD = [
  { id: "lena", nome: "Lena", descrizione: "Scuro · carbonio e brace" },
  { id: "box", nome: "Box", descrizione: "Scuro · carbonio, pista e segnaletica" },
  { id: "velluto", nome: "Velluto", descrizione: "Scuro · art déco, nero caldo e oro" },
  { id: "oldschool", nome: "Old School", descrizione: "Chiaro · manifesto da strongman d'inizio '900" },
  { id: "botanico", nome: "Botanico", descrizione: "Chiaro · rosa polvere e fiori essiccati" },
  { id: "tatami", nome: "Tatami", descrizione: "Chiaro · dojo, pennello e pastelli" },
];
const PREDEFINITO = "lena";
const èMood = (id) => typeof id === "string" && MOOD.some((m) => m.id === id);
module.exports = { MOOD, PREDEFINITO, èMood };
