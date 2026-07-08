'use client';

import * as XLSX from 'xlsx';
import { PeriodSelection, RegulatoryChange } from '@/lib/types';

const PROBABILITY_LABELS: Record<string, string> = {
  high: 'Wysokie',
  medium: 'Średnie',
  low: 'Niskie',
};

interface Props {
  results: RegulatoryChange[];
  period: PeriodSelection;
  revisedAt: string;
  disabled?: boolean;
}

export function ExportButton({ results, period, revisedAt, disabled }: Props) {
  const handleExport = () => {
    const rows = results.map((r) => ({
      'Krótki opis zmiany': r.short_description,
      Źródło: r.source,
      'Link do źródła': r.source_url,
      'Prawdopodobieństwo zastosowania w Rezon Bio':
        PROBABILITY_LABELS[r.probability] ?? r.probability,
      Interpretacja: r.interpretation,
      'Data rewizji': revisedAt,
      'Okres analizy': `${period.label} (${period.from} – ${period.to})`,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 45 },
      { wch: 20 },
      { wch: 40 },
      { wch: 18 },
      { wch: 60 },
      { wch: 14 },
      { wch: 28 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Wyniki rewizji');

    const filename = `pharma-regulatory-watch_${revisedAt.slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={disabled || results.length === 0}
      className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      Eksportuj do Excela
    </button>
  );
}
