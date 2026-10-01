// Knoten 3: das Qualitätstor. Hier steckt kein Modell drin.
//
// Der Graph sagt, wann geprüft wird. Ob bestanden ist, entscheidet ein
// Exit-Code - nicht ein Sprachmodell. Diese Trennung ist der Grund, warum man
// dem Ergebnis trauen kann.

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { withSpan } from '../trace.js';
import type { FactoryStateType } from '../state.js';

const RELEVANT =
  /FEHLGESCHLAGEN|<<< (FAILURE|ERROR)|Tests run:.*Failures: [1-9]|expected:|AssertionError|^\s*FAIL |Tests\s+\d+ failed|×/;

export function verifyNode(root: string) {
  return async (state: FactoryStateType) =>
    withSpan('verify', state.attempt, async () => {
      const gate = spawnSync(process.execPath, [join(root, 'verify.mjs')], {
        cwd: root,
        encoding: 'utf8'
      });

      const green = gate.status === 0;
      const output = `${gate.stdout ?? ''}${gate.stderr ?? ''}`;
      const lines = output.split('\n').filter((line) => RELEVANT.test(line)).slice(0, 20);

      return {
        result: {
          gateGreen: green,
          gateOutput: green ? '' : (lines.length > 0 ? lines : output.split('\n').slice(-25)).join('\n')
        },
        note: green ? 'grün' : `rot (${lines.length} Fehlerzeilen)`
      };
    });
}
