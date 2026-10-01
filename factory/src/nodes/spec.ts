// Knoten 1: aus einem Satz wird eine prüfbare Spec. Schreibt nichts.

import { withSpan } from '../trace.js';
import { runWorker } from '../worker.js';
import type { FactoryStateType } from '../state.js';

export function specNode(root: string) {
  return async (state: FactoryStateType) =>
    withSpan('spec', state.attempt, async () => {
      const worker = await runWorker({
        root,
        tools: ['Read', 'Grep', 'Glob'],
        maxTurns: 20,
        prompt: `Erarbeite eine Spec für dieses Feature. Implementiere noch nichts.
Kommt es aus einem geprüften Brief, sind die Antworten des Teams auf die offenen
Fragen Teil des Auftrags - halte dich daran.

${state.feature}

Schau dir an, was im Projekt schon da ist, bevor du etwas Neues vorschlägst.

Liefere knapp:
1. Ziel in einem Satz.
2. Zwei bis drei Akzeptanzkriterien, je in der Form "Wenn ..., dann sehe ich ...".
3. Welche Dateien neu entstehen und welche geändert werden.
4. Testplan: welcher Test beweist welches Kriterium.
5. Was bewusst nicht dazugehört.

Ist das Feature zu groß für 30 Minuten, schlage einen kleineren Schnitt vor.`
      });

      return {
        result: { specification: worker.text },
        tokensIn: worker.tokensIn,
        tokensOut: worker.tokensOut,
        costUsd: worker.costUsd,
        note: `${worker.turns} Runden`
      };
    });
}
