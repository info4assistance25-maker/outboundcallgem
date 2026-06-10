import React, { createContext, useContext, useState, useEffect } from 'react';
import { isValidPhoneNumber } from '../lib/utils';
import * as XLSX from 'xlsx';

export interface User {
  username: string;
  nome: string;
  role?: string;
  isAdmin?: boolean;
  canSchedule?: boolean;
}

export interface Contact {
  id: string;
  nome: string;
  numero: string;
  inv?: boolean;
  dup?: boolean;
}

export interface ContactList {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  contacts: Contact[];
}

export interface HistoryItem {
  ts: string;
  count: number;
  scheduledAt: string | null;
  opt: string;
  chunkSize: number;
  contactsList?: Contact[];
}

interface CampaignContextType {
  user: User | null;
  login: (u: string, p: string) => Promise<any>;
  verifyOtp: (u: string, otp: string) => Promise<any>;
  logout: () => void;
  
  contacts: Contact[];
  setContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
  updateManualContacts: (newContacts: Contact[]) => void;
  validContacts: Contact[];
  invalidCount: number;
  duplicateCount: number;

  uploadMode: 'csv' | 'xls' | 'manual';
  setUploadMode: (m: 'csv' | 'xls' | 'manual') => void;

  scheduleMode: 'now' | 'later';
  setScheduleMode: (m: 'now' | 'later') => void;
  scheduledAt: string;
  setScheduledAt: (s: string) => void;
  concurrency: number;
  setConcurrency: (c: number) => void;

  isLaunching: boolean;
  launchStatus: { type: 'idle' | 'load' | 'ok' | 'err'; msg: string };
  launchCampaign: () => Promise<void>;
  
  history: HistoryItem[];
  clearHistory: () => void;

  lists: ContactList[];
  saveList: (name: string, contactsToSave: Contact[]) => void;
  deleteList: (id: string) => void;
  loadList: (id: string) => void;

  darkMode: boolean;
  toggleTheme: () => void;
}

const CampaignContext = createContext<CampaignContextType | null>(null);

