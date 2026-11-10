# API di Lena

Il "motore" di Lena: un server Node/Express che parla con il database Postgres, risponde
in JSON alle richieste del frontend **e serve anche le pagine web** (cartella `web/`).
Due ruoli: **PT** (personal trainer) e **cliente**.

## Indice

1. [Avviare tutto da zero](#avviare-tutto-da-zero)
2. [Il giro completo del PT, passo per passo](#il-giro-completo-del-pt-passo-per-passo-tutto-dal-browser)
   e gli [strumenti di emergenza](#strumenti-di-emergenza-riga-di-comando)
3. [Privacy, consensi e conservazione dei dati](#privacy-consensi-e-conservazione-dei-dati)
3. [Aprire il sito dal telefono](#aprire-il-sito-dal-telefono-wifi-di-casa)
3. [Le pagine del sito (cartella web/)](#le-pagine-del-sito-cartella-web)
4. [Come cambiare colori e font](#come-cambiare-colori-e-font)
5. [Le tabelle](#le-tabelle)
6. [Gli endpoint](#gli-endpoint)
7. [Esempi in PowerShell](#esempi-in-powershell)
8. [Regole di sicurezza già attive](#regole-di-sicurezza-già-attive)
9. [Prima di andare online (checklist)](#prima-di-andare-online-checklist-sicurezza)

---

## Avviare tutto da zero

Servono: **Docker Desktop** acceso e **Node.js 22** (o più recente).

```powershell
# 1. Password del database: copia il modello e cambia CAMBIAMI con una password a tua scelta
cd C:\Users\a.venturi\progetti\schede-pt
Copy-Item .env.example .env
notepad .env

# 2. Accendi il database (la prima volta crea le tabelle con i file in db/initdb)
docker compose up -d
docker compose ps        # deve dire "healthy"

# 3. Configura l'API: copia il modello e riempi i valori
cd api
Copy-Item .env.example .env
notepad .env
#    DATABASE_URL = postgres://lena:<la password del punto 1>@localhost:5433/lena
#    PORT         = 3001
#    JWT_SECRET   = un segreto lungo e casuale, generato con:
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

# 4. Installa i pacchetti
npm install

# 5. Crea il tuo account da PT
node crea-pt.js tua@email.it UnaPasswordLunga123 "Nome Cognome"

# 6. Controlla che tutto funzioni (serve il database acceso)
npm test

# 7. Avvia il server (--watch = si riavvia da solo quando cambi un file)
node --watch server.js
```

Il server risponde su `http://localhost:3001`. Prova veloce: `Invoke-RestMethod http://localhost:3001/api/salute`,
oppure apri `http://localhost:3001` nel browser (ti manda al login).

**Database già esistente e nuove tabelle.** I file in `db/initdb` girano da soli **solo la prima volta**
(con il volume vuoto). Quando si aggiunge un file nuovo (es. `03_inviti.sql`) va applicato a mano,
senza perdere i dati:

```powershell
cd C:\Users\a.venturi\progetti\schede-pt
cmd /c "docker exec -i lena-db psql -U lena -d lena < db\initdb\03_inviti.sql"
```

(Si passa da `cmd /c` perché in PowerShell 5.1 `Get-Content file | docker exec ...` rovina le lettere accentate.
I file scritti con `IF NOT EXISTS` si possono rilanciare senza danni.)

Non usare mai `docker compose down -v`: il `-v` cancella il volume, cioè **tutti i dati**.

**I test** (`npm test`) avviano una loro copia del server su una porta libera e usano il database di
sviluppo: creano utenti con email `...@test.lena` e alla fine li cancellano. I tuoi dati non vengono toccati.
Sono molti gruppi (circa 130 test in tutto): `e2e` e `pt` (l'API, con il database), `consensi` e `account` (consensi, diritti del cliente), `conservazione` (scadenze, pulizia, rapporto concluso),
`web`, `pt-pagine` e `pagine-privacy` (pagine, sicurezza, accessibilità, contrasto dei colori), `convertitore` e `salute` (il convertitore con Excel veri e il controllo sui dati di salute),
`log` (i log non contengono dati personali), `progressi`, `sincronizza` e `uscita` (calcoli, salvataggio e uscita: senza rete né database, istantanei).

**Script a riga di comando:** sono diventati "strumenti di emergenza": vedi la sezione dedicata più sotto. Per cambiare l'indirizzo scritto nei link
(es. quando sarai online) aggiungi in `api/.env` una riga `URL_BASE=https://il-tuo-dominio.it` (vale per `crea-invito.js`; il sito usa l'indirizzo con cui lo apri).

---|---|
| `node crea-pt.js email password "Nome"` | crea un account da PT |
| `node carica-scheda.js <id-cliente> <file.json>` | carica una scheda (il JSON del convertitore) per un cliente |
| `node crea-invito.js <id-cliente>` | crea l'invito e stampa il link `.../registrati.html?codice=...` |

Sono provvisori: quando ci sarà l'area del PT (elenco clienti, carica Excel, crea invito) si faranno dal sito.
Dentro usano lo stesso codice delle rotte dell'API (`operazioni.js`), quindi gli stessi controlli.
Per cambiare l'indirizzo scritto nei link (es. quando sarai online) aggiungi in `api/.env` una riga `URL_BASE=https://il-tuo-dominio.it`.

---

## Il giro completo del PT, passo per passo (tutto dal browser)

Il PT fa tutto dal sito: **niente riga di comando** (se non la prima volta, per accendere il sistema e creare il proprio account).

### La prima volta: accendere il sistema

Servono **Docker Desktop** acceso e **Node.js 22**. Poi, in PowerShell, una riga alla volta:

```powershell
cd C:\Users\a.venturi\progetti\schede-pt
Copy-Item .env.example .env
notepad .env
docker compose up -d
cd api
Copy-Item .env.example .env
notepad .env
npm install
node crea-pt.js tua@email.it LaTuaPasswordLunga123 "Il tuo nome"
node --watch server.js
```

(Nel primo `notepad` metti una password a tua scelta al posto di `CAMBIAMI`; nel secondo riempi `DATABASE_URL` con la stessa password
e `JWT_SECRET` con un segreto lungo: i dettagli sono nella sezione "Avviare tutto da zero". La password del PT deve avere da 10 a 72 caratteri.)

Le volte dopo basta Docker acceso e `node --watch server.js` dentro la cartella `api`.

### Ogni volta: dal browser

1. **Entra.** Apri `http://localhost:3001` (dal telefono: vedi la sezione "Aprire il sito dal telefono"). Ti manda al login: email e password del PT.
   **Al primo accesso** (e ogni volta che le condizioni cambiano versione) prima compare la schermata **«Condizioni d'uso per i professionisti»**: leggi, spunta e premi **«Accetta e continua»**. Poi arrivi su **"I tuoi clienti"**.
2. **Nuovo cliente.** Premi **"Nuovo cliente"**, scrivi nome e cognome, **"Crea cliente"**: si apre la pagina del cliente.
   Nell'elenco ogni cliente ha uno **stato**:
   - *Nessuna scheda* (arancio): non gli hai ancora caricato niente;
   - *Invito non ancora usato (scade il …)* (rosa): hai creato l'invito ma non l'ha ancora aperto;
   - *Scheda caricata, da invitare*: c'è la scheda ma non c'è un invito valido;
   - *Attivo, ultimo allenamento il …* (verde): il cliente usa la scheda e salva i suoi kg;
   - *Registrato, non ha ancora segnato nulla*.
   La casella **"Cerca un cliente"** filtra per nome o cognome (senza badare a maiuscole e accenti).
3. **Carica la scheda da Excel.** Nella pagina del cliente premi **"Carica scheda da Excel"** e scegli il file `.xlsx`
   (può stare in **qualsiasi cartella**, per esempio sul Desktop: il browser lo legge da lì; **non va copiato nel progetto**, e infatti i `.xlsx`
   sono ignorati da git di proposito). Il file viene **letto nel tuo browser**: al server arriva solo la scheda già convertita.
   Poi guarda cosa dice la pagina:
   - **riquadro rosso** = errore che *blocca* (per esempio manca la data di inizio): il pulsante "Invia al cliente" resta spento, correggi l'Excel e riscegli il file;
   - **riquadro arancio** = avvisi che *non* bloccano (per esempio "l'Excel dice 3 sedute ma ho trovato 2 giorni"): leggili, e per inviare devi mettere la spunta **"Ho letto gli avvisi e voglio inviare lo stesso"**;
   - **avviso sul nome**: se il nome e cognome scritti nell'Excel sono diversi da quelli del cliente (per esempio hai scelto il file di un altro) lo dice con tutti e due i nomi, e serve la spunta;
   - sotto compare **l'anteprima nel telefono**: scorri e controlla che sia come la vuoi.
   Poi **"Invia al cliente"**: da quel momento il cliente vede questa scheda (se ne carichi un'altra, vede sempre l'ultima).
4. **Crea l'invito.** Nella sezione "Invito" premi **"Crea invito"**: compare il **link** completo con la scadenza (7 giorni).
   Premi **"Copia"** e mandalo al cliente (WhatsApp, email...). Attenzione: **il link si vede una volta sola**. Se lo perdi, ne crei un altro
   (e il vecchio smette di funzionare).
5. **Il cliente apre il link**, sceglie email e password (almeno 10 caratteri), **spunta «Ho letto l'informativa privacy»** ed entra nella sua scheda. Da quel momento kg, ripetizioni, serie e spunte
   si salvano da soli nel database. *Per provare da solo:* apri il link in una **finestra privata** (Ctrl+Maiusc+N).
6. **Guarda i progressi.** Nella sezione "Progressi" vedi, settimana per settimana, quanti allenamenti sono completati
   ("Settimana 3: 2 allenamenti su 3 completati") e, accanto, **la scheda del cliente in sola lettura** con i suoi kg e le sue ripetizioni:
   puoi scegliere settimana e giorno, ma non cambiare niente. Il pulsante "Aggiorna" ricarica i dati. Un allenamento conta come *completato* quando
   ogni esercizio ha la sua spunta (riscaldamento e stretching non contano).
7. **Dati personali (GDPR).** In fondo alla pagina:
   - **"Esporta dati (JSON)"** scarica un file con anagrafica, schede e progressi del cliente (serve se te li chiede);
   - **"Cancella cliente"**: per sicurezza devi riscrivere nome e cognome. Vengono cancellati **per sempre** il cliente, tutte le sue schede,
     tutti i suoi progressi **e il suo account**: dopo, non riesce più a entrare. Non si può annullare.

Se qualcosa va storto la pagina lo dice: **rete assente** → messaggio con "Riprova"; **sessione scaduta** → ti riporta al login;
**cliente non trovato** → messaggio gentile. I pulsanti che creano qualcosa (cliente, scheda, invito) si spengono mentre lavorano, quindi un doppio clic non fa doppioni.

---

## Strumenti di emergenza (riga di comando)

Il sito fa già tutto. Questi script restano per i casi in cui il sito non è disponibile (o per automatizzare qualcosa); si lanciano **dalla cartella `api`**:

| Comando | Quando serve |
|---|---|
| `node crea-pt.js email password "Nome"` | creare un account da PT (email valida, password da 10 a 72 caratteri). da terminale; i trainer si iscrivono anche da soli dal sito (`/registrati-pt.html`) |
| `node carica-scheda.js <id-cliente> <file.json>` | caricare una scheda (il JSON del convertitore) senza passare dal sito |
| `node crea-invito.js <id-cliente>` | creare l'invito e stampare il link senza passare dal sito |
| `node riempi-libreria.js [--prova \| --esegui]` | **una volta sola**: riempie la libreria esercizi di ogni trainer con quelli delle schede già caricate prima che la libreria esistesse. Senza argomenti è solo un elenco; si può rilanciare senza danni |
| `node pulizia.js [--prova \| --esegui]` | **non è di emergenza: è la pulizia dei clienti vecchi** (vedi «Conservazione dei dati»). Senza argomenti è solo un elenco |

Per vedere gli `id` dei clienti: `docker exec lena-db psql -U lena -d lena -c "SELECT id, nome, cognome FROM cliente"`.
Il file `esempio/scheda-esempio.json` è una scheda d'esempio per provare `carica-scheda.js`; il JSON di una scheda vera si ottiene dalla pagina vecchia del
convertitore (vedi sotto) con "Scarica dati (JSON)".

**La pagina vecchia del convertitore** (`convertitore-test.html`, si apre con `npx serve .` nella cartella principale) funziona ancora come prima:
carica l'Excel, mostra l'anteprima e scarica la scheda come file `.html` singolo (da mandare per esempio via WhatsApp, funziona anche senza il sito).
Usa **lo stesso codice di conversione** del sito (`web/convertitore.js`) e la libreria Excel è ospitata nel progetto: nessun CDN.

### Come funziona l'anteprima (per chi è curioso)

La CSP del sito vieta gli script scritti dentro le pagine, e non va allentata. Quindi l'anteprima non è più un riquadro con la scheda "incollata" dentro:
è una **pagina vera del sito**, `/anteprima.html`, mostrata in una cornice. L'area del PT le manda la scheda con un **messaggio** (`postMessage`);
la pagina la accetta solo se il messaggio viene **dallo stesso sito** e **proprio dalla pagina che la contiene**, e solo se la scheda passa gli stessi controlli
del server. I dati arrivano come semplice testo e non vengono mai eseguiti come codice. La stessa pagina, in "sola lettura", mostra anche i progressi di un cliente.

---

## Privacy, consensi e conservazione dei dati

> **Importante.** Tutto quello che c'è qui sono le **basi tecniche**. I testi legali (informativa, condizioni d'uso) sono **segnaposto** da sostituire, e manca ancora molto prima di usare Lena
> con dati di persone vere. Gli appunti sulla privacy (cosa manca, perimetro, dati trattati, registro dei trattamenti) sono documenti di lavoro tenuti fuori dal repository.

**Il perimetro in una riga:** pilota con **un** professionista e pochi clienti **maggiorenni**; **solo schede di allenamento**; **nessun dato di salute**; Lena mostra e raccoglie, non decide.
Chi gestisce Lena è il *responsabile del trattamento*, il professionista è il *titolare*.

### I consensi

- **Cliente:** per registrarsi deve spuntare «Ho letto l'informativa privacy» (con il link). Il server rifiuta la registrazione se manca `accettaInformativa: true` o se la versione non è quella corrente;
  il consenso (tipo, versione, data) si salva **nella stessa operazione** della creazione dell'account.
- **Professionista:** al primo accesso vede la schermata «Condizioni d'uso per i professionisti» e deve accettarla. Finché non accetta, tutte le rotte dell'area rispondono **403 con codice `CONDIZIONI_DA_ACCETTARE`**
  e le pagine lo portano alla schermata. Vale per tutti, compreso il PT di prova: nessuna scorciatoia.
- **Le versioni dei testi stanno in un solo posto: [`api/config.js`](config.js)** (`VERSIONE_INFORMATIVA`, `VERSIONE_CONDIZIONI_PT`). Quando cambi un testo, cambia la versione lì: i professionisti dovranno
  riaccettare al prossimo accesso e i nuovi clienti accetteranno la nuova. I clienti già registrati **non** vengono richiamati (limite noto, vedi `COSA-MANCA.md`).
- **Dove sono i testi:** `web/privacy.html` e `web/condizioni-pt.html`. Sono segnaposto: dentro ci sono le sezioni minime e i campi `[DA COMPILARE]` evidenziati. Per sostituirli basta cambiare l'HTML (e la versione):
  i test controllano solo la struttura (versione, link, titoli), non le parole.

### I diritti del cliente, da solo (pagina «Il mio account»)

Dalla scheda, il pulsante **«Il mio account e i miei dati»** porta a `/account.html`:

- **«Scarica i miei dati»** → un file JSON con anagrafica, email, schede, valori segnati e consensi con le date (`GET /api/me/esporta`). Usa la stessa funzione dell'esportazione fatta dal professionista.
- **«Cancella il mio account»** → serve **riscrivere la password** e spuntare la conferma. Cancella in un'unica operazione l'utente, i consensi, il record cliente, le schede e i valori; chiude la sessione e porta a una pagina di conferma.
  È la stessa cancellazione che fa il professionista dalla pagina del cliente. Sulla password sbagliata c'è un limite: **5 tentativi ogni 15 minuti** per utente.
  Dopo la cancellazione il vecchio cookie non vale più (il server controlla a ogni richiesta che l'utente esista ancora).

### Conservazione dei dati

- **Quanti mesi:** parametro `MESI_CONSERVAZIONE` in `api/.env` (se manca, **24**). È **ancora da decidere con il professionista**.
- **Cosa si registra:** per ogni cliente `ultima_attivita` (si aggiorna quando il professionista carica una scheda o il cliente salva un valore) e `rapporto_finito_il` (il professionista, dalla pagina del cliente,
  può premere **«Segna rapporto concluso»**; è reversibile con «Riapri il rapporto» e non toglie l'accesso al cliente).
- **Chi viene cancellato:** i clienti con rapporto concluso da più di N mesi (conta la data di conclusione) oppure, se il rapporto è in corso, senza attività da più di N mesi.
- **Come si pulisce** (dalla cartella `api`):

  ```powershell
  node pulizia.js            # prova: elenca chi verrebbe cancellato e perché, senza toccare niente
  node pulizia.js --esegui   # cancella davvero (cliente, schede, valori, inviti, account e consensi), un cliente alla volta
  ```

- **Perché è manuale, per ora:** una cancellazione è **definitiva**, e una cancellazione automatica *sbagliata* (periodo sbagliato, una data errata, un test dimenticato) è peggio di una cancellazione dimenticata.
  Finché il periodo non è deciso con il professionista e l'elenco della prova non è stato controllato un po' di volte, si lancia a mano.
- **Come programmarla più avanti** (su Windows, con l'Utilità di pianificazione): si crea un'attività che lancia ogni settimana `node pulizia.js` **in modalità prova** e avvisa se l'elenco non è vuoto;
  solo dopo mesi senza sorprese si pensa a programmare `--esegui`. Attenzione: l'elenco stampa nomi e cognomi, quindi **non salvarlo in file di log condivisi**.

### Nessun dato di salute

- Nella pagina di caricamento della scheda c'è l'avvertenza **«Non inserire dati di salute (infortuni, patologie, farmaci)»**; è anche nelle condizioni d'uso.
- Il convertitore fa un **controllo morbido**: se un testo dell'Excel contiene parole tipiche (infortunio, ernia, diabete, gravidanza, allergia, farmaco...) compare un avviso
  **non bloccante** («Questo testo sembra contenere informazioni sulla salute: verifica di averne il consenso o toglile»), con l'indicazione di dove si trova. Il professionista può proseguire con la spunta.
- **La lista delle parole** è in [`web/parole-salute.js`](../web/parole-salute.js), facile da modificare (le istruzioni sono in cima al file). È solo un aiuto: **non vede** sinonimi, errori di battitura, altre lingue o frasi indirette, e **può scattare** su parole usate in senso non medico.

### I log del server

Nei log **non finiscono mai** dati delle persone: né corpi di richieste, né email o password, né dati delle schede, né cookie, né la parte dell'indirizzo dopo il `?`, né i messaggi di errore (quelli del database possono contenere i valori).
Si scrive solo il tipo di errore, il percorso e il punto del codice (`api/log.js`). Un test avvia un server vero, gli manda dati pieni di "marcatori" e controlla che non compaiano nei log.

### Dispositivi condivisi

Premendo **«Esci»** nella scheda: l'app prova a inviare le modifiche non ancora salvate; se ci riesce, esce e **cancella la copia locale**. Se non ci riesce (offline) avvisa
**«Hai modifiche non salvate: se esci ora si perdono»** e lascia scegliere se restare o uscire. Se esci, la copia locale di quell'utente viene cancellata in ogni caso.
Se manca la rete **l'uscita non riesce** (il cookie di sessione si toglie solo dal server) e te lo dice: resti dentro e non perdi niente.

---

## Aprire il sito dal telefono (Wi‑Fi di casa)

Serve per vedere e provare Lena sul telefono vero. In sviluppo (`NODE_ENV` diverso da `production`, cioè sempre, a meno che
tu non lo imposti) il server lavora in http e **non** chiede al browser di passare a https: per questo funziona.

1. **PC e telefono sulla stessa rete Wi‑Fi** (non la rete "ospiti" del router: spesso isola i dispositivi).
2. **Trova l'indirizzo del PC.** In PowerShell scrivi `ipconfig` e cerca la scheda **"Scheda LAN wireless Wi‑Fi"** (o "Ethernet" se sei col cavo):
   la riga **"Indirizzo IPv4"**, tipo `192.168.1.23`. Ignora quelle chiamate `vEthernet` o `WSL`: sono reti interne al PC.
3. **Avvia il server** come sempre (`node --watch server.js` nella cartella `api`).
4. **Firewall di Windows.** La prima volta che Node parte, Windows chiede "Consentire l'accesso?": scegli **"Reti private"**.
   Se non l'hai visto o hai detto di no, apri PowerShell **come amministratore** e scrivi (una riga):
   ```powershell
   New-NetFirewallRule -DisplayName "Lena (sviluppo)" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow -Profile Private
   ```
   Per togliere la regola quando non serve più: `Remove-NetFirewallRule -DisplayName "Lena (sviluppo)"`.
   Se la tua rete Wi‑Fi è segnata come "Pubblica" (Impostazioni → Rete e Internet → Wi‑Fi → proprietà), mettila su "Privata", altrimenti Windows blocca comunque.
5. **Sul telefono** apri il browser e scrivi `http://192.168.1.23:3001` (con il TUO indirizzo). Vedi il login di Lena.

Cose da sapere: l'indirizzo del PC può cambiare quando riavvii il router; la connessione **non è cifrata** (http), quindi usa solo
dati di prova; e il link d'invito mostrato dal sito PT usa l'indirizzo con cui hai aperto la pagina, quindi se apri il sito PT dal PC con
`localhost` il link non si apre dal telefono (apri il sito PT usando `http://192.168.1.23:3001` anche dal PC).
**Online (produzione) tutto questo non vale**: lì serve https, e il server dice al browser di usare sempre https.

---

## Il profilo del trainer (foto, presentazione, contatto)

- **Database:** `db/initdb/05_profilo_trainer.sql` aggiunge le colonne a `pt`. Su un database già in funzione:
  `docker exec -i lena-db psql -U lena -d lena < db/initdb/05_profilo_trainer.sql`
- **API del trainer** (`api/profilo-trainer.js`): `GET/PUT /api/pt/profilo` (nome, bio fino a 500 caratteri, contatto fino a 100),
  `GET/PUT/DELETE /api/pt/foto`. La foto è un JPEG (massimo 400 KB) salvato nel database; il browser la ritaglia quadrata e la riduce a 512 px prima di inviarla.
  Il server controlla che sia davvero un JPEG (inizio e fine del file), non solo il tipo dichiarato.
- **API del cliente** (`api/me.js`): `GET /api/me/trainer` e `GET /api/me/trainer/foto`: solo il profilo del SUO trainer.
- **Profilo del cliente** (`db/initdb/06_profilo_cliente.sql`, stessa procedura): `GET /api/me/profilo`, `GET/PUT/DELETE /api/me/foto`. Il trainer vede la foto dei SUOI clienti con `GET /api/clienti/:id/foto`; l'elenco dice solo se c'è (`ha_foto`). La foto è nei dati esportati (`cliente.foto_jpeg_base64`) e sparisce con la cancellazione del cliente. Nome e cognome li scrive il trainer, il cliente non li cambia.
- **Scadenze delle schede:** l'ultimo giorno di una scheda è `inizio + settimane × 7 − 1`. L'elenco clienti (`/api/clienti`) include `scheda_scade_il` e `giorni_alla_scadenza` (oggi contato in ora italiana). L'area trainer mostra «Schede in scadenza» per le schede che finiscono entro 14 giorni o sono già finite (soglia in `web/pt-comune.js`, `SOGLIA_SCADENZA`), e il riquadro «Cosa fare adesso» nella pagina del cliente. Niente email per ora.
- **Pagine:** `web/pt-profilo.html` (il trainer lo modifica, con anteprima «Come ti vede un cliente»); il cliente lo vede in `web/account.html`.
- **Privacy:** foto e presentazione sono scelte dal trainer e le vedono solo i suoi clienti. Da citare nelle condizioni d'uso dei professionisti quando passerà dal consulente.

---

## Le pagine del sito (cartella web/)

Express le serve così come sono (`express.static`), **dopo** le rotte `/api`: un indirizzo `/api/...` che non esiste
risponde sempre con un errore JSON, mai con una pagina.

| Indirizzo | File | Cosa fa |
|---|---|---|
| `/` | `index.html`, `index.js` | ti manda alla pagina giusta: scheda (cliente), area PT, oppure login |
| `/login.html` | `login.html`, `login.js` | accesso con email e password; dopo: cliente → scheda, PT → area PT |
| `/registrati.html?codice=...` | `registrati.html`, `registrati.js` | il cliente crea l'accesso con il codice dell'invito; poi va alla scheda |
| `/scheda.html` | `scheda.html`, `scheda-server.js` | la scheda del cliente, letta dal server (401 → login, 404 → "non c'è ancora una scheda") |
| `/pt.html` | `pt.html`, `pt.js` | **area del PT**: elenco dei clienti con il loro stato, ricerca, "Nuovo cliente", Esci |
| `/pt-cliente.html?id=...` | `pt-cliente.html`, `pt-cliente.js`, `pt-converti.js`, `pt-progressi.js` | pagina di un cliente: schede, carica Excel, invito, progressi, esporta/cancella |
| `/anteprima.html` | `anteprima.html`, `anteprima.js` | mostra una scheda dentro una cornice (anteprima del convertitore e progressi in sola lettura): non si apre da sola |
| `/privacy.html` | `privacy.html`, `privacy.js` | informativa privacy per i clienti (**testo segnaposto**), con la versione |
| `/condizioni-pt.html` | `condizioni-pt.html`, `condizioni-pt.js` | condizioni d'uso per i professionisti (**segnaposto**); il professionista le accetta qui |
| `/account.html` | `account.html`, `account.js` | «Il mio account»: il cliente scarica i suoi dati o cancella il suo account |
| `/account-cancellato.html` | `account-cancellato.html` | conferma dopo la cancellazione dell'account |
| (indirizzo inesistente) | `404.html` | pagina "non trovato" |

File usati da più pagine:

| File | A cosa serve |
|---|---|
| `sistema.css`, `tema.js` | **colori, font, spazi e icone di tutte le pagine** (design system Lena, modalità scura e chiara; vedi sotto) |
| `tema.css` | colori e font **della sola scheda di allenamento** (provvisorio, la scheda scaricabile li incorpora) |
| `pagine.css` | stile di login, registrazione, area PT, 404 e dei messaggi di stato |
| `scheda.css`, `scheda.js` | **l'unica copia** di stile e logica della scheda (vedi sotto) |
| `api.js` | piccolo aiuto per chiamare l'API, uscire, mostrare gli errori comuni |
| `pt.css`, `pt-comune.js` | stile e aiuti dell'area del PT (controllo accesso, richieste, cornice dell'anteprima) |
| `convertitore.js` | **l'unica copia** della logica Excel → scheda (la usano il sito e la pagina vecchia del convertitore) |
| `valida-scheda.js` | il controllo sulla forma di una scheda: lo usano il browser (prima di inviare) e il server (prima di salvare) |
| `progressi.js` | calcola "Settimana 3: 2 allenamenti su 3 completati" |
| `vendor/` | la libreria per leggere l'Excel (SheetJS 0.20.3), con licenza, versione e impronta in `vendor/LEGGIMI.txt` |
| `registrazioni.js` | traduce i progressi tra il formato del database e quello della scheda |
| `sincronizza.js` | il "motore" che manda i progressi al server (vedi sotto) |

**Una sola fonte per la scheda.** `scheda.css` e `scheda.js` li usano sia il sito sia la scheda scaricabile dal convertitore.
`modello-scheda.html` contiene solo i riferimenti; quando scarichi, il convertitore **incorpora** i file dentro un unico `.html`
autonomo. Se cambi `tema.css`, `scheda.css` o `scheda.js`, le schede già scaricate non cambiano: vanno riscaricate.
La scheda scaricata continua a salvare solo sul telefono (localStorage), come prima; quella del sito salva nel database.

**Come funziona il salvataggio nel database** (`sincronizza.js`):

- Dopo ogni modifica aspetta **1 secondo** senza altre modifiche e poi invia in una richiesta sola (al massimo 200 voci per volta).
- L'indicatore in alto a destra dice: *Salvato ✓* · *Salvo…* · *Non salvato, riprovo…*.
- Senza rete o con il server in errore: la modifica resta **sul dispositivo** (localStorage, chiave `lena:coda:<utente>:<scheda>`)
  e il sito riprova da solo dopo 2, 4, 8, 16, 32 secondi (poi ogni 60), e subito appena torna la rete.
- Se la sessione scade (401): niente si perde, ti porta al login con un messaggio, e dopo l'accesso le modifiche partono.
- Chiudendo la pagina subito dopo una modifica, l'invio parte comunque.
- **Esci** prova prima a inviare tutto; se non ci riesce chiede conferma, e le modifiche restano sul dispositivo.
- Se due dispositivi cambiano lo stesso valore, vince l'ultimo che arriva al server.
- Valori accettati: kg e ripetizioni fino a 40 caratteri (i campi non ne accettano di più).

**Perché serve la Content-Security-Policy (CSP).** È una regola che il server manda al browser: "esegui solo gli script
che arrivano da questo stesso sito". Se qualcuno riuscisse a infilare del codice in una pagina (per esempio in un nome o
in una nota di una scheda), il browser lo rifiuterebbe: senza questa regola potrebbe rubare i dati di salute o agire al posto
del cliente. Per questo nelle pagine **non ci sono script scritti dentro l'HTML** (stanno in file `.js`) e la regola
di `helmet` non va allentata: un test (`test/web.test.js`) fa fallire `npm test` se qualcuno ci prova.

---

## Come cambiare colori e font

Le pagine del sito usano il design system **Lena** (cartella `design-sistema/`). I valori stanno in **un solo file:
`web/sistema.css`** (variabili CSS: `--sfondo`, `--superficie`, `--testo`, `--brace`…, per la modalità scura e per la chiara).
Prima si cambia il design system (`design-sistema/tokens.json`), poi `sistema.css`; `npm test` controlla i contrasti
in entrambe le modalità. Regole per le nuove pagine: [`web/README.md`](../web/README.md). Elementi aggiunti in attesa
di approvazione: [`design-sistema/PROPOSTE.md`](../design-sistema/PROPOSTE.md).

**La scheda di allenamento** (e quella scaricabile) usa ancora il vecchio tema, in `web/tema.css`, qui sotto.

### Il tema della scheda (`web/tema.css`)

Tutto sta in **un solo file: `web/tema.css`**. Sono "variabili" CSS: dai un nome a un colore o a un font,
e tutte le pagine lo usano. Cambi il valore in un punto, cambia dappertutto.

| Variabile | Cosa colora |
|---|---|
| `--colore-sfondo` | il fondo delle pagine (crema) |
| `--colore-carta` | riquadri, schede e campi (bianco) |
| `--colore-testo` | il testo principale |
| `--colore-testo-tenue` | testo secondario, etichette |
| `--colore-linea` | bordi e righe sottili |
| `--colore-accento`, `--colore-accento-chiaro`, `--colore-accento-scuro` | il colore "di marca": pulsanti, titoli colorati |
| `--colore-su-accento` | il testo sopra i pulsanti pieni |
| `--colore-ok-...`, `--colore-avviso-...`, `--colore-errore-...` | i messaggi verdi, arancio e rossi (`sfondo`, `bordo`, `testo`) |
| `--scheda-font-titoli` | i titoli (oggi un carattere con le grazie, Georgia) |
| `--scheda-font-testo` | tutto il resto (oggi il carattere di sistema) |

**Esempio.** Per un tema azzurro, in `web/tema.css` cambia (le altre righe restano):

```css
--colore-accento: #8FB3D9;
--colore-accento-chiaro: #E6EFF8;
--colore-accento-scuro: #3F6A99;
```

Ricarica la pagina nel browser (Ctrl+F5) e vedi subito il risultato.

**Cose da sapere:**

- **Nella scheda, ogni giorno ha il suo colore** (il rosa del Giorno A, il verde del B...). Quei colori vengono dai
  *dati* della scheda (`colore`, `chiaro`, `scuro` di ogni giorno), che il convertitore sceglie dalla sua lista `PALETTE`.
  `--colore-accento...` sono solo il colore di partenza e quello delle pagine fuori dalla scheda.
- **Restano alcuni colori scritti a mano dentro `scheda.css`** (il bianco sopra i pulsanti, il grigio caldo del testo sul giorno
  selezionato, le ombre, il colore dei segnaposto): sono una decina di righe da portare in `tema.css` quando faremo i temi.
- **I font** sono solo quelli già presenti sul telefono o sul computer: nessun font viene scaricato da siti esterni
  (il motivo è la privacy: ogni richiesta a Google Fonts comunicherebbe a Google chi apre la scheda).
  Per usare un font tuo: scarica il file `.woff2` (con licenza che lo permette), mettilo in `web/font/` e in `tema.css`
  aggiungi sopra `:root`:
  ```css
  @font-face { font-family: "NomeDelFont"; src: url("/font/nome-del-font.woff2") format("woff2"); font-display: swap; }
  ```
  poi scrivi `--font-titoli: "NomeDelFont", Georgia, serif;`. La CSP lascia caricare font dal tuo sito.
- Le schede **già scaricate** come file `.html` hanno i colori di quando sono state scaricate: vanno riscaricate dal convertitore.

---

## Le tabelle

```
utente  (chi può fare login)
  id · email (unica) · password_hash · ruolo ('pt' | 'cliente') · creato_il
   │
   ├── 1:1 ──► pt        id · utente_id · nome
   │            │
   │            └── 1:N ──► cliente   id · pt_id · utente_id (vuoto finché non si registra) · nome · cognome
   │                          │
   └── 1:1 (dopo la registrazione) ┘
                              │
                              ├── 1:N ──► invito    id · cliente_id · codice_hash · scade_il · usato_il · creato_il
                              │
                              └── 1:N ──► scheda    id · cliente_id · inizio · settimane · dati (JSONB) · creata_il · aggiornata_il
                                            │
                                            └── 1:N ──► registrazione   (scheda_id, tipo, chiave) · valore · aggiornata_il
```

- **utente**: solo l'accesso (email + password). Chi è davvero la persona sta in `pt` o `cliente`.
- **cliente**: esiste anche prima di avere un account. Quando si registra con l'invito, `utente_id` viene riempito.
- **invito**: si salva solo l'impronta (sha256) del codice, mai il codice. Vale 7 giorni e una volta sola.
- **scheda**: `dati` è l'oggetto prodotto dal convertitore (`convertitore-test.html`).
- **registrazione**: ciò che il cliente segna. `tipo` è `kg`, `rip`, `serie` o `fatto`.
  `chiave` è `settimana|giorno|resto`, la stessa di `modello-scheda.html`:
  - `2|A|1`: settimana 2, giorno A, blocco 1
  - `2|A|3|0`: esercizio 0 del circuito 3
  - `2|A|R|1`: voce 1 del riscaldamento
  - `2|A|S`: stretching

**Cancellazioni a cascata.** Se si cancella un PT se ne vanno i suoi clienti; se si cancella un cliente
se ne vanno schede, registrazioni e inviti. L'**account** del cliente invece no (è `ON DELETE SET NULL`):
per questo `DELETE /api/clienti/:id` lo cancella esplicitamente.

---

## Gli endpoint

| Metodo e indirizzo | Chi | Cosa fa |
|---|---|---|
| `GET /api/salute` | tutti | Il server è acceso e vede il database? |
| `POST /api/auth/login` | tutti | Login con `{ email, password }`. Mette il cookie di sessione |
| `POST /api/auth/logout` | tutti | Toglie il cookie |
| `GET /api/auth/me` | con login | Chi sono io (`id`, `email`, `ruolo`) |
| `POST /api/auth/registra-cliente` | tutti (con codice) | Crea l'account del cliente da un invito e fa già il login. Serve `accettaInformativa: true` e `versioneInformativa` (la versione corrente), altrimenti 400 |
| `GET /api/clienti` | PT | I miei clienti, ognuno con il suo stato: `registrato` (ha creato l'accesso), `schede` (quante), `scheda_recente_id`, `ultimo_progresso` (data dell'ultimo salvataggio), `invito_attivo` e `invito_scade_il` |
| `GET /api/clienti/:id` | PT | Un cliente mio, con gli stessi campi dell'elenco (404 se non è mio) |
| `PUT /api/clienti/:id/rapporto` | PT | `{ concluso: true \| false }`: segna il rapporto come concluso (o lo riapre) |
| `GET /api/privacy/versioni` | tutti | Le versioni correnti di informativa e condizioni |
| `GET /api/privacy/condizioni-pt` | PT | Ho già accettato la versione corrente delle condizioni? |
| `POST /api/privacy/condizioni-pt` | PT | `{ versione }`: accetta le condizioni (deve essere la versione corrente) |
| `GET /api/me/esporta` | cliente | Scarica **i miei** dati (file JSON) |
| `DELETE /api/me/account` | cliente | `{ password, conferma: true }`: cancella il mio account e tutti i miei dati (5 tentativi/15 min) |
| `POST /api/clienti` | PT | Nuovo cliente `{ nome, cognome }` |
| `DELETE /api/clienti/:id` | PT | Cancella il cliente e tutti i suoi dati (GDPR) |
| `GET /api/clienti/:id/esporta` | PT | Scarica tutti i dati del cliente in JSON (GDPR) |
| `POST /api/clienti/:id/invito` | PT | Crea il codice di invito (si vede solo in questa risposta) |
| `POST /api/clienti/:id/schede` | PT | Carica una scheda `{ dati }` prodotta dal convertitore |
| `GET /api/clienti/:id/schede` | PT | Elenco delle schede del cliente (senza i dati pesanti) |
| `GET /api/schede/:id` | PT | Una scheda completa |
| `GET /api/schede/:id/registrazioni` | PT | Cosa ha segnato il cliente |
| `PUT /api/schede/:id/registrazioni` | cliente | Salva i progressi `{ voci: [{ tipo, chiave, valore }] }` |
| `GET /api/me/scheda` | cliente | La mia scheda più recente, con le mie registrazioni |

**Risposte di errore** (sempre `{ "errore": "messaggio" }`):

| Codice | Significato |
|---|---|
| 400 | Dati mancanti o non validi, oppure invito non valido o scaduto |
| 401 | Login mancante o non valido |
| 403 | Il tuo ruolo non può usare questa rotta (es. un cliente su una rotta da PT) |
| 404 | Non esiste **oppure non è tuo**: per sicurezza le due cose si confondono |
| 409 | Email già registrata, oppure cliente che ha già un account |
| 413 | Richiesta troppo grande (oltre 1 MB) |
| 429 | Troppi tentativi: riprova tra qualche minuto |
| 500 | Errore del server (i dettagli sono solo nel log del server) |

**Regole per `PUT /api/schede/:id/registrazioni`:**
- al massimo 200 voci per richiesta;
- si salvano tutte o nessuna;
- la settimana deve stare tra 1 e il numero di settimane della scheda, e il giorno deve esistere nella scheda;
- `kg` e `rip` sono testo di al massimo 40 caratteri, `serie` è un numero da 0 a 99, `fatto` vale `1`;
- un valore vuoto (`""` o `null`) **cancella** la voce.

---

## Esempi in PowerShell

`-SessionVariable` crea una "sessione" che ricorda il cookie come un browser; `-WebSession` la riusa.
Scrivere `charset=utf-8` nel `ContentType` serve perché le lettere accentate arrivino giuste.

```powershell
$API = "http://localhost:3001"
$JSON = "application/json; charset=utf-8"

# --- salute ---
Invoke-RestMethod "$API/api/salute"
# → { ok: true, utenti: 2 }

# --- login del PT (crea la sessione $pt) ---
Invoke-RestMethod "$API/api/auth/login" -Method Post -ContentType $JSON -SessionVariable pt `
  -Body (@{ email = "tua@email.it"; password = "UnaPasswordLunga123" } | ConvertTo-Json)
# → { id: 3, ruolo: "pt" }      (password sbagliata → errore 401)

# --- chi sono ---
Invoke-RestMethod "$API/api/auth/me" -WebSession $pt
# → { id: 3, email: "tua@email.it", ruolo: "pt" }

# --- nuovo cliente ---
$c = Invoke-RestMethod "$API/api/clienti" -Method Post -ContentType $JSON -WebSession $pt `
  -Body (@{ nome = "Niccolò"; cognome = "Rossi" } | ConvertTo-Json)
# → { id: 13, nome: "Niccolò", cognome: "Rossi" }

# --- i miei clienti ---
Invoke-RestMethod "$API/api/clienti" -WebSession $pt
# → [ { id: 13, nome: "Niccolò", cognome: "Rossi", registrato: false } ]

# --- caricare una scheda (di solito "dati" arriva dal convertitore; qui una minima) ---
$scheda = @{ dati = @{
  inizio = "2026-10-26"; settimane = 5
  info = @{ titolo = "Forza"; nome = "Niccolò"; cognome = "Rossi" }
  riscaldamento = @{ esercizi = @() }
  giorni = @(@{ id = "A"; titolo = "Giorno A"; blocchi = @(@{ tipo = "esercizio"; nome = "Squat"; serie = "4"; rip = "10" }) })
} }
$s = Invoke-RestMethod "$API/api/clienti/$($c.id)/schede" -Method Post -ContentType $JSON -WebSession $pt `
  -Body ($scheda | ConvertTo-Json -Depth 20)
# → { id: 8 }    (formato sbagliato → 400 con il motivo, es. "Scheda non valida: nessun giorno di allenamento")

# --- elenco schede del cliente / una scheda completa ---
Invoke-RestMethod "$API/api/clienti/$($c.id)/schede" -WebSession $pt
# → [ { id: 8, inizio: "2026-10-26", settimane: 5, titolo: "Forza", creata_il: ..., registrazioni: 0 } ]
(Invoke-RestMethod "$API/api/schede/$($s.id)" -WebSession $pt).dati.info
# → { titolo: "Forza", nome: "Niccolò", cognome: "Rossi" }

# --- invito: il codice si vede SOLO qui, va mandato al cliente (es. dentro un link) ---
$inv = Invoke-RestMethod "$API/api/clienti/$($c.id)/invito" -Method Post -WebSession $pt
# → { codice: "XhhmibNT6J...", scade_il: "2026-11-13T10:41:46.014Z" }

# --- il cliente si registra con il codice (crea la sessione $cl, è già dentro) ---
Invoke-RestMethod "$API/api/auth/registra-cliente" -Method Post -ContentType $JSON -SessionVariable cl `
  -Body (@{ codice = $inv.codice; email = "niccolo@email.it"; password = "PasswordCliente1"; accettaInformativa = $true; versioneInformativa = (Invoke-RestMethod "$API/api/privacy/versioni").informativa_cliente } | ConvertTo-Json)
# → { id: 25, ruolo: "cliente" }   (codice sbagliato/scaduto/usato → 400 "Invito non valido o scaduto"; senza consenso → 400 con codice CONSENSO_MANCANTE)

# --- il cliente legge la sua scheda ---
$mia = Invoke-RestMethod "$API/api/me/scheda" -WebSession $cl
# → { scheda: { id, inizio, settimane, dati: {...} }, registrazioni: [ { tipo, chiave, valore, aggiornata_il } ] }

# --- il cliente salva i progressi (valore "" = cancella) ---
$voci = @{ voci = @(
  @{ tipo = "kg";    chiave = "1|A|1"; valore = "40" }
  @{ tipo = "fatto"; chiave = "1|A|1"; valore = "1" }
) }
Invoke-RestMethod "$API/api/schede/$($s.id)/registrazioni" -Method Put -ContentType $JSON -WebSession $cl `
  -Body ($voci | ConvertTo-Json -Depth 5)
# → { salvate: 2, cancellate: 0 }

# --- il PT legge i progressi ---
Invoke-RestMethod "$API/api/schede/$($s.id)/registrazioni" -WebSession $pt
# → [ { tipo: "fatto", chiave: "1|A|1", valore: "1", ... }, { tipo: "kg", chiave: "1|A|1", valore: "40", ... } ]

# --- esportazione GDPR (salva il file) ---
Invoke-RestMethod "$API/api/clienti/$($c.id)/esporta" -WebSession $pt -OutFile "cliente-$($c.id).json"

# --- un cliente su una rotta da PT: vedere il messaggio di errore ---
try { Invoke-RestMethod "$API/api/clienti" -WebSession $cl }
catch { $_.Exception.Response.StatusCode.value__; $_.ErrorDetails.Message }
# → 403  {"errore":"Non hai il permesso"}

# --- cancellazione GDPR: cliente, account, schede, registrazioni, inviti ---
Invoke-RestMethod "$API/api/clienti/$($c.id)" -Method Delete -WebSession $pt
# → (nessun contenuto, codice 204)

# --- logout ---
Invoke-RestMethod "$API/api/auth/logout" -Method Post -WebSession $pt
# → { ok: true }
```

---

## Regole di sicurezza già attive

- **Password**: salvate solo come hash bcrypt (costo 12). Per i clienti: minimo 10 caratteri, massimo 72.
- **Sessione legata al database**: a ogni richiesta, oltre alla firma del cookie, il server controlla che l'utente **esista ancora** (e prende il ruolo dal database).
  Il prezzo è **una piccola query in più per richiesta** (frazioni di millisecondo in locale, trascurabile finché il sito è piccolo); il vantaggio è che
  dopo una cancellazione il vecchio cookie smette di valere **subito**, non dopo 7 giorni. Non esiste ancora un "account disattivato": per bloccare
  qualcuno oggi si cancella l'utente.
- **Sessione**: un JWT firmato (valido 7 giorni) dentro il cookie `lena_sessione`, che è:
  - `HttpOnly`: il JavaScript della pagina non lo legge;
  - `SameSite=Lax`: non parte dalle richieste di altri siti;
  - `Secure` con `NODE_ENV=production`: solo su https.
- **Accesso**: il PT vede solo i suoi clienti e le loro schede, il cliente solo la sua. Tutto il resto risponde 404.
- **Limite tentativi** (per IP, ogni 15 minuti):
  - login e registrazione: 10 tentativi **sbagliati**;
  - tutte le altre richieste: 600 in totale.
- **helmet** (CSP e altre intestazioni): il browser esegue solo script dello stesso sito, niente script nell'HTML,
  niente caricamenti da siti esterni. Non va allentata (vedi "Perché serve la CSP" sopra).
- **Pagine**: il sito serve **solo** la cartella `web/`; nessun file fuori da lì (`.env`, codice, database) è raggiungibile
  (c'è un test con i tentativi classici di "risalire" le cartelle).
- **Dati di salute mai in cache**: ogni risposta di `/api` ha `Cache-Control: no-store`.
- **Niente richieste a terzi**: le pagine non usano CDN, font o librerie esterne; un test controlla che non compaia nessun indirizzo esterno nei file di `web/`.
- **Errori**: un gestore centrale. Al client arriva solo un messaggio generico, i dettagli vanno nel log del server.
- **Avvio**: senza `JWT_SECRET` (o con `CAMBIAMI`, o più corto di 32 caratteri) il server non parte.

## Prima di andare online (checklist sicurezza)

Oggi tutto è pensato per girare sul tuo PC. Prima di mettere Lena su un server vero:

1. **Password del database.** Cambia `LENA_DB_PASSWORD` nel `.env` principale e la stessa password in `DATABASE_URL` di `api/.env`. Quella di sviluppo è finita nei vecchi commit di git, quindi va considerata pubblica.
   Sul database già creato la password non cambia da sola: va cambiata anche con `ALTER USER lena PASSWORD '...'` dentro psql.
2. **JWT_SECRET nuovo**, lungo e casuale, diverso da quello di sviluppo:
   `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.
   Cambiarlo fa uscire tutti (i cookie vecchi non valgono più): è anche il modo per "buttare fuori" tutti in caso di problemi.
3. **https obbligatorio** e `NODE_ENV=production`: così il cookie ha anche il flag `Secure` (viaggia solo cifrato).
4. **Porta del database chiusa.** In `docker-compose.yml` la porta `5433` è aperta su tutte le interfacce: su un server va tolta o legata a `127.0.0.1:5433:5432`.
5. **Proxy davanti (nginx, Caddy, ecc.).** Se il server sta dietro un proxy, aggiungi `app.set("trust proxy", 1)` in `app.js`: altrimenti il limite di tentativi vede tutti con lo stesso IP (quello del proxy) e blocca tutti insieme.
6. **CORS** solo se il frontend sta su un **dominio diverso** dall'API. Se frontend e API sono sullo stesso dominio (consigliato) non serve niente. Se servono domini diversi: pacchetto `cors` con `origin` = il dominio esatto del frontend e `credentials: true`, e il cookie dovrà diventare `sameSite: "none"` + `secure`.
7. **Backup del database** (sono dati di salute): un `pg_dump` automatico, cifrato, conservato fuori dal server.
8. **Link di invito**: in `api/.env` metti `URL_BASE=https://il-tuo-dominio.it`, così `crea-invito.js` stampa link con l'indirizzo vero.
9. **La libreria Excel è nostra.** Il convertitore (sito e pagina vecchia) usa SheetJS 0.20.3 salvata in `web/vendor/`: nessuna richiesta a terzi.
   Per aggiornarla segui `web/vendor/LEGGIMI.txt` (un test controlla che il file corrisponda all'impronta dichiarata). Non usare la 0.18.5 di npm:
   ha due vulnerabilità note.
10. **Dispositivi condivisi.** Dopo "Esci", se c'erano modifiche non ancora inviate, restano nel `localStorage` di quel browser
    (solo kg, ripetizioni, serie e spunte, senza nomi). Per un telefono condiviso conviene aggiungere "svuota tutto al logout"
    quando si decide come comportarsi.

## La libreria degli esercizi
- Tabella `esercizio_libreria` (migrazione `db/initdb/07_libreria_esercizi.sql`): per ogni trainer, nome normalizzato, nome come scritto, ultimo video, numero di usi. Solo nomi e link: nessun dato dei clienti. Sparisce con il trainer.
- Si riempie da sola: `creaScheda` (in `operazioni.js`) chiama `imparaDallaScheda` (in `libreria.js`) per **ogni** scheda salvata, quindi vale sia per l'editor sia per gli Excel. Un video nuovo sostituisce il vecchio; se manca, resta quello ricordato. Se l'apprendimento fallisce, la scheda è salvata comunque.
- `GET /api/pt/esercizi?q=testo` (solo trainer): fino a 8 esercizi suoi che contengono il testo, i più usati per primi. Senza testo restituisce `[]`.
- Test: `api/test/libreria.test.js`.

## Recupero della password

Chi dimentica la password (trainer o cliente) va su «Hai dimenticato la password?» nel login, scrive la sua email e riceve un link:

- il link vale **1 ora** e si usa **una volta sola**; un nuovo link annulla il precedente;
- la risposta è **sempre la stessa** (anche se l'email non ha un account), così non si scopre chi è registrato;
- non si può chiedere più di un link ogni 2 minuti per lo stesso account, e al massimo 5 richieste ogni 15 minuti per indirizzo;
- dopo il cambio, **gli accessi già aperti smettono di valere** (se qualcuno conosceva la vecchia password e aveva una sessione aperta, viene buttato fuori);
- nel database c'è solo l'impronta del codice (tabella `reimposta_password`), mai il codice.

**Database: migrazione 10 (da applicare PRIMA di riavviare il server, altrimenti il login non funziona):**

```powershell
Get-Content db\initdb\10_reimposta_password.sql | docker exec -i lena-db psql -U lena -d lena
```

### Backup del database su Neon

Il piano gratuito di Neon conserva la cronologia solo per poco: con dati veri serve un backup nostro. Da PowerShell, nella cartella del progetto (Docker acceso):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\backup-neon.ps1
```

Lo script chiede la stringa di connessione di Neon (senza mostrarla), fa `pg_dump` con un contenitore PostgreSQL 18 (la stessa versione di Neon), controlla che il file si legga e tiene gli ultimi 14. I file finiscono in `C:\Users\<tu>\backup-lena`, **fuori dal progetto**: contengono dati veri e non vanno mai pubblicati. Quando ci sono clienti veri, conviene copiarli anche su un disco esterno o su un cloud personale.

**Ripristinare** (in un database vuoto, per esempio un nuovo progetto Neon; la stringa va nella variabile `$u` tra virgolette):

```powershell
docker run --rm -v C:\Users\<tu>\backup-lena:/backup postgres:18 pg_restore --no-owner --clean --if-exists -d "$u" /backup/lena-AAAA-MM-GG-HHMM.dump
```

### L'app sul telefono (PWA)

Lena si può mettere sul telefono come un'app: icona, schermo intero, apertura più rapida. Serve https (online su Render va; in locale solo su `localhost`).

- `web/manifest.webmanifest` e le icone in `web/icone-app/` (192, 512, maschera per Android, 180 per iPhone), disegnate con le stesse forme di `web/favicon.svg`.
- `web/sw.js` è il service worker. **Non salva mai dati delle persone**: lascia passare l'API (`/api/`), gli indirizzi con parametri (codici di invito e di recupero) e tutto ciò che non è GET; tiene solo una copia dei file del sito. Prima va in rete, così dopo un aggiornamento si vede subito la versione nuova. Se cambia la logica di cosa si copia, cambia `VERSIONE` in `sw.js`.
- Senza rete si vede `web/offline.html`. La scheda **non** si apre offline: i dati restano solo sul server finché la pagina non è caricata (i valori segnati senza rete, a pagina già aperta, partono appena torna la rete, come prima).
- `web/pwa.js` registra il service worker e mostra il riquadro «Metti Lena sul telefono» (in «Il mio account» e nel profilo del trainer), con il pulsante «Installa» su Android e le istruzioni a parole per iPhone.
- Il test è `api/test/pwa.test.js`.

### Dati del titolare (migrazione 11)

Ogni trainer è il titolare dei dati dei suoi clienti. Nella pagina «Il tuo profilo» inserisce nome (o palestra), indirizzo ed email per la privacy: compaiono nell'informativa che leggono i suoi clienti (prima di registrarsi, dal link di invito; dopo, dal loro account). **Senza questi dati un trainer non può creare inviti.** Chi gestisce Lena (Asiha Venturi) è scritto direttamente nei testi.

**Database: migrazione 11 (da applicare PRIMA di riavviare il server; sia sul database locale sia su Neon):**

```powershell
Get-Content db\initdb\11_titolare.sql | docker exec -i lena-db psql -U lena -d lena
```

Per Neon: stesso comando ma con `psql "$u"` al posto di `psql -U lena -d lena` (con `$u` impostata come per le altre migrazioni).

**Spedire le email.** Come in Loadout: **Brevo** spedisce (tramite la sua API https, quindi funziona anche su Render gratuito, che blocca le porte SMTP) e un indirizzo **Gmail** dedicato fa da mittente (Gmail non spedisce niente). Piano gratuito di Brevo: controlla i limiti attuali nella tua area (in Loadout erano 300 email al giorno).

1. Brevo → **Mittenti** → aggiungi il Gmail → Brevo manda un link di conferma in quella casella → aprilo.
2. Brevo → **SMTP e API** → **Chiavi API** → crea una chiave per Lena (non riusare quella di Loadout).
3. In `api/.env`: `BREVO_API_KEY` (la chiave), `EMAIL_MITTENTE` (il Gmail verificato) ed, facoltativa, `EMAIL_ASSISTENZA`. Online le stesse variabili vanno nel pannello Environment di Render, mai nel repository.
4. Online serve anche `URL_BASE` (l'indirizzo pubblico del sito, per i link nelle email): senza, l'email non parte.

**Senza chiave (sviluppo).** Se `BREVO_API_KEY` manca, l'email non parte: il testo, con il link, viene scritto nella finestra dove gira il server. Basta copiare il link e aprirlo per provare tutto. In produzione (`NODE_ENV=production`) senza configurazione il link non viene scritto da nessuna parte.

**Limite noto.** Con un mittente `gmail.com` Brevo non può firmare le email (DKIM): qualcuna può finire nello spam. Si risolve solo con un dominio proprio.

**Errori comuni.** «Key not found» da Brevo: chiave copiata male o scaduta (ne basta una nuova; il codice toglie già spazi e a capo). Variabili aggiunte a `.env` ma ignorate: riavvia il server.

**Privacy.** Brevo (e Google, per la casella del mittente) vedono l'email della persona e il link: sono fornitori (responsabili del trattamento) da nominare nell'informativa privacy e da citare nelle condizioni d'uso. L'email non contiene mai dati di allenamento né di salute.

**Se il trainer non riceve l'email** (servizio non ancora configurato): resta il comando di emergenza `node reimposta-password.js email nuovaPassword`, che cambia la password direttamente dal database.

