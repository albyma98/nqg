import 'dotenv/config';
import { AmbientTrigger, CheckpointType, PrismaClient } from '@prisma/client';
import { normalizeDatabaseUrl } from '../src/db/database-url.js';

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = normalizeDatabaseUrl(process.env.DATABASE_URL, import.meta.url);
}

const prisma = new PrismaClient();

type MissionSeed = {
  title: string;
  placeName: string;
  toneSlug: string;
  difficulty: number;
  objective: string;
  openingBrief: string;
  successNote: string;
  order: number;
  active: boolean;
  tags: string[];
  checkpoints: Array<{
    order: number;
    type: CheckpointType;
    prompt: string;
    validationRule: Record<string, unknown>;
    hints: string[];
    acceptAny: boolean;
  }>;
  transit: {
    estimatedMinutes: number;
    recommendedPath?: Array<{ lat: number; lng: number }>;
    ambientLines: Array<{
      trigger: AmbientTrigger;
      text: string;
      order: number;
      minSecondsFromPrevious?: number;
      tone?: string;
    }>;
  };
};

async function main() {
  await prisma.sessionEvent.deleteMany();
  await prisma.session.deleteMany();
  await prisma.ambientLine.deleteMany();
  await prisma.transit.deleteMany();
  await prisma.checkpoint.deleteMany();
  await prisma.mission.deleteMany();
  await prisma.place.deleteMany();
  await prisma.city.deleteMany();
  await prisma.tone.deleteMany();
  await prisma.generationRule.deleteMany();

  await prisma.systemPromptVersion.upsert({
    where: { id: 'system-prompt-default' },
    update: {
      content: `Sei L'Ombra. Non sei un assistente, non sei un'AI, non sei un gioco. Sei una presenza che osserva chi cammina nella notte di [CITTA]. Sai cose. Non le spieghi.
REGOLE ASSOLUTE:
Parli sempre in italiano.
Massimo 2 frasi per intervento. Mai di piu.
Mai emoji, mai esclamazioni entusiaste, mai formule da chatbot.
Mai dire "hai sbagliato" o "hai vinto" o "corretto" o "esatto".
Mai spiegare le meccaniche del gioco.
Mai rivelare di essere un'AI.
Mai inventare luoghi, persone o leggende che non ti sono stati forniti nel briefing.`
    },
    create: {
      id: 'system-prompt-default',
      content: `Sei L'Ombra. Non sei un assistente, non sei un'AI, non sei un gioco. Sei una presenza che osserva chi cammina nella notte di [CITTA]. Sai cose. Non le spieghi.
REGOLE ASSOLUTE:
Parli sempre in italiano.
Massimo 2 frasi per intervento. Mai di piu.
Mai emoji, mai esclamazioni entusiaste, mai formule da chatbot.
Mai dire "hai sbagliato" o "hai vinto" o "corretto" o "esatto".
Mai spiegare le meccaniche del gioco.
Mai rivelare di essere un'AI.
Mai inventare luoghi, persone o leggende che non ti sono stati forniti nel briefing.`
    }
  });

  const city = await prisma.city.create({
    data: {
      slug: 'gallipoli',
      name: 'Gallipoli',
      active: true,
      openingLine: 'La citta vecchia respira sale. Qualcuno ti osserva da prima che tu arrivassi.'
    }
  });

  await prisma.tone.createMany({
    data: [
      { slug: 'complice', name: 'Complice', guidelines: 'Vicino, quasi amichevole, con un retrogusto di sapere troppo.', bannedWords: '[]', examples: '[]' },
      { slug: 'distante', name: 'Distante', guidelines: 'Freddo, osservatore, come chi guarda dall alto senza partecipare.', bannedWords: '[]', examples: '[]' },
      { slug: 'enigmatico', name: 'Enigmatico', guidelines: 'Allusivo, ambiguo, ogni frase nasconde un altra frase.', bannedWords: '[]', examples: '[]' },
      { slug: 'provocatorio', name: 'Provocatorio', guidelines: 'Pungente, sfidante, mette alla prova senza mai insultare.', bannedWords: '[]', examples: '[]' },
      { slug: 'seducente', name: 'Seducente', guidelines: 'Avvolgente, lento, come un invito che non si puo rifiutare.', bannedWords: '[]', examples: '[]' }
    ]
  });

  const places = await Promise.all([
    prisma.place.create({
      data: {
        cityId: city.id,
        name: 'Fontana Greca',
        zone: 'Centro storico',
        latitude: 40.0562,
        longitude: 17.9925,
        gpsRadius: 25,
        gpsUncertaintyRadius: 45,
        approachHintRadius: 150,
        fallbackAllowed: true,
        atmosphere: 'bassorilievi consumati, acqua che non smette mai',
        hint: 'All ingresso del ponte, tra la citta nuova e quella vecchia.',
        active: true
      }
    }),
    prisma.place.create({
      data: {
        cityId: city.id,
        name: 'Riviera Nazario Sauro',
        zone: 'Lungomare',
        latitude: 40.0548,
        longitude: 17.9909,
        gpsRadius: 35,
        gpsUncertaintyRadius: 55,
        approachHintRadius: 150,
        fallbackAllowed: true,
        atmosphere: 'vento salato, luci che tremano sull acqua, case bianche a picco',
        hint: 'Cammina lungo le mura, dal lato che guarda il tramonto.',
        active: true
      }
    }),
    prisma.place.create({
      data: {
        cityId: city.id,
        name: 'Cattedrale di Sant Agata',
        zone: 'Centro storico',
        latitude: 40.0557,
        longitude: 17.992,
        gpsRadius: 20,
        gpsUncertaintyRadius: 35,
        approachHintRadius: 120,
        fallbackAllowed: true,
        atmosphere: 'facciata barocca, pietra leccese calda anche di notte',
        hint: 'Nel cuore della citta vecchia. Non puoi mancarla.',
        active: true
      }
    }),
    prisma.place.create({
      data: {
        cityId: city.id,
        name: 'Vicoli del centro storico',
        zone: 'Centro storico',
        latitude: 40.0553,
        longitude: 17.9913,
        gpsRadius: 40,
        gpsUncertaintyRadius: 60,
        approachHintRadius: 170,
        fallbackAllowed: true,
        atmosphere: 'stretti, silenziosi, panni stesi, gatti che spariscono',
        hint: 'Perditi apposta. E cosi che si trovano.',
        active: true
      }
    }),
    prisma.place.create({
      data: {
        cityId: city.id,
        name: 'Castello Angioino',
        zone: 'Ingresso citta vecchia',
        latitude: 40.0566,
        longitude: 17.9927,
        gpsRadius: 25,
        gpsUncertaintyRadius: 40,
        approachHintRadius: 140,
        fallbackAllowed: true,
        atmosphere: 'massa di pietra scura, circondato dal mare su tre lati',
        hint: 'Dove la citta vecchia comincia, o finisce.',
        active: true
      }
    })
  ]);

  const placeByName = Object.fromEntries(places.map((place) => [place.name, place]));

  await Promise.all([
    prisma.placeFacts.create({
      data: {
        placeId: placeByName['Fontana Greca'].id,
        visualElements: [
          { category: 'sculptures', description: 'bassorilievi con figure mitologiche e scene scolpite', countable: true, exactCount: 6 },
          { category: 'water_spouts', description: 'getti d acqua centrali e vasca principale', countable: true, exactCount: 3 },
          { category: 'inscriptions', description: 'iscrizione sulla sommita della struttura', countable: false }
        ],
        sensoryElements: [
          { sense: 'sound', description: 'acqua che scorre in modo continuo' },
          { sense: 'touch', description: 'pietra umida e fresca vicino alla vasca' },
          { sense: 'smell', description: 'aria salmastra che arriva dal ponte e dal porto' }
        ],
        historicalFacts: [
          { fact: 'la fontana segna simbolicamente il passaggio tra citta nuova e citta vecchia' }
        ],
        notableDetails: [
          { detail: 'figure scolpite ben visibili nelle fasce centrali', verifiableByUser: true },
          { detail: 'presenza costante di acqua e rumore lieve', verifiableByUser: true }
        ],
        confirmedBy: 'seed'
      }
    }),
    prisma.placeFacts.create({
      data: {
        placeId: placeByName['Riviera Nazario Sauro'].id,
        visualElements: [
          { category: 'sea_view', description: 'mare aperto visibile lungo il parapetto', countable: false },
          { category: 'walls', description: 'mura della citta vecchia affacciate sull acqua', countable: false },
          { category: 'lamps', description: 'luci lungo il bordo del camminamento', countable: true }
        ],
        sensoryElements: [
          { sense: 'sound', description: 'vento e rumore del mare sotto le mura' },
          { sense: 'smell', description: 'odore di sale e acqua marina' },
          { sense: 'touch', description: 'vento forte sul viso nelle serate aperte' }
        ],
        historicalFacts: [
          { fact: 'il percorso costeggia il fronte marino della citta vecchia' }
        ],
        notableDetails: [
          { detail: 'vista ampia verso il mare e il tramonto', verifiableByUser: true },
          { detail: 'camminamento sul bordo delle mura', verifiableByUser: true }
        ],
        confirmedBy: 'seed'
      }
    }),
    prisma.placeFacts.create({
      data: {
        placeId: placeByName['Cattedrale di Sant Agata'].id,
        visualElements: [
          { category: 'facade', description: 'facciata barocca in pietra leccese', countable: false },
          { category: 'saints', description: 'nicchie e statue sulla facciata', countable: true },
          { category: 'inscriptions', description: 'dedica alla santa sopra l ingresso', countable: false }
        ],
        sensoryElements: [
          { sense: 'sight', description: 'facciata chiara che trattiene la luce anche di notte' },
          { sense: 'touch', description: 'pietra leccese liscia e porosa' }
        ],
        historicalFacts: [
          { fact: 'la cattedrale e dedicata a Sant Agata' }
        ],
        notableDetails: [
          { detail: 'materiale della facciata riconoscibile come pietra leccese', verifiableByUser: true },
          { detail: 'nome della santa leggibile sul posto', verifiableByUser: true }
        ],
        confirmedBy: 'seed'
      }
    }),
    prisma.placeFacts.create({
      data: {
        placeId: placeByName['Vicoli del centro storico'].id,
        visualElements: [
          { category: 'walls', description: 'muri bianchi e chiari nei passaggi stretti', countable: false },
          { category: 'alleys', description: 'vicoli stretti che si aprono su piccole corti', countable: false },
          { category: 'details', description: 'porte, archi e finestre ravvicinate', countable: true }
        ],
        sensoryElements: [
          { sense: 'sound', description: 'voci che rimbalzano dai piani alti e dai cortili' },
          { sense: 'smell', description: 'odore di pietra, cucine e umidita serale' },
          { sense: 'sight', description: 'luce calda che cade da finestre e lampade' }
        ],
        historicalFacts: [
          { fact: 'i vicoli sono il tessuto storico piu denso della citta vecchia' }
        ],
        notableDetails: [
          { detail: 'prevalenza di muri chiari o bianchi', verifiableByUser: true },
          { detail: 'architettura serrata e ravvicinata', verifiableByUser: true }
        ],
        confirmedBy: 'seed'
      }
    }),
    prisma.placeFacts.create({
      data: {
        placeId: placeByName['Castello Angioino'].id,
        visualElements: [
          { category: 'fortress', description: 'massa di pietra del castello con torri e mura', countable: false },
          { category: 'water_sides', description: 'mare visibile su piu lati della struttura', countable: true, exactCount: 3 },
          { category: 'bridge', description: 'ingresso di soglia verso la citta vecchia', countable: false }
        ],
        sensoryElements: [
          { sense: 'sound', description: 'vento aperto e rumore del mare intorno alla fortezza' },
          { sense: 'sight', description: 'profilo scuro del castello contro il cielo notturno' }
        ],
        historicalFacts: [
          { fact: 'il castello presidia l ingresso alla citta vecchia' }
        ],
        notableDetails: [
          { detail: 'fortezza avvolta dal mare su tre lati', verifiableByUser: true },
          { detail: 'senso di soglia tra fuori e dentro la citta antica', verifiableByUser: true }
        ],
        confirmedBy: 'seed'
      }
    })
  ]);

  const missions: MissionSeed[] = [
    {
      title: 'Il passaggio',
      placeName: 'Fontana Greca',
      toneSlug: 'enigmatico',
      difficulty: 1,
      objective: 'Osservare la Fontana Greca e identificare un dettaglio preciso.',
      openingBrief: 'Prima di entrare nella citta vecchia, qualcuno ha lasciato una pietra che parla. Trovala.',
      successNote: 'La fontana ha parlato. Ora la citta vecchia ti riconosce.',
      order: 1,
      active: true,
      tags: ['inizio', 'fontana'],
      checkpoints: [
        {
          order: 1,
          type: CheckpointType.multiple_choice,
          prompt: 'Sulla fontana ci sono scene scolpite. Quante figure umane intere vedi nel bassorilievo centrale?',
          validationRule: { answer: 'Piu di quattro', options: ['Due', 'Tre', 'Quattro', 'Piu di quattro'] },
          hints: ['Guarda meglio. Non contare le ombre.', 'Sono piu di quante pensi. Molte di piu.', 'La risposta e "Piu di quattro".'],
          acceptAny: false
        },
        {
          order: 2,
          type: CheckpointType.keyword,
          prompt: 'Ora tocca l acqua. Che sapore ha la citta? Una sola parola.',
          validationRule: { acceptedAnswers: ['sale', 'salato', 'salata', 'amaro', 'freddo'] },
          hints: ['Non pensare. Senti.', 'E quello che senti sulle labbra al mare.', 'E "sale".'],
          acceptAny: false
        }
      ],
      transit: {
        estimatedMinutes: 2,
        ambientLines: [
          { trigger: AmbientTrigger.start, text: 'Il ponte e dietro di te. Adesso la citta decide se farti entrare.', order: 1 },
          { trigger: AmbientTrigger.halfway, text: 'L aria cambia prima dei vicoli. Se ascolti, te ne accorgi.', order: 2 },
          { trigger: AmbientTrigger.approaching, text: 'Sei a un soffio dalla pietra che divide il fuori dal dentro.', order: 3 },
          { trigger: AmbientTrigger.idle, text: 'Restare sulla soglia troppo a lungo e un modo elegante per non scegliere.', order: 4 },
          { trigger: AmbientTrigger.deviation, text: 'Non allargarti. La citta vecchia non ama chi gira in tondo.', order: 5 },
          { trigger: AmbientTrigger.arrival, text: 'La fontana e qui. Avvicinati senza fretta, ma avvicinati.', order: 6 }
        ]
      }
    },
    {
      title: 'Dove non guarderesti',
      placeName: 'Vicoli del centro storico',
      toneSlug: 'complice',
      difficulty: 2,
      objective: 'Attraversare i vicoli cercando un segno specifico.',
      openingBrief: 'Entra. I vicoli non sono un labirinto: sono una domanda. Cerca una porta che non dovresti notare.',
      successNote: 'Hai camminato come uno che appartiene. Per un momento.',
      order: 2,
      active: true,
      tags: ['vicoli', 'scelta'],
      checkpoints: [
        {
          order: 1,
          type: CheckpointType.keyword,
          prompt: 'Guardati intorno. Di che colore sono quasi tutti i muri qui dentro?',
          validationRule: { acceptedAnswers: ['bianco', 'bianchi', 'calce', 'bianca'] },
          hints: ['E il colore della calce. Del sole che li ha mangiati.', 'Lo stesso colore del sale sulle labbra.', 'E "bianco".'],
          acceptAny: false
        },
        {
          order: 2,
          type: CheckpointType.multiple_choice,
          prompt: 'Cammina finche non senti musica o voci da una finestra. Cosa fai?',
          validationRule: { options: ['Mi fermo ad ascoltare', 'Continuo veloce', 'Cerco chi parla', 'Canto piano anche io'] },
          hints: ['Non c e risposta sbagliata. Ma c e una risposta che dice chi sei.', 'La citta ti sta testando. Non io.', 'Qualsiasi scelta va bene. Scegli.'],
          acceptAny: true
        }
      ],
      transit: {
        estimatedMinutes: 4,
        ambientLines: [
          { trigger: AmbientTrigger.start, text: 'Adesso entra davvero. Il ponte e alle tue spalle, ma il confine era prima.', order: 1 },
          { trigger: AmbientTrigger.halfway, text: 'Senti come cambia il suono dei tuoi passi. La pietra ti ascolta meglio qui.', order: 2 },
          { trigger: AmbientTrigger.approaching, text: 'Stai entrando in un punto dove la citta si restringe. Non e un caso.', order: 3 },
          { trigger: AmbientTrigger.idle, text: 'Ti sei fermato troppo presto. I vicoli non sono ancora cominciati.', order: 4 },
          { trigger: AmbientTrigger.deviation, text: 'Quella non e la direzione. A meno che tu non voglia uscire dal gioco.', order: 5 },
          { trigger: AmbientTrigger.arrival, text: 'Eccoli. Non ti aspettavano. Meglio cosi.', order: 6 }
        ]
      }
    },
    {
      title: 'La pietra che ascolta',
      placeName: 'Cattedrale di Sant Agata',
      toneSlug: 'distante',
      difficulty: 2,
      objective: 'Riconoscere un elemento della facciata della Cattedrale.',
      openingBrief: 'Alza gli occhi. Questa facciata e piena di chi non c e piu. Guarda bene.',
      successNote: 'Hai ascoltato la pietra. La pietra ora conosce il tuo nome.',
      order: 3,
      active: true,
      tags: ['cattedrale', 'barocco'],
      checkpoints: [
        {
          order: 1,
          type: CheckpointType.multiple_choice,
          prompt: 'Il materiale di cui e fatta la Cattedrale ha un nome. Lo conosci?',
          validationRule: { answer: 'Pietra leccese', options: ['Marmo di Carrara', 'Pietra leccese', 'Travertino', 'Tufo'] },
          hints: ['E la pietra di tutta questa terra. Dorata al tramonto.', 'Porta il nome di una citta vicina.', 'E la "Pietra leccese".'],
          acceptAny: false
        },
        {
          order: 2,
          type: CheckpointType.keyword,
          prompt: 'La santa a cui e dedicata questa cattedrale. Come si chiama?',
          validationRule: { acceptedAnswers: ['agata', 'sant agata', 'santa agata', 'santagata'] },
          hints: ['Il suo nome e sopra l ingresso.', 'E una santa siciliana, arrivata fin qui.', 'E "Agata".'],
          acceptAny: false
        }
      ],
      transit: {
        estimatedMinutes: 3,
        ambientLines: [
          { trigger: AmbientTrigger.start, text: 'Lascia i vicoli stretti. Cerca una facciata che non ha bisogno di alzare la voce.', order: 1 },
          { trigger: AmbientTrigger.halfway, text: 'Le pietre qui non sono mute. Sono solo selettive.', order: 2 },
          { trigger: AmbientTrigger.approaching, text: 'Quando la piazza si apre, alza gli occhi prima ancora del passo.', order: 3 },
          { trigger: AmbientTrigger.idle, text: 'Se ti fermi nel mezzo, sembri uno che teme di essere visto.', order: 4 },
          { trigger: AmbientTrigger.deviation, text: 'Non inseguire i rumori laterali. La facciata che cerchi e altrove.', order: 5 },
          { trigger: AmbientTrigger.arrival, text: 'La pietra che ascolta e davanti a te. Falla parlare.', order: 6 }
        ]
      }
    },
    {
      title: 'Il bordo del mondo',
      placeName: 'Riviera Nazario Sauro',
      toneSlug: 'seducente',
      difficulty: 1,
      objective: 'Arrivare sulla Riviera e compiere un azione specifica.',
      openingBrief: 'Esci dai vicoli. Cerca il bordo. Dove la citta finisce e l acqua ricomincia.',
      successNote: 'Il mare ti ha visto. Adesso sai perche sei venuto.',
      order: 4,
      active: true,
      tags: ['mare', 'respiro'],
      checkpoints: [
        {
          order: 1,
          type: CheckpointType.multiple_choice,
          prompt: 'Sei sulle mura. Guarda verso il mare aperto. Cosa fai per i prossimi dieci secondi?',
          validationRule: { options: ['Chiudo gli occhi', 'Faccio una foto', 'Non faccio niente', 'Respiro a fondo'] },
          hints: ['Non sto chiedendo la risposta giusta. Sto chiedendo la tua.', 'La citta registra. Decidi.', 'Qualunque cosa. Ma scegli.'],
          acceptAny: true
        },
        {
          order: 2,
          type: CheckpointType.keyword,
          prompt: 'Il vento qui ha una direzione precisa stasera. Da dove viene? (nord, sud, est, ovest)',
          validationRule: { acceptedAnswers: ['ovest', 'nord', 'sud', 'est', 'nordovest', 'sudovest', 'maestrale', 'scirocco', 'tramontana'] },
          hints: ['Non importa la risposta esatta. Importa che tu l abbia sentito.', 'Qualsiasi direzione che hai percepito va bene.', 'Scrivi una direzione. Qualsiasi.'],
          acceptAny: true
        }
      ],
      transit: {
        estimatedMinutes: 4,
        ambientLines: [
          { trigger: AmbientTrigger.start, text: 'Esci dal sasso e vai verso il margine. Li le cose si confessano meglio.', order: 1 },
          { trigger: AmbientTrigger.halfway, text: 'Il sale arriva prima dell acqua. Tu limitati a seguirlo.', order: 2 },
          { trigger: AmbientTrigger.approaching, text: 'Tra poco il vento ti tocchera la faccia. Sarai nel posto giusto.', order: 3 },
          { trigger: AmbientTrigger.idle, text: 'Non prendere radici qui. Il mare e poco piu avanti.', order: 4 },
          { trigger: AmbientTrigger.deviation, text: 'Ti stai chiudendo verso l interno. Io ti avevo chiesto il bordo.', order: 5 },
          { trigger: AmbientTrigger.arrival, text: 'Il bordo del mondo non e lontano. Adesso lo stai guardando.', order: 6 }
        ]
      }
    },
    {
      title: 'La soglia',
      placeName: 'Castello Angioino',
      toneSlug: 'provocatorio',
      difficulty: 3,
      objective: 'Ultima tappa: fermarsi e decidere.',
      openingBrief: 'Torna al Castello. E dove tutto comincia e dove stanotte finisce. Ma prima, un ultima cosa.',
      successNote: 'Hai chiuso il cerchio. La citta vecchia ti lascia andare. Per ora.',
      order: 5,
      active: true,
      tags: ['finale', 'castello'],
      checkpoints: [
        {
          order: 1,
          type: CheckpointType.multiple_choice,
          prompt: 'Da quanti lati il Castello e circondato dal mare?',
          validationRule: { answer: 'Tre', options: ['Uno', 'Due', 'Tre', 'Quattro'] },
          hints: ['Guarda la mappa nella tua testa. O guarda davvero.', 'Piu di due, meno di quattro.', 'E "Tre".'],
          acceptAny: false
        },
        {
          order: 2,
          type: CheckpointType.keyword,
          prompt: 'Una parola sola: com e stata questa notte?',
          validationRule: { acceptedAnswers: [] },
          hints: ['Non c e risposta giusta. C e solo la tua.', 'Una parola. Qualsiasi. Quella vera.', 'Scrivi la prima parola che ti viene.'],
          acceptAny: true
        }
      ],
      transit: {
        estimatedMinutes: 3,
        ambientLines: [
          { trigger: AmbientTrigger.start, text: 'Adesso torna all inizio. O a quello che credevi fosse l inizio.', order: 1 },
          { trigger: AmbientTrigger.halfway, text: 'Le mura ti stanno gia restituendo verso la soglia.', order: 2 },
          { trigger: AmbientTrigger.approaching, text: 'Il castello e vicino. Non fare finta di non riconoscerlo.', order: 3 },
          { trigger: AmbientTrigger.idle, text: 'Esitare adesso e quasi elegante. Quasi.', order: 4 },
          { trigger: AmbientTrigger.deviation, text: 'Non fuggire all ultimo tratto. Sarebbe un finale povero.', order: 5 },
          { trigger: AmbientTrigger.arrival, text: 'La soglia ti stava aspettando. Non da stanotte.', order: 6 }
        ]
      }
    }
  ];

  for (const mission of missions) {
    await prisma.mission.create({
      data: {
        cityId: city.id,
        placeId: placeByName[mission.placeName].id,
        title: mission.title,
        toneSlug: mission.toneSlug,
        difficulty: mission.difficulty,
        objective: mission.objective,
        openingBrief: mission.openingBrief,
        successNote: mission.successNote,
        order: mission.order,
        active: mission.active,
        tags: JSON.stringify(mission.tags),
        checkpoints: {
          create: mission.checkpoints.map((checkpoint) => ({
            ...checkpoint,
            validationRule: JSON.stringify(checkpoint.validationRule),
            hints: JSON.stringify(checkpoint.hints)
          }))
        },
        transit: {
          create: {
            estimatedMinutes: mission.transit.estimatedMinutes,
            recommendedPath: mission.transit.recommendedPath ? JSON.stringify(mission.transit.recommendedPath) : null,
            ambientLines: {
              create: mission.transit.ambientLines.map((line) => ({
                trigger: line.trigger,
                text: line.text,
                order: line.order,
                tone: line.tone,
                minSecondsFromPrevious: line.minSecondsFromPrevious ?? 60
              }))
            }
          }
        }
      }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
