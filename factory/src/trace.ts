// Der Trace-Rekorder der Fabrik.
//
// Jeder Knoten legt einen Span an: wie lange er lief, wie viele Tokens er
// verbraucht hat, in welchem Versuch er lief. Am Ende landet alles als JSON in
// traces/. Das ist die Datengrundlage für Baustein 4.
//
// >> Das hier ist die Langfuse-Naht. << Wer später Langfuse anschließen will,
// tauscht exportSpans() gegen einen Langfuse-Client aus - der Rest der Fabrik
// bleibt unverändert.

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type Span = {
  node: string;
  attempt: number;
  startMs: number;
  durationMs: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  note: string;
};

export type SpanMetrics = {
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
  note?: string;
};

const spans: Span[] = [];
const runStartedAt = Date.now();

/**
 * Führt fn aus und schreibt dabei einen Span mit.
 * Was fn zurückgibt, wandert unverändert weiter - der Trace hängt nur daneben.
 */
export async function withSpan<T>(
  node: string,
  attempt: number,
  fn: () => Promise<{ result: T } & SpanMetrics>
): Promise<T> {
  const start = Date.now();
  try {
    const { result, tokensIn, tokensOut, costUsd, note } = await fn();
    spans.push({
      node,
      attempt,
      startMs: start - runStartedAt,
      durationMs: Date.now() - start,
      tokensIn: tokensIn ?? 0,
      tokensOut: tokensOut ?? 0,
      costUsd: costUsd ?? 0,
      note: note ?? ''
    });
    return result;
  } catch (error) {
    spans.push({
      node,
      attempt,
      startMs: start - runStartedAt,
      durationMs: Date.now() - start,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      note: `FEHLER: ${(error as Error).message}`
    });
    throw error;
  }
}

export function allSpans(): Span[] {
  return spans;
}

export async function exportSpans(root: string, runId: string, feature: string): Promise<string> {
  const dir = join(root, 'traces');
  await mkdir(dir, { recursive: true });
  const path = join(dir, `run-${runId}.json`);
  await writeFile(
    path,
    JSON.stringify({ runId, feature, recordedAt: new Date().toISOString(), spans }, null, 2)
  );
  return path;
}
