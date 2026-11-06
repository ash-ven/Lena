-- Lena: schema del database, parte 4 (privacy)
-- Si può lanciare più volte senza danni ("IF NOT EXISTS").
-- Su un database già in funzione si applica a mano, senza perdere i dati:
--   docker exec -i lena-db psql -U lena -d lena < db/initdb/04_privacy.sql

-- ---------- Consensi ----------
-- Chi ha accettato cosa, e quando. Una riga per ogni accettazione di una certa VERSIONE di un testo:
-- se il testo cambia (nuova versione) serve una nuova riga, cioè una nuova accettazione.
-- "tipo" oggi ha due valori. Per aggiungerne altri in futuro (altri professionisti) basta modificare il CHECK qui sotto.
CREATE TABLE IF NOT EXISTS consenso (
  id            SERIAL PRIMARY KEY,
  utente_id     INTEGER NOT NULL REFERENCES utente(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL CHECK (tipo IN ('informativa_cliente', 'condizioni_pt')),
  versione      TEXT NOT NULL,
  accettato_il  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (utente_id, tipo, versione)   -- questo vincolo crea anche l'indice per cercare i consensi di un utente
);

-- ---------- Conservazione dei dati (usati dal blocco "conservazione") ----------
-- Quando il cliente (o il suo professionista) ha fatto qualcosa l'ultima volta: carica una scheda, salva un valore.
ALTER TABLE cliente ADD COLUMN IF NOT EXISTS ultima_attivita TIMESTAMPTZ NOT NULL DEFAULT now();
-- Quando il professionista ha segnato "rapporto concluso". Vuoto = rapporto in corso. È reversibile.
ALTER TABLE cliente ADD COLUMN IF NOT EXISTS rapporto_finito_il TIMESTAMPTZ;
