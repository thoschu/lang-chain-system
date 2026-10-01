// Der Zustand des Eingangstors - dasselbe Muster wie state.ts, nur kleiner.
//
// Auch hier gilt: kein Feldname darf so heißen wie ein Knoten. Die Knoten
// heißen 'triage' und 'check', also heißt das Ergebnis 'annotated' und der
// Formatbefund 'formatOk'.

import { StateSchema } from '@langchain/langgraph';
import { z } from 'zod/v4';

export const BriefState = new StateSchema({
  /** Der Brief, wie ihn das Team geschrieben hat. */
  briefText: z.string(),
  /** Der zerlegte Brief mit offenen Fragen - das Ergebnis der Triage. */
  annotated: z.string().default(''),
  /** Wie viele Arbeitspakete der check-Knoten wiederfinden konnte. */
  packageCount: z.number().default(0),
  /** Wie viele davon blockierend sind (★). */
  blockingCount: z.number().default(0),
  /** Konnte das Programm den Text überhaupt lesen? */
  formatOk: z.boolean().default(false)
});

export type BriefStateType = typeof BriefState.State;
