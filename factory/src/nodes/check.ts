// Knoten 2 des Eingangstors: prüft das Ergebnis der Triage. Kein Modell.
//
// Auch der Prüfer wird geprüft. Der triage-Knoten ist ein Sprachmodell und
// kann das vereinbarte Format verfehlen. Wenn das passiert, soll es hier
// auffallen - in einer Zehntelsekunde - und nicht achtzehn Minuten später,
// wenn der Fabriklauf mit einem leeren Auftrag losgelaufen ist.
//
// Es ist derselbe Parser, den run.ts vor jedem Lauf benutzt.

import { withSpan } from '../trace.js';
import { blockingOpen, parseBrief } from '../brief-parse.js';
import type { BriefStateType } from '../brief-state.js';

export function checkNode() {
  return async (state: BriefStateType) =>
    withSpan('check', 0, async () => {
      const { packages } = parseBrief(state.annotated);
      const blocking = packages.reduce((sum, pkg) => sum + blockingOpen(pkg).length, 0);
      const formatOk = packages.length > 0;

      return {
        result: { packageCount: packages.length, blockingCount: blocking, formatOk },
        note: formatOk
          ? `${packages.length} Arbeitspakete, ${blocking} blockierende Fragen`
          : 'Format nicht lesbar - kein Arbeitspaket gefunden'
      };
    });
}
