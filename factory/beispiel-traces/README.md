# Referenz-Traces

Echte Läufe, aufgezeichnet am 31.08.2026 auf diesem Repo. Keine konstruierten Zahlen.

| Datei | Lauf |
|---|---|
| `lauf-mit-skill.json` | `/api/version`-Feature, Konventionen-Skill aktiv |
| `lauf-ohne-skill.json` | dasselbe Feature, Skill entfernt |
| `lauf-mit-retry.json` | dasselbe Feature, Tor beim Start absichtlich rot |

Anschauen:

```bash
cd factory
npm run trace -- beispiel-traces/lauf-mit-skill.json
```

Das Ergebnis des Vergleichs steht bewusst nicht hier — es steht auf dem Aufgabenblatt zu
Baustein 4, und zwar erst, nachdem ihr eure eigenen Zahlen eingetragen habt.

## Hinweis zum Schema

Die Läufe wurden aufgezeichnet, bevor die Bezeichner im Code auf Englisch umgestellt wurden.
Die Schlüssel in diesen Dateien sind entsprechend nachgezogen (`dauerMs` → `durationMs` und so
weiter), und der Knoten `umfang` heißt jetzt `scope`. **Die Messwerte selbst sind unverändert.**
