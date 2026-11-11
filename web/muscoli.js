// I muscoli principali di ogni esercizio, per la figura del corpo a fine scheda.
// Solo i muscoli PRINCIPALI (da 1 a 3 per esercizio), niente secondari. Un solo file, usato dal browser e dai test.
// Funziona sul NOME dell'esercizio (anche per quelli inventati dal trainer): si normalizza il nome e si cercano parole chiave,
// dalla più specifica alla più generale; vince la prima regola che corrisponde. [] = non allena un muscolo in particolare
// (cardio, mobilità, stretching, allenamenti a tempo): non colora nulla.
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica();
  else radice.LenaMuscoli = fabbrica();
})(typeof self !== "undefined" ? self : this, function () {
  // id, nome da mostrare, dove si vede sulla figura
  const MUSCOLI = [
    { id: "petto", nome: "Petto", lati: ["davanti"] },
    { id: "spalle_anteriori", nome: "Spalle (davanti)", lati: ["davanti"] },
    { id: "spalle_laterali", nome: "Spalle (lato)", lati: ["davanti", "dietro"] },
    { id: "spalle_posteriori", nome: "Spalle (dietro)", lati: ["dietro"] },
    { id: "trapezio", nome: "Trapezio", lati: ["dietro"] },
    { id: "schiena_alta", nome: "Schiena alta", lati: ["dietro"] },
    { id: "dorsali", nome: "Dorsali", lati: ["dietro"] },
    { id: "lombari", nome: "Lombari", lati: ["dietro"] },
    { id: "bicipiti", nome: "Bicipiti", lati: ["davanti"] },
    { id: "tricipiti", nome: "Tricipiti", lati: ["dietro"] },
    { id: "avambracci", nome: "Avambracci", lati: ["davanti", "dietro"] },
    { id: "addome", nome: "Addominali", lati: ["davanti"] },
    { id: "obliqui", nome: "Obliqui", lati: ["davanti"] },
    { id: "quadricipiti", nome: "Quadricipiti", lati: ["davanti"] },
    { id: "adduttori", nome: "Adduttori", lati: ["davanti"] },
    { id: "abduttori", nome: "Abduttori", lati: ["dietro"] },
    { id: "glutei", nome: "Glutei", lati: ["dietro"] },
    { id: "femorali", nome: "Femorali", lati: ["dietro"] },
    { id: "polpacci", nome: "Polpacci", lati: ["davanti", "dietro"] },
  ];
  const ID = new Set(MUSCOLI.map((m) => m.id));

  const normalizza = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, " ").trim();

  // [espressione, muscoli]. Le espressioni lavorano sul nome senza accenti e in minuscolo.
  const R = (re, m) => [new RegExp(re), m];
  const REGOLE = [
    // ---- non allena un muscolo in particolare: allenamenti a tempo, cardio, mobilità, stretching, equilibrio ----
    R("^(wod|amrap|emom|e2mom|metcon|chipper|circuito|finisher|hiit|tabata|defaticamento|riscaldamento|workout)\\b", []),
    R("^stretching|^figura del quattro|^pigeon|^posizione (del|della)|^child|^downward|^cane a testa|^cobra|^upward dog|^foam roller|^rilascio|^respirazione diaframmatica|^gambe al muro|^world's greatest|^hip opener|^90/90|^cat[ -]|^wall angel|^angelo al muro|^thread the needle|^open book|^doorway|^allungamento|^torsione (da|in)|^supine twist|^piegamento in avanti|^farfalla|^affondo del corridore", []),
    R("^(mobilita|rotazioni? (delle|del|dei) (spall|brac|coll|caviglie|polsi|anche|bacino|ginocchi)|cerchi con le braccia|slanci della gamba|arm swing|leg swing|marcia sul posto|corsa sul posto|talloni ai glutei|ginocchia alte|skip|jumping jack|walking lunge con rotazione|equilibrio|single leg stance|y balance|star excursion|tavoletta|tandem|camminata (sulla|in tandem|sul bordo|sui talloni|sulle punte)|short foot|piede corto|presa del pavimento|arrotolamento|towel curl|marble|passive hang|active hang|sospensione (passiva|attiva))", []),
    R("(cyclette|air bike|assault bike|echo bike|spin bike|bike indoor|tapis|^corsa|^sprint|ripetute|fartlek|ellittica|cross trainer|stepper|stair|scala infinita|stairmaster|scale$|vogatore|rowing machine|concept2|skierg|ski erg|arm bike|ergometro|ube$|versaclimber|arc trainer|jacob|^nuoto|acquagym|^boxe|sacco|shadow|pugilato|kickboxing|muay|camminata veloce|camminata in salita|camminata inclinata|camminata a ritmo|camminata nordica|camminata con pesi|camminata di defaticamento|^corda$|salto con (la )?corda|double under|single under|triple under|^corde navali|battle rope onde|aqua|canottaggio|navetta|shuttle run|ladder$|agility ladder|scaletta|cono drill|cone drill|slalom|zig-zag|pro agility|illinois|t-drill|t test|cambi di direzione|passi laterali veloci|shuffle|carioca|passo incrociato|a-skip|b-skip|c-skip|corsa (calciata|balzata|laterale|all'indietro|con)|run \\d|^run |echo bike|assault)", []),
    // ---- core ----
    R("(russian twist|woodchop|taglialegna|side bend|piegamenti laterali|plank laterale|side plank|rotazion[ei] ai cavi|rotazione del busto|rotazioni del busto|windshield|tergicristallo|heel touch|tocco dei talloni|bicycle|bicicletta|side crunch|crunch laterale|landmine rotation|rotazione con landmine|rotary torso|torso rotation|core rotation|crunch con rotazione|copenhagen plank|anti-rotation|anti-rotazione|pallof|trasporto anti-rotazione|rotazione del busto|torsione del busto|inclinazioni laterali)", ["obliqui", "addome"]),
    R("(ab wheel|rollout|sollevamento (gambe|ginocchia)|forbice|scalatori|calci alternati|a vuoto|plank|crunch|sit-up|sit up|v-up|v-sit|jackknife|toes to bar|knees to|dead bug|hollow|mountain climber|flutter|scissor|forbici|leg raise|alzate delle (gambe|ginocchia)|hanging (leg|knee)|dragon flag|l-sit|tuck hold|vacuum|stir the pot|body saw|pelvic|basculamento|bear (plank|hold)|shoulder tap|toe tap|heel slide|leg lower|abbassamento delle gambe|hip lift|ab coaster|ab machine|abdominal|captain's chair|sedia romana|roman chair|addominal|walkout|inchworm|crab walk|bear crawl|camminata (del granchio|dell'orso)|arch hold|superman hold|bird dog|body hollow|core |sollevamento del bacino|panca per addominali|knees to elbows)", ["addome"]),
    // ---- polpacci ----
    R("(calf|polpac|punte|tibial|donkey)", ["polpacci"]),
    // ---- glutei e anche ----
    R("(adduction|adductor|adduzion|adduttor|copenhagen|squeeze con palla|ponte con palla tra le ginocchia)", ["adduttori"]),
    R("(abduction|abduzion|abductor|clamshell|monster walk|camminata laterale|fire hydrant|side-lying hip|abduttor|passo laterale con elastico|calci laterali con elastico)", ["abduttori", "glutei"]),
    R("(hip thrust|glute bridge|ponte per glutei|^ponte|frog pump|glute kickback|kickback a quattro|calci posteriori|calci all'indietro con elastico|donkey kick|glute drive|glute machine|kickback machine|standing glute|pull-through|cable pull|macchina per i glutei|glutei)", ["glutei"]),
    R("(reverse hyperextension|hyperextension|iperestension|back extension|lombari|estensioni lombari|lower back|superman|good morning)", ["lombari", "glutei"]),
    // ---- stacchi, femorali ----
    R("(nordic|leg curl|hamstring|femorali|glute ham|ghd hip|slider leg curl|ponte con leg curl)", ["femorali"]),
    R("(rumeno|gambe tese|stiff|romanian|rdl|a una gamba con|stacco a una gamba|stacco b-stance)", ["femorali", "glutei"]),
    R("(stacco|deadlift|rack pull|trap bar|axle bar deadlift)", ["glutei", "femorali", "lombari"]),
    // ---- gambe ----
    R("(leg extension|quadricip|sissy|wall sit|squat isometrico|macchina per i quadricipiti)", ["quadricipiti"]),
    R("(squat sumo|sumo squat)", ["quadricipiti", "glutei", "adduttori"]),
    R("(squat|cosacc|hack|leg press|pendulum|belt squat|v-squat|lever squat|affond|lunge|step-up|step-down|split|bulgaro|pistol|shrimp|cossack|curtsy|box squat|zercher|cluster|thruster|wall ball)", ["quadricipiti", "glutei"]),
    R("(salto|salti|jump|bounding|^hop|depth jump|skater|pattinatore|tuck jump|star jump|broad jump|frog jump)", ["quadricipiti", "glutei"]),
    R("(sled|slitta|prowler|spinta della|trascinamento)", ["quadricipiti", "glutei"]),
    R("(estensioni dietro la nuca)", ["tricipiti"]),
    R("(carry|yoke|frame carry|husafell|atlas stone|sasso atlas|keg|sandbag su spalla|sandbag over|bear hug)", ["trapezio", "avambracci"]),
    R("(rotatori|rotazione esterna spalla)", ["spalle_posteriori"]),
    R("(camminata sulle mani)", ["spalle_anteriori"]),
    R("(hammer strength (incline )?press|incline press)", ["petto", "tricipiti"]),
    R("(kettlebell press|bent press|log press|tronco press|log lift|ground[- ]to[- ]overhead|shoulder[- ]to[- ]overhead|^pike)", ["spalle_anteriori", "tricipiti"]),
    R("(prone cobra|prone swimmer|^swimmer|nuotatore a terra)", ["lombari", "glutei"]),
    R("(tirata (all'indietro|orizzontale) con elastico)", ["dorsali", "schiena_alta"]),
    R("(apertura (posteriore|delle braccia))", ["schiena_alta", "spalle_posteriori"]),
    R("(apertura in avanti)", ["petto"]),
    R("(step-over|glute-ham developer)", ["quadricipiti", "glutei"]),
    R("(kettlebell long cycle)", ["glutei", "spalle_anteriori"]),
    // ---- avambracci e presa ----
    R("(wrist|polsi|polso|avambrac|farmer|passeggiata del contadino|suitcase|waiter|rack carry|plate pinch|pinch grip|dead hang|sospensione alla sbarra|grip crusher|wrist roller|roll up del polso|trasporto)", ["avambracci"]),
    // ---- braccia ----
    R("(tricip|french press|skull|push ?down|pushdown|kickback|estensioni sopra la testa|estensioni tricipiti|jm press|tate press|dip alla panca|dips per tricipiti|dip tra due sedie|panca presa stretta|panca con presa stretta|press con presa stretta|triceps)", ["tricipiti"]),
    R("(curl inverso|hammer curl|curl a martello|reverse curl|zottman)", ["bicipiti", "avambracci"]),
    R("(curl|bicip|biceps|preacher|scott|spider|drag curl)", ["bicipiti"]),
    // ---- spalle ----
    R("(face pull|band pull|pull-apart|pull apart|alzate posteriori|reverse pec|reverse fly|rear delt|rotazioni (esterne|interne)|y raise|t raise|w raise|alzate a (y|t|w)|croci inverse|prone (y|t|w)|\\b(y|t|w) con elastico)", ["spalle_posteriori", "schiena_alta"]),
    R("(alzate frontali|front raise)", ["spalle_anteriori"]),
    R("(alzate (laterali|frontali|a 90)|lateral raise|alzate con|front raise|macchina per le alzate)", ["spalle_laterali"]),
    R("(tirate al mento|upright row|tirata al petto con elastico)", ["spalle_laterali", "trapezio"]),
    R("(shrug|trapez|neck|collo|chin tuck|cervical)", ["trapezio"]),
    R("(handstand push|pike push|verticale|handstand|wall walk|planche|bradford|behind the neck)", ["spalle_anteriori", "tricipiti"]),
    R("(military|shoulder press|arnold|lento (avanti|dietro)|push press|landmine press|overhead press|press sopra la testa|z press|cuban|spalle|macchina per le spalle|bottoms-up|turkish|get-up|press con disco sopra|half-kneeling landmine)", ["spalle_anteriori", "spalle_laterali", "tricipiti"]),
    // ---- schiena ----
    R("(scapular|scapolar|serratus|dentato|wall slide|retrazion|protrazion|elevazion)", ["schiena_alta"]),
    R("(muscle-up|muscle up)", ["dorsali", "tricipiti"]),
    R("(front lever|back lever|skin the cat)", ["dorsali", "addome"]),
    R("(rope climb|salita (alla|della) fune|salita alla corda|peg board)", ["dorsali", "bicipiti"]),
    R("(straight arm|braccia tese|pullover ai cavi|pullover alla macchina|pullover machine)", ["dorsali"]),
    R("(pullover)", ["petto", "dorsali"]),
    R("(trazion|pull-up|pull up|chin-up|chin up|lat machine|lat pulldown|pulldown|macchina per i dorsali|assisted pull|toes to bar kipping|kipping pull|butterfly pull|chest to bar|chest-to-bar)", ["dorsali", "bicipiti"]),
    R("(rematore|row|pulley|t-bar|pendlay|yates|kroc|meadows|gorilla|renegade|low row|seated row|high row|iso-lateral row|hammer strength row|chest supported)", ["dorsali", "schiena_alta"]),
    // ---- petto ----
    R("(croci|fly|pec deck|pectoral|cable crossover|chest fly|pec fly|macchina per il petto)", ["petto"]),
    R("(dip|dips|parallele|ring dip|bar dip|korean dip)", ["petto", "tricipiti"]),
    R("(panca|bench|chest press|distensioni|floor press|svend|spoto|guillotine|pin press|board press|flession|push-up|push up|burpee con flessione|press con disco)", ["petto", "tricipiti"]),
    // ---- olimpico, kettlebell e funzionale ----
    R("(kettlebell swing|swing con kettlebell|swing americano|swing russo|swing a)", ["glutei", "femorali"]),
    R("(clean|snatch|jerk|strappo|slancio|muscle clean|high pull|sumo deadlift high pull|hang)", ["glutei", "quadricipiti", "trapezio"]),
    R("(medicine ball|palla medica|slam|ball slam|lancio)", ["addome", "spalle_anteriori"]),
    R("(battle rope|corde pesanti)", ["spalle_anteriori"]),
    R("(devil press|man maker|burpee|sprawl|squat thrust)", []),
    R("(windmill|halo)", ["spalle_laterali", "obliqui"]),
    R("(good morning|hip hinge)", ["femorali", "lombari"]),
  ];

  // Restituisce i muscoli principali (id) di un esercizio, in ordine di importanza. [] se nessuno in particolare.
  function muscoliDi(nome) {
    const n = normalizza(nome);
    if (!n) return [];
    for (const [re, m] of REGOLE) if (re.test(n)) return m.slice();
    return [];
  }

  return { MUSCOLI, ID, REGOLE, muscoliDi, normalizza };
});
