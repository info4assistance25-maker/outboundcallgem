import React, { useState } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { Play, Calendar, AlertTriangle, Loader2, Trash2, DownloadCloud, ChevronDown, ChevronUp, Save } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '../lib/utils';
import * as XLSX from 'xlsx';

export function LaunchSidebar({ mode = 'all' }: { mode?: 'launch' | 'history' | 'all' }) {
  const { 
    user,
    validContacts, 
    contacts,
    scheduleMode, 
    scheduledAt, 
    concurrency, 
    isLaunching, 
    launchStatus, 
    launchCampaign,
    history,
    clearHistory,
    saveList
  } = useCampaign();

  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [isSavingList, setIsSavingList] = useState(false);
  const [listName, setListName] = useState('');

  const isViewer = user?.role === 'Viewer';

  const exportHistoryToXLSX = (h: any) => {
    if (!h.contactsList) return;
    const data = h.contactsList.map((c: any) => ({
      Nome: c.nome,
      Numero: c.numero
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contatti");
    XLSX.writeFile(wb, `Campagna_${format(new Date(h.ts), 'yyyyMMdd_HHmm')}.xlsx`);
  };

  const handleLaunch = () => {
    launchCampaign();
  };

  const handleSaveList = () => {
    if (listName.trim() && validContacts.length > 0) {
      saveList(listName.trim(), validContacts);
      setIsSavingList(false);
      setListName('');
    }
  };

  const getButtonText = () => {
    if (isLaunching) return "Avvio in corso...";
    if (validContacts.length === 0) return "Avvia Campagna";
    if (scheduleMode === 'later' && scheduledAt) {
      try {
        return `Pianifica per le ${format(new Date(scheduledAt), 'HH:mm')}`;
      } catch {
        return "Pianifica Campagna";
      }
    }
    return "Avvia Campagna Wildix";
  };

  return (
    <div className="space-y-6 sticky top-24">
      {/* Launch Card */}
      {!isViewer && (mode === 'all' || mode === 'launch') && (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-soft overflow-hidden">
        <div className="h-1.5 w-full bg-slate-800 dark:bg-slate-200"></div>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-700/50 text-brand-700 dark:text-brand-300 flex items-center justify-center font-display font-bold">4</div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">Riepilogo e Avvio</h2>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl p-4 mb-6 space-y-3">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-700">
              <span className="text-sm font-semibold text-slate-500">Contatti Validi</span>
              <span className={cn("text-base font-bold", validContacts.length > 0 ? "text-slate-900 dark:text-white" : "text-slate-400")}>
                {validContacts.length} / {contacts.length}
              </span>
            </div>
            
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-700">
              <span className="text-sm font-semibold text-slate-500">Chiamate Simultanee</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white">x{concurrency}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-slate-500">Modalità</span>
              <span className="text-sm font-bold text-brand-600 dark:text-brand-400">
                {scheduleMode === 'now' ? 'Immediata' : 'Pianificata'}
              </span>
            </div>
            
            {scheduleMode === 'later' && scheduledAt && (
              <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-700">
                <span className="text-sm font-semibold text-slate-500">Data e Ora</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                   {format(new Date(scheduledAt), 'dd MMM HH:mm', { locale: it })}
                </span>
              </div>
            )}
          </div>

          {validContacts.length > 0 && !isSavingList && (
            <button
              onClick={() => setIsSavingList(true)}
              className="w-full mb-4 py-2 text-sm font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <Save className="w-4 h-4" /> Salva come Lista
            </button>
          )}

          {isSavingList && (
            <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-top-2">
              <label className="block text-xs font-bold text-slate-500 mb-2">NOME LISTA</label>
              <input
                type="text"
                placeholder="Es. Clienti VIP"
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md text-sm mb-3 focus:outline-none focus:border-brand-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setIsSavingList(false)}
                  className="flex-1 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={handleSaveList}
                  disabled={!listName.trim()}
                  className="flex-1 py-1.5 text-xs font-bold bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-md transition-colors"
                >
                  Salva
                </button>
              </div>
            </div>
          )}

          <button
            onClick={handleLaunch}
            disabled={isLaunching || validContacts.length === 0}
            className={cn(
              "w-full py-4 px-6 rounded-xl font-display font-extrabold text-base flex items-center justify-center gap-3 transition-all duration-200",
              validContacts.length === 0
                ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                : "bg-brand-600 hover:bg-brand-700 text-white shadow-soft-blue hover:shadow-lg hover:-translate-y-0.5",
              isLaunching && "opacity-80 pointer-events-none"
            )}
          >
            {isLaunching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
            {getButtonText()}
          </button>

          {launchStatus.type !== 'idle' && (
            <div className={cn(
              "mt-4 p-4 rounded-xl border flex items-center gap-3 text-sm font-medium animate-in fade-in zoom-in-95",
              launchStatus.type === 'ok' && "bg-green-50 border-green-200 text-green-700",
              launchStatus.type === 'err' && "bg-red-50 border-red-200 text-red-700",
              launchStatus.type === 'load' && "bg-brand-50 border-brand-200 text-brand-700"
            )}>
              {launchStatus.type === 'ok' ? null : launchStatus.type === 'err' ? <AlertTriangle className="w-5 h-5 shrink-0" /> : <Loader2 className="w-5 h-5 animate-spin shrink-0" />}
              {launchStatus.msg}
            </div>
          )}
        </div>
      </div>
      )}

      {/* History Card */}
      {(mode === 'all' || mode === 'history') && (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-soft overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
          <h2 className="text-base font-bold text-slate-900 dark:text-white font-display flex items-center gap-2">
            Storico Campagne
          </h2>
        </div>
        <div className="p-0">
          {history.length === 0 ? (
            <div className="p-8 text-center text-sm font-medium text-slate-400">
              Nessuna campagna ancora avviata
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {history.map((h, i) => (
                <div key={i} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      {h.scheduledAt ? (
                         <span className="px-2 py-0.5 rounded-full bg-accent-50 dark:bg-accent-900/30 text-accent-600 dark:text-accent-400 text-[10px] font-bold uppercase tracking-wider">Pianificata</span>
                      ) : (
                         <span className="px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-bold uppercase tracking-wider">Immediata</span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="block font-display font-extrabold text-brand-600 dark:text-brand-400 text-lg leading-none">{h.count}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">chiamate</span>
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-white mb-0.5">
                    {format(new Date(h.ts), 'dd MMM yyyy, HH:mm', { locale: it })}
                  </div>
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="text-xs font-medium text-slate-500">
                      Op: {h.opt} {h.chunkSize > 1 ? `· ${h.chunkSize} simul.` : ''}
                    </div>
                    {h.contactsList && h.contactsList.length > 0 && (
                      <button 
                        onClick={() => exportHistoryToXLSX(h)}
                        className="text-[10px] uppercase tracking-wider font-bold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-2 py-1 rounded transition-colors flex items-center gap-1 flex-shrink-0"
                      >
                        <DownloadCloud className="w-3 h-3" />
                        Esporta
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button 
                onClick={clearHistory}
                className="w-full p-3 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Cancella Storico
              </button>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
