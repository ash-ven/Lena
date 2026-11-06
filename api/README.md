# API di Lena

Il "motore" di Lena: un server Node/Express che parla con il database Postgres e risponde
in JSON alle richieste del frontend. Due ruoli: **PT** (personal trainer) e **cliente**.

## Indice

1. [Avviare tutto da zero](#avviare-tutto-da-zero)
2. [Le tabelle](#le-tabelle)
3. [Gli endpoint](#gli-endpoint)
4. [Esempi in PowerShell](#esempi-in-powershell)
5. [Regole di sicurezza già attive](#regole-di-sicurezza-già-attive)
6. [Prima di andare online (checklist)](#prima-di-andare-online-checklist-sicurezza)

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

Il server risponde su `http://localhost:3001`. Prova veloce: `Invoke-RestMethod http://localhost:3001/api/salute`.

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
| `POST /api/auth/registra-cliente` | tutti (con codice) | Crea l'account del cliente da un invito e fa già il login |
| `GET /api/clienti` | PT | I miei clienti (con `registrato: true/false`) |
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
  -Body (@{ codice = $inv.codice; email = "niccolo@email.it"; password = "PasswordCliente1" } | ConvertTo-Json)
# → { id: 25, ruolo: "cliente" }   (codice sbagliato/scaduto/usato → 400 "Invito non valido o scaduto")

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
- **Sessione**: un JWT firmato (valido 7 giorni) dentro il cookie `lena_sessione`, che è:
  - `HttpOnly`: il JavaScript della pagina non lo legge;
  - `SameSite=Lax`: non parte dalle richieste di altri siti;
  - `Secure` con `NODE_ENV=production`: solo su https.
- **Accesso**: il PT vede solo i suoi clienti e le loro schede, il cliente solo la sua. Tutto il resto risponde 404.
- **Limite tentativi** (per IP, ogni 15 minuti):
  - login e registrazione: 10 tentativi **sbagliati**;
  - tutte le altre richieste: 600 in totale.
- **helmet**: aggiunge le intestazioni di sicurezza standard.
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
