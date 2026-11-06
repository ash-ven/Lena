require("dotenv").config({ quiet: true });
const { creaApp, problemiConfigurazione } = require("./app");

// Senza configurazione giusta (es. JWT_SECRET mancante) il server si rifiuta di partire
const problemi = problemiConfigurazione();
if (problemi.length) {
  console.error("Il server non parte, sistema prima api/.env:\n - " + problemi.join("\n - "));
  process.exit(1);
}

const PORTA = process.env.PORT || 3001;
const server = creaApp().listen(PORTA, (err) => {
  // In Express 5 questa funzione viene chiamata anche quando l'avvio fallisce (con l'errore):
  // in quel caso non diciamo "acceso", ci pensa server.on("error") qui sotto.
  if (err) return;
  console.log(`API Lena su http://localhost:${PORTA}`);
});

// Se la porta è occupata (o c'è un altro errore all'avvio), lo dice chiaramente e si ferma
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`La porta ${PORTA} è già occupata da un altro programma. Chiudilo e riprova.`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
