-- Lena: schema del database, parte 2 (le schede)

-- Una scheda di allenamento assegnata a un cliente.
-- Colonne vere per ciò che si cerca e si ordina; JSONB per tutto il resto.
CREATE TABLE scheda (
  id             SERIAL PRIMARY KEY,
  cliente_id     INTEGER NOT NULL REFERENCES cliente(id) ON DELETE CASCADE,
  inizio         DATE NOT NULL,
  settimane      INTEGER NOT NULL CHECK (settimane BETWEEN 1 AND 52),
  dati           JSONB NOT NULL,
  creata_il      TIMESTAMPTZ NOT NULL DEFAULT now(),
  aggiornata_il  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX scheda_cliente_idx ON scheda (cliente_id);

-- Quello che il cliente segna: kg, ripetizioni fatte, serie fatte, spunte, com'e' andato l'esercizio (sforzo: 1 facile, 2 giusto, 3 pesante).
-- Una riga per ogni valore, con la stessa "chiave" che oggi usa il telefono (es. "2|A|1").
CREATE TABLE registrazione (
  scheda_id      INTEGER NOT NULL REFERENCES scheda(id) ON DELETE CASCADE,
  tipo           TEXT NOT NULL CHECK (tipo IN ('kg', 'rip', 'serie', 'fatto', 'sforzo')),
  chiave         TEXT NOT NULL,
  valore         TEXT NOT NULL,
  aggiornata_il  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scheda_id, tipo, chiave)
);