# Proposte per il sistema Lena

Cose che nel sito servono ma il sistema "Performance lab" non ha ancora. Sono state implementate in `web/sistema.css`, `web/pagine.css` e `web/pt.css` e contrassegnate "PROPOSTA". Finché non le approvi (e non le aggiungiamo al design system) restano provvisorie. Gli originali in questa cartella non sono stati toccati.

| # | Proposta | Dove si vede | Perché |
|---|----------|--------------|--------|
| 1 | Pulsante secondario (contorno, testo `testo`) | Esci, Annulla, Crea invito, Copia… | In ogni vista c'è un solo pulsante brace: gli altri servono in forma quieta. |
| 2 | Pulsante pericoloso (contorno `errore`) | Cancella cliente, Cancella account | Azione irreversibile: niente riempimento, ma colore distinto. |
| 3 | Pulsante piccolo (altezza 44px, testo 14px) | Esci nella barra | La barra è stretta; resta il bersaglio da 44px. |
| 4 | Colore `conferma` (#3DDC97 scuro, #17603B chiaro) | "Si allena", "Salvato" | Il sistema non ha un colore per l'esito positivo. Contrasto 8,9:1 (scuro) e 6,0:1 (chiaro) su sfondo, superficie e superficie-alta. |
| 5 | Chip di stato (attivo, in attesa, nessuna scheda, neutro) | Elenco clienti, pagina cliente | Testo + icona, mai solo colore. Il neutro sta solo su `superficie-alta`. |
| 6 | Riquadri di riepilogo (cifre) | Cima dell'elenco clienti | Colpo d'occhio su quanti si allenano e quanti inviti sono in attesa. |
| 7 | Riquadro "Cosa fare adesso" | Pagina cliente | Un solo prossimo passo, con un solo pulsante brace. |
| 8 | Avvisi neutri con icona | Messaggi e avvisi | Niente rosso/giallo di sistema: superficie-alta con icona; solo l'errore usa `errore`. |
| 9 | Campi a 16px (il sistema dice 14px) | Tutti i campi | Sotto i 16px iOS ingrandisce la pagina quando tocchi il campo. |
| 10 | "Mostra la password" come casella | Login e registrazione | Il sistema suggerisce l'occhio dentro il campo; la casella è più chiara con lo screen reader. Da decidere. |
| 11 | Selettore del tema (auto, scura, chiara) | Barra di ogni pagina | Il sistema prevede le due modalità ma non dice come si sceglie. |
| 12 | Icone Phosphor Bold come file SVG (via maschera CSS) | Ovunque | Colorabili con i token, nessuna richiesta esterna. |

## Ancora da fare (non dipende da te)

- **Logo**: i file SVG (simbolo "Gradi" + LENA) non erano leggibili da qui. Il logo è provvisorio (testo) e anche `web/favicon.svg`. Scarica i 7 SVG del gruppo "Logos" del design system in `design-sistema/assets/Logos/` e li sostituisco.
- **Scheda del cliente**: resta con il suo tema (`web/tema.css`, `web/scheda.css`), identico a quella scaricabile. Va ridisegnata in un secondo momento, insieme alla scheda scaricabile.
