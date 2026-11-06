// Il registro degli errori del server. REGOLA: nei log non finiscono MAI dati delle persone.
// Quindi niente corpi delle richieste, niente email o password, niente dati delle schede, niente cookie,
// niente parte dell'indirizzo dopo il «?» e niente MESSAGGI di errore (quelli del database, per esempio, possono contenere
// il valore che ha causato l'errore). Si scrive solo: quando, che richiesta (metodo e percorso), che tipo di errore e DOVE è successo.
function registraErrore(req, err) {
  const e = err || {};
  const percorso = req ? String(req.originalUrl || req.url || "").split("?")[0] : "";   // senza la parte dopo il «?»
  const tipo = [e.name, e.code, e.type].filter((x) => typeof x === "string" && x).join(" ");
  // dello "stack" (la lista dei punti del codice) si tengono solo le righe dei punti, non la prima riga che contiene il messaggio
  const punti = String(e.stack || "").split("\n").slice(1, 6).map((r) => r.trim()).filter((r) => r.startsWith("at "));
  console.error(`[errore] ${new Date().toISOString()} ${req ? `${req.method} ${percorso} ` : ""}→ ${tipo || "errore sconosciuto"}${punti.length ? "\n  " + punti.join("\n  ") : ""}`);
}

module.exports = { registraErrore };
