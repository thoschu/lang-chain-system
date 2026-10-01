# Die Fabrik

Ein LangGraph-Graph, der euer Feature durch den SDLC schickt. Die Knoten sind
Claude-Code-Worker, die im Projektordner arbeiten und dort automatisch euer
`.claude/`-Verzeichnis lesen — Skill, Subagenten, Commands.

```bash
cd factory && npm install
npm run factory -- "Mitglieder anlegen und die Liste mit Kontostand sehen"
npm run trace          # jüngsten Trace als Zeitleiste
```

## Die Knoten

| Knoten | Was er tut | Modell? |
|---|---|---|
| `spec` | Aus einem Satz eine prüfbare Spec. Liest nur. | ja |
| `implement` | Setzt die Spec um. Der einzige Knoten, der schreiben darf. | ja |
| `verify` | Startet `verify.mjs`. Bestanden = Exit-Code 0. | **nein** |
| `review` | Zweite Meinung über `.claude/agents/reviewer.md`. Ändert nichts. | ja |

Dass im `verify`-Knoten kein Modell steckt, ist der Kern: Der Graph bestimmt,
wann geprüft wird — ob bestanden ist, entscheidet ein Exit-Code.

## Zwei Tore, zwei Ebenen

Der Stop-Hook aus Baustein 2 läuft **auch** im Worker mit. Das ist Absicht:

- **Der Hook ist die schnelle Schleife.** Er greift am Ende des Worker-Turns, solange
  der Worker den Kontext noch im Kopf hat. Korrigieren ist hier am billigsten.
- **Der `verify`-Knoten ist das verbindliche Tor.** Er prüft unabhängig davon nach.
  Man glaubt dem Worker nicht, dass er fertig ist — man sieht nach.
- **Die Retry-Kante ist das Netz.** Sie greift, wenn die schnelle Schleife nicht
  gereicht hat. Wenn sie selten feuert, ist das ein gutes Zeichen, kein schlechtes.

Genau so würde man es auch produktiv bauen. Die Fabrik enthält keinen Mechanismus,
der nur zur Vorführung da ist.

## Traces

Jeder Lauf schreibt `traces/run-<zeit>.json`: pro Knoten Dauer, Tokens, Kosten
und der Versuch, in dem er lief. Die Funktion `exportSpans()` in `src/trace.ts`
ist die einzige Stelle, an der Traces das Haus verlassen — dort hängt später
Langfuse dran.

## Sprache im Code

Bezeichner auf Englisch, Kommentare und alles, was auf dem Bildschirm erscheint, auf Deutsch —
dieselbe Regel, die auch im Konventionen-Skill steht.
