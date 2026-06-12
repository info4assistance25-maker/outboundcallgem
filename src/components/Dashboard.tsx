import React, { useState } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { GemLogo } from './Icons';
import { LogOut, Sun, Moon, Plus, List, Clock, User, LifeBuoy, BarChart2, Users, Phone, Menu, X, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { Step1Upload, Step2Preview, Step3Settings } from './CampaignSteps';
import { LaunchSidebar } from './LaunchSidebar';
import { ContactLists } from './ContactLists';
import { AdminUsers } from './AdminUsers';
import { AdminVoicebots } from './AdminVoicebots';
import { SupportSection } from './SupportSection';
import { StatsDashboard } from './StatsDashboard';
import { ProfileSection } from './ProfileSection';

type Tab = 'campaign' | 'lists' | 'history' | 'profile' | 'support' | 'stats' | 'users' | 'voicebots';

interface NavItem {
  id: Tab;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  viewerHidden?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  adminOnly?: boolean;
  viewerOnly?: boolean;
}

const NAV_GROUPS = [
  {
    label: 'Campagne',
    items: [
      { id: 'campaign' as Tab, label: 'Nuova Campagna', icon: Plus, viewerHidden: true },
      { id: 'lists' as Tab, label: 'Liste Salvate', icon: List, viewerHidden: true },
      { id: 'history' as Tab, label: 'Storico Chiamate', icon: Clock },
    ]
  },
  {
    label: 'Account',
    items: [
      { id: 'profile' as Tab, label: 'Il Mio Profilo', icon: User },
      { id: 'support' as Tab, label: 'Assistenza', icon: LifeBuoy },
    ]
  },
  {
    label: 'Report',
    items: [
      { id: 'stats' as Tab, label: 'Statistiche', icon: BarChart2, adminOnly: false },
    ]
  },
  {
    label: 'Amministrazione',
    adminOnly: true,
    items: [
      { id: 'users' as Tab, label: 'Gestione Utenti', icon: Users, adminOnly: true },
      { id: 'voicebots' as Tab, label: 'Voicebot', icon: Phone, adminOnly: true },
    ]
  },
];

const TAB_META: Record<Tab, { title: string; subtitle: string }> = {
  campaign: { title: 'Nuova Campagna', subtitle: 'Carica la lista contatti, definisci le tempistiche e avvia le chiamate sul centralino Wildix.' },
  lists: { title: 'Liste Salvate', subtitle: 'Salva, gestisci o riutilizza le tue liste contatti precedentemente caricate.' },
  history: { title: 'Storico Chiamate', subtitle: 'Consulta lo storico delle campagne effettuate e scarica i report associati.' },
  profile: { title: 'Il Mio Profilo', subtitle: 'Gestisci le tue informazioni di contatto e le impostazioni del tuo account.' },
  support: { title: 'Assistenza', subtitle: 'Invia una richiesta direttamente al nostro team tecnico o amministrativo.' },
  stats: { title: 'Statistiche', subtitle: 'Panoramica delle campagne, chiamate per operatore e log accessi.' },
  users: { title: 'Gestione Utenti', subtitle: 'Gestisci accessi, ruoli e permessi per gli utenti della piattaforma.' },
  voicebots: { title: 'Gestione Voicebot', subtitle: 'Configura i voicebot disponibili sul centralino Wildix per le campagne.' },
};

export function Dashboard() {
  const { user, darkMode, toggleTheme, logout } = useCampaign();
  const isAdmin = user?.isAdmin || user?.role === 'Admin';
  const isViewer = user?.role === 'Viewer';
  const savedTab = sessionStorage.getItem('gem_active_tab') as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>(savedTab || (isViewer ? 'history' : 'campaign'));
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleNav = (tab: Tab) => {
    setActiveTab(tab);
    sessionStorage.setItem('gem_active_tab', tab);
    setSidebarOpen(false);
  };

  // Ascolta navigazione da altri componenti (es. link "Vai in Assistenza")
  React.useEffect(() => {
    const handler = (e: Event) => handleNav((e as CustomEvent).detail as Tab);
    window.addEventListener('gem:nav', handler);
    return () => window.removeEventListener('gem:nav', handler);
  }, []);

  const meta = TAB_META[activeTab];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex transition-colors duration-200" style={{minHeight:'100dvh'}}>

      {/* SIDEBAR */}
      <>
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        <aside className={cn(
          "fixed top-0 left-0 h-full z-50 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-300 shadow-xl lg:shadow-none",
          "lg:sticky lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )} style={{width: 'clamp(220px, 16vw, 260px)', minHeight: '100dvh'}}>
          {/* Logo */}
          <div className="flex items-center justify-between px-5 h-16 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <GemLogo className="w-28 text-slate-900 dark:text-white" />
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-700 dark:hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav groups */}
          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
            {NAV_GROUPS.map(group => {
              if (group.adminOnly && !isAdmin) return null;
              if (group.viewerOnly && !isViewer) return null;
              const visibleItems = group.items.filter(item => {
                if (item.adminOnly && !isAdmin) return false;
                if (item.viewerHidden && isViewer) return false;
                return true;
              });
              if (!visibleItems.length) return null;
              return (
                <div key={group.label}>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">{group.label}</div>
                  <div className="space-y-0.5">
                    {visibleItems.map(item => {
                      const Icon = item.icon;
                      const active = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleNav(item.id)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-left",
                            active
                              ? "bg-brand-600 text-white shadow-sm"
                              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                          )}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="flex-1">{item.label}</span>
                          {active && <ChevronRight className="w-3.5 h-3.5 opacity-70" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          {/* User + actions */}
          <div className="border-t border-slate-200 dark:border-slate-800 p-3 shrink-0">
            {/* Wildix status */}
            <div className="flex items-center gap-2 px-3 py-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Wildix · Attivo</span>
            </div>
            {/* User row */}
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 mb-2">
              <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-xs font-bold text-brand-700 dark:text-brand-300 uppercase shrink-0">
                {user?.nome?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user?.nome}</div>
                <div className="text-xs text-slate-500 truncate">{user?.role || 'Editor'}</div>
              </div>
            </div>
            {/* Theme + logout */}
            <div className="flex gap-2">
              <button
                onClick={toggleTheme}
                className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                {darkMode ? 'Chiaro' : 'Scuro'}
              </button>
              <button
                onClick={logout}
                className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Esci
              </button>
            </div>
          </div>
        </aside>
      </>

      {/* MAIN */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between h-14 px-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-500 hover:text-slate-900 dark:hover:text-white">
            <Menu className="w-5 h-5" />
          </button>
          <GemLogo className="w-24 text-slate-900 dark:text-white" />
          <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-xs font-bold text-brand-700 dark:text-brand-300 uppercase">
            {user?.nome?.charAt(0)}
          </div>
        </header>

        {/* Page header */}
        <div className="px-6 lg:px-10 pt-8 pb-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-serif">
            {meta.title}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">{meta.subtitle}</p>
        </div>

        {/* Content */}
        <main className="flex-1 px-6 lg:px-10 py-8">

          {activeTab === 'campaign' && !isViewer && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="space-y-6 lg:col-span-2">
                <Step1Upload />
                <Step2Preview />
                <Step3Settings />
              </div>
              <div className="lg:col-span-1 lg:border-l border-slate-200 dark:border-slate-800/50 lg:pl-8">
                <LaunchSidebar mode="launch" />
              </div>
            </div>
          )}

          {activeTab === 'lists' && !isViewer && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <ContactLists onSelectProcess={() => handleNav('campaign')} />
            </div>
          )}

          {activeTab === 'history' && (
            <div className="max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-300">
              <LaunchSidebar mode="history" />
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <ProfileSection />
            </div>
          )}

          {activeTab === 'support' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <SupportSection />
            </div>
          )}

          {activeTab === 'stats' && (isAdmin || isViewer) && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <StatsDashboard />
            </div>
          )}

          {activeTab === 'users' && isAdmin && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <AdminUsers />
            </div>
          )}

          {activeTab === 'voicebots' && isAdmin && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <AdminVoicebots />
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
