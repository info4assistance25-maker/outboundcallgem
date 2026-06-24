import React, { useEffect } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { Step2Preview, Step3Settings } from './CampaignSteps';
import { LaunchSidebar } from './LaunchSidebar';
import { UploadCloud, DownloadCloud, Plus, Trash2, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../lib/utils';

const PRESTAZIONE_SUGGERIMENTI = [
  'Visita di controllo',
  'Prima visita',
  'Visita cardiologica',
  'Visita ortopedica',
  'Visita dermatologica',
  'Visita pediatrica',
  'Igiene dentale',
  'Prelievo del sangue',
  'Ecografia',
  'Radiografia',
  'Elettrocardiogramma',
];

export function AppointmentPage() {
  const { user, contacts, setContacts, updateManualContacts, setCampaignType } = useCampaign();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const isViewer = user?.role === 'Viewer';

  // Forza sempre campaignType appuntamenti su questa pagina
  useEffect(() => {
    setCampaignType('appuntamenti');
  }, []);

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Nome', 'Numero', 'Data', 'Ora', 'Prestazione'],
      ['Mario Rossi', '+393331234567', '22/06/2026', '10:00', 'Visita cardiologica'],
      ['Giulia Bianchi', '+393334567890', '29/06/2026', '11:30', 'Igiene dentale'],
    ]);
    ws['!cols'] = [{ wch: 20 }, { wch: 18 }, { wch: 14 }, { wch: 10 }, { wch: 24 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Appuntamenti');
    XLSX.writeFile(wb, 'template_appuntamenti.xlsx');
  };

  const formatDate = (val: any): string => {
    if (!val && val !== 0) return '';
    const s = String(val).trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
    const num = parseFloat(s);
    if (!isNaN(num) && num > 40000 && num < 60000) {
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + Math.floor(num) * 86400000);
      const dd = String(date.getDate()).padStart(2, '0');
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const yyyy = date.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
    }
    return s;
  };

  const formatTime = (val: any): string => {
    if (!val && val !== 0) return '';
    const s = String(val).trim();
    if (/^\d{1,2}:\d{2}$/.test(s)) return s.padStart(5, '0');
    const num = parseFloat(s);
    if (!isNaN(num) && num >= 0 && num < 1) {
      const totalMinutes = Math.round(num * 24 * 60);
      return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
    }
    return s;
  };

  const handleExcel = (file: File) => {
    if (!file || isViewer) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        if (!e.target?.result) return;
        const wb = XLSX.read(e.target.result, { type: 'array', raw: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '', raw: true });
        const out = [];
        for (const row of rows) {
          const nome = String(row[0] || '').trim();
          const numero = String(row[1] || '').trim();
          const data = formatDate(row[2]);
          const ora = formatTime(row[3]);
          const prestazione = String(row[4] || '').trim();
          if (!nome || !numero) continue;
          if (['nome', 'name'].includes(nome.toLowerCase())) continue;
          out.push({ id: crypto.randomUUID(), nome, numero, data_appuntamento: data, ora_appuntamento: ora, prestazione });
        }
        setCampaignType('appuntamenti');
        setContacts([]);
        updateManualContacts(out);
      } catch (err: any) {
        alert('Errore lettura Excel: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const addRow = () => {
    if (isViewer) return;
    setCampaignType('appuntamenti');
    updateManualContacts([...contacts, { id: crypto.randomUUID(), nome: '', numero: '', data_appuntamento: '', ora_appuntamento: '', prestazione: '' }]);
  };

  const updateRow = (id: string, field: string, val: string) => {
    if (isViewer) return;
    updateManualContacts(contacts.map(c => c.id === id ? { ...c, [field]: val } : c));
  };

  const deleteRow = (id: string) => {
    if (isViewer) return;
    updateManualContacts(contacts.filter(c => c.id !== id));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="space-y-6 lg:col-span-2">

        {/* Upload + Manuale */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-soft overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 bg-slate-50 dark:bg-slate-800/30">
            <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-700/50 text-brand-700 dark:text-brand-300 flex items-center justify-center font-display font-bold">1</div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">Lista Appuntamenti</h2>
          </div>

          <div className="p-6 space-y-4">
            {/* Formato info */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-3 rounded-xl text-sm font-medium text-blue-700 dark:text-blue-300">
              <strong>Formato Excel:</strong> Nome | Numero | Data (gg/mm/aaaa) | Ora (HH:MM) | Prestazione (opzionale)
            </div>

            {/* Drop zone */}
            <div
              className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-8 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50/50 dark:hover:bg-brand-900/10 transition-all group"
              onClick={() => !isViewer && fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) handleExcel(file); }}
            >
              <UploadCloud className="w-10 h-10 mx-auto mb-3 text-slate-400 group-hover:text-brand-500 transition-colors" />
              <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Carica Excel appuntamenti</p>
              <p className="text-xs text-slate-500">Trascina qui o clicca per selezionare (.xlsx)</p>
              <input type="file" accept=".xlsx,.xls" ref={fileInputRef} className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleExcel(f); e.target.value = ''; }} />
            </div>

            <div className="flex items-center justify-end">
              <button onClick={downloadTemplate}
                className="flex items-center gap-1.5 text-xs text-brand-600 dark:text-brand-400 hover:underline font-semibold">
                <DownloadCloud className="w-3.5 h-3.5" /> Scarica template
              </button>
            </div>

            {/* Separatore */}
            <div className="relative flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">oppure inserisci manualmente</span>
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
            </div>

            {/* Tabella editabile */}
            {contacts.length > 0 && (
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="grid grid-cols-[1fr_1fr_0.9fr_0.7fr_1.2fr_40px] bg-slate-50 dark:bg-slate-800/80 px-3 py-2 border-b border-slate-200 dark:border-slate-700 gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <span>Nome</span><span>Numero</span><span>Data</span><span>Ora</span><span>Prestazione</span><span />
                </div>
                <div className="max-h-[320px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {contacts.map(c => (
                    <div key={c.id} className="grid grid-cols-[1fr_1fr_0.9fr_0.7fr_1.2fr_40px] gap-2 px-3 py-2 items-center hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <input type="text" placeholder="Mario Rossi" value={c.nome} disabled={isViewer}
                        onChange={e => updateRow(c.id, 'nome', e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 px-2 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 focus:border-brand-500 focus:outline-none text-slate-900 dark:text-slate-100" />
                      <input type="text" placeholder="+39..." value={c.numero} disabled={isViewer}
                        onChange={e => updateRow(c.id, 'numero', e.target.value)}
                        className={cn("w-full bg-white dark:bg-slate-900 px-2 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 focus:border-brand-500 focus:outline-none text-slate-900 dark:text-slate-100",
                          c.inv && c.numero.length > 3 && "!border-red-400 !bg-red-50 dark:!bg-red-900/20")} />
                      <input type="text" placeholder="gg/mm/aaaa" value={c.data_appuntamento || ''} disabled={isViewer}
                        onChange={e => updateRow(c.id, 'data_appuntamento', e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 px-2 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 focus:border-brand-500 focus:outline-none text-slate-900 dark:text-slate-100" />
                      <input type="text" placeholder="HH:MM" value={c.ora_appuntamento || ''} disabled={isViewer}
                        onChange={e => updateRow(c.id, 'ora_appuntamento', e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 px-2 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 focus:border-brand-500 focus:outline-none text-slate-900 dark:text-slate-100" />
                      <div>
                        <input type="text" placeholder="es. Visita cardiologica" value={c.prestazione || ''} disabled={isViewer}
                          list={`pl-${c.id}`}
                          onChange={e => updateRow(c.id, 'prestazione', e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 px-2 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 focus:border-brand-500 focus:outline-none text-slate-900 dark:text-slate-100" />
                        <datalist id={`pl-${c.id}`}>
                          {PRESTAZIONE_SUGGERIMENTI.map(p => <option key={p} value={p} />)}
                        </datalist>
                      </div>
                      {!isViewer && (
                        <button onClick={() => deleteRow(c.id)}
                          className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 font-medium">
                  {contacts.length} appuntamenti
                </div>
              </div>
            )}

            {!isViewer && (
              <button onClick={addRow}
                className="w-full flex items-center justify-center gap-2 py-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-brand-600 dark:text-brand-400 font-semibold text-sm border border-slate-200 dark:border-slate-700 rounded-xl transition-colors">
                <Plus className="w-4 h-4" /> Aggiungi appuntamento manualmente
              </button>
            )}
          </div>
        </div>

        <Step2Preview />
        <Step3Settings />
      </div>

      <div className="lg:col-span-1 lg:border-l border-slate-200 dark:border-slate-800/50 lg:pl-8">
        <LaunchSidebar mode="launch" />
      </div>
    </div>
  );
}
