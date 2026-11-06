# CampoTesto

Campo per email, password e testi brevi, con l'etichetta sempre visibile sopra.

- **Cosa fornisce chi lo usa**: etichetta, tipo (email, password, testo), testo d'esempio, eventuale requisito sotto il campo, eventuale messaggio di errore.
- Etichetta in `etichetta` colore `testo`, distanza `spazio-2` dal campo.
- Campo su `superficie` con contorno 1 px `bordo-campo`, angoli `raggio-controllo`, interno `spazio-3`, testo `corpo-piccolo`; testo d'esempio in `testo-secondario` con un valore realistico («nome@esempio.it»).
- Requisito sotto il campo in `nota` colore `testo-secondario`, visibile da subito.
- Password: occhio per mostrarla a destra, dentro il campo.
- Errore: contorno `errore`, messaggio sotto in `nota` colore `errore` con icona, che dice cosa fare.
- Mai su `superficie-alta`: lì il contorno non arriva a 3:1.
