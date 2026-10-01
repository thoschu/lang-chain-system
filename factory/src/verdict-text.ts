// Was unter "Urteil des Reviewers" steht, wenn es kein Urteil gibt.
//
// Drei Fälle, und sie zu verwechseln kostet eine Gruppe zehn Minuten Suche:
// Ein leeres Urteil heißt beim allerersten Lauf fast nie "rotes Tor", sondern
// "der review-Knoten hängt noch nicht im Graphen" - also Baustein 3.

export function verdictText(verdict: string, gateGreen: boolean, attempt: number): string {
  if (verdict) return verdict;
  if (!gateGreen) return `(kein Review - das Tor wurde nach ${attempt} Versuchen nicht grün)`;
  return (
    '(kein Review - der review-Knoten hängt noch nicht im Graphen.\n' +
    ' Das Tor war grün. Baustein 3, Teil A: src/graph.ts)'
  );
}
