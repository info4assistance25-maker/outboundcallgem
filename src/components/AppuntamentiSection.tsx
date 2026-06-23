import React, { useRef } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { UploadCloud, DownloadCloud, Plus, Trash2, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../lib/utils';

export function AppuntamentiSection() {
  const { user, contacts, setContacts, updateManualContacts, setCampaignType } = useCampaign();
  const fileInputRefApp = useRef<HTMLInputElement>(null);
  const isViewer = user?.role === 'Viewer';

  const downloadAppointmentTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Nome', 'Numero', 'Data', 'Ora'],
      ['Mario Rossi', '+393331234567', '22/06/2026', '10:00'],
      ['Giulia Bianchi', '+393334567890', '22/06/2026', '11:30'],
    ]);
    ws['!cols'] = [{ wch: 20 }, { wch: 18 }, { wch: 14 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Appuntamenti');
    XLSX.writeFile(wb, 'template_appuntamenti.xlsx');
  };

  const handleAppointmentExcel = (file: File) => {
    if (!file || isViewer) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        if (!e.target?.result) return;
        const wb = XLSX.read(e.target.result, { type: 'array', raw: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
        const out = [];

        const excelSerialToDate = (serial: number): string => {
          const excelEpoch = new Date(1899, 11, 30);
          const date = new Date(excelEpoch.getTime() + serial * 86400000);
          const dd = String(date.getDate()).padStart(2, '0');
          const mm = String(date.getMonth() + 1).padStart(2, '0');
          const yyyy = date.getFullYear();
          return `${dd}/${mm}/${yyyy}`;
        };

        const formatDate = (val: any): string => {
          if (!val && val !== 0) return '';
          const s = String(val).trim();
          if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
          const num = parseFloat(s);
          if (!isNaN(num) && num > 40000 && num < 60000) return excelSerialToDate(Math.floor(num));
          return s;
        };

        const formatTime = (val: any): string => {
          if (!val && val !== 0) return '';
          const s = String(val).trim();
          if (/^\d{1,2}:\d{2}$/.test(s)) return s.padStart(5, '0');
          const num = parseFloat(s);
          if (!isNaN(num) && num >= 0 && num < 1) {
            const totalMinutes = Math.round(num * 24 * 60);
            const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
            const mm = String(totalMinutes % 60).padStart(2, '0');
            return `${hh}:${mm}`;
          }
          return s;
        };

        for (const row of rows) {
          const nome = String(row[0] || '').trim();
          const numero = String(row[1] || '').trim();
          const data = formatDate(row[2]);
          const ora = formatTime(row[3]);
          if (!nome || !numero) continue;
          if (['nome', 'name'].includes(nome.toLowerCase())) continue;
          out.push({ id: crypto.randomUUID(), nome, numero, data_appuntamento: data, ora_appuntamento: ora });
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

  const handleManualAppointmentAdd = () => {
    if (isViewer) return;
    setCampaignType('appuntamenti');
    updateManualContacts([...contacts, { id: crypto.randomUUID(), nome: '', numero: '', data_appuntamento: '', ora_appuntamento: '' }]);
  };

  const updateAppointmentRow = (id: string, field: 'nome' | 'numero' | 'data_appuntamento' | 'ora_appuntamento', val: string) => {
    if (isViewer) return;
    updateManualContacts(contacts.map(c => c.id === id ? { ...c, [field]: val } : c));
  };

  const deleteAppointmentRow = (id: string) => {
    if (isViewer) return;
    updateManualContacts(contacts.filter(c => c.id !== id));
  };

  return (
    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200 bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-soft">
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-3 rounded-xl text-sm font-medium text-blue-700 dark:text-blue-300">
        <strong>Formato richiesto:</strong> Colonne <code>Nome</code>, <code>Numero</code>, <code>Data</code> (gg/mm/aaaa), <code>Ora</code> (HH:MM)
      </div>

      {isViewer ? (
        <div className="p-8 text-center text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
          Non hai i permessi per caricare appuntamenti
        </div>
      ) : (
        <div
          className="border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl p-10 text-center hover:bg-accent-50 dark:hover:bg-accent-500/10 hover:border-accent-400 transition-colors cursor-pointer group"
          onClick={() => fileInputRefApp.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) handleAppointmentExcel(file);
          }}
        >
          <UploadCloud className="w-10 h-10 mx-auto mb-3 text-slate-400 group-hover:text-brand-500 dark:group-hover:text-brand-400 transition-colors group-hover:scale-110" />
          <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Carica Excel appuntamenti</p>
          <p className="text-xs text-slate-500">Trascina qui o clicca per selezionare (.xlsx)</p>
          <input type="file" accept=".xlsx,.xls" ref={fileInputRefApp} className="hidden"
            onChange={e => { const file = e.target.files?.[0]; if (file) handleAppointmentExcel(file); e.target.value = ''; }} />
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          <span>Richiesto: Nome | Numero | Data | Ora</span>
        </div>
        <button onClick={downloadAppointmentTemplate} className="flex items-center gap-1.5 text-brand-600 dark:text-brand-400 hover:underline font-semibold">
          <DownloadCloud className="w-3.5 h-3.5" /> Scarica template
        </button>
      </div>

      <div className="relative flex items-center gap-3 py-1">
        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700"></div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">oppure inserisci manualmente</span>
        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700"></div>
      </div>

      {contacts.length > 0 && (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1.3fr_1.3fr_1fr_0.8fr_40px] bg-slate-50 dark:bg-slate-800/80 p-3 border-b border-slate-200 dark:border-slate-700 gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Nome</span>
            <span>Numero</span>
            <span>Data</span>
            <span>Ora</span>
            <span />
          </div>
          <div className="max-h-[280px] overflow-y-auto">
            {contacts.map(c => (
              <div key={c.id} className="grid grid-cols-[1.3fr_1.3fr_1fr_0.8fr_40px] gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0 items-center hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <input type="text" placeholder="Mario Rossi" value={c.nome} disabled={isViewer} onChange={e => updateAppointmentRow(c.id, 'nome', e.target.value)} className="w-full bg-white dark:bg-slate-900 px-2 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-500" />
                <input type="text" placeholder="+39..." value={c.numero} disabled={isViewer} onChange={e => updateAppointmentRow(c.id, 'numero', e.target.value)} className={cn("w-full bg-white dark:bg-slate-900 px-2 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-500", c.inv && c.numero.length > 3 && "!border-red-400 !bg-red-50 dark:!bg-red-900/20")} />
                <input type="text" placeholder="gg/mm/aaaa" value={c.data_appuntamento || ''} disabled={isViewer} onChange={e => updateAppointmentRow(c.id, 'data_appuntamento', e.target.value)} className="w-full bg-white dark:bg-slate-900 px-2 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-500" />
                <input type="text" placeholder="HH:MM" value={c.ora_appuntamento || ''} disabled={isViewer} onChange={e => updateAppointmentRow(c.id, 'ora_appuntamento', e.target.value)} className="w-full bg-white dark:bg-slate-900 px-2 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-500" />
                {!isViewer && (
                  <button 
                    onClick={() => deleteAppointmentRow(c.id)}
                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!isViewer && (
        <button onClick={handleManualAppointmentAdd} className="w-full flex items-center justify-center gap-2 py-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-brand-600 dark:text-brand-400 font-semibold text-sm border border-slate-200 dark:border-slate-700 rounded-xl transition-colors">
          <Plus className="w-4 h-4" /> Aggiungi appuntamento manualmente
        </button>
      )}
    </div>
  );
}
