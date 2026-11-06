// Piccoli aiuti usati da più file.

// Trasforma ":id" dell'indirizzo in un numero intero positivo, oppure null se non è valido.
// Massimo 9 cifre: così resta sempre dentro il tipo INTEGER di Postgres.
function idDa(testo) {
  return /^[1-9]\d{0,8}$/.test(String(testo)) ? Number(testo) : null;
}

// Il cookie di sessione: sempre con le stesse opzioni (anche quando lo cancelliamo).
const NOME_COOKIE = "lena_sessione";
function opzioniCookie() {
  return {
    httpOnly: true,                                // il JavaScript della pagina non può leggerlo
    sameSite: "lax",                               // non viene inviato nelle richieste partite da altri siti
    secure: process.env.NODE_ENV === "production", // in produzione viaggia solo su https
    path: "/",
  };
}

// Email: controllo semplice (qualcosa@qualcosa.qualcosa), minuscola e senza spazi ai lati.
function emailPulita(valore) {
  const email = String(valore || "").toLowerCase().trim();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

module.exports = { idDa, NOME_COOKIE, opzioniCookie, emailPulita };
