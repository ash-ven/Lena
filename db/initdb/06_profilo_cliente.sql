-- Lena: schema del database, parte 6 (la foto del cliente)
-- Si può lanciare più volte senza danni ("IF NOT EXISTS").
-- Su un database già in funzione si applica a mano, senza perdere i dati:
--   Get-Content db\initdb\06_profilo_cliente.sql | docker exec -i lena-db psql -U lena -d lena     (PowerShell)
-- La foto è un JPEG già ridotto dal browser (al massimo 400 KB), come quella del trainer. Se il cliente viene cancellato, se ne va con lui.
ALTER TABLE cliente ADD COLUMN IF NOT EXISTS foto BYTEA CHECK (foto IS NULL OR octet_length(foto) <= 400000);
ALTER TABLE cliente ADD COLUMN IF NOT EXISTS foto_aggiornata_il TIMESTAMPTZ;
