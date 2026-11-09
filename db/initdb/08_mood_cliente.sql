-- Lena: schema del database, parte 8 (il mood scelto dal cliente per la sua scheda)
-- Si può lanciare più volte senza danni ("IF NOT EXISTS").
-- Su un database già in funzione si applica a mano, senza perdere i dati:
--   Get-Content db\initdb\08_mood_cliente.sql | docker exec -i lena-db psql -U lena -d lena     (PowerShell)
-- NULL = non ha scelto: vale il mood predefinito («lena»). I nomi validi li decide api/mood.js.
ALTER TABLE cliente ADD COLUMN IF NOT EXISTS mood TEXT;
