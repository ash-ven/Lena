// Controlli sui dati scritti dal trainer nel profilo (nome, indirizzo del titolare, contatto).
// Una sola copia: la usa il browser (messaggi subito) e il server (che non si fida del browser).
// Ogni funzione restituisce il testo dell'errore in italiano, oppure null se va bene.
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica();
  else radice.LenaValidaProfilo = fabbrica();
})(typeof self !== "undefined" ? self : this, function () {
  const lettere = (t) => (String(t).match(/\p{L}/gu) || []).length;
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  // Un nome: almeno due lettere (una lettera sola o un numero non sono un nome)
  function erroreNome(t, cosa = "il tuo nome") {
    return lettere(t) >= 2 ? null : `Scrivi ${cosa}: servono almeno due lettere.`;
  }

  // L'indirizzo del titolare (finisce nell'informativa dei clienti): via, numero, CAP di 5 cifre e città.
  // Esempio: «Via Roma 12, 20121 Milano». «Snc» vale come numero.
  function erroreIndirizzo(t) {
    const msg = "Scrivi l'indirizzo completo: via e numero, CAP e città. Per esempio «Via Roma 12, 20121 Milano».";
    const s = String(t).trim();
    const m = /^(.*?)[\s,]*\b(\d{5})\b[\s,]+(.+)$/su.exec(s);
    if (!m) return msg;
    const via = m[1], citta = m[3];
    if (lettere(via) < 3 || !(/\d/.test(via) || /\bs\.?n\.?c\.?\b/i.test(via))) return msg;
    if (lettere(citta) < 2) return msg;
    return null;
  }

  // Il contatto mostrato ai clienti: vuoto va bene; altrimenti un'email oppure un telefono (da 8 a 15 cifre)
  function erroreContatto(t) {
    const s = String(t).trim();
    if (!s) return null;
    if (EMAIL.test(s)) return null;
    if (/^\+?[\d\s().\-\/]+$/.test(s)) { const cifre = s.replace(/\D/g, "").length; if (cifre >= 8 && cifre <= 15) return null; }
    return "Scrivi un'email (nome@esempio.it) o un numero di telefono valido, oppure lascia vuoto.";
  }

  return { erroreNome, erroreIndirizzo, erroreContatto };
});
