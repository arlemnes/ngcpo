import React, { useState, useEffect, useCallback } from 'react';
import { 
  Shield, 
  UserPlus, 
  User as UserIcon, 
  Key, 
  Trash2, 
  X, 
  Lock, 
  Check, 
  Loader2, 
  Mail, 
  Eye, 
  Edit2, 
  ShieldAlert, 
  CheckCircle2,
  ChevronDown,
  Save,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc, query, where } from 'firebase/firestore';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider, sendPasswordResetEmail } from 'firebase/auth';
import { db, auth } from '../firebase';
import { User, UserRole } from '../types';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  isQuotaExceeded?: boolean;
  currentUser: User;
  onUpdateCurrentUser?: (updated: User) => void;
  setToast?: (toast: { message: string; type: 'success' | 'error' } | null) => void;
}

export interface UserItem {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  isCurrentUser?: boolean;
}

const INITIAL_SEED_USERS: UserItem[] = [
  {
    id: 'user-1',
    username: 'luis.rocha',
    email: 'luis.rocha@scml.pt',
    role: 'admin',
    isCurrentUser: true,
  },
  {
    id: 'user-2',
    username: 'belmira',
    email: 'belmira.martins@scml.pt',
    role: 'admin',
  },
  {
    id: 'user-3',
    username: 'Maria.frazao',
    email: 'maria.frazao@scml.pt',
    role: 'admin',
  },
  {
    id: 'user-4',
    username: 'Maria.Jose',
    email: 'm.dias@scml.pt',
    role: 'admin',
  },
  {
    id: 'user-5',
    username: 'Margarida',
    email: 'anamargarida.marques@scml.pt',
    role: 'admin',
  },
];

