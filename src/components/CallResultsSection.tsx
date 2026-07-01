import React, { useEffect, useState } from 'react';
import { PhoneCall, CheckCircle2, XCircle, ChevronDown, RefreshCw, Clock } from 'lucide-react';
import { cn } from '../lib/utils';

interface CallResult {
  callId: string;
  numero: string | null;
  risposto: boolean | null;
  durata: number | null;
  timestamp: string;
  trascrizione: string | null;
  riassunto?: {
    titolo: string | null;
    testo: string | null;
    argomenti: string[];
    decisioni: string[];
    problemi: string[];
  } | null;
}

function formatDurata(ms: number | null) {
  if (!ms) return '—';
  const sec = Math.round(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function isRifiutato(r: CallResult): boolean {
  const decisioni = r.riassunto?.decisioni || [];
  return decisioni.some(d => /non conferma|rifiut/i.test(d));
}

function isConfermato(r: CallResult): boolean {
  const decisioni = r.riassunto?.decisioni || [];
  return decisioni.some(d => /confer/i.test(d)) && !isRifiutato(r);
}

function ResultCard({ r }: { r: CallResult }) {
  const [open, setOpen] = useState(false);
  const rifiutato = isRifiutato(r);
  const confermato = isConfermato(r);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="p-4 flex items-start gap-3">
        <div className={cn(
          "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
          r.risposto ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
        )}>
          <PhoneCall className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-slate-900 dark:text-white">
              {r.riassunto?.titolo || r.numero || r.callId}
            </span>

            {r.risposto === false && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                Non risposto
              </span>
            )}
            {confermato && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Confermato
              </span>
            )}
            {rifiutato && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 flex items-center gap-1">
                <XCircle className="w-3 h-3" /> Rifiutato
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDurata(r.durata)}</span>
            <span>{new Date(r.timestamp).toLocaleString('it-IT')}</span>
          </div>

          {r.riassunto?.testo && (
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">{r.riassunto.testo}</p>
          )}
        </div>

        {(r.trascrizione || r.riassunto) && (
          <button
            onClick={() => setOpen(o => !o)}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white shrink-0"
          >
            <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} />
          </button>
        )}
      </div>

      {open && (
        <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-800 pt-3 space-y-3">
          {r.riassunto?.argomenti && r.riassunto.argomenti.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {r.riassunto.argomenti.map((a, i) => (
                <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300">
                  {a}
                </span>
              ))}
            </div>
          )}

          {r.trascrizione && (
            <details className="text-xs">
              <summary className="cursor-pointer font-semibold text-slate-500 dark:text-slate-400">
                Trascrizione completa
              </summary>
              <pre className="whitespace-pre-wrap mt-2 text-slate-600 dark:text-slate-300 font-sans">
                {r.trascrizione}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

export function CallResultsSection() {
  const [results, setResults] = useState<CallResult[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/call-results');
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {results.length} chiamat{results.length === 1 ? 'a' : 'e'} registrat{results.length === 1 ? 'a' : 'e'}
        </span>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} /> Aggiorna
        </button>
      </div>

      {loading && results.length === 0 && (
        <p className="text-sm text-slate-400">Caricamento...</p>
      )}

      {!loading && results.length === 0 && (
        <p className="text-sm text-slate-400">Nessuna chiamata registrata finora.</p>
      )}

      <div className="space-y-3">
        {results.map(r => <ResultCard key={r.callId} r={r} />)}
      </div>
    </div>
  );
}
