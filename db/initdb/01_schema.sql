-- Lena: schema del database, parte 1 (le persone)

-- Chi può fare login. Qui sta solo l'accesso: chi è davvero sta in pt o cliente.
CREATE TABLE utente (
  id             SERIAL PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  ruolo          TEXT NOT NULL CHECK (ruolo IN ('pt', 'cliente')),
  creato_il      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Il profilo del personal trainer (più avanti: tema, logo).
CREATE TABLE pt (
  id         SERIAL PRIMARY KEY,
  utente_id  INTEGER NOT NULL UNIQUE REFERENCES utente(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL
);

-- Le persone seguite da un PT. Possono esistere prima di avere un account.
CREATE TABLE cliente (
  id         SERIAL PRIMARY KEY,
  pt_id      INTEGER NOT NULL REFERENCES pt(id) ON DELETE CASCADE,
  utente_id  INTEGER UNIQUE REFERENCES utente(id) ON DELETE SET NULL,
  nome       TEXT NOT NULL,
  cognome    TEXT NOT NULL,
  creato_il  TIMESTAMPTZ NOT NULL DEFAULT now()
);