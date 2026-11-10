/* pt-cliente.html: le note private del trainer su un cliente (un solo campo di testo).
   Espone LenaPtNote.avvia(idCliente). Il controllo sui dati di salute è solo un avviso (parole-salute.js), mai un blocco. */
(function () {
  const $ = (id) => document.getElementById(id);
  const MAX = 2000;
  const { messaggio, testoErrore } = LenaPt;
  let id = null, salvato = "", inCorso = false;

  function conta() { $("note-conta").textContent = `${[...$("note-testo").value].length} su ${MAX}`; }

  function controllaSalute() {
    const zona = $("note-salute");
    zona.replaceChildren();
    const parole = window.LenaParoleSalute ? LenaParoleSalute.trova($("note-testo").value) : [];
    if (parole.length) zona.append(messaggio("avviso", LenaParoleSalute.MESSAGGIO, [`Parole riconosciute: ${parole.join(", ")}. Puoi salvare lo stesso, ma meglio toglierle.`]));
  }

  async function salva() {
    if (inCorso) return;
    const esito = $("note-esito");
    esito.replaceChildren();
    inCorso = true;
    $("note-salva").disabled = true;
    const r = await LenaPt.chiama("PUT", `/api/clienti/${id}/note`, { testo: $("note-testo").value });
    inCorso = false;
    $("note-salva").disabled = false;
    if (r.stato === 200) {
      salvato = r.json.testo;
      $("note-testo").value = salvato;
      conta();
      esito.append(messaggio("ok", salvato ? "Note salvate." : "Note cancellate."));
    } else {
      esito.append(messaggio("errore", testoErrore(r, "salvare le note")));
    }
  }

  async function avvia(idCliente) {
    id = idCliente;
    const r = await LenaPt.chiama("GET", `/api/clienti/${id}/note`);
    if (r.stato === 200) { salvato = r.json.testo; $("note-testo").value = salvato; }
    else $("note-esito").replaceChildren(messaggio("errore", testoErrore(r, "caricare le note")));
    conta(); controllaSalute();
  }

  $("note-testo").addEventListener("input", () => { conta(); controllaSalute(); $("note-esito").replaceChildren(); });
  $("note-salva").addEventListener("click", salva);
  // un'uscita dalla pagina con note non salvate: si avvisa (solo il browser, nessun dato parte)
  window.addEventListener("beforeunload", (ev) => { if ($("note-testo").value.trim() !== salvato.trim()) { ev.preventDefault(); ev.returnValue = ""; } });

  window.LenaPtNote = { avvia };
})();
