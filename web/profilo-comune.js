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

  window.LenaProfilo = { el, iniziali, disegnaAvatar, disegnaScheda };
})();
