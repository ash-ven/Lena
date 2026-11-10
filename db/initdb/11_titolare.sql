-- Lena: schema del database, parte 11 (i dati del titolare del trattamento, scritti dal trainer)
-- Ogni trainer è il titolare dei dati dei SUOI clienti: nome (o palestra), indirizzo ed email di contatto per la privacy
-- compaiono nell'informativa che leggono i suoi clienti. Si può lanciare più volte senza danni.
-- Su un database già in funzione si applica a mano, senza perdere i dati:
--   docker exec -i lena-db psql -U lena -d lena < db/initdb/11_titolare.sql

ALTER TABLE pt ADD COLUMN IF NOT EXISTS titolare_nome TEXT;
ALTER TABLE pt ADD COLUMN IF NOT EXISTS titolare_indirizzo TEXT;
ALTER TABLE pt ADD COLUMN IF NOT EXISTS titolare_email TEXT;
