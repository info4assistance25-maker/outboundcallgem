import React from 'react';
import { useCampaign } from '../context/CampaignContext';
import { GemLogo } from './Icons';
import { LogOut, Sun, Moon } from 'lucide-react';
import { cn } from '../lib/utils';
import { Step1Upload, Step2Preview, Step3Settings } from './CampaignSteps';
import { LaunchSidebar } from './LaunchSidebar';
import { ContactLists } from './ContactLists';

import { AdminUsers } from './AdminUsers';

import { SupportSection } from './SupportSection';
import { StatsDashboard } from './StatsDashboard';

export function Navbar() {
  const { user, darkMode, toggleTheme, logout } = useCampaign();

  return (
    <nav className="sticky top-0 z-50 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-8">
            <a href="#" className="flex-shrink-0 flex items-center transition-opacity hover:opacity-80">
              <GemLogo className="w-28 lg:w-32 text-slate-900 dark:text-white" />
            </a>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest">Wildix System</span>
            </div>

            <div className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-700">
              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-300 uppercase shadow-sm">
                {user?.nome.charAt(0)}
              </div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 hidden sm:block">{user?.nome}</span>
            </div>

            <div className="flex items-center gap-1">
              <button 
                onClick={toggleTheme}
                className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"
                title="Cambia Tema"
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              <button 
                onClick={logout}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all"
                title="Esci"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

export function Dashboard() {
  const { user } = useCampaign();
  const isViewer = user?.role === 'Viewer';
  const isAdmin = user?.role === 'Admin' || user?.isAdmin;
  
  const [activeTab, setActiveTab] = React.useState<'campaign' | 'history' | 'users' | 'lists' | 'support' | 'stats'>(
    isViewer ? 'history' : 'campaign'
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200 flex flex-col">
      <Navbar />
      
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="mb-6 lg:mb-10 pl-1 animate-in fade-in slide-in-from-top-4 duration-500">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 dark:text-white mb-3 font-serif">
            {activeTab === 'users' ? 'Gestione ' : activeTab === 'lists' ? 'Le Tue ' : isViewer || activeTab === 'history' ? 'Storico ' : activeTab === 'support' ? 'Richiedi ' : activeTab === 'stats' ? 'Dashboard ' : 'Nuova '}
            <span className="text-slate-500 dark:text-slate-400 font-serif italic">
              {activeTab === 'users' ? 'Utenti' : activeTab === 'lists' ? 'Liste' : activeTab === 'support' ? 'Assistenza' : activeTab === 'stats' ? 'Statistiche' : 'Campagna'}
            </span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm lg:text-base font-normal max-w-2xl leading-relaxed">
            {activeTab === 'users' 
              ? 'Gestisci accessi, ruoli e permessi per gli utenti della piattaforma.'
              : activeTab === 'lists'
              ? 'Salva, gestisci o riutilizza le tue liste contatti precedentemente caricate.'
              : activeTab === 'support'
              ? 'Invia una richiesta direttamente al nostro team tecnico o amministrativo.'
              : activeTab === 'stats'
              ? 'Panoramica delle campagne, chiamate per operatore e log accessi.'
              : activeTab === 'history' || isViewer 
              ? 'Consulta lo storico delle campagne effettuate e scarica i report associati.'
              : 'Carica la lista contatti, definisci le tempistiche e avvia le chiamate sul centralino Wildix.'}
          </p>
        </div>

        <div className="flex space-x-1 sm:space-x-2 border-b border-slate-200 dark:border-slate-800 mb-8 overflow-x-auto pb-px">
          {!isViewer && (
            <button
              onClick={() => setActiveTab('campaign')}
              className={cn(
                "px-4 md:px-6 py-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap",
                activeTab === 'campaign' 
                  ? "border-brand-500 text-brand-600 dark:text-brand-400" 
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              Nuova Campagna
            </button>
          )}

          {!isViewer && (
            <button
              onClick={() => setActiveTab('lists')}
              className={cn(
                "px-4 md:px-6 py-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap",
                activeTab === 'lists' 
                  ? "border-brand-500 text-brand-600 dark:text-brand-400" 
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              Liste Salvate
            </button>
          )}
          
          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              "px-4 md:px-6 py-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap",
              activeTab === 'history' 
                ? "border-brand-500 text-brand-600 dark:text-brand-400" 
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            Storico Chiamate
          </button>

          <button
            onClick={() => setActiveTab('support')}
            className={cn(
              "px-4 md:px-6 py-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap",
              activeTab === 'support' 
                ? "border-brand-500 text-brand-600 dark:text-brand-400" 
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            Assistenza
          </button>

          <button
            onClick={() => setActiveTab('stats')}
            className={cn(
              "px-4 md:px-6 py-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap",
              activeTab === 'stats' 
                ? "border-brand-500 text-brand-600 dark:text-brand-400" 
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            Statistiche
          </button>

          {isAdmin && (
            <button
              onClick={() => setActiveTab('users')}
              className={cn(
                "px-4 md:px-6 py-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap",
                activeTab === 'users' 
                  ? "border-brand-500 text-brand-600 dark:text-brand-400" 
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              Gestione Utenti
            </button>
          )}
        </div>

        {activeTab === 'campaign' && !isViewer && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="space-y-6 lg:col-span-2">
              <Step1Upload />
              <Step2Preview />
              <Step3Settings />
            </div>
            <div className="lg:col-span-1 border-l-0 lg:border-l border-slate-200 dark:border-slate-800/50 pl-0 lg:pl-8">
              <LaunchSidebar mode="launch" />
            </div>
          </div>
        )}

        {activeTab === 'lists' && !isViewer && (
          <ContactLists onSelectProcess={() => setActiveTab('campaign')} />
        )}

        {activeTab === 'history' && (
          <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
            <LaunchSidebar mode="history" />
          </div>
        )}

        {activeTab === 'support' && (
          <SupportSection />
        )}

        {activeTab === 'stats' && (
          <StatsDashboard />
        )}

        {activeTab === 'users' && isAdmin && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <AdminUsers />
          </div>
        )}

      </main>
    </div>
  );
}
