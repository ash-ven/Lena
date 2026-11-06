# API di Lena

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
