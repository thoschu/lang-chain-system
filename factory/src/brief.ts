// Das Eingangstor der Fabrik: npm run brief -- briefs/unser-projekt.md
//
// Dieselbe Bauform wie die große Fabrik, nur mit zwei Knoten:
//
//     START → triage → check → Ende
//             (Modell)  (kein Modell)
//
// Ein Modellknoten, der urteilt, und dahinter ein Tor, das nicht urteilt,
// sondern zählt. Das ist das Muster, das im ganzen Abend wiederkommt.
//
// Warum es das überhaupt gibt: Ein Fabriklauf dauert 18 Minuten und kostet
// rund 5 $. Er auf einen unklaren Auftrag anzusetzen, ist die teuerste Art,
// eine offene Frage zu stellen. Dieser Lauf hier dauert eine Minute.

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { StateGraph, START, END } from '@langchain/langgraph';
import { BriefState } from './brief-state.js';
import { triageNode } from './nodes/triage.js';
import { checkNode } from './nodes/check.js';
import { blockingOpen, parseBrief } from './brief-parse.js';
import { allSpans } from './trace.js';
import { renderTimeline } from './trace-show.js';

export function buildIntake(root: string) {
  return new StateGraph(BriefState)
    .addNode('triage', triageNode(root))
    .addNode('check', checkNode())
    .addEdge(START, 'triage')
    .addEdge('triage', 'check')
    .addEdge('check', END)
    .compile();
}

/**
 * Löst einen Pfad so auf, wie ein Mensch ihn meint: erst gegen das Verzeichnis,
 * aus dem gestartet wurde, dann gegen die Projektwurzel. Sonst hängt es davon
 * ab, ob man in factory/ steht oder daneben.
 */
function findFile(argument: string, root: string): string | undefined {
  for (const candidate of [
    isAbsolute(argument) ? argument : resolve(process.cwd(), argument),
    resolve(root, argument)
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

const root = resolve(import.meta.dirname, '..', '..');
const argument = process.argv[2];

if (!argument) {
  console.error(`
Aufruf: npm run brief -- briefs/unser-projekt.md

Das Eingangstor liest euren Projekt-Brief, zerlegt ihn in Arbeitspakete und
schreibt die offenen Fragen hinein. Beantwortet werden sie von euch.
`);
  process.exit(1);
}

const input = findFile(argument, root);
if (!input) {
  console.error(`Brief nicht gefunden: ${argument}`);
  process.exit(1);
}

if (input.endsWith('.geprueft.md')) {
  console.error(`
Das ist schon ein geprüfter Brief. Ein zweiter Durchlauf würde eure Antworten
überschreiben. Gebt den ursprünglichen Brief an - oder startet direkt:

  npm run factory -- --brief ${argument} --paket 1
`);
  process.exit(1);
}

const briefText = await readFile(input, 'utf8');
const output = join(dirname(input), `${basename(input).replace(/\.md$/, '')}.geprueft.md`);

console.log(`\nEingangstor: ${basename(input)}\n`);

const result = await buildIntake(root).invoke({ briefText });
await writeFile(output, `${result.annotated}\n`);

console.log('--- Ablauf ---\n');
renderTimeline(allSpans());

if (!result.formatOk) {
  console.error(`
Das Tor konnte sein eigenes Ergebnis nicht lesen - keine Zeile "## Arbeitspaket N"
gefunden. Der Text liegt trotzdem in ${basename(output)}. Schaut hinein: meist
fehlt nur die Überschrift. Ausbessern und weiter, oder noch einmal starten.
`);
  process.exit(1);
}

const { packages } = parseBrief(result.annotated);

console.log(`\n--- ${basename(output)} ---\n`);
for (const pkg of packages) {
  const open = blockingOpen(pkg);
  console.log(`Arbeitspaket ${pkg.number} — ${pkg.title}`);
  for (const question of open) console.log(`   [blockierend] ${question.label}  ${question.text}`);
  if (open.length === 0) console.log('   keine blockierenden Fragen');
}

console.log(`
Beantwortet die blockierenden Fragen in ${basename(output)} - direkt hinter
"Antwort:". Danach:

  npm run factory -- --brief ${argument.replace(/\.md$/, '')}.geprueft.md --paket 1
`);
