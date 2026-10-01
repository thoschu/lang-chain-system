// Knoten 4: die zweite Meinung. Läuft als Subagent aus .claude/agents/reviewer.md
// und darf nichts ändern.

import { withSpan } from '../trace.js';
import { runWorker } from '../worker.js';
import type { FactoryStateType } from '../state.js';

export function reviewNode(root: string) {
  return async (state: FactoryStateType) =>
    withSpan('review', state.attempt, async () => {
      const worker = await runWorker({
        root,
        subagent: 'reviewer',
        tools: ['Read', 'Grep', 'Glob', 'Bash'],
        maxTurns: 25,
        prompt: `Prüfe die Änderung gegen diese Spec:

${state.specification}`
      });

      return {
        result: { verdict: worker.text },
        tokensIn: worker.tokensIn,
        tokensOut: worker.tokensOut,
        costUsd: worker.costUsd,
        note: `${worker.turns} Runden`
      };
    });
}
