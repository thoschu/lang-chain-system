// Knoten 2: setzt die Spec um. Der einzige Knoten, der Dateien anfassen darf.
// Beim zweiten und jedem weiteren Versuch bekommt er die Fehlerzeilen des
// Qualitätstors mit - das ist der Grund, warum die Retry-Kante überhaupt hilft.

import { withSpan } from '../trace.js';
import { runWorker } from '../worker.js';
import type { FactoryStateType } from '../state.js';

export function implementNode(root: string) {
  return async (state: FactoryStateType) => {
    const attempt = state.attempt + 1;

    return withSpan('implement', attempt, async () => {
      const rework =
        attempt > 1
          ? `\n\nDein voriger Versuch hat das Qualitätstor nicht bestanden:\n\n${state.gateOutput}\n\nBehebe genau das. Bau nichts Neues dazu.`
          : '';

      const worker = await runWorker({
        root,
        maxTurns: 60,
        maxBudgetUsd: 5,
        prompt: `Setz diese Spec um. Halte dich an die Konventionen des Projekts.

${state.specification}${rework}`
      });

      return {
        result: { attempt },
        tokensIn: worker.tokensIn,
        tokensOut: worker.tokensOut,
        costUsd: worker.costUsd,
        note: `${worker.turns} Runden`
      };
    });
  };
}
