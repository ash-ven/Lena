-- Lena: schema del database, parte 10 (recupero della password)
-- Chi ha dimenticato la password riceve per email un link da usare UNA volta, entro un'ora.
-- Nel database salviamo solo l'impronta (hash sha256) del codice, mai il codice vero, come per gli inviti.
-- In più, "sessioni_dal" serve a far smettere di valere gli accessi aperti prima del cambio di password
-- (se qualcuno la conosceva e aveva già una sessione aperta, dopo il cambio viene buttato fuori).
--
-- Su un database già in funzione si applica a mano (PowerShell):
--   Get-Content db\initdb\10_reimposta_password.sql | docker exec -i lena-db psql -U lena -d lena
-- "IF NOT EXISTS" lo rende sicuro anche se lanciato due volte.

CREATE TABLE IF NOT EXISTS reimposta_password (
  id           SERIAL PRIMARY KEY,
  utente_id    INTEGER NOT NULL REFERENCES utente(id) ON DELETE CASCADE,
  codice_hash  TEXT NOT NULL UNIQUE,
  scade_il     TIMESTAMPTZ NOT NULL,
  usato_il     TIMESTAMPTZ,
  creato_il    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reimposta_password_utente_idx ON reimposta_password (utente_id);

ALTER TABLE utente ADD COLUMN IF NOT EXISTS sessioni_dal TIMESTAMPTZ;
