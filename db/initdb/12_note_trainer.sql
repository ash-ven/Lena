-- Lena: schema del database, parte 12 (le note private del trainer su un cliente)
-- Un solo campo di testo per cliente. Le vede il trainer; il cliente le riceve se scarica i propri dati («Il mio account»).
-- Si può lanciare più volte senza danni. Su un database già in funzione si applica a mano, senza perdere i dati:
--   docker exec -i lena-db psql -U lena -d lena < db/initdb/12_note_trainer.sql

ALTER TABLE cliente ADD COLUMN IF NOT EXISTS note_trainer TEXT;
ALTER TABLE cliente ADD COLUMN IF NOT EXISTS note_trainer_aggiornate_il TIMESTAMPTZ;
