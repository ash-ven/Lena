-- Lena: schema del database, parte 14 («com'e' andata» a ogni esercizio: facile, giusto, pesante)
-- Non serve una tabella nuova: e' un nuovo tipo di registrazione, con valore 1 (facile), 2 (giusto) o 3 (pesante).
-- La tabella registrazione ammetteva solo kg, rip, serie e fatto: qui si aggiunge «sforzo».
-- Si puo' lanciare piu' volte senza danni. DA APPLICARE PRIMA di mettere online il codice (sul database locale e su Neon):
--   Get-Content db\initdb\14_sforzo.sql | docker exec -i lena-db psql -U lena -d lena
--   (Neon: psql "$u" al posto di docker exec ... psql -U lena -d lena)

ALTER TABLE registrazione DROP CONSTRAINT IF EXISTS registrazione_tipo_check;
ALTER TABLE registrazione ADD CONSTRAINT registrazione_tipo_check CHECK (tipo IN ('kg', 'rip', 'serie', 'fatto', 'sforzo'));
