// Rendert einen Trace als Zeitleiste im Terminal.
// Ohne Argument: der jüngste eigene Trace. Mit Pfad: genau dieser.

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import type { Span } from './trace.js';

export function renderTimeline(spans: Span[]): void {
  if (spans.length === 0) {
    console.log('(keine Spans)');
    return;
  }

  const total = Math.max(...spans.map((s) => s.startMs + s.durationMs));
  const width = 32;

  console.log('Knoten      Versuch  Dauer    Tokens ein/aus   Kosten    Verlauf');
  for (const span of spans) {
    const from = Math.floor((span.startMs / total) * width);
    const length = Math.max(1, Math.round((span.durationMs / total) * width));
    const bar = ' '.repeat(from) + '█'.repeat(Math.min(length, width - from));
    console.log(
      `${span.node.padEnd(11)} ${String(span.attempt).padEnd(8)} ${(span.durationMs / 1000).toFixed(1).padStart(5)}s  ` +
        `${String(span.tokensIn).padStart(7)}/${String(span.tokensOut).padEnd(7)} ` +
        `$${span.costUsd.toFixed(3).padStart(6)}  ${bar}  ${span.note}`
    );
  }

  const attempts = Math.max(...spans.map((s) => s.attempt));
  const cost = spans.reduce((sum, s) => sum + s.costUsd, 0);
  console.log(
    `\nImplementierungsversuche: ${attempts} | Gesamtdauer: ${(total / 1000).toFixed(1)}s | Kosten: $${cost.toFixed(3)}`
  );
}

// Direktaufruf über npm run trace
//
//   npm run trace                                   jüngster eigener Lauf
//   npm run trace -- beispiel-traces/lauf-x.json    ein mitgelieferter Trace
//
// Pfade werden gegen die Projektwurzel aufgelöst, nicht gegen das aktuelle
// Verzeichnis - sonst haengt es davon ab, aus welchem Ordner man startet.
if (import.meta.filename === resolve(process.argv[1] ?? '')) {
  const root = resolve(import.meta.dirname, '..', '..');
  const argument = process.argv[2];

  let chosen: string;
  if (argument) {
    chosen = isAbsolute(argument) ? argument : resolve(root, 'factory', argument);
    if (!existsSync(chosen)) chosen = resolve(root, argument);
  } else {
    const dir = join(root, 'traces');
    const own = existsSync(dir)
      ? (await readdir(dir)).filter((d) => d.endsWith('.json')).sort()
      : [];
    if (own.length === 0) {
      console.log(
        '\nNoch kein eigener Trace da - der erste Lauf dauert rund 18 Minuten.\n' +
          'Bis dahin die mitgelieferten anschauen:\n\n' +
          '  npm run trace -- beispiel-traces/lauf-mit-skill.json\n' +
          '  npm run trace -- beispiel-traces/lauf-ohne-skill.json\n' +
          '  npm run trace -- beispiel-traces/lauf-mit-retry.json\n'
      );
      process.exit(0);
    }
    chosen = join(dir, own.at(-1)!);
  }

  if (!existsSync(chosen)) {
    console.error(`Trace nicht gefunden: ${chosen}`);
    process.exit(1);
  }

  const data = JSON.parse(await readFile(chosen, 'utf8'));
  console.log(`\nTrace: ${data.feature}\n${chosen}\n`);
  renderTimeline(data.spans);
}
