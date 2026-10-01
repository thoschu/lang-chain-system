// Ein Worker ist ein Claude-Code-Lauf, den die Fabrik startet.
//
// Wichtig: Der Worker arbeitet im Projektordner und liest von dort automatisch
// euer .claude/-Verzeichnis - Skill, Subagenten, Commands. Was ihr in Baustein 1
// konfiguriert, wirkt deshalb hier, ohne dass die Fabrik davon etwas wissen muss.

import { query } from '@anthropic-ai/claude-agent-sdk';

export type WorkerRequest = {
  prompt: string;
  root: string;
  /** Nur diese Werkzeuge sind erlaubt. Weglassen heißt: alle. */
  tools?: string[];
  /** Name eines Subagenten aus .claude/agents/, der den Auftrag übernimmt. */
  subagent?: string;
  maxTurns?: number;
  /** Reißleine: bricht ab, wenn der geschätzte Preis überschritten wird. */
  maxBudgetUsd?: number;
};

export type WorkerResult = {
  text: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  turns: number;
};

export async function runWorker(request: WorkerRequest): Promise<WorkerResult> {
  const stream = query({
    prompt: request.prompt,
    options: {
      cwd: request.root,
      model: 'claude-opus-5',
      permissionMode: 'bypassPermissions',
      allowedTools: request.tools,
      agent: request.subagent,
      maxTurns: request.maxTurns ?? 30,
      maxBudgetUsd: request.maxBudgetUsd ?? 3
    }
  });

  let text = '';
  let tokensIn = 0;
  let tokensOut = 0;
  let costUsd = 0;
  let turns = 0;

  for await (const message of stream) {
    if (message.type !== 'result') continue;

    turns = message.num_turns;
    text = message.subtype === 'success' ? message.result : `Worker abgebrochen (${message.subtype}).`;

    // modelUsage ist laut SDK die richtige Quelle fürs Token-Konto: es zählt
    // auch Subagenten mit, anders als das schlichtere usage-Feld.
    costUsd = message.total_cost_usd ?? 0;
    tokensIn = 0;
    tokensOut = 0;
    for (const usage of Object.values(message.modelUsage ?? {})) {
      tokensIn += usage.inputTokens + usage.cacheReadInputTokens;
      tokensOut += usage.outputTokens;
    }
  }

  return { text, tokensIn, tokensOut, costUsd, turns };
}
