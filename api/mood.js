// I mood che il cliente può scegliere per la sua scheda. L'estetica di ognuno è in web/mood/<id>.css.
// Per aggiungerne uno: il file css, una riga qui (i nomi sono provvisori), e il test mood.test.js lo controlla da solo.
const MOOD = [
  { id: "lena", nome: "Lena", descrizione: "Scuro, carbonio e brace" },
  { id: "motori", nome: "Motori", descrizione: "Scuro, carbonio e segnaletica" },
];
const PREDEFINITO = "lena";
const èMood = (id) => typeof id === "string" && MOOD.some((m) => m.id === id);
module.exports = { MOOD, PREDEFINITO, èMood };
