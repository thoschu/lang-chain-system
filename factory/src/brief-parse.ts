// Der Parser für geprüfte Briefs.
//
// Eine Stelle, zwei Nutzer: der check-Knoten liest damit das Ergebnis der
// Triage gegen, und run.ts entscheidet damit, ob ein Fabriklauf überhaupt
// starten darf. Zwei Implementierungen wären irgendwann unterschiedlich
// streng - und ein Tor, das man umgehen kann, ist keins.
//
// Hier steckt kein Modell drin. Das ist Absicht, genau wie bei verify.ts:
// Ob eine Frage beantwortet ist, entscheidet ein Textvergleich.

/** Eine offene Frage aus der Triage. */
export type Question = {
  /** true = blockierend (★), false = die Fabrik darf annehmen (☆) */
  blocking: boolean;
  /** "F1", "F2", ... */
  label: string;
  text: string;
  /** Leer heißt: noch nicht beantwortet. */
  answer: string;
};

/** Ein Arbeitspaket - so groß, dass ein Fabriklauf es schafft. */
export type WorkPackage = {
  number: number;
  title: string;
  /** Der ganze Abschnitt, inklusive Kriterien, Fragen und Antworten. */
  body: string;
  questions: Question[];
};

export type ParsedBrief = {
  packages: WorkPackage[];
};

const PACKAGE = /^##\s+Arbeitspaket\s+(\d+)\s*[—–-]?\s*(.*)$/;
const SECTION = /^##\s+/;
const QUESTION = /^\*\*([★☆])\s*(F\d+)[^*]*\*\*\s*(.*)$/;
const ANSWER = /^>?\s*Antwort:\s*(.*)$/;

/**
 * Sammelt die Fragen eines Abschnitts.
 *
 * Eine Antwort steht hinter "Antwort:" oder in den Zeilen direkt darunter.
 * Eine Leerzeile, eine Überschrift, ein Listenpunkt oder die nächste Frage
 * beenden sie - sonst würde ein unbeantwortetes "Antwort:" die nachfolgende
 * Überschrift verschlucken und als Antwort durchgehen.
 */
function parseQuestions(body: string): Question[] {
  const found: Question[] = [];
  let current: Question | null = null;
  let answering = false;
  let buffer: string[] = [];

  const flush = () => {
    if (current) {
      current.answer = buffer.join(' ').replace(/\s+/g, ' ').trim();
      found.push(current);
    }
    current = null;
    answering = false;
    buffer = [];
  };

  for (const raw of body.split('\n')) {
    const line = raw.trimEnd();

    const question = QUESTION.exec(line.trim());
    if (question) {
      flush();
      current = {
        blocking: question[1] === '★',
        label: question[2],
        text: question[3].trim(),
        answer: ''
      };
      continue;
    }

    if (!current) continue;

    const answer = ANSWER.exec(line);
    if (answer) {
      answering = true;
      if (answer[1].trim()) buffer.push(answer[1].trim());
      continue;
    }

    if (!answering) continue;

    const text = line.replace(/^>\s?/, '').trim();
    if (!text || /^(#{1,6}\s|[-*]\s|\d+\.\s|\*\*)/.test(text)) {
      flush();
      continue;
    }
    buffer.push(text);
  }

  flush();
  return found;
}

export function parseBrief(text: string): ParsedBrief {
  const lines = text.split('\n');

  const headings: number[] = [];
  const starts: { line: number; number: number; title: string }[] = [];
  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!SECTION.test(line)) return;
    headings.push(index);
    const match = PACKAGE.exec(line);
    if (match) starts.push({ line: index, number: Number(match[1]), title: match[2].trim() });
  });

  const packages = starts.map((start) => {
    const next = headings.find((index) => index > start.line) ?? lines.length;
    const body = lines.slice(start.line, next).join('\n').trim();
    return { number: start.number, title: start.title, body, questions: parseQuestions(body) };
  });

  return { packages };
}

/** Die Fragen, die einen Lauf aufhalten: blockierend und ohne Antwort. */
export function blockingOpen(pkg: WorkPackage): Question[] {
  return pkg.questions.filter((q) => q.blocking && q.answer === '');
}

/** Die Fragen, aus denen die Fabrik eine Annahme machen muss. */
export function assumedOpen(pkg: WorkPackage): Question[] {
  return pkg.questions.filter((q) => !q.blocking && q.answer === '');
}
