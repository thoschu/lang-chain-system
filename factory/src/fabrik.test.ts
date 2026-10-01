// Die Tests der Fabrik, die ohne Modell und ohne Netz auskommen:
//   npx tsx src/fabrik.test.ts
//
// Der Parser entscheidet, ob ein Lauf startet. Wenn er eine unbeantwortete
// Frage für beantwortet hält, ist das Tor wertlos - deshalb steht hier vor
// allem, was NICHT als Antwort zählen darf.

import { blockingOpen, assumedOpen, parseBrief } from './brief-parse.js';
import { verdictText } from './verdict-text.js';

let failed = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) return console.log(`  ok   ${name}`);
  failed++;
  console.log(`  FEHL ${name}\n       erwartet ${e}\n       war      ${a}`);
}

const brief = `# Projekt-Brief, geprüft — Getränkekasse

## Ampel

gelb — zwei Fragen offen

## Widersprüche und Lücken

- keine

## Arbeitspaket 1 — Mitglied anlegen

**Ziel:** Ein Mitglied anlegen und in der Liste sehen.

**Akzeptanzkriterien**

- [ ] Wenn ich speichere, dann sehe ich das Mitglied.

**Offene Fragen**

**★ F1 (blockierend)** Darf ein Name doppelt vorkommen?
> Antwort: Nein, der Name ist eindeutig.

**★ F2 (blockierend)** Wer darf ein Mitglied löschen?
> Antwort:

**☆ F3 (Annahme möglich)** Soll die Liste paginiert werden?
> Antwort:

## Arbeitspaket 2 — Liste sortieren

**Ziel:** Die Liste alphabetisch zeigen.

**Offene Fragen**

**★ F4 (blockierend)** Sortierung nach Vor- oder Nachname?
> Antwort: Nachname,
> ersatzweise der ganze Name.

**☆ F5 (Annahme möglich)** Groß-/Kleinschreibung beachten?
Antwort: nein

## Anhang

Nichts weiter.
`;

const { packages } = parseBrief(brief);

check('zwei Arbeitspakete', packages.map((p) => p.number), [1, 2]);
check('Titel gelesen', packages[0].title, 'Mitglied anlegen');
check('Anhang gehört zu keinem Paket', packages[1].body.includes('Nichts weiter'), false);
check('Paket 1 hat drei Fragen', packages[0].questions.length, 3);
check('Antwort auf derselben Zeile', packages[0].questions[0].answer, 'Nein, der Name ist eindeutig.');
check('leere Antwort bleibt leer', packages[0].questions[1].answer, '');
check('blockierend offen in Paket 1', blockingOpen(packages[0]).map((q) => q.label), ['F2']);
check('Annahme offen in Paket 1', assumedOpen(packages[0]).map((q) => q.label), ['F3']);
check('mehrzeilige Antwort', packages[1].questions[0].answer, 'Nachname, ersatzweise der ganze Name.');
check('Antwort ohne >', packages[1].questions[1].answer, 'nein');
check('Paket 2 ist frei', blockingOpen(packages[1]).length, 0);

// Die gefährlichen Fälle: was nach einem leeren "Antwort:" kommt, darf nie
// als Antwort durchgehen. Sonst startet die Fabrik auf einer Überschrift.
const traps = parseBrief(`## Arbeitspaket 1 — Falle

**★ F1 (blockierend)** Offen, danach eine Überschrift?
> Antwort:

### Zwischenüberschrift

**★ F2 (blockierend)** Offen, danach eine Liste?
> Antwort:
- [ ] ein Akzeptanzkriterium

**★ F3 (blockierend)** Offen, danach fett?
> Antwort:
**Akzeptanzkriterien**

**★ F4 (blockierend)** Offen, danach direkt die nächste Frage?
> Antwort:
**★ F5 (blockierend)** Und diese ist beantwortet.
> Antwort: ja
`);

check(
  'nichts davon zählt als Antwort',
  blockingOpen(traps.packages[0]).map((q) => q.label),
  ['F1', 'F2', 'F3', 'F4']
);
check('F5 gilt als beantwortet', traps.packages[0].questions[4].answer, 'ja');

// Ein Brief, der nie durchs Tor gegangen ist: kein Arbeitspaket, kein Start.
check('roher Brief hat keine Pakete', parseBrief('# Unser Projekt\n\n## 1. Was baut ihr?\n\n> Eine App.\n').packages.length, 0);

// Die Meldung unter "Urteil des Reviewers". Der mittlere Fall ist der, den
// jede Gruppe beim ersten Lauf auf main sieht: Tor gruen, aber kein
// review-Knoten im Graphen.
check('echtes Urteil wird durchgereicht', verdictText('sieht gut aus', true, 1), 'sieht gut aus');
check(
  'Tor rot',
  verdictText('', false, 3),
  '(kein Review - das Tor wurde nach 3 Versuchen nicht grün)'
);
check(
  'Tor gruen, aber kein review-Knoten',
  verdictText('', true, 1).includes('hängt noch nicht im Graphen'),
  true
);
check('Tor gruen nennt nicht faelschlich ein rotes Tor', verdictText('', true, 1).includes('nicht grün'), false);

console.log(failed === 0 ? '\nAlles gruen\n' : `\n${failed} Fehler\n`);
process.exit(failed === 0 ? 0 : 1);