export function CampaignProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  
  // UI States
  const [uploadMode, setUploadMode] = useState<'csv' | 'xls' | 'manual'>('csv');
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const [scheduledAt, setScheduledAt] = useState<string>('');
  const [concurrency, setConcurrency] = useState<number>(1);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchStatus, setLaunchStatus] = useState<{ type: 'idle' | 'load' | 'ok' | 'err', msg: string }>({ type: 'idle', msg: '' });
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [lists, setLists] = useState<ContactList[]>([]);
  const [darkMode, setDarkMode] = useState(false);

  // Load persistence
  useEffect(() => {
    const s = sessionStorage.getItem('gem_session');
    if (s) setUser(JSON.parse(s));

    const h = localStorage.getItem('gem_history');
    if (h) setHistory(JSON.parse(h));

    const lst = localStorage.getItem('gem_lists');
    if (lst) setLists(JSON.parse(lst));

    const theme = localStorage.getItem('gem_theme');
    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
      setDarkMode(true);
    }
  }, []);

  const login = async (u: string, p: string) => {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p })
      });
      const data = await res.json();
      return data;
    } catch (err) {
      console.error(err);
      return { ok: false, error: "Errore di rete" };
    }
  };

  const verifyOtp = async (u: string, otp: string) => {
    try {
      const res = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, otp })
      });
      const data = await res.json();
      
      if (res.ok && data.ok) {
        const loggedUser = { username: data.username, nome: data.nome, role: data.role, isAdmin: data.isAdmin, canSchedule: data.canSchedule };
        setUser(loggedUser);
        sessionStorage.setItem('gem_session', JSON.stringify(loggedUser));
        return { ok: true };
      }
      return data;
    } catch (err) {
      console.error(err);
      return { ok: false, error: "Errore di rete" };
    }
  };

  const logout = () => {
    sessionStorage.removeItem('gem_session');
    setUser(null);
  };

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    setDarkMode(isDark);
    localStorage.setItem('gem_theme', isDark ? 'dark' : 'light');
  };

  // Contacts deduplication and validation logic
  const evaluateContacts = (raw: Contact[]) => {
    const seen = new Set();
    return raw.map(c => {
      const numStr = String(c.numero || '');
      const k = numStr.replace(/\s/g, '');
      const inv = !isValidPhoneNumber(numStr);
      const dup = Boolean(k && seen.has(k));
      if (!dup && k) seen.add(k);
      return { ...c, inv, dup };
    });
  };

  const updateManualContacts = (newContacts: Contact[]) => {
    setContacts(evaluateContacts(newContacts));
  };

  // Keep derived state clean
  const evaluated = evaluateContacts(contacts);
  const validContacts = evaluated.filter(c => !c.inv && !c.dup && String(c.nome || '').trim() && String(c.numero || '').trim());
  const invalidCount = evaluated.filter(c => c.inv).length;
  const duplicateCount = evaluated.filter(c => c.dup).length;

  const saveHistory = (count: number, sched: string | null, chunk: number, contactsList?: Contact[]) => {
    const newItems = [{ ts: new Date().toISOString(), count, scheduledAt: sched, opt: user?.nome || 'Operatore', chunkSize: chunk, contactsList }, ...history].slice(0, 20);
    setHistory(newItems);
    localStorage.setItem('gem_history', JSON.stringify(newItems));
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('gem_history');
  };

  const saveList = (name: string, contactsToSave: Contact[]) => {
    const list: ContactList = {
      id: Date.now().toString(),
      name,
      createdBy: user?.nome || 'User',
      createdAt: new Date().toISOString(),
      contacts: contactsToSave.map(c => ({...c})), // deep copy
    };
    const newLists = [list, ...lists];
    setLists(newLists);
    localStorage.setItem('gem_lists', JSON.stringify(newLists));
  };

  const deleteList = (id: string) => {
    const newLists = lists.filter(l => l.id !== id);
    setLists(newLists);
    localStorage.setItem('gem_lists', JSON.stringify(newLists));
  };

  const loadList = (id: string) => {
    const list = lists.find(l => l.id === id);
    if (list) {
      setContacts(list.contacts);
      setUploadMode('manual');
    }
  };

  const launchCampaign = async () => {
    if (!validContacts.length) return;

    let targetAt: string | null = null;
    if (scheduleMode === 'later') {
      if (!scheduledAt) {
        setLaunchStatus({ type: 'err', msg: 'Seleziona data e ora' });
        return;
      }
      const target = new Date(scheduledAt);
      if (target <= new Date()) {
        setLaunchStatus({ type: 'err', msg: 'Seleziona un orario futuro' });
        return;
      }
      targetAt = target.toISOString();
    }

    setIsLaunching(true);
    setLaunchStatus({ type: 'load', msg: `Preparazione invio di ${validContacts.length} contatti...` });

    // Chunking logic (Matches Vanilla Original exactly)
    const chunks = [];
    for (let i = 0; i < validContacts.length; i += concurrency) {
      chunks.push(validContacts.slice(i, i + concurrency));
    }

    try {
      const results = await Promise.all(chunks.map((chunk, idx) => 
        fetch('https://hook.eu1.make.com/ac3icgiyh1nbvvh463w33qh58uenvfgo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contatti: chunk,
            totale: chunk.length,
            avviatoIl: new Date().toISOString(),
            scheduledAt: targetAt,
            modalita: targetAt ? 'scheduled' : 'immediate',
            operatore: user?.nome,
            fonte: 'gem-dashboard-react',
            chunk: idx + 1,
            chunks_totali: chunks.length
          })
        })
      ));

      const okCount = results.filter(r => r.ok || r.status === 200).length;
      if (okCount === chunks.length) {
        setLaunchStatus({ type: 'ok', msg: `Campagna inviata — ${validContacts.length} chiamate in elaborazione.` });
        saveHistory(validContacts.length, targetAt, concurrency, validContacts.map(c => ({...c})));
      } else {
        setLaunchStatus({ type: 'err', msg: `${okCount}/${chunks.length} blocchi inviati correttamente.` });
      }
    } catch(err: any) {
      setLaunchStatus({ type: 'err', msg: 'Errore di rete: ' + err.message });
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <CampaignContext.Provider value={{
      user, login, verifyOtp, logout,
      contacts: evaluated, setContacts, validContacts, invalidCount, duplicateCount, updateManualContacts,
      uploadMode, setUploadMode,
      scheduleMode, setScheduleMode, scheduledAt, setScheduledAt, concurrency, setConcurrency,
      isLaunching, launchStatus, launchCampaign,
      history, clearHistory,
      lists, saveList, deleteList, loadList,
      darkMode, toggleTheme
    }}>
      {children}
    </CampaignContext.Provider>
  );
}

export function useCampaign() {
  const ctx = useContext(CampaignContext);
  if (!ctx) throw new Error("useCampaign must be used within a CampaignProvider");
  return ctx;
}
