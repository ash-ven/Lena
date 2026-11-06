# web/: le pagine di Lena

## Come è fatto il grafico
- `sistema.css`: **unico posto** per colori, font, spazi, raggi e icone (token del design system in `../design-sistema/`). Modalità scura (principale) e chiara; per default segue il dispositivo, l'utente può scegliere (`tema.js`, salvato in `localStorage` come `lena:tema`).
- `pagine.css`: login, registrazione, pagine semplici. `pt.css`: area del trainer, account, informative.
- `tema.css` + `scheda.css`: tema della scheda di allenamento, **separato** perché la scheda scaricabile li incorpora e deve restare identica.
- Nei file CSS delle pagine **non si scrivono colori né font a mano**: si usano le variabili (`var(--brace)`…). Lo controllano i test.

## Aggiungere una pagina
1. Copia la testa di `login.html` (o di `pt.html` per l'area trainer): `theme-color`, `/tema.js` PRIMA dei CSS, poi `/sistema.css` e il CSS della famiglia.
2. `lang="it"`, un `<title>`, un solo `<h1>`, ogni campo con la sua `<label>`.
3. Niente script o stili scritti nella pagina (la CSP li blocca) e niente risorse esterne.
4. Un solo pulsante brace per vista; gli altri `bottone secondario`.
5. Testi: dai del "tu", nessun punto esclamativo, titoli-frase con il punto, pulsanti = verbi, "trainer".
6. Se serve un elemento che il sistema non ha, aggiungilo con la scritta PROPOSTA e annotalo in `../design-sistema/PROPOSTE.md`.

## Cambiare colori o font
Prima nel design system (`../design-sistema/tokens.json`), poi in `sistema.css`. Poi `npm test` in `api`: controlla i contrasti in entrambe le modalità.
