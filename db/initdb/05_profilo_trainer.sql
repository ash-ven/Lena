-- Lena: schema del database, parte 5 (il profilo del trainer, con la foto)
-- Si può lanciare più volte senza danni ("IF NOT EXISTS").
-- Su un database già in funzione si applica a mano, senza perdere i dati:
--   docker exec -i lena-db psql -U lena -d lena < db/initdb/05_profilo_trainer.sql

-- Una breve presentazione e un contatto che il trainer sceglie di far vedere ai SUOI clienti (e a nessun altro).
ALTER TABLE pt ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE pt ADD COLUMN IF NOT EXISTS contatto TEXT;
-- La foto: un JPEG già ridotto dal browser (al massimo 400 KB). Sta nel database, così finisce nei backup insieme al resto
-- e non c'è una cartella di file da proteggere.
ALTER TABLE pt ADD COLUMN IF NOT EXISTS foto BYTEA CHECK (foto IS NULL OR octet_length(foto) <= 400000);
ALTER TABLE pt ADD COLUMN IF NOT EXISTS foto_aggiornata_il TIMESTAMPTZ;
