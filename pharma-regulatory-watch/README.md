# Pharma Regulatory Watch

Aplikacja webowa do monitorowania zmian w regulacjach prawnych przemysłu farmaceutycznego dla
firmy **Rezon Bio**. Pozwala wybrać źródła regulacyjne (FDA, EMA, MHRA, PIC/S, ICH, GIF, EDQM, USP
itd.), okres analizy, a następnie uruchomić rewizję, która pobiera aktualną treść każdej strony,
porównuje ją z ostatnim zapisanym snapshotem i wykorzystuje Claude (Anthropic API) do wyodrębnienia
istotnych zmian regulacyjnych wraz z oceną prawdopodobieństwa zastosowania do Rezon Bio.

## Stack techniczny

- **Next.js 14 (App Router) + TypeScript** — full-stack w jednym projekcie
- **better-sqlite3** — historia snapshotów treści stron (tabela `snapshots`)
- **Tailwind CSS** — stylowanie UI
- **cheerio** — parsowanie HTML do czystego tekstu
- **@anthropic-ai/sdk** — analiza treści przez Claude (`claude-sonnet-4-5`)
- **xlsx (SheetJS)** — eksport wyników do Excela (generowany w przeglądarce)

## Instalacja

```bash
cd pharma-regulatory-watch
npm install
```

## Konfiguracja klucza API

1. Skopiuj plik `.env.local.example` do `.env.local`:

   ```bash
   cp .env.local.example .env.local
   ```

2. Wklej swój klucz Anthropic API (dostępny na [console.anthropic.com](https://console.anthropic.com)):

   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```

`.env.local` jest w `.gitignore` — klucz nigdy nie trafi do repozytorium.

## Uruchomienie lokalne

```bash
npm run dev
```

Aplikacja będzie dostępna pod adresem [http://localhost:3000](http://localhost:3000).

## Jak działa rewizja

1. Zaznacz na liście źródła, które mają zostać sprawdzone (domyślnie wszystkie zaznaczone).
   Pozycje EDQM i USP prowadzą do stron logowania (CAS) i są oznaczone etykietą
   „wymaga logowania" — aplikacja mimo to spróbuje je pobrać.
2. Wybierz okres analizy: ostatnie 3 miesiące, ostatni rok, lub zakres własny (od–do).
3. Kliknij **„Zrób rewizję”**. Dla każdego zaznaczonego źródła aplikacja:
   - pobiera aktualną treść strony po stronie serwera (Next.js API route) i redukuje HTML do
     czystego tekstu,
   - porównuje ją z ostatnim zapisanym snapshotem w SQLite (jeśli istnieje),
   - wysyła obie wersje do Claude z promptem zawierającym kontekst firmy Rezon Bio i wybrany okres
     analizy, prosząc o wyodrębnienie istotnych zmian regulacyjnych w formacie JSON,
   - zapisuje nowy snapshot treści strony w SQLite (historia poprzednich rewizji jest zachowywana —
     nowe wiersze są dopisywane, nic nie jest nadpisywane).
4. Błędy pobierania lub analizy pojedynczego źródła nie przerywają całej rewizji — są zbierane w
   sekcji „Status rewizji” jako źródła niedostępne.
5. Wyniki pojawiają się na bieżąco w tabeli, którą można sortować po kolumnie
   „Prawdopodobieństwo” (kliknięcie nagłówka).
6. Przycisk **„Eksportuj do Excela”** generuje plik `.xlsx` z wynikami, datą rewizji i wybranym
   okresem analizy.

## Struktura kodu

```
src/
  app/
    page.tsx              — główny widok (checklist, wybór okresu, wyniki, eksport)
    api/revise/route.ts   — API route: fetch + diff + wywołanie Claude + zapis snapshotu (streaming NDJSON)
    layout.tsx, globals.css
  components/
    SourceChecklist.tsx    — checkboxy źródeł
    PeriodSelector.tsx     — wybór okresu analizy
    ResultsTable.tsx       — tabela wyników (sortowanie, kolorowe badge'e)
    ReviseStatus.tsx       — lista źródeł, które zwróciły błąd
    ExportButton.tsx       — eksport do Excela (SheetJS)
  lib/
    sources.ts             — statyczna lista 21 monitorowanych źródeł
    fetchPage.ts           — fetch + parsowanie HTML do czystego tekstu (cheerio), timeouty, obsługa błędów
    anthropic.ts           — wywołania Anthropic API (prompt, parsowanie JSON)
    db.ts                  — SQLite (better-sqlite3): historia snapshotów
    types.ts               — współdzielone typy TypeScript
```

## Wdrożenie na Vercel

Kod jest napisany z myślą o Vercel (App Router, Node.js runtime dla API route), ale jedna rzecz
wymaga uwagi: **system plików na Vercel jest tylko do odczytu poza katalogiem `/tmp`, który jest
efemeryczny** (czyszczony między wywołaniami funkcji). Oznacza to, że SQLite w obecnej formie nie
zachowa historii snapshotów pomiędzy kolejnymi requestami w środowisku serverless Vercel — dla
produkcyjnego wdrożenia na Vercel zalecane jest podmienienie `src/lib/db.ts` na klienta hostowanej
bazy danych (np. Turso/libSQL, Neon/Postgres, Vercel Postgres) — interfejs modułu
(`getLatestSnapshot`, `saveSnapshot`, `getSnapshotHistory`) można zaimplementować analogicznie bez
zmian w reszcie aplikacji. Do uruchomienia lokalnego (`npm run dev`) i na własnym serwerze/VPS
better-sqlite3 działa od razu, z plikiem bazy w `./data/regulatory_watch.db`.

Pamiętaj też o ustawieniu zmiennej środowiskowej `ANTHROPIC_API_KEY` w ustawieniach projektu na
Vercel (Project Settings → Environment Variables) — analogicznie do `.env.local` lokalnie.

## Znane ograniczenia

- Niektóre strony (np. EudraGMDP, CFR Search, strony logowania EDQM/USP) są w dużym stopniu
  generowane przez JavaScript lub wymagają sesji/logowania — serwerowy fetch pobierze tylko
  wyjściowy HTML, co może skutkować małą ilością odczytanego tekstu lub błędem „No readable text
  content found”. Takie źródła są zgłaszane jako niedostępne w sekcji „Status rewizji”, a rewizja
  pozostałych źródeł przebiega normalnie.
- Analiza opiera się na treści aktualnie wyrenderowanego HTML strony, a nie na pełnej historii
  publikacji źródła — dla stron bez wyraźnych dat przy ogłoszeniach model ocenia zawartość na
  podstawie tego, co jest nowe/zmienione względem poprzedniego zapisanego snapshotu.
