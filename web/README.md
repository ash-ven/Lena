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

## L'editor delle schede (`pt-editor.html?cliente=ID`)
- Il trainer compila giorni, esercizi, circuiti EMOM/AMRAP, riscaldamento, stretching, schema per settimana e progressione. `pt-editor.js` costruisce **lo stesso oggetto «dati»** del convertitore Excel, lo controlla con `valida-scheda.js` e lo invia a `POST /api/clienti/:id/schede`: la scheda del cliente non cambia.
- `settimane` = totale comprese quelle di scarico; lo schema di un esercizio ha una voce per ogni settimana di lavoro (le ultime settimane, di scarico, restano senza voce: è così che `scheda.js` le riconosce).
- La bozza si ricorda in `localStorage` (`lena:bozza:<id cliente>`) finché la scheda non viene inviata.
- Il nome di un esercizio si completa dalla libreria (`GET /api/pt/esercizi?q=`) e ricompila il video già usato.
- Per ora si crea solo da zero: modificare una scheda esistente e copiare da modelli sono passi successivi.

## Il riepilogo allenamento («omino», nella home del cliente)
- `muscoli.js` dice, per ogni esercizio, i muscoli principali (19 gruppi; si legge il nome dell'esercizio, anche se è inventato dal trainer). `omino.js` conta quanti esercizi di un allenamento lavorano ogni muscolo e li accende sulla figura: più esercizi = più luminoso (5 livelli).
- Sta in `benvenuto.html`, tra «La tua scheda» e «Il tuo trainer», e non nella scheda (né in quella scaricabile). `benvenuto.js` gli passa la scheda e le registrazioni a ogni aggiornamento della pagina.
- Un «allenamento» è un giorno della scheda in una settimana con almeno un esercizio fatto (spunta o almeno una serie); riscaldamento e stretching non contano. In primo piano c'è l'ultimo (per data di salvataggio), una tendina fa vedere i precedenti. Se non c'è ancora nessun allenamento, la sezione resta nascosta.
- Il cliente sceglie la figura (uomo o donna: nessun dato nuovo, resta solo nel suo browser, chiave `lena:omino`).
- `omino/`: per ogni figura la base grigia (`.webp`) e la sagoma (`-sagoma.png`, per tenere il bagliore dentro il corpo). `omino-dati.js`: la forma di ogni muscolo (tracciati SVG), ricavata da una mappa a colori della stessa figura. Le immagini sono state generate con un'IA a partire dalla stessa posa: se si cambiano, vanno rifatti anche i tracciati.
- Il bagliore è fatto da tre strati (tinta, luce, alone) in `omino.css`, con il brace di Lena uguale in ogni mood.

## Il logo
Le pagine usano due immagini per ogni logo (`su-scuro` e `su-chiaro`): `sistema.css` mostra quella giusta in base al tema. I file sono in `web/logo/` (copia di `design-sistema/assets/Logos/`). Nella home c'è solo la scritta, perché il simbolo è già nella composizione; nelle intestazioni c'è simbolo + scritta. L'icona del browser è `favicon.svg`.

## I mood della scheda del cliente (`web/mood/`)
La scheda di allenamento ha un'estetica a parte, il **mood**: colori, carattere dei titoli, angoli, texture e animazioni. La struttura (`scheda.js`) è la stessa per tutti i mood.
- Un mood è un file `web/mood/<nome>.css`, attivo quando `<html>` ha `data-mood="<nome>"`. Lo mettono `scheda-server.js` (scheda del cliente) e `anteprima.js` (il trainer vede la stessa estetica). Mood ufficiali (elenco in `api/mood.js`, con nome e descrizione): **Lena** `lena` (predefinito), **Box** `box`, **Velluto** `velluto`, **Old School** `oldschool`, **Botanico** `botanico`, **Tatami** `tatami`. Il cliente sceglie dall'icona «Aspetto» nella testata della scheda; la scelta si salva sul profilo (`cliente.mood`, `/api/me/mood`). Il trainer vede la scheda e i progressi con il mood del cliente (`GET /api/schede/:id` restituisce `mood`). `?mood=<id>` nell'indirizzo serve solo per provare un mood senza salvarlo. Gli id non si cambiano più: sono nel database.
- La barra di avanzamento ha due forme: `.avanzamento > i` (barra continua) e `.avanzamento .tappe b` (una tappa per blocco, `on` se fatto); ogni mood ne mostra una sola (Velluto: le perle).
- Il riquadro «Allenamento completato» contiene più disegni (`.gradi`, `.fiore`, `.enso`): ogni mood mostra il suo e nasconde gli altri.
- Ganci di `scheda.js` per le animazioni dei mood: classe `cambia` su `<html>` al cambio di giorno; `data-luci` (0–3) sul timer negli ultimi 3 secondi, con tre `<i>` in `.luci` (Lena le nasconde, Motori ne fa il semaforo).
- Ogni mood è **o scuro o chiaro**: dentro la scheda vale il mood, non l'interruttore del tema del sito (`:root[data-mood]` vince su `data-theme`).
- **Colori dei giorni:** `--giorno-1` … `--giorno-7` e `--su-giorno-1` … `--su-giorno-7` (la scritta sopra). Il giorno si sceglie per posizione (`data-giorno` su `<html>` e sulle linguette), mai dai colori salvati nei dati. Si vedono nella testata del giorno, nelle linguette, nella barra di avanzamento e nei passi della modalità allenamento.
- **Animazioni:** brevi e legate a momenti precisi (spunta → classe `scatta`, cambio giorno → `entra`, allenamento completato → `completato appena`, fine recupero → `.timer.finito`). Si fermano con «riduci movimento».
- La scheda **scaricabile** non ha mood: resta con `tema.css` e `scheda.css`.
- `api/test/mood.test.js` controlla ogni mood: 7 colori, scritta della testata ≥ 4,5:1, colore sulla superficie ≥ 3:1, testo leggibile, niente risorse esterne.
- Regole e decisioni: nota di progetto «Lena: mood delle schede».
