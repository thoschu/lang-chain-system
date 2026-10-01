// Startet die Fabrik.
//
//   npm run factory -- "Mitglieder anlegen und Kontostand sehen"
//   npm run factory -- --brief briefs/unser-projekt.geprueft.md --paket 1
//
// Die zweite Form geht durchs Eingangstor: Sie nimmt ein Arbeitspaket aus dem
// geprüften Brief - mitsamt euren Antworten auf die offenen Fragen. Stehen dort
// noch unbeantwortete ★-Fragen, startet der Lauf gar nicht erst. Das kostet
// eine Zehntelsekunde statt achtzehn Minuten und fünf Dollar.
//
// --trotzdem startet ihn doch. Die offenen Fragen werden dann als Annahmen
// mitgegeben und stehen im Trace. Das Tor hält euch nie auf - es macht den
// Preis nur sichtbar, bevor ihr ihn zahlt.

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, isAbsolute, resolve } from 'node:path';
import { buildFactory } from './graph.js';
import { assumedOpen, blockingOpen, parseBrief } from './brief-parse.js';
import { verdictText } from './verdict-text.js';
import { allSpans, exportSpans, withSpan } from './trace.js';
import { renderTimeline } from './trace-show.js';

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

const argv = process.argv.slice(2);

function option(name: string): string | undefined {
  const index = argv.indexOf(`--${name}`);
  return index === -1 ? undefined : argv[index + 1];
}

const briefArgument = option('brief');
const anyway = argv.includes('--trotzdem');

const root = resolve(import.meta.dirname, '..', '..');

let feature: string;
let label: string;
let intakeNote = 'ohne Eingangstor - Feature direkt auf der Kommandozeile';

if (briefArgument) {
  const path = findFile(briefArgument, root);
  if (!path) {
    console.error(`Brief nicht gefunden: ${briefArgument}`);
    process.exit(1);
  }

  const { packages } = parseBrief(await readFile(path, 'utf8'));
  if (packages.length === 0) {
    console.error(`
In ${basename(path)} steht kein Arbeitspaket. Der Brief war noch nicht durchs
Eingangstor:

  npm run brief -- ${briefArgument}
`);
    process.exit(1);
  }

  const wanted = Number(option('paket') ?? '1');
  const pkg = packages.find((entry) => entry.number === wanted);
  if (!pkg) {
    console.error(
      `\nArbeitspaket ${wanted} gibt es nicht. Vorhanden:\n` +
        packages.map((entry) => `  --paket ${entry.number}   ${entry.title}`).join('\n') +
        '\n'
    );
    process.exit(1);
  }

  const blocking = blockingOpen(pkg);
  if (blocking.length > 0 && !anyway) {
    console.error(
      `\nDas Eingangstor hält den Lauf auf. ${blocking.length} blockierende Frage(n) ` +
        `in Arbeitspaket ${pkg.number} sind unbeantwortet:\n\n` +
        blocking.map((q) => `  ${q.label}  ${q.text}`).join('\n') +
        `\n\nBeantwortet sie in ${basename(path)} direkt hinter "Antwort:".\n` +
        'Bewusst ohne Antwort losfahren: dasselbe Kommando mit --trotzdem.\n'
    );
    process.exit(1);
  }

  const assumed = [...assumedOpen(pkg), ...(anyway ? blocking : [])];
  const hint =
    assumed.length === 0
      ? ''
      : '\n\nZu diesen Fragen gibt es keine Antwort. Triff je eine vernünftige, ' +
        'einfache Annahme und schreibe sie ausdrücklich in die Spec:\n' +
        assumed.map((q) => `- ${q.label} ${q.text}`).join('\n');

  feature = `${pkg.body}${hint}`;
  label = `Arbeitspaket ${pkg.number} — ${pkg.title}`;
  intakeNote =
    `${pkg.questions.length - blocking.length - assumedOpen(pkg).length} beantwortet, ` +
    `${assumed.length} Annahme(n)${blocking.length > 0 && anyway ? ', davon blockierend übergangen' : ''}`;
} else {
  feature = argv.filter((part) => !part.startsWith('--')).join(' ').trim();
  if (!feature) {
    console.error(`
Aufruf:
  npm run factory -- "Mitglieder anlegen und Kontostand sehen"
  npm run factory -- --brief briefs/unser-projekt.geprueft.md --paket 1
`);
    process.exit(1);
  }
  label = feature;
}

const runId = new Date().toISOString().replace(/[:.]/g, '-');

console.log(`\nFabrik läuft: ${label}\n`);

// Das Eingangstor als erste Zeile im Trace. Es hat kein Modell gebraucht und
// keine Sekunde gekostet - genau das soll man in Baustein 4 sehen können.
await withSpan('intake', 0, async () => ({ result: null, note: intakeNote }));

const factory = buildFactory(root);
const result = await factory.invoke({ feature });

console.log('\n--- Urteil des Reviewers ---\n');
console.log(verdictText(result.verdict, result.gateGreen, result.attempt));

const path = await exportSpans(root, runId, label);
console.log('\n--- Trace ---\n');
renderTimeline(allSpans());
console.log(`\nTrace gespeichert: ${path}`);
console.log(result.gateGreen ? 'Tor: grün' : `Tor: rot nach ${result.attempt} Versuchen`);
