-- Lena: schema del database, parte 7 (la libreria degli esercizi del trainer)
-- Si può lanciare più volte senza danni ("IF NOT EXISTS").
-- Su un database già in funzione si applica a mano, senza perdere i dati:
--   Get-Content db\initdb\07_libreria_esercizi.sql | docker exec -i lena-db psql -U lena -d lena     (PowerShell)
-- Si riempie da sola: ogni esercizio di ogni scheda salvata (dall'editor o da Excel) viene ricordato, col suo video.
-- Non contiene dati dei clienti: solo nomi di esercizi e link. Se il trainer viene cancellato, se ne va con lui.
CREATE TABLE IF NOT EXISTS esercizio_libreria (
  id          SERIAL PRIMARY KEY,
  pt_id       INTEGER NOT NULL REFERENCES pt(id) ON DELETE CASCADE,
  chiave      TEXT NOT NULL,                       -- il nome in minuscolo, senza accenti, spazi singoli: serve a riconoscere "Squat" e "squat "
  nome        TEXT NOT NULL CHECK (char_length(nome) <= 200),   -- come l'ha scritto l'ultima volta
  video       TEXT CHECK (video IS NULL OR (char_length(video) <= 2000 AND video ~ '^https?://')),
  usi         INTEGER NOT NULL DEFAULT 1,
  ultimo_uso  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pt_id, chiave)
);
