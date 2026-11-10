/* pt-cliente.html: i due campi di testo del trainer su un cliente.
   - «Note private» (/note): le riceve anche il cliente se scarica i suoi dati.
   - «Appunti per me» (/appunti): solo del trainer, non esportati.
   Espone LenaPtNote.avvia(idCliente). Il controllo sui dati di salute è solo un avviso (parole-salute.js), mai un blocco. */
(function () {
  const $ = (id) => document.getElementById(id);
  const { messaggio, testoErrore } = LenaPt;

  // prefisso: «note» o «appunti» (stesso nome degli id nella pagina); percorso: la parte finale dell'indirizzo
  function sezione(prefisso, percorso, max, nomi) {
    let id = null, salvato = "", inCorso = false;
    const campo = $(`${prefisso}-testo`);

    const conta = () => { $(`${prefisso}-conta`).textContent = `${[...campo.value].length} su ${max}`; };

    function controllaSalute() {
      const zona = $(`${prefisso}-salute`);
      zona.replaceChildren();
      const parole = window.LenaParoleSalute ? LenaParoleSalute.trova(campo.value) : [];
      if (parole.length) zona.append(messaggio("avviso", LenaParoleSalute.MESSAGGIO, [`Parole riconosciute: ${parole.join(", ")}. Puoi salvare lo stesso, ma meglio toglierle.`]));
    }

    async function salva() {
      if (inCorso) return;
      const esito = $(`${prefisso}-esito`);
      esito.replaceChildren();
      inCorso = true;
      $(`${prefisso}-salva`).disabled = true;
      const r = await LenaPt.chiama("PUT", `/api/clienti/${id}/${percorso}`, { testo: campo.value });
      inCorso = false;
      $(`${prefisso}-salva`).disabled = false;
      if (r.stato === 200) {
        salvato = r.json.testo;
        campo.value = salvato;
        conta();
        esito.append(messaggio("ok", salvato ? `${nomi.salvate}.` : `${nomi.cancellate}.`));
      } else {
        esito.append(messaggio("errore", testoErrore(r, nomi.salvare)));
      }
    }

    async function avvia(idCliente) {
      id = idCliente;
      const r = await LenaPt.chiama("GET", `/api/clienti/${id}/${percorso}`);
      if (r.stato === 200) { salvato = r.json.testo; campo.value = salvato; }
      else $(`${prefisso}-esito`).replaceChildren(messaggio("errore", testoErrore(r, nomi.caricare)));
      conta(); controllaSalute();
    }

    campo.addEventListener("input", () => { conta(); controllaSalute(); $(`${prefisso}-esito`).replaceChildren(); });
    $(`${prefisso}-salva`).addEventListener("click", salva);
    // un'uscita dalla pagina con testo non salvato: si avvisa (solo il browser, nessun dato parte)
    window.addEventListener("beforeunload", (ev) => { if (campo.value.trim() !== salvato.trim()) { ev.preventDefault(); ev.returnValue = ""; } });
    return { avvia };
  }

  const note = sezione("note", "note", 2000, { salvate: "Note salvate", cancellate: "Note cancellate", salvare: "salvare le note", caricare: "caricare le note" });
  const appunti = sezione("appunti", "appunti", 4000, { salvate: "Appunti salvati", cancellate: "Appunti cancellati", salvare: "salvare gli appunti", caricare: "caricare gli appunti" });

  window.LenaPtNote = { avvia: (idCliente) => Promise.all([note.avvia(idCliente), appunti.avvia(idCliente)]) };
})();
