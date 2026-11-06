/* pt-profilo.html: il trainer modifica foto, nome, presentazione e contatto. */
(function () {
  const $ = (id) => document.getElementById(id);
  const { messaggio, testoErrore } = LenaPt;
  const FOTO = "/api/pt/foto";
  let profilo = null;

  $("esci").addEventListener("click", () => Lena.esci());

  function disegna() {
    $("p-nome").value = profilo.nome;
    $("p-bio").value = profilo.bio;
    $("p-contatto").value = profilo.contatto;
    contaBio();
    LenaProfilo.disegnaAvatar($("avatar"), profilo, FOTO);
    $("rimuovi-foto").hidden = !profilo.haFoto;
    LenaProfilo.disegnaScheda($("anteprima"), profilo, FOTO);
  }
  function contaBio() { $("conta-bio").textContent = `${[...$("p-bio").value].length} su 500`; }
  $("p-bio").addEventListener("input", contaBio);

  // ---------- testo ----------
  let inCorso = false;
  $("modulo-profilo").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (inCorso) return;
    const esito = $("esito-profilo");
    esito.replaceChildren();
    const nome = $("p-nome").value.trim();
    if (!nome) { esito.append(messaggio("errore", "Scrivi il tuo nome.")); $("p-nome").focus(); return; }
    inCorso = true;
    $("salva-profilo").disabled = true;
    const r = await LenaPt.chiama("PUT", "/api/pt/profilo", { nome, bio: $("p-bio").value, contatto: $("p-contatto").value });
    inCorso = false;
    $("salva-profilo").disabled = false;
    if (r.stato === 200) { profilo = r.json; disegna(); esito.append(messaggio("ok", "Profilo salvato.")); }
    else esito.append(messaggio("errore", testoErrore(r, "salvare il profilo")));
  });

  // ---------- foto ----------
  $("p-foto").addEventListener("change", async (ev) => {
    const esito = $("esito-foto");
    esito.replaceChildren();
    const { errore, r } = await LenaProfilo.caricaFoto(ev.target.files[0], FOTO);
    ev.target.value = "";
    if (errore) { esito.append(messaggio("errore", errore)); return; }
    if (!r) return;
    if (r.stato === 200) { profilo = { ...profilo, ...r.json }; disegna(); esito.append(messaggio("ok", "Foto aggiornata.")); }
    else if (r.stato === 401) location.replace("/login.html?sessione=scaduta");
    else esito.append(messaggio("errore", testoErrore(r, "caricare la foto")));
  });

  $("rimuovi-foto").addEventListener("click", async () => {
    const esito = $("esito-foto");
    esito.replaceChildren();
    const r = await LenaPt.chiama("DELETE", FOTO);
    if (r.stato === 200) { profilo = { ...profilo, ...r.json }; disegna(); esito.append(messaggio("ok", "Foto rimossa.")); }
    else esito.append(messaggio("errore", testoErrore(r, "rimuovere la foto")));
  });

  // ---------- avvio ----------
  (async () => {
    const utente = await LenaPt.verificaPt();
    if (!utente) { $("stato-pagina").append(messaggio("errore", "Non riesco a collegarmi al server", ["Controlla la connessione e riprova."])); return; }
    const r = await LenaPt.chiama("GET", "/api/pt/profilo");
    if (r.stato !== 200) { $("stato-pagina").append(messaggio("errore", "Non riesco a caricare il profilo", [testoErrore(r, "caricare il profilo")])); return; }
    profilo = r.json;
    $("pagina").hidden = false;
    disegna();
  })();
})();
