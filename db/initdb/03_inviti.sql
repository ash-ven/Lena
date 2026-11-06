-- Lena: schema del database, parte 3 (gli inviti)
-- Il PT genera un invito per un cliente; il cliente lo usa una volta sola per crearsi l'account.
-- Nel database salviamo solo l'"impronta" (hash sha256) del codice, mai il codice vero:
-- se qualcuno leggesse il database, non potrebbe usare gli inviti.
--
-- Questo file gira da solo solo su un database nuovo (volume vuoto).
-- Su un database già in funzione si applica a mano:
--   docker exec -i lena-db psql -U lena -d lena < db/initdb/03_inviti.sql
-- "IF NOT EXISTS" lo rende sicuro anche se lanciato due volte.

CREATE TABLE IF NOT EXISTS invito (
  id           SERIAL PRIMARY KEY,
  cliente_id   INTEGER NOT NULL REFERENCES cliente(id) ON DELETE CASCADE,
  codice_hash  TEXT NOT NULL UNIQUE,
  scade_il     TIMESTAMPTZ NOT NULL,
  usato_il     TIMESTAMPTZ,
  creato_il    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indice su cliente_id: serve quando si cancella un cliente (la cascata cerca i suoi inviti)
-- e quando un nuovo invito annulla quelli vecchi dello stesso cliente.
CREATE INDEX IF NOT EXISTS invito_cliente_idx ON invito (cliente_id);
