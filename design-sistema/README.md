Lena trasforma l'Excel del personal trainer in una scheda di allenamento interattiva per il cliente. Questa guida vale per la **parte base** dell'app: login, registrazione da invito, informativa e consenso, area PT. Le schede di allenamento del cliente hanno quattro mood a scelta e una guida propria; partono comunque da questi token.

## Carattere

Lena è un **laboratorio di prestazione**: precisa come la strumentazione sportiva, seria, un po' cattiva. Professionale prima di tutto, coinvolgente senza fare rumore.

- Un solo colore forte, `brace`. Tutto il resto è carbonio, grigi e bianco.
- I numeri sono protagonisti: kg, ripetizioni, tempi e date si leggono prima di tutto il resto.
- Pochi elementi per schermata, un solo pulsante principale per vista.
- Angoli morbidi (`raggio-controllo`, `raggio-riquadro`) che bilanciano le parti dure: chevron, titoli in grassetto, contrasti forti.

## Logo

Il logo è il **simbolo «Gradi»** accanto alla **scritta LENA**.

- **Simbolo**: tre chevron impilati come gradi militari. Il più alto è sempre `brace`; i due sotto sono nel colore `testo` della modalità. Richiama livello, progressione, disciplina.
- **Scritta**: LENA in Space Grotesk Bold, maiuscola e spaziata. La **A è un chevron con l'apice piatto**, in `brace`, e lega la scritta al simbolo.
- File nel gruppo **Logos**: `lena-logo-scuro.svg` e `lena-logo-chiaro.svg` (simbolo e scritta), `lena-simbolo-*` (solo simbolo), `lena-scritta-*` (solo scritta), `lena-icona-app.svg` (icona del telefono e del browser).
- Usa la versione `-scuro` su `sfondo` della modalità scura e la `-chiaro` su quella chiara. Le lettere sono tracciati, non testo: non serve il font per mostrarle.
- Lascia attorno al logo uno spazio libero pari almeno all'altezza del simbolo diviso due.
- Non cambiare i colori, non ruotare, non separare il chevron arancio dal simbolo, non mettere il logo su fondi arancio o su fotografie.
- Il monogramma «L», per usi piccolissimi, è ancora da disegnare: fino ad allora usa il simbolo.

## Colori

Lena ha due modalità, **scura** (principale) e **chiara**. All'apertura segue l'impostazione del telefono o del computer; l'utente la può cambiare da dentro l'app.

- Pagine su `sfondo`; riquadri, schede e interno dei campi su `superficie`.
- Testo su `testo`; spiegazioni, date e requisiti su `testo-secondario`.
- Il **pulsante principale** è `brace` con scritta `su-brace`, identico nelle due modalità. Mai scritta bianca sull'arancio.
- Le parole in arancio (link, evidenze) usano `testo-brace`, non `brace`: sul chiaro `brace` non basta per il testo piccolo.
- Contorni dei campi in `bordo-campo`; contorni decorativi dei riquadri in `bordo-superficie`; linee tra le righe in `divisorio`.
- Gli errori usano `errore`, sempre con icona e testo. `errore` e `brace` non si toccano mai nello stesso elemento.
- `superficie-alta` serve solo per etichette neutre e passaggio del mouse: non metterci sopra `testo-brace`, `errore` o campi.
- Colori scartati di proposito: volt `#D4FF3A` (illeggibile sul bianco), blu (troppo vicino a Facebook), rosso come accento (si confonde con gli errori).
- Un colore per le conferme («Salvato») non è ancora stato scelto.

## Tipografia

- **Space Grotesk** (`titoli`) per titoli e logo; **Inter** (`testo`) per tutto il resto. Entrambi a licenza SIL OFL, ospitati da Lena in `fonts/`: nessuna richiesta a Google Fonts dalle pagine.
- Titoli in `titolo-grande`, `titolo`, `titolo-piccolo`. Testo in `corpo` e `corpo-piccolo`; etichette dei campi in `etichetta`; requisiti in `nota`; pulsanti in `pulsante`.
- Kg, ripetizioni, tempi e conteggi in `numero`, con cifre a larghezza fissa (`font-variant-numeric: tabular-nums`).
- Mai testo sotto 12 px. Iniziale maiuscola solo all'inizio della frase, niente Titoli Con Tutte Maiuscole; il maiuscolo è riservato alla scritta del logo.

## Spazi e forme

- Spaziature dalla scala `spazio-1` … `spazio-10`. Margine laterale sul telefono `spazio-4`; tra campi `spazio-5`; tra sezioni `spazio-8`; tra logo e titolo `spazio-10`.
- Pulsanti, campi ed etichette con `raggio-controllo` (10 px); riquadri e schede con `raggio-riquadro` (14 px); caselle con `raggio-casella`.
- Superfici piatte: niente sfumature, ombre decorative, bagliori.
- Pulsanti e caselle alti almeno 44 px, comodi da toccare anche in palestra.

## Iconografia

- Icone a **contorno spesso**, stile Phosphor Bold, nel colore `testo` o `testo-secondario`; `brace` solo per l'icona dell'elemento attivo.
- Le icone si ospitano come file SVG, senza librerie esterne caricate dalle pagine.
- Le icone non sono ancora state copiate in questa guida: gli esempi usano segni provvisori.
- Niente emoji nell'interfaccia.

## Testi e tono

- Si dà del **tu**, con tono deciso e un po' motivante, senza esclamativi.
- **Niente giochi di parole sul nome Lena** e niente slogan costruiti su «lena»: il nome si usa solo come nome.
- **Senza genere**: niente «Bentornato/a». Si parla dell'allenamento, non della persona.
- Titoli brevi che chiudono con il punto quando sono frasi: «Il prossimo allenamento ti aspetta.», «La tua scheda è pronta.»
- Pulsanti con un verbo, una o due parole, senza punto: «Accedi», «Crea accesso».
- Etichette sempre visibili sopra i campi; il testo d'esempio dentro il campo non sostituisce l'etichetta.
- Errori: cosa è successo e cosa fare, in una frase. «Questo invito non è più valido. Chiedi al tuo trainer un nuovo link.»
- Requisiti scritti prima, non solo dopo l'errore: «Almeno 10 caratteri.»
- In Lena si entra solo su invito: «Non hai un account? Chiedi l'invito al tuo trainer.»

## Accessibilità

- Testo almeno 4,5:1 sul suo fondo, in **tutte e due** le modalità; contorni dei controlli, icone e anello di attivazione almeno 3:1. Ogni `usage` dei colori dice su quali fondi vale.
- Ogni controllo attivo da tastiera mostra `anello-attivo`: 2 px, staccato di 2 px.
- Il colore non è mai l'unico segnale: errori e stati hanno sempre anche parole o icone.
- La casella del consenso non è mai già spuntata.

## Cosa non fare

- Due pulsanti `brace` nella stessa vista.
- `brace` come colore del testo piccolo nella modalità chiara.
- Font caricati da servizi esterni, script o stili scritti dentro l'HTML (la CSP di Lena li blocca).
- Fotografie o illustrazioni decorative nella parte base.
