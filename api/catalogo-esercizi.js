// L'elenco di partenza degli esercizi: lo stesso per tutti i trainer. Solo NOMI (niente video, niente immagini, niente dati di nessuno).
// Si propone dopo gli esercizi del trainer stesso (libreria.js, cercaConCatalogo). Per aggiungerne uno basta una riga qui sotto.
// Regola dei nomi: in italiano quando esiste un nome d'uso comune; se in palestra si dice in inglese (Hip thrust, Face pull) resta inglese.
const GRUPPI = {
  gambe: [
    "Squat", "Squat con bilanciere", "Back squat", "Front squat", "Squat bulgaro", "Squat con manubri", "Goblet squat", "Squat al multipower",
    "Squat alla Smith machine", "Squat a corpo libero", "Squat con salto", "Squat sumo", "Squat con pausa", "Box squat", "Overhead squat", "Zercher squat",
    "Pistol squat", "Hack squat", "Hack squat alla macchina", "Pendulum squat", "Belt squat", "Sissy squat",
    "Leg press", "Leg press 45°", "Leg press orizzontale", "Leg press a una gamba", "Leg extension", "Leg extension a una gamba",
    "Leg curl seduto", "Leg curl sdraiato", "Leg curl in piedi", "Nordic hamstring curl", "Glute ham raise",
    "Affondi", "Affondi camminati", "Affondi sul posto", "Affondi indietro", "Affondi laterali", "Affondi con manubri", "Affondi con bilanciere", "Affondi alla Smith machine",
    "Step-up", "Step-up con manubri", "Step-up laterale", "Stacco rumeno", "Stacco rumeno con manubri", "Stacco a gambe tese", "Stacco a una gamba",
    "Good morning", "Adductor machine", "Abductor machine", "Adduttori ai cavi", "Abduzioni ai cavi", "Abduzione dell'anca con elastico",
    "Calf in piedi", "Calf in piedi alla macchina", "Calf seduto", "Calf alla leg press", "Calf a una gamba", "Calf alla Smith machine", "Salti sulle punte", "Tibiale con elastico",
    "Wall sit", "Squat isometrico al muro", "Alzate sulle punte",
  ],
  glutei: [
    "Hip thrust", "Hip thrust con bilanciere", "Hip thrust con manubrio", "Hip thrust a una gamba", "Hip thrust alla macchina", "Hip thrust alla Smith machine", "Hip thrust con elastico",
    "Glute bridge", "Glute bridge a una gamba", "Ponte per glutei", "Glute kickback ai cavi", "Glute kickback alla macchina", "Kickback a quattro zampe",
    "Calci posteriori ai cavi", "Donkey kick", "Fire hydrant", "Clamshell", "Clamshell con elastico", "Monster walk con elastico", "Camminata laterale con elastico",
    "Frog pump", "Cable pull-through", "Pull-through ai cavi", "Reverse hyperextension", "Hyperextension 45°", "Hyperextension a 90°", "Back extension", "Back extension alla macchina",
    "Squat sumo con manubrio", "Stacco sumo", "Stacco con trap bar", "Stacco da terra", "Stacco da terra con bilanciere", "Stacco con kettlebell", "Stacco da deficit", "Rack pull",
  ],
  petto: [
    "Panca piana", "Panca piana con bilanciere", "Panca piana con manubri", "Panca inclinata", "Panca inclinata con bilanciere", "Panca inclinata con manubri",
    "Panca declinata", "Panca declinata con bilanciere", "Panca declinata con manubri", "Panca piana alla Smith machine", "Panca inclinata alla Smith machine", "Panca con presa stretta", "Floor press",
    "Distensioni con manubri", "Chest press", "Chest press orizzontale", "Chest press inclinata", "Chest press declinata", "Chest press convergente",
    "Croci con manubri", "Croci su panca inclinata", "Croci ai cavi", "Croci ai cavi alti", "Croci ai cavi bassi", "Cable crossover", "Cable crossover alto", "Cable crossover basso",
    "Pec deck", "Pectoral machine", "Pullover con manubrio", "Pullover ai cavi", "Pullover alla macchina",
    "Flessioni", "Flessioni sulle ginocchia", "Flessioni con piedi sollevati", "Flessioni diamante", "Flessioni con battito", "Flessioni sugli anelli", "Flessioni a una mano",
    "Dip alle parallele", "Dip alla macchina", "Dip alle parallele assistiti", "Svend press", "Landmine press",
  ],
  schiena: [
    "Trazioni alla sbarra", "Trazioni presa prona", "Trazioni presa supina", "Trazioni presa neutra", "Trazioni presa larga", "Trazioni assistite", "Trazioni alla macchina assistita", "Trazioni negative", "Australian pull-up", "Trazioni agli anelli",
    "Lat machine", "Lat machine presa larga", "Lat machine presa stretta", "Lat machine presa inversa", "Lat machine presa neutra", "Lat machine a una mano", "Lat machine dietro la nuca",
    "Pulley", "Pulley basso", "Pulley basso presa stretta", "Pulley basso presa larga", "Pulley con corda", "Pulley a una mano",
    "Rematore con bilanciere", "Rematore con bilanciere presa inversa", "Rematore con manubrio", "Rematore a un braccio con manubrio", "Rematore su panca inclinata", "Rematore al cavo basso",
    "Rematore alla macchina", "Low row", "Low row alla macchina", "Seated row", "Seated row alla macchina", "High row alla macchina", "T-bar row", "T-bar row alla macchina", "Rematore Pendlay", "Rematore Yates", "Rematore al multipower", "Rematore con kettlebell", "Rematore agli anelli",
    "Pullover ai cavi con braccia tese", "Straight arm pulldown", "Face pull", "Face pull ai cavi", "Face pull con elastico", "Pullover alla macchina",
    "Shrug con bilanciere", "Shrug con manubri", "Shrug alla macchina", "Shrug al multipower",
    "Superman", "Superman a terra", "Lombari alla macchina", "Estensioni lombari", "Bird dog", "Hyperextension",
  ],
  spalle: [
    "Military press", "Shoulder press", "Shoulder press con manubri", "Shoulder press con bilanciere", "Shoulder press alla macchina", "Shoulder press alla Smith machine", "Arnold press",
    "Lento avanti", "Lento dietro", "Push press", "Landmine press", "Alzate laterali", "Alzate laterali con manubri", "Alzate laterali ai cavi", "Alzate laterali alla macchina", "Lateral raise alla macchina",
    "Alzate frontali", "Alzate frontali con manubri", "Alzate frontali con bilanciere", "Alzate frontali ai cavi", "Alzate frontali con disco",
    "Alzate a 90°", "Alzate posteriori", "Alzate posteriori con manubri", "Alzate posteriori ai cavi", "Reverse pec deck", "Reverse fly alla macchina", "Rear delt fly",
    "Tirate al mento", "Tirate al mento con bilanciere", "Tirate al mento con manubri", "Tirate al mento ai cavi", "Rotazioni esterne con elastico", "Rotazioni esterne ai cavi", "Rotazioni interne ai cavi", "Rotazioni esterne con manubrio", "Y raise", "T raise", "W raise",
    "Bottoms-up press con kettlebell", "Turkish get-up", "Overhead press con kettlebell", "Handstand push-up",
  ],
  bicipiti: [
    "Curl con bilanciere", "Curl con bilanciere EZ", "Curl con manubri", "Curl alternato con manubri", "Curl a martello", "Hammer curl", "Hammer curl ai cavi",
    "Curl su panca inclinata", "Curl concentrato", "Curl alla panca Scott", "Preacher curl", "Preacher curl con manubrio", "Curl alla macchina", "Curl ai cavi", "Curl ai cavi bassi", "Curl ai cavi alti",
    "Curl con corda", "Curl inverso", "Curl inverso con bilanciere", "Curl 21", "Curl di Zottman", "Spider curl", "Drag curl", "Curl con elastico", "Curl al cavo a una mano", "Curl alla Scott alla macchina",
  ],
  tricipiti: [
    "French press", "French press con bilanciere EZ", "French press con manubrio", "French press ai cavi", "Skull crusher", "Pushdown ai cavi", "Pushdown con corda", "Pushdown con barra dritta", "Pushdown con barra a V", "Pushdown a una mano",
    "Estensioni sopra la testa", "Estensioni sopra la testa con manubrio", "Estensioni sopra la testa ai cavi", "Estensioni dietro la nuca", "Kickback per tricipiti", "Kickback ai cavi",
    "Dip alla panca", "Dip alle parallele per tricipiti", "Dip alla macchina per tricipiti", "Panca presa stretta", "Close grip bench press", "Tricipiti alla macchina", "Tate press", "JM press", "Pushdown con elastico", "Flessioni a gomiti stretti",
  ],
  avambracci: ["Wrist curl", "Reverse wrist curl", "Farmer walk", "Passeggiata del contadino", "Dead hang", "Sospensione alla sbarra", "Pinch grip", "Rotazione del polso con bilanciere"],
  addome: [
    "Crunch", "Crunch a terra", "Crunch inverso", "Crunch alla macchina", "Crunch ai cavi", "Crunch con piedi sollevati", "Crunch bicicletta", "Crunch obliquo", "Sit-up", "Sit-up con zavorra", "V-up", "Jackknife",
    "Plank", "Plank frontale", "Plank laterale", "Plank con tocco di spalla", "Plank con salita e discesa", "Plank sulle mani", "Plank dinamico", "Hollow hold", "Hollow body rock", "Dead bug", "Bird dog",
    "Sollevamento gambe", "Sollevamento gambe alla sbarra", "Sollevamento ginocchia alla sbarra", "Sollevamento gambe in verticale", "Sollevamento gambe a terra", "Toes to bar", "Knee raise alla sedia romana", "Leg raise",
    "Russian twist", "Russian twist con peso", "Torsione del busto ai cavi", "Torsione del busto alla macchina", "Pallof press", "Pallof press ai cavi", "Pallof press con elastico", "Woodchopper", "Woodchopper ai cavi", "Taglialegna",
    "Ab wheel", "Rollout con ruota", "Rollout con bilanciere", "Mountain climber", "Scalatori", "Flutter kick", "Forbice", "Scissor kick", "Tocco dei talloni", "Inclinazioni laterali con manubrio", "Side bend",
    "Vacuum addominale", "Bear crawl", "Camminata dell'orso", "Hanging windshield wiper", "Dragon flag", "L-sit", "Suitcase carry",
  ],
  polpacci_cardio: [
    "Tapis roulant", "Corsa sul tapis roulant", "Camminata inclinata sul tapis roulant", "Cyclette", "Cyclette in piedi", "Ellittica", "Vogatore", "Rower", "Stepper", "Scala (stair climber)", "Assault bike", "Air bike", "Ski erg",
    "Corsa", "Corsa a ritmo lento", "Corsa a intervalli", "Sprint", "Sprint in salita", "Camminata veloce", "Camminata in salita", "Bicicletta", "Nuoto", "Salto con la corda", "Corda navale (battle rope)", "Slam ball", "Sled push", "Sled pull", "Trascinamento della slitta",
  ],
  funzionale: [
    "Kettlebell swing", "Kettlebell swing a una mano", "Kettlebell goblet squat", "Clean con kettlebell", "Snatch con kettlebell", "Kettlebell press", "Kettlebell deadlift", "Kettlebell windmill", "Kettlebell halo",
    "Burpees", "Burpees con salto", "Jumping jack", "Salti sul box", "Box jump", "Box step-up", "Salto in lungo da fermo", "Skip", "Corsa balzata", "Salti laterali", "Salti a ginocchia alte",
    "Thruster", "Thruster con manubri", "Wall ball", "Clean", "Power clean", "Hang clean", "Clean and jerk", "Snatch", "Power snatch", "Strappo", "Slancio", "Push jerk", "Split jerk", "Muscle-up", "Rope climb", "Salita alla fune",
    "Medicine ball slam", "Lancio della palla medica", "Lancio dalla posizione di squat", "Rotazione con palla medica", "Sandbag carry", "Sandbag squat", "Sandbag clean", "Carry con manubri", "Overhead carry", "Trasporto con bilanciere",
    "Bear crawl", "Crab walk", "Camminata del granchio", "Camminata dell'orso", "Inchworm", "Spiderman climb", "Skater", "Pattinatore laterale", "Salto con ginocchia al petto", "Scaletta di agilità", "Agility ladder", "Corsa a navetta", "Shuttle run",
  ],
  mobilita_riscaldamento: [
    "Cat cow", "Cat-camel", "Child's pose", "Posizione del bambino", "Downward dog", "Cane a testa in giù", "Cobra", "Cobra stretch", "Upward dog", "World's greatest stretch", "Hip opener", "90/90 dell'anca", "Hip circles", "Cerchi con le anche",
    "Rotazioni delle spalle", "Rotazioni delle braccia", "Cerchi con le braccia", "Rotazioni del busto", "Rotazioni del collo", "Rotazioni delle caviglie", "Rotazioni dei polsi", "Rotazioni delle anche", "Rotazione toracica", "Thoracic rotation",
    "Arm swing", "Leg swing", "Slanci della gamba in avanti", "Slanci della gamba laterali", "Walking lunge con rotazione", "Affondo con rotazione", "Affondo con braccia in alto", "Affondo laterale", "Cossack squat", "Squat profondo con pausa",
    "Mobilità della caviglia", "Mobilità dell'anca", "Mobilità della schiena", "Mobilità della spalla", "Wall slide", "Scapular push-up", "Scapular pull-up", "Band pull-apart", "Pull-apart con elastico", "Rotazioni con bastone", "Pass-through con bastone",
    "Respirazione diaframmatica", "Gambe al muro", "Foam roller per la schiena", "Foam roller per i quadricipiti", "Foam roller per i glutei", "Foam roller per i polpacci", "Rilascio miofasciale con palla",
    "Marcia sul posto", "Corsa sul posto", "Talloni ai glutei", "Ginocchia alte", "Skip", "Jumping jack",
  ],
  stretching: [
    "Stretching dei quadricipiti", "Stretching degli ischiocrurali", "Stretching dei glutei", "Stretching dei polpacci", "Stretching degli adduttori", "Stretching degli abduttori", "Stretching dei flessori dell'anca", "Stretching della schiena",
    "Stretching del petto", "Stretching delle spalle", "Stretching dei tricipiti", "Stretching dei bicipiti", "Stretching degli avambracci", "Stretching del collo", "Stretching dei dorsali", "Stretching dei lombari", "Stretching dell'ileopsoas",
    "Figura del quattro", "Pigeon pose", "Posizione del piccione", "Piegamento in avanti da seduto", "Farfalla", "Posizione della farfalla", "Torsione da sdraiati", "Supine twist", "Affondo del corridore", "Half kneeling hip flexor stretch",
  ],
  elastici_corpo_libero: [
    "Trazioni con elastico", "Squat con elastico", "Rematore con elastico", "Chest press con elastico", "Alzate laterali con elastico", "Pressa con elastico", "Pushdown con elastico", "Good morning con elastico",
    "Squat isometrico", "Hip thrust a corpo libero", "Affondi a corpo libero", "Flessioni sulle ginocchia", "Flessioni inclinate", "Flessioni declinate", "Pike push-up", "Dip tra due sedie", "Rematore invertito", "Rematore con asciugamano",
    "Squat con TRX", "Rematore al TRX", "Chest press al TRX", "Affondi al TRX", "Plank al TRX", "Curl al TRX", "Estensioni tricipiti al TRX", "Hamstring curl al TRX", "Pike al TRX",
    "Swiss ball crunch", "Swiss ball leg curl", "Swiss ball plank", "Swiss ball hyperextension", "BOSU squat", "BOSU plank", "Squat con pesi alle caviglie",
  ],
};

const ESERCIZI = [...new Set(Object.values(GRUPPI).flat())];
module.exports = { ESERCIZI };
