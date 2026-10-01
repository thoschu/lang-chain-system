// Knoten 1 des Eingangstors: liest den Projekt-Brief und zerlegt ihn.
//
// Er sieht sich das Projekt bewusst NICHT an - deshalb dauert er eine Minute
// und nicht achtzehn. Was er prüft, ist der Auftrag, nicht der Code.
// Er schreibt auch keine Datei: der Knoten liefert Text, geschrieben wird in
// brief.ts. Ein Knoten, der prüft, soll nichts anfassen können.

import { withSpan } from '../trace.js';
import { runWorker } from '../worker.js';
import type { BriefStateType } from '../brief-state.js';

export function triageNode(root: string) {
  return async (state: BriefStateType) =>
    withSpan('triage', 0, async () => {
      const worker = await runWorker({
        root,
        tools: ['Read'],
        maxTurns: 6,
        prompt: `Du bist das Eingangstor einer Software-Fabrik. Prüfe den folgenden
Projekt-Brief und zerlege ihn in Arbeitspakete. Sieh dir das Projekt NICHT an -
du beurteilst den Auftrag, nicht den Code. Benutze keine Werkzeuge.

--- BRIEF ANFANG ---
${state.briefText}
--- BRIEF ENDE ---

Der technische Rahmen steht fest und ist für alle Gruppen derselbe. Darüber
stellst du keine Fragen:
- Backend Spring Boot 3.5 auf Java 21, Persistenz über JPA gegen eine
  H2-Datenbank im Arbeitsspeicher - die Daten überleben das Neuladen der Seite,
  aber nicht den Neustart des Servers.
- Frontend Angular 21, Standalone Components, Tests mit Vitest.
- Keine Authentifizierung, keine Rollen, keine Anbindung fremder Systeme.

Ein Arbeitspaket ist so geschnitten, dass ein einzelner Fabriklauf es schafft:
CRUD-Niveau, keine Rechenlogik. Ist ein Feature aus dem Brief zu groß,
schneide es kleiner.

Offene Fragen stellst du nur, wenn die Antwort die Umsetzung tatsächlich
verändert. "Wie soll der Button heißen" verändert nichts. "Darf jeder löschen
oder nur der Anleger" verändert das Datenmodell.

- ★ = blockierend. Ohne Antwort baut die Fabrik mit hoher Wahrscheinlichkeit
  das Falsche. **Höchstens drei pro Arbeitspaket.**
- ☆ = die Fabrik darf selbst eine vernünftige Annahme treffen.
  **Höchstens zwei pro Arbeitspaket.**

Antworte mit genau diesem Markdown und mit nichts sonst - kein Vorwort, kein
Nachwort, keine Code-Zäune drumherum:

# Projekt-Brief, geprüft — <Projektname aus dem Brief>

## Ampel

<grün | gelb | rot> — <ein Satz, warum>

## Widersprüche und Lücken

- <Widerspruch oder Lücke, die keine Frage ist, sondern eine Feststellung>
- <weglassen, wenn es keine gibt: dann eine Zeile "- keine">

## Arbeitspaket 1 — <Titel>

**Ziel:** <ein Satz>

**Akzeptanzkriterien**

- [ ] Wenn ..., dann sehe ich ...
- [ ] Wenn ..., dann sehe ich ...

**Offene Fragen**

**★ F1 (blockierend)** <Frage>
> Antwort:

**☆ F2 (Annahme möglich)** <Frage>
> Antwort:

## Arbeitspaket 2 — <Titel>

<derselbe Aufbau>

Regeln für das Format, an die du dich halten musst, weil ein Programm den Text
weiterliest:
- Jede Paket-Überschrift beginnt mit "## Arbeitspaket " und einer Zahl.
- Jede Frage beginnt am Zeilenanfang mit "**★ " oder "**☆ ", dann F und Nummer.
- Unter jeder Frage steht genau eine Zeile "> Antwort:" - dahinter nichts.
  Die Fragen beantwortest nicht du, sondern das Team.
- Die Fragennummern laufen über den ganzen Brief durch, nicht je Paket neu.`
      });

      return {
        result: { annotated: worker.text.trim() },
        tokensIn: worker.tokensIn,
        tokensOut: worker.tokensOut,
        costUsd: worker.costUsd,
        note: `${worker.turns} Runden`
      };
    });
}
