/* condizioni-pt.html: le condizioni d'uso per i professionisti.
   - Chi non è loggato, o è un cliente, le legge e basta.
   - Un professionista che non ha accettato la VERSIONE CORRENTE vede la casella e il pulsante «Accetta e continua»:
     finché non accetta, le rotte dell'area del PT rispondono 403 e le pagine lo portano qui. */
(function () {
  const $ = (id) => document.getElementById(id);
  const crea = (tag, attrs, ...figli) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) { if (k === "class") e.className = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); }
    for (const f of figli) if (f != null) e.append(f.nodeType ? f : document.createTextNode(String(f)));
    return e;
  };
  const zona = $("azione");

  async function avvia() {
    const [me, ver] = await Promise.all([Lena.chiama("GET", "/api/auth/me"), Lena.chiama("GET", "/api/privacy/versioni")]);
    if (ver.stato === 200) $("versione").textContent = ver.json.condizioni_pt;
    if (me.stato !== 200 || me.json.ruolo !== "pt") return;   // sola lettura

    const st = await Lena.chiama("GET", "/api/privacy/condizioni-pt");
    if (st.stato !== 200) return;
    if (st.json.accettate) {
      zona.append(crea("p", { class: "avviso-pt ok" }, "Hai già accettato questa versione."), crea("a", { class: "bottone", href: "/pt.html" }, "Vai ai tuoi clienti"));
      return;
    }

    const casella = crea("input", { type: "checkbox", id: "accetto" });
    const bottone = crea("button", { class: "bottone", type: "button", id: "accetta-continua", disabled: "" }, "Accetta e continua");
    const errore = crea("div", { role: "alert" });
    casella.addEventListener("change", () => { bottone.disabled = !casella.checked; });
    let inCorso = false;
    bottone.addEventListener("click", async () => {
      if (inCorso || !casella.checked) return;
      inCorso = true; bottone.disabled = true; errore.replaceChildren();
      const r = await Lena.chiama("POST", "/api/privacy/condizioni-pt", { versione: st.json.versione });
      if (r.stato === 200) { location.replace("/pt.html"); return; }
      inCorso = false; bottone.disabled = !casella.checked;
      errore.append(crea("p", { class: "avviso-pt errore" }, (r.json && r.json.errore) || Lena.messaggioComune(r) || "Non sono riuscito a salvare la tua accettazione. Riprova."));
    });
    zona.append(
      crea("label", { class: "spunta-pt", for: "accetto" }, casella, crea("span", {}, "Ho letto e accetto le condizioni d'uso (versione " + st.json.versione + ")")),
      errore,
      crea("div", { class: "azioni-pt" }, bottone, crea("button", { class: "bottone secondario", type: "button", onclick: () => Lena.esci() }, "Esci")));
  }
  avvia();
})();
