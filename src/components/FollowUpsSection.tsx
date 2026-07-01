import React, { useEffect, useState } from 'react';
import { AlertTriangle, Check, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';

interface Followup {
  id: number;
  call_id: string;
  numero: string | null;
  nome: string | null;
  motivo: string;
  stato: string;
  created_at: string;
}

export function FollowUpsSection() {
  const [items, setItems] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/followups?stato=pending');
      const data = await res.json();
      setItems(data.followups || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const markDone = async (id: number) => {
    setItems(prev => prev.filter(i => i.id !== id)); // ottimistico
    try {
      await fetch(`/api/followups/${id}/done`, { method: 'POST' });
    } catch {
      load(); // rollback ricaricando se fallisce
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {items.length} da gestire
        </span>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} /> Aggiorna
        </button>
      </div>

      {!loading && items.length === 0 && (
        <p className="text-sm text-slate-400">Nessun follow-up in sospeso. 🎉</p>
      )}

      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="flex items-start gap-3 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/10">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-slate-900 dark:text-white">
                {item.nome || item.numero || item.call_id}
              </div>
              <div className="text-xs text-amber-700 dark:text-amber-400 font-medium mt-0.5">{item.motivo}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {item.numero} · {new Date(item.created_at).toLocaleString('it-IT')}
              </div>
            </div>
            <button
              onClick={() => markDone(item.id)}
              className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
            >
              <Check className="w-3.5 h-3.5" /> Gestito
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
