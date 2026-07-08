import Anthropic from '@anthropic-ai/sdk';
import { PeriodSelection, RegulatoryChange, RegulatorySource } from './types';

const MODEL = 'claude-sonnet-4-5';

const COMPANY_CONTEXT = `Rezon Bio to firma biotechnologiczno-farmaceutyczna zajmująca się produkcją
biologicznych produktów leczniczych (biologics). Działa w reżimie eQMS/GxP (GMP, GDP, walidacja
systemów komputerowych) i sprzedaje/rejestruje produkty na rynkach UE, Polski, USA oraz Kanady.
Interesują ją w szczególności: zmiany w GMP dla produktów biologicznych, wymagania dotyczące
elektronicznych zapisów/podpisów (21 CFR Part 11), inspekcje i warning lettery dotyczące produkcji
biologicznej, biosimilary, oraz zmiany w prawie farmaceutycznym PL/UE/US/Kanada.`;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Add it to .env.local (see .env.local.example).'
    );
  }
  client = new Anthropic({ apiKey });
  return client;
}

function buildPrompt(params: {
  source: RegulatorySource;
  currentText: string;
  previousText: string | null;
  period: PeriodSelection;
}): string {
  const { source, currentText, previousText, period } = params;

  return `Kontekst firmy:
${COMPANY_CONTEXT}

Zadanie: Przeanalizuj poniższą treść strony regulacyjnej i zidentyfikuj ISTOTNE zmiany regulacyjne
(nowe wytyczne, aktualizacje dokumentów, ogłoszenia, warning lettery, zmiany w prawie), które mieszczą
się w wybranym okresie analizy: ${period.label} (od ${period.from} do ${period.to}).

Źródło: ${source.source} — ${source.area}
URL: ${source.url}

=== AKTUALNA TREŚĆ STRONY (tekst oczyszczony z HTML) ===
${currentText || '(brak treści — strona mogła nie zwrócić czytelnego tekstu)'}

${
  previousText
    ? `=== POPRZEDNIA ZAPISANA TREŚĆ (z ostatniej rewizji) ===\n${previousText}\n\nPorównaj obie wersje i zwróć uwagę przede wszystkim na to, co jest nowe lub zmienione względem poprzedniej wersji.`
    : '=== BRAK POPRZEDNIEJ WERSJI ===\nTo pierwsza rewizja tego źródła — oceń treść strony pod kątem zmian/ogłoszeń mieszczących się w wybranym okresie analizy.'
}

Zwróć WYŁĄCZNIE poprawny JSON — tablicę obiektów, bez żadnego tekstu przed ani po, bez bloków markdown.
Każdy obiekt ma strukturę:
{
  "short_description": "krótki opis zmiany",
  "source": "${source.source}",
  "source_url": "${source.url}",
  "probability": "high" | "medium" | "low",
  "interpretation": "krótka, praktyczna interpretacja (2-4 zdania) co to może oznaczać dla Rezon Bio, lub pusty string jeśli nie da się jednoznacznie ocenić"
}

"probability" oceń na podstawie tego, jak prawdopodobne jest, że dana zmiana ma zastosowanie do Rezon Bio
(produkcja biologiczna, GxP/eQMS, rynki EU/PL/US/Kanada).

Jeśli nie wykryto żadnych istotnych zmian mieszczących się w wybranym okresie, zwróć pustą tablicę: []`;
}

function extractJsonArray(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\[[\s\S]*\]/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error('Model response was not valid JSON');
  }
}

function isValidChange(item: unknown): item is RegulatoryChange {
  if (!item || typeof item !== 'object') return false;
  const c = item as Record<string, unknown>;
  return (
    typeof c.short_description === 'string' &&
    typeof c.source === 'string' &&
    typeof c.source_url === 'string' &&
    (c.probability === 'high' || c.probability === 'medium' || c.probability === 'low') &&
    typeof c.interpretation === 'string'
  );
}

export async function analyzeSourceWithClaude(params: {
  source: RegulatorySource;
  currentText: string;
  previousText: string | null;
  period: PeriodSelection;
}): Promise<RegulatoryChange[]> {
  const prompt = buildPrompt(params);

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    return [];
  }

  const parsed = extractJsonArray(textBlock.text);
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.filter(isValidChange);
}
