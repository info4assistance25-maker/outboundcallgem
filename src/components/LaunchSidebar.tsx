import React, { useState } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { Play, AlertTriangle, Loader2, Trash2, DownloadCloud, Save, Phone, Clock, Filter, X, StickyNote, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '../lib/utils';
import * as XLSX from 'xlsx';

export function LaunchSidebar({ mode = 'all' }: { mode?: 'launch' | 'history' | 'all' }) {
  const { 
    user, validContacts, contacts,
    scheduleMode, scheduledAt, concurrency,
    isLaunching, launchStatus, launchCampaign,
    testSingleCall, testStatus,
    campaignNote, setCampaignNote,
    businessHoursEnabled, setBusinessHoursEnabled,
    businessHoursConfig, setBusinessHoursConfig,
    historyFilter, setHistoryFilter, filteredHistory, exportHistoryToXLSX,
    history, clearHistory, saveList,
  } = useCampaign();

  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [isSavingList, setIsSavingList] = useState(false);
  const [listName, setListName] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [showBhConfig, setShowBhConfig] = useState(false);
  const [testNome, setTestNome] = useState('');
  const [testNumero, setTestNumero] = useState('');

  const isViewer = user?.role === 'Viewer';

  const exportSingleHistory = (h: any) => {
    if (!h.contactsList) return;
    const data = h.contactsList.map((c: any) => ({ Nome: c.nome, Numero: c.numero }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contatti');
    XLSX.writeFile(wb, `Campagna_${format(new Date(h.ts), 'yyyyMMdd_HHmm')}.xlsx`);
  };

  const handleSaveList = () => {
    if (listName.trim() && validContacts.length > 0) {
      saveList(listName.trim(), validContacts);
      setIsSavingList(false); setListName('');
    }
  };

  const handleTestCall = async () => {
    if (!testNome.trim() || !testNumero.trim()) return;
    await testSingleCall({ id: 'test', nome: testNome, numero: testNumero });
    setTestNome(''); setTestNumero('');
  };

  const getButtonText = () => {
    if (isLaunching) return 'Avvio in corso...';
    if (validContacts.length === 0) return 'Avvia Campagna';
    if (scheduleMode === 'later' && scheduledAt) {
      try { return `Pianifica per le ${format(new Date(scheduledAt), 'HH:mm')}`; }
      catch { return 'Pianifica Campagna'; }
    }
    return 'Avvia Campagna Wildix';
  };

  const operators = [...new Set(history.map(h => h.opt))];

  return (
    <div className="space-y-6 sticky top-24">

      {/* LAUNCH CARD */}
      {!isViewer && (mode === 'all' || mode === 'launch') && (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-soft overflow-hidden">
        <div className="h-1.5 w-full bg-slate-800 dark:bg-slate-200"></div>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-700/50 text-brand-700 dark:text-brand-300 flex items-center justify-center font-display font-bold">4</div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">Riepilogo e Avvio</h2>
          </div>

          {/* Summary */}
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl p-4 mb-4 space-y-3">
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

          {/* Note campagna */}
          <div className="mb-4">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              <StickyNote className="w-3 h-3" /> Note campagna (facoltativo)
            </label>
            <input
              type="text"
              value={campaignNote}
              onChange={e => setCampaignNote(e.target.value)}
              placeholder="Es. Promo estiva clienti VIP..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:border-brand-500 dark:text-white"
            />
          </div>

          {/* Orari consentiti — solo se pianificata */}
          {scheduleMode === 'later' && (
            <div className="mb-4 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Blocca fuori orario</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowBhConfig(!showBhConfig)} className="text-slate-400 hover:text-slate-600 transition-colors">
                    {showBhConfig ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => setBusinessHoursEnabled(!businessHoursEnabled)}
                    className={cn("relative w-10 h-5 rounded-full transition-colors", businessHoursEnabled ? "bg-brand-600" : "bg-slate-300 dark:bg-slate-600")}
                  >
                    <span className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform", businessHoursEnabled ? "translate-x-5" : "translate-x-0.5")} />
                  </button>
                </div>
              </div>
              {showBhConfig && (
                <div className="p-3 border-t border-slate-200 dark:border-slate-700 space-y-3 animate-in fade-in slide-in-from-top-2">
                  {/* Giorni */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Giorni consentiti</label>
                    <div className="flex gap-1 flex-wrap">
                      {[{d:1,l:'Lu'},{d:2,l:'Ma'},{d:3,l:'Me'},{d:4,l:'Gi'},{d:5,l:'Ve'},{d:6,l:'Sa'},{d:0,l:'Do'}].map(({d,l}) => (
                        <button key={d}
                          onClick={() => {
                            const days = businessHoursConfig.days.includes(d)
                              ? businessHoursConfig.days.filter(x => x !== d)
                              : [...businessHoursConfig.days, d];
                            setBusinessHoursConfig({...businessHoursConfig, days});
                          }}
                          className={cn("w-8 h-8 rounded-lg text-xs font-bold transition-colors",
                            businessHoursConfig.days.includes(d)
                              ? "bg-brand-600 text-white"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                          )}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Ore */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Dalle</label>
                      <select value={businessHoursConfig.startHour}
                        onChange={e => setBusinessHoursConfig({...businessHoursConfig, startHour: parseInt(e.target.value)})}
                        className="w-full px-2 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none dark:text-white">
                        {Array.from({length:24},(_,i)=><option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Alle</label>
                      <select value={businessHoursConfig.endHour}
                        onChange={e => setBusinessHoursConfig({...businessHoursConfig, endHour: parseInt(e.target.value)})}
                        className="w-full px-2 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none dark:text-white">
                        {Array.from({length:24},(_,i)=><option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">
                    Attivo: {businessHoursConfig.days.length} giorni · {String(businessHoursConfig.startHour).padStart(2,'0')}:00–{String(businessHoursConfig.endHour).padStart(2,'0')}:00
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Test chiamata singola */}
          <button
            onClick={() => setShowTestModal(!showTestModal)}
            className="w-full mb-3 py-2 text-xs font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Phone className="w-3.5 h-3.5" /> {showTestModal ? 'Chiudi test chiamata' : 'Testa chiamata singola'}
          </button>
          {showTestModal && (
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-200 dark:border-amber-800 animate-in fade-in slide-in-from-top-2">
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input type="text" placeholder="Nome" value={testNome} onChange={e => setTestNome(e.target.value)}
                  className="px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 dark:text-white focus:outline-none focus:border-brand-500" />
                <input type="tel" placeholder="+39..." value={testNumero} onChange={e => setTestNumero(e.target.value)}
                  className="px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 dark:text-white focus:outline-none focus:border-brand-500" />
              </div>
              <button onClick={handleTestCall} disabled={testStatus.type === 'load' || !testNome.trim() || !testNumero.trim()}
                className="w-full py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded flex items-center justify-center gap-1.5 transition-colors">
                {testStatus.type === 'load' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Phone className="w-3 h-3" />}
                Chiama ora
              </button>
              {testStatus.type !== 'idle' && (
                <div className={cn("mt-2 text-xs font-medium p-2 rounded", testStatus.type === 'ok' ? 'text-green-700 bg-green-50' : testStatus.type === 'err' ? 'text-red-700 bg-red-50' : 'text-brand-700 bg-brand-50')}>
                  {testStatus.msg}
                </div>
              )}
            </div>
          )}

          {/* Salva lista */}
          {validContacts.length > 0 && !isSavingList && (
            <button onClick={() => setIsSavingList(true)}
              className="w-full mb-3 py-2 text-sm font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg flex items-center justify-center gap-2 transition-colors">
              <Save className="w-4 h-4" /> Salva come Lista
            </button>
          )}
          {isSavingList && (
            <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 animate-in fade-in">
              <label className="block text-xs font-bold text-slate-500 mb-2">NOME LISTA</label>
              <input type="text" placeholder="Es. Clienti VIP" value={listName} onChange={e => setListName(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md text-sm mb-3 focus:outline-none focus:border-brand-500 dark:text-white" />
              <div className="flex gap-2">
                <button onClick={() => setIsSavingList(false)} className="flex-1 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors">Annulla</button>
                <button onClick={handleSaveList} disabled={!listName.trim()} className="flex-1 py-1.5 text-xs font-bold bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-md transition-colors">Salva</button>
              </div>
            </div>
          )}

          {/* Launch button */}
          <button onClick={launchCampaign} disabled={isLaunching || validContacts.length === 0}
            className={cn(
              "w-full py-4 px-6 rounded-xl font-display font-extrabold text-base flex items-center justify-center gap-3 transition-all duration-200",
              validContacts.length === 0 ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                : "bg-brand-600 hover:bg-brand-700 text-white shadow-soft-blue hover:shadow-lg hover:-translate-y-0.5",
              isLaunching && "opacity-80 pointer-events-none"
            )}>
            {isLaunching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
            {getButtonText()}
          </button>

          {launchStatus.type !== 'idle' && (
            <div className={cn(
              "mt-4 p-4 rounded-xl border flex items-start gap-3 text-sm font-medium animate-in fade-in zoom-in-95",
              launchStatus.type === 'ok' && "bg-green-50 border-green-200 text-green-700",
              launchStatus.type === 'err' && "bg-red-50 border-red-200 text-red-700",
              launchStatus.type === 'load' && "bg-brand-50 border-brand-200 text-brand-700"
            )}>
              {launchStatus.type === 'ok' ? <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" /> : launchStatus.type === 'err' ? <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" /> : <Loader2 className="w-5 h-5 animate-spin shrink-0 mt-0.5" />}
              <span>
                {launchStatus.msg.replace(' — Vai in Assistenza per aprire un ticket.', '')}
                {launchStatus.type === 'err' && (
                  <> — <button
                    onClick={() => window.dispatchEvent(new CustomEvent('gem:nav', { detail: 'support' }))}
                    className="underline font-bold hover:opacity-80 transition-opacity"
                  >Vai in Assistenza</button> per aprire un ticket.</>
                )}
              </span>
            </div>
          )}
        </div>
      </div>
      )}

      {/* HISTORY CARD */}
      {(mode === 'all' || mode === 'history') && (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-soft overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white font-display">Storico Campagne</h2>
          <div className="flex items-center gap-2">
            <button onClick={exportHistoryToXLSX} title="Esporta tutto in Excel"
              className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
              <DownloadCloud className="w-4 h-4" />
            </button>
            <button onClick={() => setShowFilters(!showFilters)}
              className={cn("p-1.5 rounded-lg transition-colors", showFilters ? "text-brand-600 bg-brand-50" : "text-slate-400 hover:text-brand-600 hover:bg-brand-50")}>
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filtri */}
        {showFilters && (
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/20 space-y-3 animate-in fade-in slide-in-from-top-2">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Operatore</label>
              <select value={historyFilter.operator} onChange={e => setHistoryFilter({...historyFilter, operator: e.target.value})}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none dark:text-white">
                <option value="">Tutti</option>
                {operators.map(op => <option key={op} value={op}>{op}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Dal</label>
                <input type="date" value={historyFilter.dateFrom} onChange={e => setHistoryFilter({...historyFilter, dateFrom: e.target.value})}
                  className="w-full px-2 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Al</label>
                <input type="date" value={historyFilter.dateTo} onChange={e => setHistoryFilter({...historyFilter, dateTo: e.target.value})}
                  className="w-full px-2 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none dark:text-white" />
              </div>
            </div>
            {(historyFilter.operator || historyFilter.dateFrom || historyFilter.dateTo) && (
              <button onClick={() => setHistoryFilter({ operator: '', dateFrom: '', dateTo: '' })}
                className="flex items-center gap-1 text-xs font-bold text-red-500 hover:text-red-700 transition-colors">
                <X className="w-3 h-3" /> Rimuovi filtri
              </button>
            )}
          </div>
        )}

        <div>
          {filteredHistory.length === 0 ? (
            <div className="p-8 text-center text-sm font-medium text-slate-400">
              {history.length === 0 ? 'Nessuna campagna ancora avviata' : 'Nessun risultato con i filtri attivi'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredHistory.map((h, i) => (
                <div key={i} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      {h.scheduledAt
                        ? <span className="px-2 py-0.5 rounded-full bg-accent-50 dark:bg-accent-900/30 text-accent-600 dark:text-accent-400 text-[10px] font-bold uppercase tracking-wider">Pianificata</span>
                        : <span className="px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-bold uppercase tracking-wider">Immediata</span>
                      }
                    </div>
                    <div className="text-right">
                      <span className="block font-display font-extrabold text-brand-600 dark:text-brand-400 text-lg leading-none">{h.count}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">chiamate</span>
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-white mb-0.5">
                    {format(new Date(h.ts), 'dd MMM yyyy, HH:mm', { locale: it })}
                  </div>
                  {h.note && (
                    <div className="text-xs text-slate-500 italic mt-1">"{h.note}"</div>
                  )}
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="text-xs font-medium text-slate-500">
                      {h.opt}{h.chunkSize > 1 ? ` · ${h.chunkSize} simul.` : ''}
                    </div>
                    {h.contactsList && h.contactsList.length > 0 && (
                      <button onClick={() => exportSingleHistory(h)}
                        className="text-[10px] uppercase tracking-wider font-bold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-2 py-1 rounded transition-colors flex items-center gap-1 flex-shrink-0">
                        <DownloadCloud className="w-3 h-3" /> Esporta
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button onClick={clearHistory}
                className="w-full p-3 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors flex items-center justify-center gap-2">
                <Trash2 className="w-3.5 h-3.5" /> Cancella Storico
              </button>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
