-- Lena: schema del database, parte 13 (gli appunti del trainer su un cliente, SEPARATI dalle note)
-- Un solo campo di testo per cliente. Li vede solo il trainer: NON entrano nel file che il cliente scarica ne' in quello del trainer.
-- Spariscono quando il cliente viene cancellato (e' una colonna della sua riga).
-- Si puo' lanciare piu' volte senza danni. Su un database gia' in funzione si applica a mano, senza perdere i dati:
--   docker exec -i lena-db psql -U lena -d lena < db/initdb/13_appunti_trainer.sql

ALTER TABLE cliente ADD COLUMN IF NOT EXISTS appunti_trainer TEXT;
ALTER TABLE cliente ADD COLUMN IF NOT EXISTS appunti_trainer_aggiornati_il TIMESTAMPTZ;
