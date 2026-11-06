-- Dati di prova per lo sviluppo (si presume un database nuovo, quindi gli id partono da 1)
INSERT INTO utente (email, password_hash, ruolo) VALUES ('pt@prova.it', 'x', 'pt');
INSERT INTO pt (utente_id, nome) VALUES (1, 'PT di prova');
INSERT INTO cliente (pt_id, nome, cognome) VALUES (1, 'Asiha', 'Venturi');