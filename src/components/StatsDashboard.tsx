import React, { useEffect, useState } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { Phone, TrendingUp, Users, Clock, Shield } from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '../lib/utils';

interface AccessLog { ts: string; username: string; nome: string; action: string; }

export function StatsDashboard() {
  const { history, user } = useCampaign();
  const isAdmin = user?.isAdmin || user?.role === 'Admin';
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    setLogsLoading(true);
    fetch('/api/access-logs')
      .then(r => r.json())
      .then(d => setLogs(d.logs || []))
      .catch(() => {})
      .finally(() => setLogsLoading(false));
  }, [isAdmin]);

  // Ultimi 7 giorni — chiamate per giorno
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = startOfDay(subDays(new Date(), 6 - i));
    const label = format(d, 'dd/MM');
    const calls = history
      .filter(h => startOfDay(new Date(h.ts)).getTime() === d.getTime())
      .reduce((sum, h) => sum + h.count, 0);
    const campaigns = history.filter(h => startOfDay(new Date(h.ts)).getTime() === d.getTime()).length;
    return { label, calls, campaigns };
  });

  // Totali
  const totalCalls = history.reduce((s, h) => s + h.count, 0);
  const totalCampaigns = history.length;
  const avgCalls = totalCampaigns > 0 ? Math.round(totalCalls / totalCampaigns) : 0;
  const operators = [...new Set(history.map(h => h.opt))];

  // Per operatore
  const byOperator = operators.map(op => ({
    name: op,
    chiamate: history.filter(h => h.opt === op).reduce((s, h) => s + h.count, 0),
    campagne: history.filter(h => h.opt === op).length,
  })).sort((a, b) => b.chiamate - a.chiamate);

  const statCards = [
    { label: 'Chiamate Totali', value: totalCalls, icon: Phone, color: 'text-brand-600', bg: 'bg-brand-50 dark:bg-brand-900/20' },
    { label: 'Campagne Avviate', value: totalCampaigns, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { label: 'Media per Campagna', value: avgCalls, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    { label: 'Operatori Attivi', value: operators.length, icon: Users, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-900/20' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-soft">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", bg)}>
              <Icon className={cn("w-5 h-5", color)} />
            </div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white font-display">{value}</div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chiamate ultimi 7 giorni */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-soft">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-5 uppercase tracking-wider">Chiamate — ultimi 7 giorni</h3>
          {totalCalls === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-slate-400">Nessun dato disponibile</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={last7} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.1)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#94a3b8' }} itemStyle={{ color: '#e2e8f0' }} />
                <Bar dataKey="calls" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Chiamate" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Trend campagne */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-soft">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-5 uppercase tracking-wider">Campagne — trend 7 giorni</h3>
          {totalCampaigns === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-slate-400">Nessun dato disponibile</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={last7}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.1)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#94a3b8' }} itemStyle={{ color: '#e2e8f0' }} />
                <Line type="monotone" dataKey="campaigns" stroke="#10b981" strokeWidth={2.5} dot={{ fill: '#10b981', r: 3 }} name="Campagne" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Per operatore */}
      {byOperator.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-soft">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-5 uppercase tracking-wider">Per operatore</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider pb-3">Operatore</th>
                  <th className="text-right text-xs font-bold text-slate-500 uppercase tracking-wider pb-3">Campagne</th>
                  <th className="text-right text-xs font-bold text-slate-500 uppercase tracking-wider pb-3">Chiamate</th>
                  <th className="text-right text-xs font-bold text-slate-500 uppercase tracking-wider pb-3">Media</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {byOperator.map(op => (
                  <tr key={op.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 font-semibold text-slate-900 dark:text-white">{op.name}</td>
                    <td className="py-3 text-right text-slate-600 dark:text-slate-400">{op.campagne}</td>
                    <td className="py-3 text-right font-bold text-brand-600 dark:text-brand-400">{op.chiamate}</td>
                    <td className="py-3 text-right text-slate-500">{op.campagne > 0 ? Math.round(op.chiamate / op.campagne) : 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Log accessi — solo admin */}
      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-soft">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex items-center gap-2">
            <Shield className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Log Accessi</h3>
          </div>
          {logsLoading ? (
            <div className="p-8 text-center text-sm text-slate-400">Caricamento...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">Nessun accesso registrato</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
              {logs.slice(0, 50).map((log, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300 uppercase">
                      {log.nome?.charAt(0) || '?'}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">{log.nome}</div>
                      <div className="text-xs text-slate-500">@{log.username}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={cn("text-xs font-bold px-2 py-0.5 rounded-full", log.action === 'login' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400')}>
                      {log.action === 'login' ? 'Accesso' : 'Uscita'}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">{format(new Date(log.ts), 'dd MMM HH:mm', { locale: it })}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
