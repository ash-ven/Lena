/* pt-profilo.html: il trainer modifica foto, nome, presentazione e contatto. */
(function () {
  const $ = (id) => document.getElementById(id);
  const { messaggio, testoErrore } = LenaPt;
  const FOTO = "/api/pt/foto";
  const LATO = 512, MAX_BYTE = 380 * 1024;   // il server accetta fino a 400 KB
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

  // ---------- foto: si ritaglia quadrata e si riduce QUI, nel browser (toglie anche i dati nascosti della fotocamera, come la posizione) ----------
  async function apriImmagine(file) {
    if (window.createImageBitmap) {
      try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch (e) { /* si prova l'altra strada */ }
    }
    const url = await new Promise((ok, no) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = no; fr.readAsDataURL(file); });
    return await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
  }
  async function ridimensiona(file) {
    const img = await apriImmagine(file);
    const w = img.width || img.naturalWidth, h = img.height || img.naturalHeight;
    const lato = Math.min(w, h);
    const c = document.createElement("canvas");
    c.width = c.height = Math.min(LATO, lato);
    const g = c.getContext("2d");
    g.fillStyle = "white";   // dietro le parti trasparenti dei PNG: il JPEG non le ha
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, (w - lato) / 2, (h - lato) / 2, lato, lato, 0, 0, c.width, c.height);
    for (const q of [0.85, 0.7, 0.55]) {
      const blob = await new Promise((ok) => c.toBlob(ok, "image/jpeg", q));
      if (blob && blob.size <= MAX_BYTE) return blob;
    }
    return null;
  }

  $("p-foto").addEventListener("change", async (ev) => {
    const file = ev.target.files[0];
    const esito = $("esito-foto");
    esito.replaceChildren();
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { esito.append(messaggio("errore", "Scegli un file JPEG, PNG o WebP.")); ev.target.value = ""; return; }
    let blob;
    try { blob = await ridimensiona(file); } catch (e) { blob = null; }
    if (!blob) { esito.append(messaggio("errore", "Non riesco a leggere questa foto. Provane un'altra.")); ev.target.value = ""; return; }
    let r;
    try {
      const res = await fetch(FOTO, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: blob, credentials: "same-origin" });
      let json = null; try { json = await res.json(); } catch (e) { /* senza corpo */ }
      r = { stato: res.status, json };
    } catch (e) { r = { stato: 0, json: null }; }
    ev.target.value = "";
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
