// Fertige Fabrik (Musterlösung zu Baustein 3, beide Teile).
//
// Teil A: Retry-Kante und Review-Knoten.
// Teil B: ein selbstgebauter Knoten (hier: scope), der hinter dem Tor haengt
//         und ein gruenes Tor wieder rot machen darf.

import { StateGraph, START, END } from '@langchain/langgraph';
import { FactoryState, type FactoryStateType } from './state.js';
import { specNode } from './nodes/spec.js';
import { implementNode } from './nodes/implement.js';
import { verifyNode } from './nodes/verify.js';
import { reviewNode } from './nodes/review.js';
import { scopeNode } from './nodes/scope.js';

export const MAX_ATTEMPTS = 3;

/** Nach dem Tor: weiter zum Review, noch einmal implementieren oder aufgeben. */
function afterGate(state: FactoryStateType): 'implement' | 'review' | typeof END {
  if (state.gateGreen) return 'review';
  if (state.attempt < MAX_ATTEMPTS) return 'implement';
  return END;
}

export function buildFactory(root: string) {
  return new StateGraph(FactoryState)
    .addNode('spec', specNode(root))
    .addNode('implement', implementNode(root))
    .addNode('verify', verifyNode(root))
    .addNode('scope', scopeNode(root))
    .addNode('review', reviewNode(root))
    .addEdge(START, 'spec')
    .addEdge('spec', 'implement')
    .addEdge('implement', 'verify')
    // Der selbstgebaute Knoten haengt hinter dem Tor: Er darf ein gruenes Tor
    // wieder rot machen, wenn der Umfang aus dem Ruder gelaufen ist.
    .addEdge('verify', 'scope')
    .addConditionalEdges('scope', afterGate)
    .addEdge('review', END)
    .compile();
}