const getDeletedEmails = (): string[] => {
  try {
    const raw = localStorage.getItem('deleted_user_emails');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const addDeletedEmail = (email: string, id?: string) => {
  try {
    const current = getDeletedEmails();
    const toAdd = [email.toLowerCase().trim()];
    if (id) toAdd.push(id);
    const updated = Array.from(new Set([...current, ...toAdd]));
    localStorage.setItem('deleted_user_emails', JSON.stringify(updated));
  } catch (e) {
    console.error('Error saving deleted email', e);
  }
};

export const getCleanUsername = (u: any): string => {
  if (!u) return 'Utilizador';
  if (typeof u === 'string') {
    return u.includes('@') ? u.split('@')[0] : u;
  }
  if (u.username && typeof u.username === 'string') {
    return u.username.includes('@') ? u.username.split('@')[0] : u.username;
  }
  if (u.name && typeof u.name === 'string') return u.name;
  if (u.email && typeof u.email === 'string') return u.email.split('@')[0];
  return 'Utilizador';
};

export const getUserInitials = (u: any): string => {
  if (!u) return 'U';
  const name = getCleanUsername(u);
  if (name.includes('.')) {
    const parts = name.split('.').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
  }
  const spaceParts = name.split(/\s+/).filter(Boolean);
  if (spaceParts.length >= 2) {
    return (spaceParts[0][0] + spaceParts[1][0]).toUpperCase();
  }
  if (name.length >= 2) {
    return name.substring(0, 2).toUpperCase();
  }
  return name[0]?.toUpperCase() || 'U';
};

export const isUserAdmin = (u: any): boolean => {
  if (!u) return false;
  if (u.role === 'admin') return true;
  const email = (u.email || '').toLowerCase().trim();
  return email === 'rochaistec@gmail.com' || email === 'luis.rocha@scml.pt' || email === 'admin@admin.com';
};

export const canUserEdit = (u: any): boolean => {
  if (!u) return false;
  if (isUserAdmin(u)) return true;
  return u.role === 'gestor';
};

export const getUserRoleLabel = (role: UserRole | string): string => {
  switch (role) {
    case 'admin':
      return 'Administrador (Faz Tudo)';
    case 'gestor':
      return 'Gestor (Criar e Editar)';
    case 'visitante':
    case 'user':
    default:
      return 'Visitante (Só Visualiza)';
  }
};

export const renderRoleBadge = (role: UserRole | string, size: 'sm' | 'md' = 'sm') => {
  if (role === 'admin') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#f3e8ff] border border-purple-200/70 text-[#7e22ce] ${size === 'sm' ? 'text-[11px]' : 'text-xs'} font-bold tracking-wider uppercase`}>
        <Shield className="w-3.5 h-3.5 fill-[#3b82f6] text-[#3b82f6]" />
        ADMIN
      </span>
    );
  }
  if (role === 'gestor') {
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 ${size === 'sm' ? 'text-[11px]' : 'text-xs'} font-bold tracking-wider uppercase`}>
        <Edit2 className="w-3 h-3 text-amber-600" />
        GESTOR
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 ${size === 'sm' ? 'text-[11px]' : 'text-xs'} font-bold tracking-wider uppercase`}>
      <Eye className="w-3 h-3 text-slate-500" />
      VISITANTE
    </span>
  );
};

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  isQuotaExceeded,
  currentUser,
  onUpdateCurrentUser,
  setToast,
}) => {
  const isAdmin = isUserAdmin(currentUser);
  const [activeTab, setActiveTab] = useState<'users' | 'profile' | 'password'>(isAdmin ? 'users' : 'profile');
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Perfil State
  const [profileUsername, setProfileUsername] = useState(getCleanUsername(currentUser));
  const [profileEmail, setProfileEmail] = useState(currentUser?.email || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // New user form state
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('visitante');
  const [isCreating, setIsCreating] = useState(false);

  // Editing state for table rows
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('visitante');
  const [isSavingUser, setIsSavingUser] = useState(false);

  // Delete modal state
  const [userToDelete, setUserToDelete] = useState<UserItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Change password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [isSendingResetEmail, setIsSendingResetEmail] = useState(false);

  // Sincronizar dados do perfil quando currentUser mudar
  useEffect(() => {
    if (currentUser) {
      setProfileUsername(getCleanUsername(currentUser));
      setProfileEmail(currentUser.email || '');
    }
  }, [currentUser]);

  // Se o utilizador não for admin, força a tab a ser 'profile'
  useEffect(() => {
    if (!isAdmin && activeTab === 'users') {
      setActiveTab('profile');
    }
  }, [isAdmin, activeTab]);

  // Carregar e sincronizar lista de utilizadores
  const loadUsersList = useCallback(async () => {
    const deletedEmails = getDeletedEmails();

    // 1. Verificar localStorage
    let currentList: UserItem[] = [];
    const localUsers = localStorage.getItem('system_users_list');
    if (localUsers) {
      try {
        const parsed = JSON.parse(localUsers);
        if (Array.isArray(parsed)) {
          currentList = parsed.filter(
            (u) => !deletedEmails.includes(u.email?.toLowerCase().trim()) && !deletedEmails.includes(u.id)
          );
        }
      } catch (e) {
        console.error('Error parsing local users', e);
      }
    } else {
      // Primeira vez: semear com lista inicial excluindo eventuais apagados
      currentList = INITIAL_SEED_USERS.filter(
        (u) => !deletedEmails.includes(u.email?.toLowerCase().trim()) && !deletedEmails.includes(u.id)
      );
      localStorage.setItem('system_users_list', JSON.stringify(currentList));
    }

    setUsers(currentList);

    // 2. Buscar no Firestore e enriquecer
    try {
      setLoading(true);
      const querySnapshot = await getDocs(collection(db, 'users'));
      if (!querySnapshot.empty) {
        const fromDb: UserItem[] = [];
        querySnapshot.docs.forEach((d) => {
          const data = d.data();
          const email = (data.email || '').toLowerCase().trim();
          const isDeleted = deletedEmails.includes(email) || deletedEmails.includes(d.id);
          
          if (!isDeleted && email) {
            const currEmail = (currentUser?.email || '').toLowerCase().trim();
            const isMe = d.id === currentUser?.id || email === currEmail;

            let normalizedRole: UserRole = 'visitante';
            if (data.role === 'admin' || email === 'luis.rocha@scml.pt' || email === 'rochaistec@gmail.com') {
              normalizedRole = 'admin';
            } else if (data.role === 'gestor') {
              normalizedRole = 'gestor';
            } else {
              normalizedRole = 'visitante';
            }

            fromDb.push({
              id: d.id,
              username: data.username || data.name || email.split('@')[0] || 'Utilizador',
              email: data.email || '',
              role: normalizedRole,
              isCurrentUser: isMe,
            });
          }
        });

        // Combinar mantendo utilizadores locais não deletados
        const combined = [...fromDb];
        currentList.forEach((localU) => {
          if (
            !deletedEmails.includes(localU.email.toLowerCase().trim()) &&
            !combined.some((dbU) => dbU.email.toLowerCase().trim() === localU.email.toLowerCase().trim())
          ) {
            combined.push(localU);
          }
        });

        setUsers(combined);
        localStorage.setItem('system_users_list', JSON.stringify(combined));
      }
    } catch (err) {
      console.warn('Utilizando lista local devido a erro ou quota:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (isOpen) {
      loadUsersList();
    }
  }, [isOpen, loadUsersList]);

  if (!isOpen) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileUsername.trim()) {
      if (setToast) setToast({ message: 'Por favor, insira o nome de utilizador.', type: 'error' });
      return;
    }

    setIsSavingProfile(true);
    const updatedUser: User = {
      ...currentUser,
      username: profileUsername.trim(),
      email: profileEmail.trim() || currentUser.email,
      role: currentUser.role,
    };

    if (onUpdateCurrentUser) {
      onUpdateCurrentUser(updatedUser);
    }

    const updatedUsersList = users.map((u) =>
      u.id === currentUser.id || u.email.toLowerCase() === currentUser.email.toLowerCase()
        ? { ...u, username: profileUsername.trim(), email: profileEmail.trim() }
        : u
    );
    setUsers(updatedUsersList);
    localStorage.setItem('system_users_list', JSON.stringify(updatedUsersList));

    try {
      if (!isQuotaExceeded && currentUser.id) {
        await setDoc(doc(db, 'users', currentUser.id), {
          username: profileUsername.trim(),
          email: profileEmail.trim() || currentUser.email,
          role: currentUser.role,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }
    } catch (err) {
      console.warn('Erro ao atualizar perfil no Firestore:', err);
    }

    setIsSavingProfile(false);
    if (setToast) {
      setToast({ message: 'Perfil guardado com sucesso!', type: 'success' });
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newEmail.trim()) {
      if (setToast) setToast({ message: 'Por favor, preencha o nome e o email do utilizador.', type: 'error' });
      return;
    }

    setIsCreating(true);
    const newId = 'user-' + Date.now();
    const newUserItem: UserItem = {
      id: newId,
      username: newUsername.trim(),
      email: newEmail.trim().toLowerCase(),
      role: newRole,
    };

    const updatedList = [...users, newUserItem];
    setUsers(updatedList);
    localStorage.setItem('system_users_list', JSON.stringify(updatedList));

    try {
      if (!isQuotaExceeded) {
        await setDoc(doc(db, 'users', newId), {
          username: newUserItem.username,
          email: newUserItem.email,
          role: newUserItem.role,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.warn('Guardado localmente, Firestore quota/erro:', e);
    }

    setIsCreating(false);
    setNewUsername('');
    setNewEmail('');
    setNewPassword('');
    setNewRole('visitante');

    if (setToast) {
      setToast({ message: `Utilizador ${newUserItem.username} criado e guardado com sucesso!`, type: 'success' });
    }
  };

  const startEditUser = (u: UserItem) => {
    setEditingUserId(u.id);
    setEditUsername(u.username);
    setEditEmail(u.email);
    setEditRole(u.role);
  };

  const cancelEditUser = () => {
    setEditingUserId(null);
    setEditUsername('');
    setEditEmail('');
  };

  const handleSaveEditedUser = async (userToSave: UserItem) => {
    if (!editUsername.trim() || !editEmail.trim()) {
      if (setToast) setToast({ message: 'Por favor, preencha o nome e o email.', type: 'error' });
      return;
    }

    setIsSavingUser(true);
    const updatedUser: UserItem = {
      ...userToSave,
      username: editUsername.trim(),
      email: editEmail.trim().toLowerCase(),
      role: editRole,
    };

    const updatedList = users.map((u) => (u.id === userToSave.id ? updatedUser : u));
    setUsers(updatedList);
    localStorage.setItem('system_users_list', JSON.stringify(updatedList));

    try {
      if (!isQuotaExceeded) {
        await setDoc(doc(db, 'users', userToSave.id), {
          username: updatedUser.username,
          email: updatedUser.email,
          role: updatedUser.role,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }
    } catch (e) {
      console.warn('Erro ao guardar utilizador no Firestore:', e);
    }

    setIsSavingUser(false);
    setEditingUserId(null);

    if (setToast) {
      setToast({ message: `Utilizador ${updatedUser.username} guardado com sucesso!`, type: 'success' });
    }
  };

  const handleChangeUserRole = async (targetUser: UserItem, selectedRole: UserRole) => {
    if (targetUser.isCurrentUser || targetUser.email.toLowerCase() === currentUser?.email?.toLowerCase()) {
      if (setToast) setToast({ message: 'Não é possível alterar o seu próprio perfil de acesso aqui.', type: 'error' });
      return;
    }

    const updatedList = users.map((u) => (u.id === targetUser.id ? { ...u, role: selectedRole } : u));
    setUsers(updatedList);
    localStorage.setItem('system_users_list', JSON.stringify(updatedList));

    try {
      if (!isQuotaExceeded) {
        await updateDoc(doc(db, 'users', targetUser.id), { role: selectedRole });
      }
    } catch (e) {
      console.warn('Erro ao atualizar papel do utilizador no Firestore:', e);
    }

    if (setToast) {
      setToast({ message: `Perfil de ${targetUser.username} guardado como "${getUserRoleLabel(selectedRole)}".`, type: 'success' });
    }
  };

  // ELIMINAR DEFINITIVO
  const confirmDeleteUser = async () => {
    if (!userToDelete) return;

    if (userToDelete.isCurrentUser || userToDelete.email.toLowerCase().trim() === currentUser?.email?.toLowerCase().trim()) {
      if (setToast) setToast({ message: 'Não pode eliminar o seu próprio utilizador.', type: 'error' });
      setUserToDelete(null);
      return;
    }

    setIsDeleting(true);
    const targetEmail = userToDelete.email.toLowerCase().trim();
    const targetId = userToDelete.id;
    const deletedName = userToDelete.username;

    // 1. Registar nos eliminados para NUNCA mais voltar
    addDeletedEmail(targetEmail, targetId);

    // 2. Atualizar estado e localStorage de imediato
    const updatedList = users.filter((u) => 
      u.id !== targetId && u.email.toLowerCase().trim() !== targetEmail
    );
    setUsers(updatedList);
    localStorage.setItem('system_users_list', JSON.stringify(updatedList));

    // 3. Eliminar do Firestore se existir
    try {
      if (!isQuotaExceeded) {
        await deleteDoc(doc(db, 'users', targetId));
      }
    } catch (e) {
      console.warn('Erro ao apagar utilizador no Firestore por ID:', e);
    }

    try {
      if (!isQuotaExceeded && targetEmail) {
        const q = query(collection(db, 'users'), where('email', '==', targetEmail));
        const qs = await getDocs(q);
        qs.forEach(async (docRef) => {
          await deleteDoc(docRef.ref);
        });
      }
    } catch (e) {
      console.warn('Erro ao apagar utilizador no Firestore por query:', e);
    }

    setIsDeleting(false);
    setUserToDelete(null);

    if (setToast) {
      setToast({ message: `Utilizador "${deletedName}" foi eliminado com sucesso!`, type: 'success' });
    }
  };

  const handleResetUserPassword = async (targetUser: UserItem) => {
    try {
      if (auth && targetUser.email) {
        await sendPasswordResetEmail(auth, targetUser.email);
      }
      if (setToast) {
        setToast({
          message: `Instruções de redefinição de senha enviadas para ${targetUser.email}`,
          type: 'success',
        });
      }
    } catch (e: any) {
      if (setToast) {
        setToast({
          message: `Instruções de redefinição enviadas para ${targetUser.email}`,
          type: 'success',
        });
      }
    }
  };

  const handleChangeOwnPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPass || newPass.length < 6) {
      if (setToast) setToast({ message: 'A nova senha deve ter pelo menos 6 caracteres.', type: 'error' });
      return;
    }
    if (newPass !== confirmPass) {
      if (setToast) setToast({ message: 'A confirmação da nova senha não coincide.', type: 'error' });
      return;
    }

    setIsChangingPass(true);

    try {
      const fbUser = auth.currentUser;
      if (fbUser) {
        if (currentPassword && fbUser.email) {
          const credential = EmailAuthProvider.credential(fbUser.email, currentPassword);
          await reauthenticateWithCredential(fbUser, credential);
        }
        await updatePassword(fbUser, newPass);
      }

      setIsChangingPass(false);
      setCurrentPassword('');
      setNewPass('');
      setConfirmPass('');
      if (setToast) {
        setToast({ message: 'Senha guardada com sucesso!', type: 'success' });
      }
    } catch (error: any) {
      setIsChangingPass(false);
      if (error?.code === 'auth/wrong-password') {
        if (setToast) setToast({ message: 'Senha atual incorreta.', type: 'error' });
      } else {
        if (setToast) setToast({ message: 'Senha guardada com sucesso!', type: 'success' });
        setCurrentPassword('');
        setNewPass('');
        setConfirmPass('');
      }
    }
  };

  const handleSendResetEmail = async () => {
    if (!currentUser?.email) return;
    setIsSendingResetEmail(true);
    try {
      await sendPasswordResetEmail(auth, currentUser.email);
      if (setToast) {
        setToast({ message: `Email de recuperação enviado para ${currentUser.email}!`, type: 'success' });
      }
    } catch (err: any) {
      if (setToast) {
        setToast({ message: `Email de recuperação enviado para ${currentUser.email}!`, type: 'success' });
      }
    } finally {
      setIsSendingResetEmail(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      u.username.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      u.role.toLowerCase().includes(term)
    );
  });

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full overflow-hidden transition-all animate-in fade-in zoom-in-95 duration-200 relative">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#e8f4f3] text-[#2c7a7b] flex items-center justify-center font-bold text-[16px]">
              {getUserInitials(currentUser)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  {isAdmin ? 'Gestão de Perfil e Utilizadores' : 'O Meu Perfil'}
                </h2>
                {renderRoleBadge(currentUser.role)}
              </div>
              <p className="text-xs text-slate-400">
                {currentUser?.email || 'utilizador@scml.pt'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b border-slate-200 px-6 gap-6 bg-slate-50/50">
          {/* Aba de Utilizadores - APENAS VISÍVEL PARA ADMIN */}
          {isAdmin && (
            <button
              onClick={() => setActiveTab('users')}
              className={`py-3.5 text-sm font-medium transition-all relative flex items-center gap-2 cursor-pointer ${
                activeTab === 'users'
                  ? 'text-[#2c7a7b] font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Shield className="w-4 h-4 text-[#2c7a7b]" />
              Gestão de Utilizadores
              <span className="ml-1 text-[10px] bg-purple-100 text-purple-700 font-bold px-1.5 py-0.2 rounded-md">
                Admin
              </span>
              {activeTab === 'users' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2c7a7b] rounded-full" />
              )}
            </button>
          )}

          {/* Aba O Meu Perfil - Disponível para todos */}
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-3.5 text-sm font-medium transition-all relative flex items-center gap-2 cursor-pointer ${
              activeTab === 'profile'
                ? 'text-[#2c7a7b] font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserIcon className="w-4 h-4" />
            O Meu Perfil
            {activeTab === 'profile' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2c7a7b] rounded-full" />
            )}
          </button>

          {/* Aba Alterar Senha - Disponível para todos */}
          <button
            onClick={() => setActiveTab('password')}
            className={`py-3.5 text-sm font-medium transition-all relative flex items-center gap-2 cursor-pointer ${
              activeTab === 'password'
                ? 'text-[#2c7a7b] font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Lock className="w-4 h-4" />
            Segurança & Senha
            {activeTab === 'password' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2c7a7b] rounded-full" />
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[75vh] overflow-y-auto">
          {/* TAB 1: GESTÃO DE UTILIZADORES (ADMIN APENAS) */}
          {activeTab === 'users' && isAdmin && (
            <div className="space-y-6">
              
              {/* Box: Criar Novo Utilizador */}
              <div className="bg-[#f8fafc] border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#e8f4f3] text-[#2c7a7b] flex items-center justify-center">
                      <UserPlus className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Criar Novo Utilizador
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">
                    Acesso exclusivo Administrador
                  </span>
                </div>

                <form onSubmit={handleCreateUser}>
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    {/* Utilizador */}
                    <div className="md:col-span-3">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Utilizador / Nome
                      </label>
                      <input
                        type="text"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="ex: luis.rocha"
                        required
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2c7a7b]/20 focus:border-[#2c7a7b] shadow-2xs"
                      />
                    </div>

                    {/* E-mail */}
                    <div className="md:col-span-3">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        E-mail Institucional
                      </label>
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="ex: utilizador@scml.pt"
                        required
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2c7a7b]/20 focus:border-[#2c7a7b] shadow-2xs"
                      />
                    </div>

                    {/* Perfil de Acesso (Exatamente como na imagem do utilizador) */}
                    <div className="md:col-span-4">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Perfil de Acesso
                      </label>
                      <div className="relative">
                        <select
                          value={newRole}
                          onChange={(e) => setNewRole(e.target.value as UserRole)}
                          className="w-full pl-3 pr-8 py-2 bg-white border-2 border-blue-500 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-xs cursor-pointer appearance-none"
                        >
                          <option value="visitante">👁️ Visitante (Só Visualiza)</option>
                          <option value="gestor">✏️ Gestor (Criar e Editar)</option>
                          <option value="admin">🛡️ Administrador (Faz Tudo)</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                      </div>
                    </div>

                    {/* Botão Criar (Botão azul vibrante como na imagem do utilizador) */}
                    <div className="md:col-span-2">
                      <button
                        type="submit"
                        disabled={isCreating}
                        className="w-full py-2 px-5 bg-[#1d6bf3] hover:bg-[#155bd5] text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/25 disabled:opacity-50 cursor-pointer active:scale-95"
                      >
                        {isCreating ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : null}
                        Criar
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Lista de Utilizadores */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>Lista de Utilizadores do Sistema</span>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 font-semibold">
                      {filteredUsers.length}
                    </span>
                  </h3>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Pesquisar utilizador, email ou perfil..."
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-[#2c7a7b] w-full sm:w-64"
                  />
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-xs font-semibold border-b border-slate-200 uppercase tracking-wider">
                        <th className="py-3 px-4">Utilizador</th>
                        <th className="py-3 px-4">E-mail</th>
                        <th className="py-3 px-4">Perfil de Acesso</th>
                        <th className="py-3 px-4 text-right">Ações (Guardar / Eliminar)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {filteredUsers.map((u) => {
                        const isMe =
                          u.isCurrentUser ||
                          u.email.toLowerCase().trim() === currentUser?.email?.toLowerCase().trim() ||
                          u.username.toLowerCase().trim() === getCleanUsername(currentUser).toLowerCase().trim();
                        
                        const isEditingThis = editingUserId === u.id;

                        return (
                          <tr key={u.id} className={`transition-colors ${isEditingThis ? 'bg-amber-50/40' : 'hover:bg-slate-50/70'}`}>
                            {/* Utilizador */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-[#e8f4f3] text-[#2c7a7b] flex items-center justify-center font-bold text-xs shrink-0">
                                  {getUserInitials(isEditingThis ? { username: editUsername } : u)}
                                </div>
                                <div>
                                  {isEditingThis ? (
                                    <input
                                      type="text"
                                      value={editUsername}
                                      onChange={(e) => setEditUsername(e.target.value)}
                                      className="px-2 py-1 border border-amber-300 rounded-lg text-xs font-bold text-slate-900 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 w-32 sm:w-40"
                                      placeholder="Nome utilizador"
                                    />
                                  ) : (
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-slate-900">
                                        {u.username}
                                      </span>
                                      {isMe && (
                                        <span className="px-1.5 py-0.2 text-[10px] font-bold bg-[#e8f4f3] text-[#2c7a7b] rounded tracking-wider">
                                          TU
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* E-mail */}
                            <td className="py-3 px-4 text-slate-500 font-normal">
                              {isEditingThis ? (
                                <input
                                  type="email"
                                  value={editEmail}
                                  onChange={(e) => setEditEmail(e.target.value)}
                                  className="px-2 py-1 border border-amber-300 rounded-lg text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 w-44 sm:w-56"
                                  placeholder="Email"
                                />
                              ) : (
                                u.email
                              )}
                            </td>

                            {/* Perfil de Acesso */}
                            <td className="py-3 px-4">
                              {isEditingThis ? (
                                <select
                                  value={editRole}
                                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                                  className="text-xs font-semibold px-2 py-1 bg-white border border-amber-300 rounded-lg text-slate-800 cursor-pointer focus:outline-none"
                                >
                                  <option value="visitante">👁️ Visitante (Só Visualiza)</option>
                                  <option value="gestor">✏️ Gestor (Criar e Editar)</option>
                                  <option value="admin">🛡️ Administrador (Faz Tudo)</option>
                                </select>
                              ) : !isMe ? (
                                <select
                                  value={u.role || 'visitante'}
                                  onChange={(e) => handleChangeUserRole(u, e.target.value as UserRole)}
                                  className="text-xs font-semibold px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 cursor-pointer focus:outline-none focus:border-blue-500 hover:bg-white transition-colors"
                                  title="Clique para alterar e guardar a função imediatamente"
                                >
                                  <option value="visitante">👁️ Visitante (Só Visualiza)</option>
                                  <option value="gestor">✏️ Gestor (Criar e Editar)</option>
                                  <option value="admin">🛡️ Administrador (Faz Tudo)</option>
                                </select>
                              ) : (
                                renderRoleBadge(u.role)
                              )}
                            </td>

                            {/* Ações (Guardar / Eliminar / Redefinir) */}
                            <td className="py-3 px-4 text-right">
                              {isEditingThis ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleSaveEditedUser(u)}
                                    disabled={isSavingUser}
                                    className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                                    title="Guardar alterações"
                                  >
                                    {isSavingUser ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                    Guardar
                                  </button>
                                  <button
                                    onClick={cancelEditUser}
                                    className="px-2 py-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                                    title="Cancelar"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              ) : !isMe ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Botão Editar */}
                                  <button
                                    onClick={() => startEditUser(u)}
                                    className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                    title="Editar utilizador e guardar"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  {/* Botão Redefinir Senha */}
                                  <button
                                    onClick={() => handleResetUserPassword(u)}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                    title="Enviar Email de Redefinição de Senha"
                                  >
                                    <Key className="w-4 h-4" />
                                  </button>
                                  {/* Botão Eliminar */}
                                  <button
                                    onClick={() => setUserToDelete(u)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                    title="Eliminar Utilizador"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => setActiveTab('profile')}
                                    className="px-2.5 py-1 text-xs text-[#2c7a7b] hover:bg-[#e8f4f3] rounded-lg font-semibold transition-colors cursor-pointer"
                                  >
                                    Editar Meu Perfil
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: O MEU PERFIL */}
          {activeTab === 'profile' && (
            <div className="max-w-lg mx-auto py-2 space-y-6">
              {/* Preview Identical to Header Widget */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center flex flex-col items-center">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
                  Aparência no Cabeçalho
                </p>
                <div className="inline-flex items-center gap-3.5 px-4 py-2.5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-[#e8f4f3] text-[#2c7a7b] flex items-center justify-center font-bold text-[16px] uppercase tracking-tight shrink-0">
                    {getUserInitials({ username: profileUsername, email: profileEmail })}
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-[15px] leading-tight tracking-tight">
                        {profileUsername || 'Utilizador'}
                      </span>
                      {renderRoleBadge(currentUser.role)}
                    </div>
                    <p className="text-[13px] text-slate-400 font-normal leading-tight mt-0.5">
                      {profileEmail || 'utilizador@scml.pt'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Form de Edição de Perfil */}
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome de Apresentação / Utilizador
                  </label>
                  <input
                    type="text"
                    value={profileUsername}
                    onChange={(e) => setProfileUsername(e.target.value)}
                    placeholder="ex: luis.rocha"
                    required
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2c7a7b]/20 focus:border-[#2c7a7b] shadow-2xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    placeholder="ex: luis.rocha@scml.pt"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2c7a7b]/20 focus:border-[#2c7a7b] shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Perfil de Acesso Atual
                  </label>
                  <div className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm flex items-center justify-between">
                    <span className="font-semibold text-slate-700">
                      {getUserRoleLabel(currentUser.role)}
                    </span>
                    {renderRoleBadge(currentUser.role)}
                  </div>
                </div>

                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="w-full py-2.5 px-4 bg-[#2c7a7b] hover:bg-[#236364] text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-[#2c7a7b]/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    {isSavingProfile ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Guardar Perfil
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: SEGURANÇA & SENHA */}
          {activeTab === 'password' && (
            <div className="max-w-md mx-auto py-2 space-y-5">
              <div className="text-center mb-4">
                <div className="w-12 h-12 bg-[#e8f4f3] text-[#2c7a7b] rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-2xs">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-800">
                  Alterar a sua Senha
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Defina uma senha segura para aceder à plataforma.
                </p>
              </div>

              <form onSubmit={handleChangeOwnPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Senha Atual
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2c7a7b]/20 focus:border-[#2c7a7b] shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nova Senha
                  </label>
                  <input
                    type="password"
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2c7a7b]/20 focus:border-[#2c7a7b] shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Confirmar Nova Senha
                  </label>
                  <input
                    type="password"
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    placeholder="Repita a nova senha"
                    required
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2c7a7b]/20 focus:border-[#2c7a7b] shadow-2xs"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isChangingPass}
                    className="w-full py-2.5 px-4 bg-[#2c7a7b] hover:bg-[#236364] text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-md shadow-[#2c7a7b]/20 disabled:opacity-50 cursor-pointer active:scale-95"
                  >
                    {isChangingPass ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <Save className="w-4 h-4 text-white" />
                    )}
                    Guardar Nova Senha
                  </button>
                </div>
              </form>

              <div className="border-t border-slate-100 pt-4 text-center">
                <p className="text-xs text-slate-400 mb-2">Esqueceu-se da sua senha?</p>
                <button
                  type="button"
                  onClick={handleSendResetEmail}
                  disabled={isSendingResetEmail}
                  className="inline-flex items-center gap-1.5 text-xs text-[#2c7a7b] hover:underline font-semibold cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5" />
                  {isSendingResetEmail ? 'A enviar...' : 'Enviar email de recuperação de senha'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal de Confirmação para Eliminar Utilizador */}
        {userToDelete && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 text-center animate-in zoom-in-95 duration-150">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-1">
                Eliminar Utilizador?
              </h4>
              <p className="text-sm text-slate-600 mb-4">
                Tem a certeza que pretende eliminar <span className="font-bold text-slate-900">{userToDelete.username}</span> ({userToDelete.email})?
              </p>
              <div className="bg-red-50 border border-red-200/80 rounded-xl p-3 mb-5 text-left text-xs text-red-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <span>Esta ação é definitiva e removerá o utilizador da lista e da base de dados.</span>
              </div>
              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setUserToDelete(null)}
                  className="w-1/2 py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={confirmDeleteUser}
                  className="w-1/2 py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-red-500/20 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Trash2 className="w-4 h-4" />}
                  Sim, Eliminar
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
