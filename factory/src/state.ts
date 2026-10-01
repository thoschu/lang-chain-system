 // Der Zustand, den die Knoten der Fabrik untereinander weiterreichen.
// Jeder Knoten bekommt ihn ganz und gibt nur die Felder zurück, die er ändert.
//
// Achtung: Kein Feldname darf so heißen wie ein Knoten im Graphen - LangGraph
// verwechselt sonst Knoten und Zustand und bricht beim Start ab. Deshalb heißt
// das Feld 'specification' und nicht 'spec', 'verdict' und nicht 'review'.

import { StateSchema } from '@langchain/langgraph';
import { z } from 'zod/v4';

export const FactoryState = new StateSchema({
  /** Das Feature in einem Satz - kommt aus eurem Projekt-Brief. */
  feature: z.string(),
  /** Die Spec, die der spec-Knoten erarbeitet hat. */
  specification: z.string().default(''),
  /** Welcher Implementierungsversuch gerade läuft. Startet bei 0. */
  attempt: z.number().default(0),
  /** Stand des Qualitätstors nach dem letzten verify-Knoten. */
  gateGreen: z.boolean().default(false),
  /** Die Fehlerzeilen aus dem Tor, damit der nächste Versuch sie kennt. */
  gateOutput: z.string().default(''),
  /** Das Urteil des Review-Knotens. */
  verdict: z.string().default('')
});

export type FactoryStateType = typeof FactoryState.State;
