// Beispiel für einen selbstgebauten Knoten (Baustein 3, zweiter Teil).
//
// Plausibilitätstor: Hat der Worker überhaupt etwas getan - und nicht zu viel?
// Kein Modell im Spiel, nur eine Zählung und zwei Grenzen. Genau so sehen
// Policy-Knoten aus: deterministisch, billig, und ihr Urteil ist nachvollziehbar.
//
// Die untere Grenze ist die wichtigere, und sie ist teuer gelernt: In einem
// Probelauf stand das Qualitätstor beim Start auf rot. Der Worker hat die rote
// Stelle repariert, sich damit für fertig gehalten und das eigentliche Feature
// nie gebaut. verify meldete grün - die Tests liefen ja - und die Fabrik hätte
// einen leeren Lauf als Erfolg verbucht. Ein Tor, das "nichts passiert" nicht
// bemerkt, ist kein Tor.

import { spawnSync } from 'node:child_process';
import { withSpan } from '../trace.js';
import type { FactoryStateType } from '../state.js';

// Grosszuegig gewaehlt: git status zaehlt kumulativ ueber alles Uncommittete.
// In Block 2 laufen zwei Features hintereinander - wer zwischendurch nicht
// committet, steht beim zweiten Lauf schon bei einem Dutzend Dateien, ohne
// etwas falsch gemacht zu haben. Ein Waechter, der falsch anschlaegt, kostet
// hier 18 Minuten.
export const MAX_FILES = 25;

export function scopeNode(root: string) {
  return async (state: FactoryStateType) =>
    withSpan('scope', state.attempt, async () => {
      const status = spawnSync('git', ['status', '--porcelain'], {
        cwd: root,
        encoding: 'utf8'
      });

      const files = (status.stdout ?? '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      const nothingHappened = files.length === 0;
      const tooMany = files.length > MAX_FILES;

      let gateOutput = state.gateOutput;
      if (nothingHappened) {
        gateOutput =
          'Am Projekt hat sich nichts geändert. Ein grünes Tor beweist hier nichts - ' +
          'es liefen nur die Tests, die vorher schon da waren.\n' +
          'Setz die Spec um. Falls dich etwas anderes aufgehalten hat: behebe es und ' +
          'bau danach trotzdem das Feature.';
      } else if (tooMany) {
        gateOutput =
          `Der Umfang ist zu groß: ${files.length} geänderte Dateien, erlaubt sind ${MAX_FILES}.\n` +
          `Nimm zurück, was nicht zur Spec gehört. Falls hier noch Ergebnisse eines\n` +
          `früheren Laufs mitzählen: die gehören committet, nicht zurückgenommen.\n\n${files.join('\n')}`;
      }

      return {
        result: {
          gateGreen: state.gateGreen && !tooMany && !nothingHappened,
          gateOutput
        },
        note: nothingHappened
          ? 'nichts geändert — kein Ergebnis'
          : `${files.length} Dateien${tooMany ? ' — zu viel' : ''}`
      };
    });
}
