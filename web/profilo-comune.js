/* Pezzi in comune tra il profilo del trainer (che lo modifica) e la pagina del cliente (che lo vede):
   l'avatar e la scheda "Il tuo trainer". Espone un solo nome globale: LenaProfilo. Richiede api.js. */
(function () {
  const el = (tag, attrs, ...figli) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) { if (v != null && v !== false) e.setAttribute(k === "class" ? "class" : k, v === true ? "" : v); }
    for (const f of figli.flat()) if (f != null) e.append(f.nodeType ? f : document.createTextNode(String(f)));
    return e;
  };

  const iniziali = (nome) => String(nome || "?").trim().split(/\s+/).slice(0, 2).map((p) => [...p][0] || "").join("").toUpperCase() || "?";

  // Riempie un "contenitore" con la foto (se c'è) o con le iniziali. "urlFoto" è l'indirizzo da cui scaricarla.
  function disegnaAvatar(contenitore, profilo, urlFoto) {
    contenitore.replaceChildren();
    if (profilo.haFoto) {
      const img = el("img", { src: `${urlFoto}?v=${encodeURIComponent(profilo.fotoAggiornataIl || "")}`, alt: "", width: "96", height: "96" });
      img.addEventListener("error", () => contenitore.replaceChildren(el("span", { "aria-hidden": "true" }, iniziali(profilo.nome))), { once: true });
      contenitore.append(img);
    } else {
      contenitore.append(el("span", { "aria-hidden": "true" }, iniziali(profilo.nome)));
    }
  }

  // La scheda con avatar, nome, presentazione e contatto
  function disegnaScheda(contenitore, profilo, urlFoto) {
    const av = el("div", { class: "avatar" });
    disegnaAvatar(av, profilo, urlFoto);
    contenitore.replaceChildren(av, el("div", { class: "scheda-trainer-testo" },
      el("p", { class: "nome-trainer" }, profilo.nome),
      profilo.bio ? el("p", { class: "bio-trainer" }, profilo.bio) : null,
      profilo.contatto ? el("p", { class: "contatto-trainer" }, el("span", { class: "nota" }, "Contatto: "), profilo.contatto) : null));
  }

  // ---------- foto: si ritaglia quadrata e si riduce QUI, nel browser (toglie anche i dati nascosti della fotocamera, come la posizione) ----------
  const LATO = 512, MAX_BYTE = 380 * 1024;   // il server accetta fino a 400 KB
  async function apriImmagine(file) {
    if (window.createImageBitmap) {
      try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch (e) { /* si prova l'altra strada */ }
    }
    const url = await new Promise((ok, no) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = no; fr.readAsDataURL(file); });
    return await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
  }
  // Restituisce un JPEG quadrato (Blob) oppure null se non riesce
  async function preparaFoto(file) {
    try {
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
    } catch (e) { /* si restituisce null */ }
    return null;
  }
  // Manda il JPEG all'indirizzo dato (PUT). Restituisce { stato, json } come Lena.chiama.
  async function inviaFoto(url, blob) {
    try {
      const res = await fetch(url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: blob, credentials: "same-origin" });
      let json = null; try { json = await res.json(); } catch (e) { /* senza corpo */ }
      return { stato: res.status, json };
    } catch (e) { return { stato: 0, json: null }; }
  }
  // Tutto in uno: controlla il file scelto, lo prepara e lo manda. Restituisce { errore } oppure { r } (la risposta del server).
  async function caricaFoto(file, url) {
    if (!file) return { errore: null };
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return { errore: "Scegli un file JPEG, PNG o WebP." };
    const blob = await preparaFoto(file);
    if (!blob) return { errore: "Non riesco a leggere questa foto. Provane un'altra." };
    return { r: await inviaFoto(url, blob) };
  }

  window.LenaProfilo = { el, iniziali, disegnaAvatar, disegnaScheda, caricaFoto };
})();
