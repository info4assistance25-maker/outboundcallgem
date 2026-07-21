import React, { useState, useEffect } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { Users, Trash2, Plus, Loader2, Edit2, X, Save, ShieldCheck, ShieldOff } from 'lucide-react';
import { cn } from '../lib/utils';
import { ConfirmModal } from './ConfirmModal';
import { SkeletonUserRow, EmptyState } from './Skeleton';
import { authFetch } from '../lib/authFetch';

interface EditingState {
  username: string;
  nome: string;
  password?: string; // vuoto = non cambiare la password esistente
  role: string;
  canSchedule: boolean;
}

export function AdminUsers() {
  const { user } = useCampaign();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newNome, setNewNome] = useState('');
  const [newRole, setNewRole] = useState('Editor');
  const [newCanSchedule, setNewCanSchedule] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [editingUser, setEditingUser] = useState<EditingState | null>(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.isAdmin) {
      fetchUsers();
    }
  }, [user]);

  const handleDelete = async (username: string) => {
    setConfirmDeleteUser(null);
    try {
      const res = await authFetch(`/api/users/${username}`, { method: 'DELETE' });
      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'Errore durante l\'eliminazione');
      }
    } catch (err) {
      console.error(err);
      alert('Errore di rete');
    }
  };

  const handleToggle2FA = async (username: string, currentlyRequired: boolean) => {
    const nextEnabled = !currentlyRequired;
    // Aggiornamento ottimistico
    setUsers(prev => prev.map(u => u.username === username ? { ...u, twoFactorRequired: nextEnabled, twoFactorEnabled: nextEnabled ? false : u.twoFactorEnabled } : u));
    try {
      const res = await authFetch(`/api/users/${username}/2fa`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextEnabled })
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Errore durante la modifica del 2FA');
        fetchUsers(); // rollback
      }
    } catch (err) {
      console.error(err);
      alert('Errore di rete');
      fetchUsers(); // rollback
    }
  };

  const handleEditStart = (u: any) => {
    setEditingUser({
      username: u.username,
      nome: u.nome,
      password: '', // vuoto = mantieni la password esistente
      role: u.role || (u.isAdmin ? 'Admin' : 'Editor'),
      canSchedule: u.canSchedule === true
    });
  };

  const handleEditCancel = () => {
    setEditingUser(null);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editingUser.nome || !editingUser.role) {
       alert("Compila tutti i campi");
       return;
    }

    try {
      const res = await authFetch(`/api/users/${editingUser.username}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: editingUser.nome,
          password: editingUser.password || undefined, // vuoto = non cambiare
          role: editingUser.role,
          canSchedule: editingUser.canSchedule
        })
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setEditingUser(null);
        fetchUsers();
      } else {
        alert(data.error || 'Errore durante la modifica');
      }
    } catch (err) {
      console.error(err);
      alert('Errore di rete');
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newPassword || !newNome || !newRole) {
      setError('Compila tutti i campi');
      return;
    }
    
    setError('');
    setIsAdding(true);
    
    try {
      const res = await authFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: newUsername, 
          password: newPassword, 
          nome: newNome, 
          role: newRole,
          canSchedule: newCanSchedule
        })
      });
      
      const data = await res.json();
      if (res.ok && data.ok) {
        setNewUsername('');
        setNewPassword('');
        setNewNome('');
        setNewRole('Editor');
        setNewCanSchedule(true);
        fetchUsers();
      } else {
        setError(data.error || "Errore durante la creazione");
      }
    } catch (err) {
      setError('Errore di rete');
    } finally {
      setIsAdding(false);
    }
  };

  if (!user?.isAdmin) return null;

  return (
    <>
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-soft overflow-hidden mb-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-700/50 text-brand-700 dark:text-brand-300 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">Gestione Utenti</h2>
        </div>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Users className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Cerca utente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      <div className="p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {loading ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {[...Array(4)].map((_, i) => <SkeletonUserRow key={i} />)}
            </div>
          ) : (
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="grid grid-cols-[2fr_2fr_1.4fr_2fr_1fr_auto] bg-slate-50 dark:bg-slate-800/80 p-3 border-b border-slate-200 dark:border-slate-700 gap-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <span>Nome</span>
                <span>Username</span>
                <span>2FA</span>
                <span>Ruolo</span>
                <span className="text-center" title="Schedulazione Campagna">Sched.</span>
                <span></span>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {users
                  .filter(u => 
                    u.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (u.role || '').toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((u) => {
                  const isEditing = editingUser?.username === u.username;
                  
                  if (isEditing) {
                    return (
                      <div key={u.username} className="bg-brand-50 dark:bg-brand-900/10 border-b border-brand-100 dark:border-brand-800 p-4 last:border-0">
                        <form onSubmit={handleEditSave} className="space-y-3">
                          {/* Nome + Username */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nome</label>
                              <input 
                                type="text" 
                                required
                                value={editingUser.nome}
                                onChange={e => setEditingUser({...editingUser, nome: e.target.value})}
                                className="w-full px-2.5 py-1.5 text-sm bg-white dark:bg-slate-900 border border-brand-300 dark:border-brand-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Username</label>
                              <div className="px-2.5 py-1.5 text-sm text-slate-500 truncate">{u.username}</div>
                            </div>
                          </div>

                          {/* Ruolo + Nuova password */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Ruolo</label>
                              <select 
                                value={editingUser.role}
                                onChange={e => setEditingUser({...editingUser, role: e.target.value})}
                                className="w-full px-2.5 py-1.5 text-sm bg-white dark:bg-slate-900 border border-brand-300 dark:border-brand-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-500"
                              >
                                <option value="Admin">Admin</option>
                                <option value="Editor">Editor</option>
                                <option value="Viewer">Viewer</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nuova password</label>
                              <input 
                                type="text" 
                                placeholder="lascia vuoto per non cambiare"
                                title="Lascia vuoto per non cambiare la password"
                                value={editingUser.password}
                                onChange={e => setEditingUser({...editingUser, password: e.target.value})}
                                className="w-full px-2.5 py-1.5 text-sm bg-white dark:bg-slate-900 border border-brand-300 dark:border-brand-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-500 placeholder:text-slate-400 placeholder:italic placeholder:text-xs"
                              />
                            </div>
                          </div>

                          {/* 2FA (sola lettura qui: si gestisce dalla riga normale) + Sched + azioni */}
                          <div className="flex items-center justify-between gap-3 pt-1">
                            <div className="flex items-center gap-4">
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                                {u.twoFactorRequired === false ? (
                                  <ShieldOff className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                                ) : u.twoFactorEnabled ? (
                                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                ) : (
                                  <ShieldCheck className="w-4 h-4 text-amber-500" />
                                )}
                                2FA: {u.twoFactorRequired === false ? 'disattivato' : u.twoFactorEnabled ? 'attivo' : 'da configurare'}
                              </span>
                              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  checked={editingUser.canSchedule}
                                  onChange={e => setEditingUser({...editingUser, canSchedule: e.target.checked})}
                                  className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                                />
                                Schedulazione
                              </label>
                            </div>
                            <div className="flex items-center gap-1">
                              <button type="submit" className="w-8 h-8 flex items-center justify-center text-green-600 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 rounded-lg transition-colors">
                                <Save className="w-4 h-4" />
                              </button>
                              <button type="button" onClick={handleEditCancel} className="w-8 h-8 flex items-center justify-center text-slate-500 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </form>
                      </div>
                    );
                  }

                  const hasSchedule = u.canSchedule === true;

                  return (
                    <div key={u.username} className="grid grid-cols-[2fr_2fr_1.4fr_2fr_1fr_auto] gap-3 p-3 items-center border-b border-slate-100 dark:border-slate-800/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/30 text-sm">
                      <span className="font-medium text-slate-900 dark:text-slate-200 truncate" title={u.nome}>{u.nome}</span>
                      <span className="text-slate-500 truncate" title={u.username}>{u.username}</span>
                      <button
                        onClick={() => handleToggle2FA(u.username, u.twoFactorRequired !== false)}
                        title={
                          u.twoFactorRequired === false
                            ? 'Clicca per RICHIEDERE il 2FA a questo utente (dovrà rifare il setup)'
                            : u.twoFactorEnabled
                              ? 'Clicca per DISATTIVARE il 2FA (l\'utente accederà con solo utente/password)'
                              : '2FA richiesto ma non ancora configurato dall\'utente — clicca per disattivarlo'
                        }
                        className={cn(
                          "inline-flex items-center gap-1.5 w-fit px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-colors cursor-pointer",
                          u.twoFactorRequired === false
                            ? "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                            : u.twoFactorEnabled
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
                              : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800"
                        )}
                      >
                        {u.twoFactorRequired === false ? (
                          <ShieldOff className="w-3.5 h-3.5" />
                        ) : (
                          <ShieldCheck className="w-3.5 h-3.5" />
                        )}
                        {u.twoFactorRequired === false ? 'Off' : u.twoFactorEnabled ? 'On' : 'Da fare'}
                      </button>
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full w-fit",
                        u.role === 'Admin' || u.isAdmin ? "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400" :
                        u.role === 'Viewer' ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" :
                        "bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400"
                      )}>
                        {u.role || (u.isAdmin ? 'Admin' : 'Editor')}
                      </span>
                      <div className="flex justify-center">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          hasSchedule ? "bg-green-500" : "bg-slate-300 dark:bg-slate-600"
                        )} title={hasSchedule ? 'Abilitato' : 'Disabilitato'} />
                      </div>
                      <div className="flex justify-end gap-1">
                        <button 
                          onClick={() => handleEditStart(u)}
                          className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {u.username.toLowerCase() !== 'admin' && (
                          <button 
                            onClick={() => setConfirmDeleteUser(u.username)}
                            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <form onSubmit={handleAdd} className="bg-slate-50 dark:bg-slate-800/50 p-4 border border-slate-200 dark:border-slate-700 rounded-xl space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Nuovo Utente</h3>
            
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">Nome</label>
              <input 
                type="text" 
                value={newNome}
                onChange={e => setNewNome(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:border-brand-500 dark:focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none transition-all"
                placeholder="Mario Rossi"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">Username</label>
              <input 
                type="text" 
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:border-brand-500 dark:focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none transition-all"
                placeholder="mario.rossi"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">Password</label>
              <input 
                type="text" 
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:border-brand-500 dark:focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none transition-all"
                placeholder="Password"
              />
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">Ruolo</label>
                <select 
                  value={newRole}
                  onChange={e => setNewRole(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:border-brand-500 dark:focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 text-slate-900 dark:text-slate-100 focus:outline-none transition-all"
                >
                  <option value="Admin">Admin</option>
                  <option value="Editor">Editor</option>
                  <option value="Viewer">Viewer</option>
                </select>
              </div>

              {/* Role Descriptions */}
              <div className="text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                {newRole === 'Admin' && <p><strong>Admin:</strong> Gestione utenti completa e controllo su tutte le campagne.</p>}
                {newRole === 'Editor' && <p><strong>Editor:</strong> Può caricare contatti e lanciare campagne.</p>}
                {newRole === 'Viewer' && <p><strong>Viewer:</strong> Sola lettura per lo storico delle campagne.</p>}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  id="canSchedule"
                  checked={newCanSchedule}
                  onChange={e => setNewCanSchedule(e.target.checked)}
                  className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 border-slate-300"
                />
                <label htmlFor="canSchedule" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Abilita Schedulazione Campagne
                </label>
              </div>
            </div>

            {error && <div className="text-red-500 text-xs font-medium">{error}</div>}

            <button 
              type="submit"
              disabled={isAdding}
              className="w-full py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-70 mt-2"
            >
              {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {isAdding ? 'Aggiunta in corso...' : 'Aggiungi'}
            </button>
          </form>
        </div>
      </div>
    </div>
    <ConfirmModal
      open={!!confirmDeleteUser}
      title="Elimina utente"
      message={`Vuoi eliminare l'utente "${confirmDeleteUser}"? Questa azione non può essere annullata.`}
      confirmLabel="Elimina"
      onConfirm={() => confirmDeleteUser && handleDelete(confirmDeleteUser)}
      onCancel={() => setConfirmDeleteUser(null)}
    />
    </>
  );
}
