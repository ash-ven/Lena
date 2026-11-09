-- Lena: schema del database, parte 9 (nomi definitivi dei mood della scheda, 9 novembre 2026)
-- I mood provvisori «motori», «ferro» e «dojo» si chiamano ora «box», «oldschool» e «tatami».
-- Chi aveva già scelto uno dei nomi vecchi passa al nuovo. Si può lanciare più volte senza danni.
-- Su un database già in funzione si applica a mano, senza perdere i dati:
--   Get-Content db\initdb\09_mood_nomi.sql | docker exec -i lena-db psql -U lena -d lena     (PowerShell)
UPDATE cliente SET mood = CASE mood WHEN 'motori' THEN 'box' WHEN 'ferro' THEN 'oldschool' WHEN 'dojo' THEN 'tatami' END
WHERE mood IN ('motori', 'ferro', 'dojo');
