/**
 * Lecteur CSV en flux.
 *
 * Écrit à la main plutôt qu'importé : la dépendance n'apporterait rien ici et
 * on a besoin d'un contrôle précis sur le comportement en flux et sur les
 * lignes malformées, qui ne doivent jamais interrompre un import de 3 millions
 * de lignes.
 */

export interface CsvParseOptions {
  delimiter?: string;
  /** Nombre maximal de lignes lues. */
  limit?: number;
}

/** Découpe une ligne CSV en respectant les guillemets et les doublements. */
export function parseCsvLine(line: string, delimiter = ','): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' && current.length === 0) {
      inQuotes = true;
    } else if (char === delimiter) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  fields.push(current);
  return fields.map((f) => f.trim());
}

/** Devine le séparateur d'après la ligne d'en-tête. */
export function detectDelimiter(headerLine: string): string {
  const candidates = [',', ';', '\t', '|'];
  let best = ',';
  let bestCount = 0;

  for (const candidate of candidates) {
    const count = parseCsvLine(headerLine, candidate).length;
    if (count > bestCount) {
      bestCount = count;
      best = candidate;
    }
  }

  return best;
}

export interface CsvRow {
  /** Numéro de ligne dans le fichier, en-tête comprise. Sert aux rapports d'erreur. */
  lineNumber: number;
  values: Record<string, string>;
}

export interface CsvParseResult {
  headers: string[];
  rows: CsvRow[];
  /** Lignes dont le nombre de colonnes ne correspond pas à l'en-tête. */
  malformed: { lineNumber: number; reason: string }[];
}

/**
 * Analyse un contenu CSV complet.
 *
 * Pour un import interactif (quelques milliers de lignes). Le fichier SIRENE
 * complet passe par `streamCsv`.
 */
export function parseCsv(content: string, options: CsvParseOptions = {}): CsvParseResult {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [], malformed: [] };

  const headerLine = lines[0]!;
  const delimiter = options.delimiter ?? detectDelimiter(headerLine);
  const headers = parseCsvLine(headerLine, delimiter).map((h) => h.replace(/^﻿/, ''));

  const rows: CsvRow[] = [];
  const malformed: { lineNumber: number; reason: string }[] = [];
  const limit = options.limit ?? Number.POSITIVE_INFINITY;

  for (let i = 1; i < lines.length && rows.length < limit; i += 1) {
    const fields = parseCsvLine(lines[i]!, delimiter);

    if (fields.length !== headers.length) {
      malformed.push({
        lineNumber: i + 1,
        reason: `${fields.length} colonnes au lieu de ${headers.length}`,
      });
      continue;
    }

    const values: Record<string, string> = {};
    headers.forEach((header, index) => {
      values[header] = fields[index] ?? '';
    });

    rows.push({ lineNumber: i + 1, values });
  }

  return { headers, rows, malformed };
}
