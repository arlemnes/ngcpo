import React, { useState, useEffect, useMemo, useCallback, Component, ReactNode, ErrorInfo } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Calendar, 
  Euro, 
  FileText, 
  AlertCircle,
  Check,
  CheckCircle2,
  CheckSquare,
  Trash2,
  Edit2,
  X,
  Download,
  ChevronDown,
  TrendingUp,
  Clock,
  ClipboardList,
  FileSpreadsheet,
  Settings,
  Upload,
  Paperclip,
  Copy,
  LogOut,
  Lock,
  User as UserIcon,
  Percent,
  Folder,
  Shield,
  ExternalLink
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, LabelList } from 'recharts';
import { format, isAfter, isBefore, addDays, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { Contract, ContractInput, User } from './types';
import { SettingsModal } from './components/SettingsModal';
import { ImportModal } from './components/ImportModal';
import { UserManagementModal, getUserInitials, getCleanUsername, canUserEdit, renderRoleBadge } from './components/UserManagementModal';
import { MultiSelectFilter } from './components/MultiSelectFilter';
import { generateId, stripHtml, cn, fixPortugueseMojibake, looksLikeContacts, parseCurrency, formatDatePt, toIsoDate } from './lib/utils';
import ErrorBoundary from './components/ErrorBoundary';

const isUserAdmin = (u: User | null | undefined): boolean => {
  if (!u) return false;
  if (u.role === 'admin') return true;
  const adminEmails = ['rochaistec@gmail.com', 'luis.rocha@scml.pt', 'admin@admin.com'];
  return Boolean(u.email && adminEmails.includes(u.email.toLowerCase().trim()));
};

const formatCurrency = (value: any, withSymbol = false) => {
  try {
    const safeValue = parseCurrency(value);
    const formatted = safeValue.toLocaleString('pt-PT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).replace(/\u00A0/g, ' ');
    return withSymbol ? `${formatted} €` : formatted;
  } catch (e) {
    console.error("Error in formatCurrency:", e);
    return withSymbol ? "0,00 €" : "0,00";
  }
};

const DateInput = ({ value, onChange, className, required = false }: any) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Se estiver no formato dd/mm/aaaa, tentar converter para ISO
    if (!isFocused && val.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      const [d, m, y] = val.split('/');
      const iso = `${y}-${m}-${d}`;
      const date = new Date(iso);
      if (!isNaN(date.getTime())) {
        onChange({ target: { value: date.toISOString() } });
        return;
      }
    }
    onChange(e);
  };

  return (
    <input
      type={isFocused ? "date" : "text"}
      placeholder="dd/mm/aaaa"
      required={required}
      className={className}
      value={isFocused ? (value?.split('T')[0] || '') : (value ? safeFormatDate(value) : '')}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onChange={handleChange}
    />
  );
};

const safeFormatDate = (dateStr: any) => {
  try {
    if (!dateStr) return '';
    const str = String(dateStr).trim();
    if (!str) return '';
    // Se já estiver no formato dd/mm/aaaa, retornar como está
    if (str.match(/^\d{2}\/\d{2}\/\d{4}$/)) return str;
    
    const parsed = parseISO(str);
    if (!isNaN(parsed.getTime())) return format(parsed, 'dd/MM/yyyy');
    
    // Tentar parse manual se parseISO falhar (ex: yyyy-mm-dd)
    const manual = new Date(str);
    if (!isNaN(manual.getTime())) return format(manual, 'dd/MM/yyyy');
    
    return str;
  } catch (e) {
    console.error("Error in safeFormatDate:", e);
    return String(dateStr || '');
  }
};

const FormattedInput = ({ value, onChange, className, required = false, placeholder = "" }: any) => {
  const [isFocused, setIsFocused] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(value);
    }
  }, [value, isFocused]);

  const displayValue = isFocused 
    ? (localValue === 0 ? "" : localValue.toString()) 
    : (value === 0 ? "" : formatCurrency(value));

  return (
    <input
      type={isFocused ? "number" : "text"}
      step="0.01"
      required={required}
      placeholder={placeholder}
      className={className}
      value={displayValue}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onChange={(e) => {
        const val = parseFloat(e.target.value) || 0;
        setLocalValue(val);
        onChange(val);
      }}
    />
  );
};

const calculateDaysRemaining = (endDateStr: any, today: Date) => {
  try {
    if (!endDateStr || typeof endDateStr !== 'string') return 0;
    
    let end: Date;
    if (endDateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      const [d, m, y] = endDateStr.split('/');
      end = new Date(`${y}-${m}-${d}`);
    } else {
      end = parseISO(endDateStr);
    }
    
    if (isNaN(end.getTime())) {
      end = new Date(endDateStr);
      if (isNaN(end.getTime())) return 0;
    }
    
    const endMidnight = new Date(end);
    endMidnight.setHours(0, 0, 0, 0);
    const diffTime = endMidnight.getTime() - today.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  } catch (e) {
    console.error("Error in calculateDaysRemaining:", e);
    return 0;
  }
};

const calculateDateDiff = (date1Str: any, date2Str: any) => {
  try {
    if (!date1Str || !date2Str || typeof date1Str !== 'string' || typeof date2Str !== 'string') return 0;
    
    const parseDate = (str: string) => {
      let d: Date;
      if (str.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        const [day, month, year] = str.split('/');
        d = new Date(`${year}-${month}-${day}`);
      } else {
        d = parseISO(str);
      }
      if (isNaN(d.getTime())) {
        d = new Date(str);
      }
      return d;
    };

    const d1 = parseDate(date1Str);
    const d2 = parseDate(date2Str);

    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;

    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);

    const diffTime = d1.getTime() - d2.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  } catch (e) {
    console.error("Error in calculateDateDiff:", e);
    return 0;
  }
};

import { auth, db } from './firebase';
import { signInWithEmailAndPassword, sendPasswordResetEmail, confirmPasswordReset, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, onSnapshot, writeBatch, getDocFromServer } from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, identifier, password);
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        onLogin({ ...userData, id: userCredential.user.uid });
      } else {
        // Fallback if user doc doesn't exist but auth succeeded
        const isAdmin = userCredential.user.email === 'rochaistec@gmail.com' || 
                        userCredential.user.email === 'luis.rocha@scml.pt' || 
                        userCredential.user.email === 'admin@admin.com';
        onLogin({
          id: userCredential.user.uid,
          username: userCredential.user.email || 'user',
          email: userCredential.user.email || '',
          role: isAdmin ? 'admin' : 'user'
        });
      }
    } catch (err: any) {
      let message = `Erro de conexão: ${err.message}`;
      if (err.code === 'resource-exhausted' || err.message?.includes('quota')) {
        message = 'Limite de quota do Firebase atingido. Por favor, tente novamente mais tarde.';
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setForgotMessage('');
    setError('');

    try {
      await sendPasswordResetEmail(auth, forgotEmail);
      setForgotMessage('Instruções enviadas para o seu e-mail.');
    } catch (err: any) {
      let message = `Erro de conexão: ${err.message}`;
      if (err.code === 'resource-exhausted' || err.message?.includes('quota')) {
        message = 'Limite de quota do Firebase atingido. Por favor, tente novamente mais tarde.';
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (showForgot) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="space-y-2">
            <h1 className="text-5xl font-normal text-brand-dark tracking-tight">Recuperar Senha</h1>
            <p className="text-slate-400 text-xl">Insira seu e-mail para receber instruções</p>
          </div>

          <form onSubmit={handleForgotSubmit} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-6 text-left">
            <div className="space-y-2">
              <label className="text-lg font-normal text-slate-600 ml-1">E-mail</label>
              <input
                type="email"
                required
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 focus:ring-2 focus:ring-brand-light focus:border-brand outline-none transition-all"
                placeholder="seu@email.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-500 text-lg bg-red-50 p-3 rounded-lg">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {forgotMessage && (
              <div className="flex items-center gap-2 text-brand-dark text-lg bg-brand-light p-3 rounded-lg">
                <CheckCircle2 size={16} />
                <span>{forgotMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-brand hover:bg-brand-dark disabled:bg-brand/70 text-slate-900 font-normal rounded-xl transition-all shadow-lg shadow-brand/20 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : 'Enviar Instruções'}
            </button>

            <button
              type="button"
              onClick={() => setShowForgot(false)}
              className="w-full text-lg text-slate-500 hover:text-brand-dark transition-colors"
            >
              Voltar para o Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-2">
          <h1 className="text-5xl font-normal text-brand-dark tracking-tight">Gestor de Contratos</h1>
          <p className="text-slate-400 text-xl">Gestão e Controlo de Prazos</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-6 text-left">
          <div className="space-y-2">
            <label className="text-lg font-normal text-slate-600 ml-1">Utilizador ou E-mail</label>
            <input
              type="text"
              required
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 focus:ring-2 focus:ring-brand-light focus:border-brand outline-none transition-all"
              placeholder="admin"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between ml-1">
              <label className="text-lg font-normal text-slate-600">Senha</label>
              <button 
                type="button"
                onClick={() => setShowForgot(true)}
                className="text-[15px] text-brand-dark hover:underline"
              >
                Esqueceu a senha?
              </button>
            </div>
            <input
              type="password"
              required
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none transition-all"
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-500 text-lg bg-red-50 p-3 rounded-lg">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-brand hover:bg-brand-dark disabled:bg-brand/70 text-slate-900 font-normal rounded-xl transition-all shadow-lg shadow-brand/20 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : 'Entrar'}
          </button>
        </form>

      </div>
    </div>
  );
}

function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const token = useMemo(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('oobCode');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      if (!token) throw new Error('Token inválido');
      await confirmPasswordReset(auth, token, password);
      setSuccess('Senha alterada com sucesso!');
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (err: any) {
      let message = `Erro de conexão: ${err.message}`;
      if (err.code === 'resource-exhausted' || err.message?.includes('quota')) {
        message = 'Limite de quota do Firebase atingido. Por favor, tente novamente mais tarde.';
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center space-y-4">
          <AlertCircle className="mx-auto text-red-500" size={48} />
          <h2 className="text-2xl font-normal text-slate-800">Token Inválido</h2>
          <p className="text-slate-500">Este link de recuperação é inválido ou já foi utilizado.</p>
          <a href="/" className="inline-block px-6 py-2 bg-brand text-slate-900 rounded-lg">Voltar ao Login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-2">
          <h1 className="text-5xl font-normal text-brand-dark tracking-tight">Nova Senha</h1>
          <p className="text-slate-400 text-xl">Crie sua nova senha de acesso</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-6 text-left">
          <div className="space-y-2">
            <label className="text-lg font-normal text-slate-600 ml-1">Nova Senha</label>
            <input
              type="password"
              required
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none transition-all"
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-lg font-normal text-slate-600 ml-1">Confirmar Senha</label>
            <input
              type="password"
              required
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none transition-all"
              placeholder="••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-500 text-lg bg-red-50 p-3 rounded-lg">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 text-brand-dark text-lg bg-brand-light p-3 rounded-lg">
              <CheckCircle2 size={16} />
              <span>{success} Redirecionando...</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !!success}
            className="w-full py-4 bg-brand hover:bg-brand-dark disabled:bg-brand/70 text-slate-900 font-normal rounded-xl transition-all shadow-lg shadow-brand/20 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : 'Redefinir Senha'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []); // Empty deps means this is stable across renders
  const isResetPage = useMemo(() => window.location.pathname === '/reset-password', []);

  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPhases, setSelectedPhases] = useState<string[]>([]);
  const [selectedProcedureTypes, setSelectedProcedureTypes] = useState<string[]>([]);
  const [selectedContractTypes, setSelectedContractTypes] = useState<string[]>([]);
  const [managerFilter, setManagerFilter] = useState<string>('Todos');
  const [technicalDirectionFilter, setTechnicalDirectionFilter] = useState<string>('Todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [contractToDelete, setContractToDelete] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [selectedContracts, setSelectedContracts] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isEmptyRecycleBinModalOpen, setIsEmptyRecycleBinModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'active' | 'recycle-bin'>('active');

  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);

  const handleFirestoreError = useCallback((error: unknown, operationType: OperationType, path: string | null) => {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errCode = (error as any)?.code;
    
    if (errCode === 'resource-exhausted' || errMsg.includes('quota')) {
      setIsQuotaExceeded(true);
      setToast({ message: 'Limite de quota do Firebase atingido. Algumas operações podem falhar.', type: 'error' });
    }

    const errInfo: FirestoreErrorInfo = {
      error: errMsg,
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
      },
      operationType,
      path
    }
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    setSelectedContracts([]);
  }, [searchTerm, selectedPhases, selectedProcedureTypes, selectedContractTypes, managerFilter, technicalDirectionFilter, viewMode]);

  const getPhaseStyles = (phaseText: string) => {
    const raw = fixPortugueseMojibake(phaseText || '').trim();
    if (!raw) return "bg-slate-100 text-slate-500 border-slate-200";

    const norm = raw
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

    // Dicionário de cores únicas e dedicadas por estado (sem repetições de cores)
    if (norm === 'em execucao') {
      return "bg-cyan-50 text-cyan-800 border-cyan-300"; // Ciano / Turquesa
    }
    if (norm.includes('execucao') && norm.includes('obra')) {
      return "bg-sky-50 text-sky-800 border-sky-300"; // Azul Céu
    }
    if (norm.includes('assistencia')) {
      return "bg-indigo-50 text-indigo-800 border-indigo-300"; // Índigo
    }
    if (norm.includes('garantia')) {
      return "bg-amber-50 text-amber-800 border-amber-300"; // Âmbar / Dourado
    }
    if (norm.includes('consignacao') || norm.includes('pss')) {
      return "bg-orange-50 text-orange-800 border-orange-300"; // Laranja
    }
    if (norm.includes('conta final')) {
      return "bg-rose-50 text-rose-800 border-rose-300"; // Rosa Coral
    }
    if (norm.includes('licenca')) {
      return "bg-purple-50 text-purple-800 border-purple-300"; // Púrpura / Roxo
    }
    if (norm.includes('concluido')) {
      return "bg-emerald-50 text-emerald-800 border-emerald-300"; // Esmeralda / Verde
    }
    if (norm === 'fechado') {
      return "bg-teal-50 text-teal-800 border-teal-300"; // Verde Petróleo
    }
    if (norm.includes('findo') || norm.includes('arquivado')) {
      return "bg-slate-100 text-slate-700 border-slate-300"; // Cinza Ardósia
    }
    if (norm.includes('cancelado')) {
      return "bg-red-50 text-red-700 border-red-300"; // Vermelho
    }
    if (norm.includes('suspenso')) {
      return "bg-fuchsia-50 text-fuchsia-800 border-fuchsia-300"; // Fúcsia
    }
    if (norm.includes('preparacao')) {
      return "bg-blue-50 text-blue-800 border-blue-300"; // Azul clássico
    }
    if (norm.includes('concurso')) {
      return "bg-yellow-50 text-yellow-800 border-yellow-300"; // Amarelo
    }
    if (norm.includes('adjudicacao')) {
      return "bg-violet-50 text-violet-800 border-violet-300"; // Violeta
    }

    // Paleta alternativa de reserva para quaisquer outros estados dinâmicos (hashing determinístico)
    const fallbackPalettes = [
      "bg-lime-50 text-lime-800 border-lime-300",
      "bg-pink-50 text-pink-800 border-pink-300",
      "bg-zinc-100 text-zinc-800 border-zinc-300",
      "bg-amber-100 text-amber-900 border-amber-400",
      "bg-teal-100 text-teal-900 border-teal-400",
      "bg-indigo-100 text-indigo-900 border-indigo-400",
      "bg-stone-100 text-stone-800 border-stone-300",
    ];

    let hash = 0;
    for (let i = 0; i < norm.length; i++) {
      hash = (hash << 5) - hash + norm.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % fallbackPalettes.length;
    return fallbackPalettes[idx];
  };

  const renderPhase = (contract: any) => {
    const displayPhase = fixPortugueseMojibake(contract.phase || '').trim();
    if (!displayPhase) {
      return <span className="text-slate-400 text-[12px]">—</span>;
    }

    const phaseClass = getPhaseStyles(displayPhase);

    return (
      <span className={cn(
        "text-[11px] font-medium px-2 py-0.5 rounded-md uppercase tracking-wider border whitespace-nowrap inline-block shadow-[0_1px_2px_rgba(0,0,0,0.02)]",
        phaseClass
      )}>
        {displayPhase}
      </span>
    );
  };

  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean | null>(null);

  useEffect(() => {
    const testConnection = async () => {
      try {
        // Test connection to Firestore
        await getDocFromServer(doc(db, 'test', 'connection'));
        setIsFirebaseConnected(true);
        console.log('Firebase connection successful');
      } catch (error: any) {
        const errMsg = error instanceof Error ? error.message : String(error);
        if (errMsg.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. The client is offline.");
          setIsFirebaseConnected(false);
          setToast({ message: 'Erro de ligação ao Firebase. Verifique a sua ligação.', type: 'error' });
        } else if (error.code === 'resource-exhausted' || errMsg.includes('quota')) {
          console.error('Firebase quota exceeded on mount.');
          setIsQuotaExceeded(true);
          setIsFirebaseConnected(true); // Still connected, just quota hit
        } else {
          // Other errors (like permission denied) still mean we're connected to the server
          setIsFirebaseConnected(true);
          console.log('Firebase connection verified (server reached)');
        }
      }
    };
    testConnection();
  }, []);

  useEffect(() => {
    if (!isAuthChecked || !user) return;

    const contractsCol = collection(db, 'contracts');

    const unsubscribe = onSnapshot(contractsCol, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contract));
      const filtered = data.filter(c => {
        if (viewMode === 'recycle-bin') {
          return c.deleted === true;
        }
        return c.deleted !== true;
      });
      setContracts(filtered);
      setLoading(false);
    }, (error: any) => {
      handleFirestoreError(error, OperationType.GET, 'contracts');
      setContracts([]);
      let message = 'Erro ao carregar dados';
      if (error.code === 'resource-exhausted' || error.message?.includes('quota')) {
        message = 'Limite de quota do Firebase atingido. Por favor, aguarde o reset da quota.';
      }
      setToast({ message, type: 'error' });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [viewMode, user, isAuthChecked]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Use getDocFromServer to ensure we are not just failing due to cache/offline state
          const userDoc = await getDocFromServer(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setUser({ id: userDoc.id, ...userDoc.data() } as User);
          } else {
            const isAdmin = firebaseUser.email === 'rochaistec@gmail.com' || 
                            firebaseUser.email === 'luis.rocha@scml.pt' || 
                            firebaseUser.email === 'admin@admin.com';
            setUser({
              id: firebaseUser.uid,
              username: firebaseUser.email || 'user',
              email: firebaseUser.email || '',
              role: isAdmin ? 'admin' : 'user'
            } as User);
          }
        } catch (error: any) {
          const errMsg = error instanceof Error ? error.message : String(error);
          if (errMsg.includes('the client is offline')) {
            console.error('Error fetching user data: Firestore is unreachable. Please check your network or Firebase configuration.');
          } else if (error.code === 'resource-exhausted' || errMsg.includes('quota')) {
            console.error('Error fetching user data: Firebase quota exceeded.');
            setToast({ message: 'Limite de quota do Firebase atingido. Alguns dados podem não carregar.', type: 'error' });
          } else {
            console.error('Error fetching user data:', error);
          }
          // Fallback to basic user info from auth if firestore is unreachable
          const isAdmin = firebaseUser.email === 'rochaistec@gmail.com' || 
                          firebaseUser.email === 'luis.rocha@scml.pt' || 
                          firebaseUser.email === 'admin@admin.com';
          setUser({
            id: firebaseUser.uid,
            username: firebaseUser.email || 'user',
            email: firebaseUser.email || '',
            role: isAdmin ? 'admin' : 'user'
          } as User);
        }
      } else {
        setUser(null);
      }
      setIsAuthChecked(true);
    });

    return () => unsubscribe();
  }, []);

  const handleSave = async (contractData: ContractInput) => {
    setIsSaving(true);

    const sanitizeForFirestore = (val: any): any => {
      if (val === undefined) return '';
      if (val === null) return null;
      if (Array.isArray(val)) {
        return val.map(item => sanitizeForFirestore(item));
      }
      if (typeof val === 'object' && !(val instanceof Date)) {
        const cleanObj: Record<string, any> = {};
        Object.entries(val).forEach(([k, v]) => {
          if (v !== undefined) {
            cleanObj[k] = sanitizeForFirestore(v);
          }
        });
        return cleanObj;
      }
      return val;
    };

    try {
      const now = new Date().toISOString();
      let savedContractId = editingContract?.id;

      // Ensure default structure for all fields and sanitize values
      const fullContractData = {
        ...getDefaultContractInput(),
        ...contractData,
        code: contractData.code || `CT-${Date.now().toString().slice(-6)}`,
        title: contractData.title || contractData.code || 'Novo Contrato',
        vendor: contractData.vendor || 'N/A',
        phase: contractData.phase || 'Aguarda Consignação/PSS',
        globalValue: Number(contractData.globalValue || contractData.contractualPrice || 0),
        deleted: false,
        updatedAt: now,
      };

      if (editingContract) {
        // Update local state immediately for fast feedback
        setContracts(prev => prev.map(c => c.id === editingContract.id ? { ...c, ...fullContractData } : c));
        
        // Attempt Firestore save
        try {
          if (!isQuotaExceeded) {
            await updateDoc(doc(db, 'contracts', editingContract.id), sanitizeForFirestore(fullContractData));
          }
        } catch (fsErr: any) {
          console.warn('Firestore update error (saved locally):', fsErr);
          if (fsErr?.code === 'resource-exhausted' || fsErr?.message?.includes('quota')) {
            setIsQuotaExceeded(true);
          }
        }
      } else {
        // Create new contract doc reference
        const newDocRef = doc(collection(db, 'contracts'));
        savedContractId = newDocRef.id;
        const newContract = {
          id: savedContractId,
          ...fullContractData,
          createdAt: now,
        };

        // Update local state immediately so user sees the new contract in the list right away
        setContracts(prev => [newContract, ...prev]);

        // Attempt Firestore save
        try {
          if (!isQuotaExceeded) {
            await setDoc(newDocRef, sanitizeForFirestore(newContract));
          }
        } catch (fsErr: any) {
          console.warn('Firestore create error (saved locally):', fsErr);
          if (fsErr?.code === 'resource-exhausted' || fsErr?.message?.includes('quota')) {
            setIsQuotaExceeded(true);
          }
        }
      }

      setIsModalOpen(false);
      setEditingContract(null);
      setToast({
        message: editingContract ? 'Contrato atualizado com sucesso!' : 'Novo contrato guardado com sucesso!',
        type: 'success',
      });
    } catch (error: any) {
      console.error('Erro ao guardar contrato:', error);
      setToast({ message: 'Erro ao guardar contrato.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    // Immediate UI update
    if (viewMode === 'recycle-bin') {
      setContracts(prev => prev.filter(c => c.id !== id));
    } else {
      setContracts(prev => prev.map(c => c.id === id ? { ...c, deleted: true } : c));
    }
    setSelectedContracts(prev => prev.filter(cId => cId !== id));

    try {
      if (!isQuotaExceeded) {
        if (viewMode === 'recycle-bin') {
          await deleteDoc(doc(db, 'contracts', id));
        } else {
          await updateDoc(doc(db, 'contracts', id), { deleted: true });
        }
      }
      setToast({ message: 'Contrato eliminado com sucesso!', type: 'success' });
    } catch (error: any) {
      console.warn('Firestore delete error (deleted locally):', error);
      if (error?.code === 'resource-exhausted' || error?.message?.includes('quota')) {
        setIsQuotaExceeded(true);
      }
      setToast({ message: 'Contrato eliminado localmente!', type: 'success' });
    }
  };

  const handleBulkDelete = async () => {
    const isPermanent = viewMode === 'recycle-bin';
    const idsToDelete = [...selectedContracts];
    if (idsToDelete.length === 0) return;

    // Immediate UI update
    if (isPermanent) {
      setContracts(prev => prev.filter(c => !idsToDelete.includes(c.id)));
    } else {
      setContracts(prev => prev.map(c => idsToDelete.includes(c.id) ? { ...c, deleted: true } : c));
    }
    setSelectedContracts([]);
    setIsBulkDeleteModalOpen(false);

    try {
      if (!isQuotaExceeded) {
        const batch = writeBatch(db);
        idsToDelete.forEach(id => {
          const ref = doc(db, 'contracts', id);
          if (isPermanent) {
            batch.delete(ref);
          } else {
            batch.update(ref, { deleted: true });
          }
        });
        await batch.commit();
      }
      setToast({ message: `${idsToDelete.length} contratos eliminados com sucesso!`, type: 'success' });
    } catch (error: any) {
      console.warn('Firestore bulk delete error (deleted locally):', error);
      if (error?.code === 'resource-exhausted' || error?.message?.includes('quota')) {
        setIsQuotaExceeded(true);
      }
      setToast({ message: `${idsToDelete.length} contratos eliminados localmente!`, type: 'success' });
    }
  };

  const handleDeleteAllContracts = async () => {
    if (!window.confirm('Tem certeza de que deseja eliminar TODOS os contratos?')) return;
    const allIds = filteredContracts.map(c => c.id);
    if (allIds.length === 0) return;

    if (viewMode === 'recycle-bin') {
      setContracts(prev => prev.filter(c => !allIds.includes(c.id)));
    } else {
      setContracts(prev => prev.map(c => allIds.includes(c.id) ? { ...c, deleted: true } : c));
    }
    setSelectedContracts([]);

    try {
      if (!isQuotaExceeded) {
        const batch = writeBatch(db);
        allIds.forEach(id => {
          const ref = doc(db, 'contracts', id);
          if (viewMode === 'recycle-bin') {
            batch.delete(ref);
          } else {
            batch.update(ref, { deleted: true });
          }
        });
        await batch.commit();
      }
      setToast({ message: 'Todos os contratos foram eliminados!', type: 'success' });
    } catch (error: any) {
      console.warn('Delete all contracts error (deleted locally):', error);
      if (error?.code === 'resource-exhausted' || error?.message?.includes('quota')) {
        setIsQuotaExceeded(true);
      }
      setToast({ message: 'Todos os contratos foram eliminados localmente!', type: 'success' });
    }
  };

  const handleRestore = async (ids: string[]) => {
    setContracts(prev => prev.map(c => ids.includes(c.id) ? { ...c, deleted: false } : c));
    setSelectedContracts([]);

    try {
      if (!isQuotaExceeded) {
        const batch = writeBatch(db);
        ids.forEach(id => {
          const ref = doc(db, 'contracts', id);
          batch.update(ref, { deleted: false });
        });
        await batch.commit();
      }
      setToast({ message: `${ids.length} contratos restaurados com sucesso!`, type: 'success' });
    } catch (error: any) {
      console.warn('Firestore restore error (restored locally):', error);
      if (error?.code === 'resource-exhausted' || error?.message?.includes('quota')) {
        setIsQuotaExceeded(true);
      }
      setToast({ message: `${ids.length} contratos restaurados localmente!`, type: 'success' });
    }
  };

  const handleEmptyRecycleBin = async () => {
    const deletedContracts = contracts.filter(c => c.deleted);
    setContracts(prev => prev.filter(c => !c.deleted));
    setSelectedContracts([]);
    setIsEmptyRecycleBinModalOpen(false);

    try {
      if (!isQuotaExceeded) {
        const batch = writeBatch(db);
        deletedContracts.forEach(c => {
          batch.delete(doc(db, 'contracts', c.id));
        });
        await batch.commit();
      }
      setToast({ message: 'Reciclagem esvaziada com sucesso!', type: 'success' });
    } catch (error: any) {
      console.warn('Empty recycle bin error (cleared locally):', error);
      if (error?.code === 'resource-exhausted' || error?.message?.includes('quota')) {
        setIsQuotaExceeded(true);
      }
      setToast({ message: 'Reciclagem esvaziada localmente!', type: 'success' });
    }
  };
// Criar tabela PDF
  const exportTableToPDF = () => {
    if (filteredContracts.length === 0) return;
    
    setToast({ message: 'A gerar PDF da tabela...', type: 'success' });
    const doc = new jsPDF('landscape');
    
    const tableColumn = [
      "Código", "Nº Fornecedor", "CPV", "Objeto", "Cocontratante", "Status", 
      "Preço Contratual", "Valor Total Executado", "Saldo", "Início", "Fim"
    ];
    
    const tableRows: any[] = [];
    
    // Calcular estatísticas para o cabeçalho do PDF
    const totalContractual = filteredContracts.reduce((acc, c) => acc + (Number(c.globalValue) || parseCurrency(c.contractualPrice || c.price || '0')), 0);
    const totalExecuted = filteredContracts.reduce((acc, c) => {
      let val = 0;
      if (c.executedValue !== undefined && c.executedValue !== null && c.executedValue !== '' && !isNaN(Number(c.executedValue))) {
        val = Number(c.executedValue);
      } else if (c.valorTotalExecutado) {
        val = parseCurrency(c.valorTotalExecutado);
      } else if (c.autosConsumption > 0) {
        val = c.autosConsumption;
      } else if (c.consumption) {
        val = Number(c.consumption) || 0;
      } else if (c.globalValue) {
        val = Number(c.globalValue) || 0;
      }
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
    const totalValue = totalContractual > 0 ? totalContractual : totalExecuted;
    const totalConsumption = totalExecuted > 0 ? totalExecuted : filteredContracts.reduce((acc, c) => {
      const consumption = c.autosConsumption > 0 ? c.autosConsumption : (c.consumption || 0);
      return acc + (Number(consumption) || 0);
    }, 0);
    const totalBalance = Math.max(0, totalValue - totalConsumption);
    const totalApprovedExpenses = filteredContracts.reduce((acc, c) => {
      let val = 0;
      if (c.approvedExpenses !== undefined && c.approvedExpenses !== null && c.approvedExpenses !== '' && !isNaN(Number(c.approvedExpenses))) {
        val = Number(c.approvedExpenses);
      } else if (c.valorTotalDespesas) {
        val = parseCurrency(c.valorTotalDespesas);
      }
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
    const pdfBaseApproved = totalApprovedExpenses > 0 ? totalApprovedExpenses : totalValue;
    const pdfBaseExecuted = totalExecuted > 0 ? totalExecuted : totalValue;
    const pdfDiffPercentage = pdfBaseApproved > 0 ? ((pdfBaseApproved - pdfBaseExecuted) / pdfBaseApproved) * 100 : 0;

    filteredContracts.forEach(contract => {
      let executed = 0;
      if (contract.executedValue !== undefined && contract.executedValue !== null && contract.executedValue !== '' && !isNaN(Number(contract.executedValue))) {
        executed = Number(contract.executedValue);
      } else if (contract.valorTotalExecutado) {
        executed = parseCurrency(contract.valorTotalExecutado);
      } else if (contract.autosConsumption > 0) {
        executed = contract.autosConsumption;
      } else if (contract.consumption) {
        executed = Number(contract.consumption) || 0;
      } else if (contract.globalValue) {
        executed = Number(contract.globalValue) || 0;
      }
      const globalValue = Number(contract.globalValue) || parseCurrency(contract.contractualPrice || contract.price || '0') || executed;
      
      const contractData = [
        stripHtml(contract.code),
        stripHtml(contract.vendorNumber),
        stripHtml(contract.cpv),
        stripHtml(contract.title),
        stripHtml(contract.vendor),
        contract.phase || 'N/A',
        formatCurrency(globalValue, true),
        formatCurrency(executed, true),
        formatCurrency(Math.max(0, globalValue - executed), true),
        safeFormatDate(contract.startDate),
        safeFormatDate(contract.endDate)
      ];
      tableRows.push(contractData);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 45, // Aumentar margem superior para acomodar o cabeçalho
      theme: 'grid',
      styles: { fontSize: 7, font: 'helvetica' },
      headStyles: { fillColor: [15, 30, 62], textColor: [255, 255, 255] },
      margin: { top: 25 }, // Margem superior para todas as páginas (exceto a primeira que usa startY)
      didDrawPage: (data) => {
        // Título Principal - Aparece em todas as páginas
        doc.setFontSize(16);
        doc.setTextColor(15, 30, 62);
        doc.setFont("helvetica", "bold");
        doc.text("DASHBOARD DE CONTRATOS", 14, 15);
        
        // Data de Geração - Aparece em todas as páginas
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 240, 15);

        // Cabeçalho Detalhado - APENAS NA PRIMEIRA PÁGINA
        if (data.pageNumber === 1) {
          // Nome do Gestor
          doc.setFontSize(10);
          doc.setTextColor(100, 116, 139);
          doc.text(`Gestor: ${user?.username || 'N/A'}`, 14, 21);
          
          // Linha divisória
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.5);
          doc.line(14, 23, 283, 23);

          // Bloco de Estatísticas
          doc.setFontSize(9);
          doc.setTextColor(100, 116, 139);
          
          // Coluna 1: Total de Contratos
          doc.text("TOTAL DE CONTRATOS", 14, 30);
          doc.setTextColor(15, 30, 62);
          doc.setFont("helvetica", "bold");
          doc.text(`${filteredContracts.length}`, 14, 35);
          
          // Coluna 2: Valor Total de Despesas Aprovadas
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 116, 139);
          doc.text("VALOR TOTAL DE DESPESAS APROVADAS", 60, 30);
          doc.setTextColor(15, 30, 62);
          doc.setFont("helvetica", "bold");
          doc.text(formatCurrency(totalApprovedExpenses > 0 ? totalApprovedExpenses : totalValue, true), 60, 35);
          
          // Coluna 3: Valor Total Executado
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 116, 139);
          doc.text("VALOR TOTAL EXECUTADO", 150, 30);
          doc.setTextColor(15, 30, 62);
          doc.setFont("helvetica", "bold");
          doc.text(formatCurrency(totalExecuted > 0 ? totalExecuted : totalValue, true), 150, 35);
          
          // Coluna 4: % Diferença (Despesas / Exec.)
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 116, 139);
          doc.text("% DIFERENÇA (DESP./EXEC.)", 220, 30);
          doc.setTextColor(15, 30, 62);
          doc.setFont("helvetica", "bold");
          doc.text(`${pdfDiffPercentage.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`, 220, 35);
        } else {
          // Nas outras páginas, apenas uma linha simples ou indicação de continuação
          doc.setFontSize(9);
          doc.setTextColor(100, 116, 139);
          doc.setFont("helvetica", "italic");
          doc.text("(Continuação)", 14, 21);
        }
        
        // Número da Página - Rodapé ou Canto
        const str = "Página " + data.pageNumber;
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(str, 270, 200); // Rodapé (landscape)
      }
    });

    doc.save(`dashboard_contratos_${format(new Date(), 'dd_MM_yyyy')}.pdf`);
    setToast({ message: 'PDF da tabela gerado com sucesso!', type: 'success' });
  };
// Criar excel
  const exportToExcel = () => {
    if (filteredContracts.length === 0) return;
    
    // Determinar o número máximo de marcos de faturação com dados para criar as colunas correspondentes
    const maxMilestones = filteredContracts.reduce((max, c) => {
      const valid = Array.isArray(c.prazosMilestones)
        ? c.prazosMilestones.filter((m: any) => 
            (m.descricao && String(m.descricao).trim()) || 
            (m.dataFatura && String(m.dataFatura).trim()) || 
            (m.numero && String(m.numero).trim()) || 
            (m.valorFaturado && String(m.valorFaturado).trim())
          )
        : [];
      return Math.max(max, valid.length);
    }, 0);

    const data = filteredContracts.map(c => {
      const formatCurr = (val: any) => {
        if (!val) return '';
        const str = String(val).trim();
        if (str.includes('€')) return str;
        const num = parseCurrency(str);
        if (num > 0) {
          return num.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u00A0/g, ' ') + ' €';
        }
        return str;
      };

      const baseData: Record<string, any> = {
        // Procedimento e Contrato
        'Referência do Contrato': stripHtml(c.code),
        'Número de Fornecedor': stripHtml(c.vendorNumber),
        'Código CPV': stripHtml(c.cpv),
        'Cocontratante': stripHtml(c.vendor),
        'Objeto do contrato': stripHtml(c.title || c.object),
        'Data de assinatura do contrato': safeFormatDate(c.signatureDate),
        'Estado do contrato': stripHtml(c.phase),
        'Contrato no SharePoint': stripHtml(c.sharepointLink),
        'Edifício': stripHtml(c.building),
        'Tipo de contrato': stripHtml(c.contractType),
        'Tipo de procedimento': stripHtml(c.procedureType),
        'Link P & D': stripHtml(c.linkPD || c.linkPED),
        'Contactos cocontratante': stripHtml(c.vendorContacts),
        'D.M. abertura e D.M. adjudicação': stripHtml(c.dmInfo),
        'Preço Contratual': stripHtml(formatCurr(c.price || c.contractualPrice)),
        'Nota de encomenda': stripHtml(c.orderNote),
        'Caução': stripHtml(c.caution),
        'Direção com a gestão técnica': stripHtml(c.technicalManagementDirection),
        'Gestor': stripHtml(c.manager),

        // Pareceres Jurídicos
        'Pareceres': stripHtml(c.pareceres),
        'Valor acumulado pagamentos decorrentes de pareceres jurídicos': stripHtml(formatCurr(c.pareceresValorAcumulado)),

        // Suspensões do Contrato
        'Suspensões': stripHtml(c.suspensoes),
        'Nova data fim do contrato': safeFormatDate(c.novaDataFimContrato),

        // Revisão de Preços
        'Revisões': stripHtml(c.revisoes),
        'Valores acumulados revisões de preços': stripHtml(formatCurr(c.revisoesValorAcumulado)),
        'Numero de revisões de Preços': stripHtml(c.numeroRevisoesPrecos),

        // Incumprimentos e Sanções
        'Incumprimentos e sanções': stripHtml(c.incumprimentos || c.breachObject),
        'Valores acumulados de sanções aplicadas': stripHtml(formatCurr(c.sancoesValorAcumulado)),

        // Modificações Objetivas do Contrato
        'Modificações objetivas': stripHtml(c.modificacoesObjetivas),
        'Valor acumulado trabalhos complementares/a mais': stripHtml(formatCurr(c.valorAcumuladoTrabalhosComplementares)),
        'Valor acumulado de trabalhos a menos': stripHtml(formatCurr(c.valorAcumuladoTrabalhosMenos)),
        'Valor acumulado modificações excluindo trabalhos a mais ou a menos': stripHtml(formatCurr(c.valorAcumuladoModificacoesExcluindo)),
        'Valor acumulado modificações objetivas': stripHtml(formatCurr(c.valorAcumuladoModificacoesObjetivas)),
        'Numero de Adendas': stripHtml(c.numeroAdendas),

        // Modificações Subjetivas do Contrato
        'Cessão da Posição Contratual': stripHtml(c.cessaoPosicaoContratual),
        'Subcontratação (quando sujeita a autorização)': stripHtml(c.subcontratacaoSujeitaAutorizacao),

        // Extinção do Contrato
        'Causa, data, D.M., sanção, execução, observações': stripHtml(c.extincaoCausa),
        'Valor associado': stripHtml(formatCurr(c.extincaoValor)),

        // Avaliação do Fornecedor
        'Avaliação e observações': stripHtml(c.avaliacaoObservacoes),

        // Comunicações Importantes
        'Comunicações importantes e observações': stripHtml(c.comunicacoesObservacoes),

        // Prazos de Execução do Contrato
        'Data início contrato': safeFormatDate(c.prazosNovaDataInicio || c.startDate || c.Datainiciocontrato || c.prazosDataInicio),
        'Data fim contrato': safeFormatDate(c.prazosNovaDataFim || c.endDate || c.DataFimContrato || c.prazosDataFim || c.novaDataFimContrato),
        'Prazos e Pagamentos Contratados': stripHtml(c.planosPagamentoFaturamentos),
        'Prorrogações de Prazos': stripHtml(c.prorrogacoesPrazos),
        'Valor total de despesas aprovada(contratos, adendas, indemnizações, juros, etc.)': stripHtml(c.valorTotalDespesas),
        'Valor Total Executado': stripHtml(c.valorTotalExecutado),
        'Percentagem': stripHtml(c.percentagem),
        'Data da Ultima Validação': safeFormatDate(c.dataUltimaFaturacao),
      };

      // Incluir marcos de execução/faturação se existirem
      for (let i = 0; i < maxMilestones; i++) {
        const m = (c.prazosMilestones && c.prazosMilestones[i]) || {};
        baseData[`Marco ${i + 1} - Descrição`] = stripHtml(m.descricao || '');
        baseData[`Marco ${i + 1} - Data (Dia/Mês/Ano)`] = stripHtml(formatDatePt(m.dataFatura) || '');
        baseData[`Marco ${i + 1} - NE`] = stripHtml(m.numero || '');
        baseData[`Marco ${i + 1} - Valor Validado`] = stripHtml(m.valorFaturado || '');
      }

      return baseData;
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Contratos");

    // Adicionar folha separada para todos os marcos detalhados se existirem
    const allMilestonesRows: any[] = [];
    filteredContracts.forEach(c => {
      if (Array.isArray(c.prazosMilestones) && c.prazosMilestones.length > 0) {
        const valid = c.prazosMilestones.filter((m: any) => 
          (m.descricao && String(m.descricao).trim()) || 
          (m.dataFatura && String(m.dataFatura).trim()) || 
          (m.numero && String(m.numero).trim()) || 
          (m.valorFaturado && String(m.valorFaturado).trim())
        );
        valid.forEach((m: any, idx: number) => {
          allMilestonesRows.push({
            'Referência do Contrato': stripHtml(c.code),
            'Cocontratante': stripHtml(c.vendor),
            'Objeto do Contrato': stripHtml(c.title || c.object),
            'Nº': idx + 1,
            'Descrição': stripHtml(m.descricao || ''),
            'Data (Dia/Mês/Ano)': stripHtml(formatDatePt(m.dataFatura) || ''),
            'NE': stripHtml(m.numero || ''),
            'Valor Validado (€)': stripHtml(m.valorFaturado || '')
          });
        });
      }
    });

    if (allMilestonesRows.length > 0) {
      const milestonesSheet = XLSX.utils.json_to_sheet(allMilestonesRows);
      XLSX.utils.book_append_sheet(workbook, milestonesSheet, "Marcos de Faturação");
    }

    XLSX.writeFile(workbook, `contratos_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    setToast({ message: 'Ficheiro Excel gerado com todos os dados!', type: 'success' });
  };

  const exportCodesToExcel = () => {
    if (filteredContracts.length === 0) return;

    const data = filteredContracts.map(c => ({
      'Número do procedimento/ Referência interna': stripHtml(c.code),
      'Objeto do Contrato': stripHtml(c.object),
      'Adjudicatário': stripHtml(c.vendor),
      'Preço Contratual': stripHtml(c.contractualPrice),
      'Data da assinatura do contrato inicial/ data da decisão de adjudicação no caso de contrato sem redução a escrito': stripHtml(c.startDate)
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Códigos");

    XLSX.writeFile(workbook, `codigos_procedimento_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    setToast({ message: 'Ficheiro Excel de Códigos gerado!', type: 'success' });
  };

  const generateReport = () => {
    const reportData: any[] = [
      {
        'Métrica': 'Empreitadas',
        'Valor': stats.totalValue
      },
      {
        'Métrica': 'Fiscalização e coordenação de segurança em obra ',
        'Valor': stats.totalConsumption
      },
      {
        'Métrica': 'Estudos e Projetos',
        'Valor': stats.totalValue - stats.totalConsumption
      }
    ];

    // Add all procedure counts dynamically to ensure exact matches with the database values
    (Object.entries(stats.contractStats || {}) as [string, { count: number, value: number }][])
      .sort((a, b) => b[1].count - a[1].count)
      .forEach(([type, stat]) => {
        if (type && type !== 'N/A') {
          reportData.push({
            'Métrica': type,
            'Valor': stat.count
          });
        }
      });

    const worksheet = XLSX.utils.json_to_sheet(reportData);
    
    // Format the values
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:B20');
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      const cellAddress = { c: 1, r: R }; // Column B (Valor)
      const cellRef = XLSX.utils.encode_cell(cellAddress);
      if (!worksheet[cellRef]) continue;
      
      // Format currency for first 3 rows
      if (R <= 3) {
        worksheet[cellRef].z = '#,##0.00 €';
      }
    }

    // Set column widths
    worksheet['!cols'] = [
      { wch: 40 }, // Métrica
      { wch: 20 }  // Valor
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório");

    XLSX.writeFile(workbook, `relatorio_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    setToast({ message: 'Relatório gerado com sucesso!', type: 'success' });
  };

  const availableContractTypes = useMemo(() => {
    const list = new Set<string>();
    // Pre-populate standard contract types
    ['Empreitada', 'Fiscalização e coordenação de segurança em obra', 'Estudos e Projetos'].forEach(t => list.add(t));
    contracts.forEach(c => {
      const fixed = fixPortugueseMojibake(c.contractType || '').trim();
      if (fixed) list.add(fixed);
    });
    return Array.from(list).sort((a, b) => a.localeCompare(b, 'pt'));
  }, [contracts]);

  const contractTypeCounts = useMemo(() => {
    const map = new Map<string, number>();
    contracts.forEach(c => {
      const fixed = fixPortugueseMojibake(c.contractType || '').trim();
      if (fixed) {
        map.set(fixed, (map.get(fixed) || 0) + 1);
      }
    });
    return map;
  }, [contracts]);

  const availableProcedureTypes = useMemo(() => {
    const list = new Set<string>();
    [
      'Ajuste direto',
      'Ajuste direto por motivos materiais',
      'Ajuste direto simplificado',
      'Consulta prévia',
      'Concurso público sem publicação no JOUE',
      'Concurso público com publicação no JOUE',
      'Concurso limitado por prévia qualificação'
    ].forEach(t => list.add(t));
    contracts.forEach(c => {
      const fixed = fixPortugueseMojibake(c.procedureType || '').trim();
      if (fixed) list.add(fixed);
    });
    return Array.from(list).sort((a, b) => a.localeCompare(b, 'pt'));
  }, [contracts]);

  const procedureTypeCounts = useMemo(() => {
    const map = new Map<string, number>();
    contracts.forEach(c => {
      const fixed = fixPortugueseMojibake(c.procedureType || '').trim();
      if (fixed) {
        map.set(fixed, (map.get(fixed) || 0) + 1);
      }
    });
    return map;
  }, [contracts]);

  const availablePhases = useMemo(() => {
    const list = new Set<string>();
    [
      'Aguarda Consignação/PSS',
      'Em execução',
      'Em execução/Aguarda Obra',
      'Em Assistência Técnica à Obra',
      'Aguarda Conta Final',
      'Aguarda Licença de Utilização',
      'Em Garantia',
      'Concluído',
      'Fechado',
      'Findo/Arquivado',
      'Cancelado'
    ].forEach(p => list.add(p));
    contracts.forEach(c => {
      const fixed = fixPortugueseMojibake(c.phase || '').trim();
      if (fixed) list.add(fixed);
    });
    return Array.from(list).sort((a, b) => a.localeCompare(b, 'pt'));
  }, [contracts]);

  const phaseCounts = useMemo(() => {
    const map = new Map<string, number>();
    contracts.forEach(c => {
      const fixed = fixPortugueseMojibake(c.phase || '').trim();
      if (fixed) {
        map.set(fixed, (map.get(fixed) || 0) + 1);
      }
    });
    return map;
  }, [contracts]);

  const filteredContracts = useMemo(() => {
    if (!Array.isArray(contracts)) return [];
    
    const normalizeForSearch = (str: string) => {
      return (str || '')
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    };

    const normalizedSearch = normalizeForSearch(searchTerm).trim();

    return contracts.filter(c => {
      const matchesSearch = !normalizedSearch || 
                           normalizeForSearch(c.title || '').includes(normalizedSearch) || 
                           normalizeForSearch(c.vendor || '').includes(normalizedSearch) ||
                           normalizeForSearch(c.code || '').includes(normalizedSearch) ||
                           normalizeForSearch(c.cpv || '').includes(normalizedSearch) ||
                           normalizeForSearch(c.contractType || '').includes(normalizedSearch) ||
                           normalizeForSearch(c.procedureType || '').includes(normalizedSearch) ||
                           normalizeForSearch(c.vendorNumber || '').includes(normalizedSearch);

      const normPhase = normalizeForSearch(fixPortugueseMojibake(c.phase || '')).trim();
      const matchesPhase = selectedPhases.length === 0 || 
                           selectedPhases.some(p => {
                             const normP = normalizeForSearch(p).trim();
                             return c.phase === p || normPhase === normP;
                           });

      const normProc = normalizeForSearch(fixPortugueseMojibake(c.procedureType || '')).trim();
      const matchesProcedureType = selectedProcedureTypes.length === 0 || 
                                   selectedProcedureTypes.some(p => {
                                     const normP = normalizeForSearch(p).trim();
                                     return c.procedureType === p || normProc === normP;
                                   });

      const normContractType = normalizeForSearch(fixPortugueseMojibake(c.contractType || '')).trim();
      const matchesContractType = selectedContractTypes.length === 0 || 
                                  selectedContractTypes.some(ct => {
                                    const normCT = normalizeForSearch(ct).trim();
                                    return c.contractType === ct || 
                                           normContractType === normCT ||
                                           (normContractType !== '' && normCT !== '' && (
                                             normContractType.includes(normCT) || 
                                             normCT.includes(normContractType)
                                           ));
                                  });

      return matchesSearch && matchesPhase && matchesProcedureType && matchesContractType;
    }).sort((a, b) => {
      // Prioritize by creation time if available, otherwise by ID
      const getTime = (dateStr?: string) => {
        if (!dateStr) return 0;
        const d = new Date(dateStr);
        const t = d.getTime();
        return isNaN(t) ? 0 : t;
      };

      const timeA = getTime(a.createdAt);
      const timeB = getTime(b.createdAt);
      
      if (timeA !== timeB) return timeB - timeA;
      return (b.id || '').localeCompare(a.id || '');
    });
  }, [contracts, searchTerm, selectedPhases, selectedProcedureTypes, selectedContractTypes, managerFilter, technicalDirectionFilter, today]);

  const stats = useMemo(() => {
    const totalContractualPrice = filteredContracts.reduce((acc, c) => {
      const val = Number(c.globalValue) || parseCurrency(c.contractualPrice || c.price || c.valorGlobal || '0');
      return acc + (isNaN(val) ? 0 : val);
    }, 0);

    const totalApprovedExpenses = filteredContracts.reduce((acc, c) => {
      const val = (c.approvedExpenses !== undefined && c.approvedExpenses !== null && c.approvedExpenses !== '' && !isNaN(Number(c.approvedExpenses)))
        ? Number(c.approvedExpenses)
        : parseCurrency(c.valorTotalDespesas || c.despesasAprovadas || '0');
      return acc + (isNaN(val) ? 0 : val);
    }, 0);

    const totalExecuted = filteredContracts.reduce((acc, c) => {
      let val = 0;
      if (c.executedValue !== undefined && c.executedValue !== null && c.executedValue !== '' && !isNaN(Number(c.executedValue))) {
        val = Number(c.executedValue);
      } else if (c.valorTotalExecutado) {
        val = parseCurrency(c.valorTotalExecutado);
      } else if (c.totalExecutado) {
        val = parseCurrency(c.totalExecutado);
      } else if (c.autosConsumption > 0) {
        val = c.autosConsumption;
      } else if (c.consumption) {
        val = Number(c.consumption) || 0;
      } else if (c.globalValue) {
        val = Number(c.globalValue) || 0;
      }
      return acc + (isNaN(val) ? 0 : val);
    }, 0);

    const totalObjectiveModifications = filteredContracts.reduce((acc, c) => {
      const val = (c.objectiveModifications !== undefined && c.objectiveModifications !== null && c.objectiveModifications !== '' && !isNaN(Number(c.objectiveModifications)))
        ? Number(c.objectiveModifications)
        : ((c.modificationValue !== undefined && c.modificationValue !== null && c.modificationValue !== '' && !isNaN(Number(c.modificationValue)))
            ? Number(c.modificationValue)
            : parseCurrency(c.valorAcumuladoModificacoesObjetivas || c.modificacoesObjetivas || '0'));
      return acc + (isNaN(val) ? 0 : val);
    }, 0);

    const totalPriceRevision = filteredContracts.reduce((acc, c) => {
      const val = (c.priceRevision !== undefined && c.priceRevision !== null && c.priceRevision !== '' && !isNaN(Number(c.priceRevision)))
        ? Number(c.priceRevision)
        : ((c.revisionValue !== undefined && c.revisionValue !== null && c.revisionValue !== '' && !isNaN(Number(c.revisionValue)))
            ? Number(c.revisionValue)
            : parseCurrency(c.revisoesValorAcumulado || c.revisoes || '0'));
      return acc + (isNaN(val) ? 0 : val);
    }, 0);

    const totalValue = totalContractualPrice > 0 ? totalContractualPrice : totalExecuted;
    const totalConsumption = totalExecuted > 0 ? totalExecuted : filteredContracts.reduce((acc, c) => {
      const consumption = c.autosConsumption > 0 ? c.autosConsumption : (Number(c.consumption) || 0);
      return acc + consumption;
    }, 0);

    const baseApproved = totalApprovedExpenses > 0 ? totalApprovedExpenses : (totalContractualPrice > 0 ? totalContractualPrice : totalValue);
    const baseExecuted = totalExecuted > 0 ? totalExecuted : totalValue;
    const differenceValue = baseApproved - baseExecuted;
    const differencePercentage = baseApproved > 0 ? ((baseApproved - baseExecuted) / baseApproved) * 100 : 0;
    const executionPercentage = baseApproved > 0 ? (baseExecuted / baseApproved) * 100 : 0;

    const totalBalance = Math.max(0, totalValue - (totalExecuted > 0 ? totalExecuted : totalConsumption));
    
    const contractStats = filteredContracts.reduce((acc, c) => {
      const type = c.contractType || 'N/A';
      if (!acc[type]) {
        acc[type] = { count: 0, value: 0 };
      }
      acc[type].count += 1;
      acc[type].value += (Number(c.globalValue) || 0);
      return acc;
    }, {} as Record<string, { count: number, value: number }>);
  
    return { 
      totalValue, 
      totalContractualPrice,
      totalApprovedExpenses,
      totalExecuted, 
      totalObjectiveModifications,
      totalPriceRevision,
      totalConsumption, 
      totalBalance,
      differenceValue,
      differencePercentage,
      executionPercentage,
      contractStats, 
      totalContracts: filteredContracts.length 
    };
  }, [filteredContracts]);

    const contractChartData = useMemo(() => 
      (Object.entries(stats.contractStats || {}) as [string, { count: number, value: number }][])
        .sort((a, b) => b[1].count - a[1].count)
        .map(([name, stat]) => ({ 
          name, 
          value: stat.count,
          percentage: stats.totalContracts > 0 
            ? ((stat.count / stats.totalContracts) * 100).toFixed(0) + '%'
            : '0%'
        })),
      [stats.contractStats, stats.totalContracts]
    );

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedContracts(filteredContracts.map(c => c.id));
    } else {
      setSelectedContracts([]);
    }
  };

  const handleSelectContract = (id: string) => {
    setSelectedContracts(prev => 
      prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
    );
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (!isAuthChecked) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-brand-light border-t-brand rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    if (isResetPage) return <ResetPassword />;
    return <Login onLogin={setUser} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Quota Exceeded Banner */}
      {isQuotaExceeded && (
        <div className="bg-red-600 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2 sticky top-0 z-[60]">
          <AlertCircle className="w-4 h-4" />
          <span>Limite de quota diária do Firebase atingido. Não é possível guardar ou apagar dados até à meia-noite.</span>
        </div>
      )}

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[98%] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-24">
            <div className="flex items-center gap-6">
              <div className="bg-brand p-3.5 rounded-2xl shadow-xl shadow-brand/20">
                <FileText className="text-white w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-normal text-slate-900 tracking-tight">Gestor de Contratos</h1>
                <p className="text-[12px] font-normal text-slate-400 uppercase tracking-widest">Sistema de Gestão e Controlo</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {user?.role === 'admin' && (
                <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl mr-4">
                  <button
                    onClick={() => setViewMode('active')}
                    className={cn(
                      "px-5 py-2 rounded-xl text-[15px] font-normal transition-all",
                      viewMode === 'active' ? "bg-white text-brand-dark shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    Ativos
                  </button>
                  <button
                    onClick={() => setViewMode('recycle-bin')}
                    className={cn(
                      "px-5 py-2 rounded-xl text-[15px] font-normal transition-all flex items-center gap-2",
                      viewMode === 'recycle-bin' ? "bg-white text-red-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    <Trash2 size={15} />
                    Reciclagem
                  </button>
                </div>
              )}

              {viewMode === 'active' && (
                <button
                  onClick={() => {
                    setEditingContract(null);
                    setIsModalOpen(true);
                  }}
                  disabled={isQuotaExceeded}
                  className="inline-flex items-center gap-2.5 bg-brand hover:bg-brand-dark text-slate-900 px-5 py-2.5 rounded-2xl text-[15px] font-normal transition-all shadow-lg shadow-brand/20 active:scale-95 mr-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus size={18} />
                  Novo Contrato
                </button>
              )}

              <div className="h-8 w-px bg-slate-200 mx-2"></div>

              <div className="flex items-center gap-1.5">

                <button
                  onClick={exportTableToPDF}
                  className="flex items-center gap-1.5 p-2.5 text-slate-500 hover:text-brand-dark hover:bg-brand-light rounded-xl transition-all"
                  title="Gerar PDF da Tabela"
                >
                  <Download size={18} />
                  <span className="text-xs font-medium">PDF</span>
                </button>
                <button
                  onClick={exportToExcel}
                  className="flex items-center gap-1.5 p-2.5 text-slate-500 hover:text-brand-dark hover:bg-brand-light rounded-xl transition-all"
                  title="Exportar Excel"
                >
                  <FileText size={18} />
                  <span className="text-xs font-medium">Excel</span>
                </button>
                <button
                  onClick={exportCodesToExcel}
                  className="flex items-center gap-1.5 p-2.5 text-slate-500 hover:text-brand-dark hover:bg-brand-light rounded-xl transition-all"
                  title="Exportar Fecho Excel"
                >
                  <FileSpreadsheet size={18} />
                  <span className="text-xs font-medium">Fecho</span>
                </button>
                {isUserAdmin(user) && (
                  <button
                    onClick={() => setIsImportModalOpen(true)}
                    disabled={isQuotaExceeded}
                    className="flex items-center gap-1.5 p-2.5 text-slate-500 hover:text-brand-dark hover:bg-brand-light rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Importar Dados"
                  >
                    <Upload size={18} />
                    <span className="text-xs font-medium">Importar</span>
                  </button>
                )}
                {isUserAdmin(user) && (
                  <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="flex items-center gap-1.5 p-2.5 text-slate-500 hover:text-brand-dark hover:bg-brand-light rounded-xl transition-all"
                    title="Configurações"
                  >
                    <Settings size={18} />
                    <span className="text-xs font-medium">Definições</span>
                  </button>
                )}
              </div>

              <div className="h-8 w-px bg-slate-200 mx-2"></div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setIsUserModalOpen(true)}
                  className="flex items-center gap-3 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-2xl transition-all shadow-xs group text-left cursor-pointer active:scale-[0.98]"
                  title="Gestão de Perfil e Utilizadores"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#e8f4f3] text-[#2c7a7b] flex items-center justify-center font-bold text-[15px] uppercase tracking-tight shrink-0 transition-transform group-hover:scale-105">
                    {getUserInitials(user)}
                  </div>
                  <div className="text-left hidden sm:block min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[14px] font-bold text-slate-900 leading-tight tracking-tight">
                        {getCleanUsername(user)}
                      </span>
                      {renderRoleBadge(user?.role || 'visitante')}
                    </div>
                    <p className="text-[12px] text-slate-400 font-normal leading-tight mt-0.5 truncate max-w-[160px]">
                      {user?.email || 'utilizador@scml.pt'}
                    </p>
                  </div>
                </button>

                <button
                  onClick={handleLogout}
                  className="p-2.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                  title="Sair"
                >
                  <LogOut size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[98%] 2xl:max-w-[1800px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Action Bar */}
        {(selectedContracts.length > 0 || viewMode === 'recycle-bin') && (
          <div className="flex flex-col md:flex-row md:items-center justify-end gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              {selectedContracts.length > 0 && (
                <div className="flex items-center gap-2 mr-2 animate-in fade-in slide-in-from-right-4 duration-300">
                  <span className="text-[15px] font-normal text-brand-dark bg-brand-light border border-brand px-3 py-2 rounded-xl">
                    {selectedContracts.length} SELECIONADO(S)
                  </span>
                  {viewMode === 'recycle-bin' && (
                    <button
                      onClick={() => handleRestore(selectedContracts)}
                      className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-slate-900 px-4 py-2 rounded-xl text-[15px] font-normal transition-all shadow-lg shadow-brand/20 active:scale-95"
                    >
                      <TrendingUp size={16} />
                      Restaurar
                    </button>
                  )}
                  {user?.role === 'admin' && (
                    <button
                      onClick={() => setIsBulkDeleteModalOpen(true)}
                      disabled={isQuotaExceeded}
                      className="inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-[15px] font-normal transition-all shadow-lg shadow-red-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={16} />
                      {viewMode === 'recycle-bin' ? 'Eliminar Definitivamente' : 'Eliminar'}
                    </button>
                  )}
                </div>
              )}

              {viewMode === 'recycle-bin' && (
                <button
                  onClick={() => setIsEmptyRecycleBinModalOpen(true)}
                  disabled={contracts.length === 0 || isQuotaExceeded}
                  className={cn(
                    "inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-lg font-normal transition-all shadow-lg active:scale-95",
                    (contracts.length === 0 || isQuotaExceeded)
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none" 
                      : "bg-red-600 hover:bg-red-700 text-white shadow-red-200"
                  )}
                >
                  <Trash2 size={20} />
                  Esvaziar Reciclagem
                </button>
              )}
            </div>
          </div>
        )}

        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 w-full">
            <StatCard 
              title="Total de Contratos" 
              value={stats.totalContracts.toString()}
              icon={<ClipboardList className="text-brand-dark" />}
              color="brand"
            />
            <StatCard 
              title="Valor Total de Despesas Aprovadas" 
              value={formatCurrency(stats.totalApprovedExpenses > 0 ? stats.totalApprovedExpenses : (stats.totalContractualPrice > 0 ? stats.totalContractualPrice : stats.totalValue), true)}
              icon={<TrendingUp className="text-brand-dark" />}
              color="brand"
            />
            <StatCard 
              title="Valor Total Executado" 
              value={formatCurrency(stats.totalExecuted > 0 ? stats.totalExecuted : stats.totalValue, true)}
              icon={<Euro className="text-brand-dark" />}
              color="brand"
            />
            <StatCard 
              title="% Diferença (Despesas / Executado)" 
              value={`${(stats.differencePercentage ?? 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`}
              subtitle={`Saldo: ${formatCurrency(stats.totalBalance, true)}`}
              icon={<Percent className="text-brand-dark" />}
              color="brand"
            />
          </div>

        {/* Procedure Counts Dashboard */}
        {Object.keys(stats.contractStats || {}).length > 0 && (() => {
          const entries = (Object.entries(stats.contractStats || {}) as [string, { count: number, value: number }][])
            .filter(([type]) => type && type !== 'N/A')
            .sort((a, b) => b[1].count - a[1].count);

          const gridColsClass = 
            entries.length === 1 ? 'grid-cols-1' :
            entries.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
            entries.length === 3 ? 'grid-cols-1 md:grid-cols-3' :
            'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';

          return (
            <div className="space-y-6 w-full">
              <div className={`grid ${gridColsClass} gap-6 w-full`}>
                {entries.map(([type, stat]) => {
                  const isSelected = selectedContractTypes.includes(type);
                  const displayType = fixPortugueseMojibake(type);
                  return (
                    <div
                      key={type}
                      onClick={() => setSelectedContractTypes(prev => 
                        prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
                      )}
                      title={`Clique para alternar filtro por ${displayType}`}
                      className={cn(
                        "bg-white p-5 rounded-2xl border shadow-sm flex flex-col justify-between transition-all cursor-pointer hover:shadow-md",
                        isSelected
                          ? "border-blue-500 ring-2 ring-blue-200 bg-blue-50/40"
                          : "border-slate-200 hover:border-slate-300"
                      )}
                    >
                      <div className="flex items-start gap-3.5 mb-4">
                        <div className={cn(
                          "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border transition-colors",
                          isSelected
                            ? "bg-blue-100 border-blue-200 text-blue-700"
                            : "bg-slate-50 border-slate-100 text-slate-500"
                        )}>
                          <ClipboardList size={22} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p 
                            className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider leading-snug break-words mb-1" 
                            title={displayType}
                          >
                            {displayType}
                          </p>
                          <p className="text-2xl font-bold text-slate-900 tracking-tight leading-none">
                            {stat.count}
                          </p>
                        </div>
                      </div>
                      <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2">
                        <span className="text-[12px] font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap">
                          Valor Total
                        </span>
                        <span className="text-lg font-semibold text-brand-dark font-mono whitespace-nowrap">
                          {formatCurrency(stat.value, true)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Procedure Chart */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm w-full">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-4">
                  Distribuição por Tipo de Contrato
                </h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={contractChartData}
                      margin={{ top: 30, right: 10, left: 10, bottom: 40 }}
                    >
                      <XAxis 
                        dataKey="name" 
                        interval={0} 
                        tick={{ fontSize: 11, fill: '#64748b' }} 
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip 
                        cursor={{ fill: 'transparent' }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={60}>
                        {contractChartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={['#F97316', '#FB923C', '#FBBF24', '#FDE047', '#CA8A04', '#EAB308', '#84CC16'][index % 7]} />
                        ))}
                        <LabelList dataKey="percentage" position="top" style={{ fontSize: '14px', fontWeight: 'bold' }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Filters & Search */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Pesquisar por título, código ou fornecedor..."
                className="w-full pl-12 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-normal focus:outline-none focus:ring-4 focus:ring-brand-light focus:border-brand transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
                <Filter size={14} className="text-slate-400" />
                <span className="text-[13px] font-normal text-slate-400 uppercase tracking-widest whitespace-nowrap">Filtros</span>
              </div>
              <MultiSelectFilter
                title="Fases do Contrato"
                placeholder="Todas as Fases"
                options={availablePhases}
                selected={selectedPhases}
                onChange={setSelectedPhases}
                counts={phaseCounts}
                totalCount={contracts.length}
              />
              <MultiSelectFilter
                title="Tipos de Procedimento"
                placeholder="Todos os Procedimentos"
                options={availableProcedureTypes}
                selected={selectedProcedureTypes}
                onChange={setSelectedProcedureTypes}
                counts={procedureTypeCounts}
                totalCount={contracts.length}
              />
              <MultiSelectFilter
                title="Tipos de Contrato"
                placeholder="Todos os Tipos de Contrato"
                options={availableContractTypes}
                selected={selectedContractTypes}
                onChange={setSelectedContractTypes}
                counts={contractTypeCounts}
                totalCount={contracts.length}
              />
              {(searchTerm || selectedPhases.length > 0 || selectedProcedureTypes.length > 0 || selectedContractTypes.length > 0) && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedPhases([]);
                    setSelectedProcedureTypes([]);
                    setSelectedContractTypes([]);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold text-red-600 hover:bg-red-50 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
                  title="Limpar todos os filtros"
                >
                  <X size={14} />
                  Limpar
                </button>
              )}
            </div>
          </div>

          {/* Active Filter Badges & Count */}
          {(searchTerm || selectedPhases.length > 0 || selectedProcedureTypes.length > 0 || selectedContractTypes.length > 0) && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-500 font-medium">
                A mostrar <strong className="text-slate-900">{filteredContracts.length}</strong> de <strong className="text-slate-900">{contracts.length}</strong> contratos:
              </span>
              {selectedContractTypes.map(ct => (
                <span key={ct} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                  Tipo: <strong>{ct}</strong>
                  <button 
                    type="button" 
                    onClick={() => setSelectedContractTypes(prev => prev.filter(t => t !== ct))}
                    className="hover:text-blue-900 text-blue-500 font-bold ml-1 cursor-pointer text-sm"
                    title="Remover filtro"
                  >
                    ×
                  </button>
                </span>
              ))}
              {selectedPhases.map(phase => (
                <span key={phase} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-50 text-cyan-800 border border-cyan-200 font-medium">
                  Fase: <strong>{phase}</strong>
                  <button 
                    type="button" 
                    onClick={() => setSelectedPhases(prev => prev.filter(p => p !== phase))}
                    className="hover:text-cyan-950 text-cyan-600 font-bold ml-1 cursor-pointer text-sm"
                    title="Remover filtro"
                  >
                    ×
                  </button>
                </span>
              ))}
              {selectedProcedureTypes.map(proc => (
                <span key={proc} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">
                  Procedimento: <strong>{proc}</strong>
                  <button 
                    type="button" 
                    onClick={() => setSelectedProcedureTypes(prev => prev.filter(p => p !== proc))}
                    className="hover:text-indigo-900 text-indigo-500 font-bold ml-1 cursor-pointer text-sm"
                    title="Remover filtro"
                  >
                    ×
                  </button>
                </span>
              ))}
              {searchTerm && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                  Pesquisa: <strong>&ldquo;{searchTerm}&rdquo;</strong>
                  <button 
                    type="button" 
                    onClick={() => setSearchTerm('')}
                    className="hover:text-slate-900 text-slate-500 font-bold ml-1 cursor-pointer text-sm"
                    title="Limpar pesquisa"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
        {/* Data Grid */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr>
                  <th className="data-grid-header w-10 text-center">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 text-brand-dark focus:ring-brand cursor-pointer"
                      checked={selectedContracts.length > 0 && selectedContracts.length === filteredContracts.length}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="data-grid-header min-w-[140px]">Tipo de Contrato</th>
                  <th className="data-grid-header min-w-[130px]">Estado do Contrato</th>
                  <th className="data-grid-header min-w-[120px] whitespace-nowrap">Referência</th>
                  <th className="data-grid-header min-w-[220px]">Objeto do Contrato</th>
                  <th className="data-grid-header min-w-[150px]">Cocontratante</th>
                  <th className="data-grid-header min-w-[130px] text-right">Preço Contratual</th>
                  <th className="data-grid-header min-w-[110px] text-center">Data Início</th>
                  <th className="data-grid-header min-w-[110px] text-center">Data Fim</th>
                  <th className="data-grid-header min-w-[140px] text-right">Despesas Aprovadas</th>
                  <th className="data-grid-header min-w-[130px] text-right">Total Executado</th>
                  <th className="data-grid-header min-w-[140px] text-right">Modificações Obj.</th>
                  <th className="data-grid-header min-w-[130px] text-right">Revisão Preços</th>
                  <th className="data-grid-header min-w-[140px]">Procedimento</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={14} className="px-6 py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <Clock className="animate-spin text-brand-dark" size={32} />
                        <span className="text-lg font-normal uppercase tracking-widest">Carregando dados...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredContracts.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="px-6 py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2 opacity-50">
                        <Search size={32} />
                        <span className="text-lg font-normal uppercase tracking-widest">Nenhum contrato encontrado</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredContracts.map((contract) => (
                    <tr 
                      key={contract.id} 
                      className="data-grid-row group"
                      onClick={() => {
                        setEditingContract(contract);
                        setIsModalOpen(true);
                      }}
                    >
                      <td className="data-grid-cell text-center" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          className="rounded-md border-slate-300 text-brand-dark focus:ring-brand cursor-pointer w-4 h-4"
                          checked={selectedContracts.includes(contract.id)}
                          onChange={() => handleSelectContract(contract.id)}
                        />
                      </td>
                      <td className="data-grid-cell">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (contract.contractType) {
                              const fixed = fixPortugueseMojibake(contract.contractType).trim();
                              setSelectedContractTypes(prev => 
                                prev.includes(fixed) ? prev.filter(t => t !== fixed) : [...prev, fixed]
                              );
                            }
                          }}
                          className="font-sans font-medium text-[14px] text-slate-800 hover:text-blue-700 hover:underline text-left transition-colors cursor-pointer leading-tight tracking-tight"
                          title="Clique para alternar filtro por este Tipo de Contrato"
                        >
                          {fixPortugueseMojibake(contract.contractType) || '-'}
                        </button>
                      </td>
                      <td className="data-grid-cell">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (contract.phase) {
                              const fixed = fixPortugueseMojibake(contract.phase).trim();
                              setSelectedPhases(prev => 
                                prev.includes(fixed) ? prev.filter(p => p !== fixed) : [...prev, fixed]
                              );
                            }
                          }}
                          className="cursor-pointer transition-transform active:scale-95 text-left inline-block"
                          title={`Clique para alternar filtro por: ${contract.phase || ''}`}
                        >
                          {renderPhase(contract)}
                        </button>
                      </td>
                      <td className="data-grid-cell whitespace-nowrap">
                        <span className="font-sans text-[13px] px-2 py-1 bg-slate-100 text-slate-700 rounded-lg border border-slate-200 font-medium">
                          {contract.code || contract.referencia || contract.ref || contract.procedimento || '-'}
                        </span>
                      </td>
                      <td className="data-grid-cell">
                        <div className="max-w-[260px] font-normal text-slate-900 line-clamp-2 leading-tight tracking-tight text-[14px]" title={stripHtml(contract.title || contract.object || '')}>
                          {stripHtml(contract.title || contract.object || '') || '-'}
                        </div>
                      </td>
                      <td className="data-grid-cell">
                        <div className="max-w-[160px] text-brand-dark font-medium truncate text-[13px] uppercase tracking-tight" title={contract.vendor || contract.cocontratante || contract.fornecedor || ''}>
                          {contract.vendor || contract.cocontratante || contract.fornecedor || '-'}
                        </div>
                      </td>
                      <td className="data-grid-cell text-right font-mono font-medium text-slate-800 text-[13px] whitespace-nowrap">
                        {formatCurrency(contract.globalValue !== undefined && contract.globalValue !== null && contract.globalValue !== 0 ? contract.globalValue : (contract.contractualPrice || contract.price || contract.valorGlobal || 0), true)}
                      </td>
                      <td className="data-grid-cell text-center text-slate-600 text-[13px] font-normal whitespace-nowrap">
                        {safeFormatDate(contract.prazosNovaDataInicio || contract.startDate || contract.Datainiciocontrato || contract.prazosDataInicio || contract.dataInicio)}
                      </td>
                      <td className="data-grid-cell text-center text-slate-600 text-[13px] font-normal whitespace-nowrap">
                        {safeFormatDate(contract.prazosNovaDataFim || contract.endDate || contract.DataFimContrato || contract.prazosDataFim || contract.novaDataFimContrato || contract.dataFim)}
                      </td>
                      <td className="data-grid-cell text-right font-mono font-normal text-slate-700 text-[13px] whitespace-nowrap">
                        {formatCurrency(contract.approvedExpenses !== undefined && contract.approvedExpenses !== null && contract.approvedExpenses !== '' ? contract.approvedExpenses : (contract.valorTotalDespesas || contract.despesasAprovadas || 0), true)}
                      </td>
                      <td className="data-grid-cell text-right font-mono font-normal text-slate-700 text-[13px] whitespace-nowrap">
                        {formatCurrency(contract.executedValue !== undefined && contract.executedValue !== null && contract.executedValue !== '' ? contract.executedValue : (contract.valorTotalExecutado || contract.totalExecutado || 0), true)}
                      </td>
                      <td className="data-grid-cell text-right font-mono font-normal text-slate-700 text-[13px] whitespace-nowrap">
                        {formatCurrency(contract.valorAcumuladoModificacoesObjetivas !== undefined && contract.valorAcumuladoModificacoesObjetivas !== null && contract.valorAcumuladoModificacoesObjetivas !== '' ? contract.valorAcumuladoModificacoesObjetivas : (contract.objectiveModifications || contract.modificationValue || 0), true)}
                      </td>
                      <td className="data-grid-cell text-right font-mono font-normal text-slate-700 text-[13px] whitespace-nowrap">
                        {formatCurrency(contract.revisoesValorAcumulado !== undefined && contract.revisoesValorAcumulado !== null && contract.revisoesValorAcumulado !== '' ? contract.revisoesValorAcumulado : (contract.priceRevision || contract.revisionValue || 0), true)}
                      </td>
                      <td className="data-grid-cell text-slate-600 text-[13px] font-normal">
                        {fixPortugueseMojibake(contract.procedureType || contract.tipoProcedimento || '-') || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-slate-50/90 font-medium border-t-2 border-slate-200">
                <tr>
                  <td colSpan={6} className="data-grid-cell text-right text-slate-500 uppercase text-[12px] tracking-wider font-semibold">Totais:</td>
                  <td className="data-grid-cell text-right font-mono text-slate-900 text-[13px] font-bold whitespace-nowrap">
                    {formatCurrency(stats.totalContractualPrice > 0 ? stats.totalContractualPrice : stats.totalValue, true)}
                  </td>
                  <td className="data-grid-cell text-center"></td>
                  <td className="data-grid-cell text-center"></td>
                  <td className="data-grid-cell text-right font-mono text-slate-900 text-[13px] font-bold whitespace-nowrap">
                    {formatCurrency(stats.totalApprovedExpenses, true)}
                  </td>
                  <td className="data-grid-cell text-right font-mono text-slate-900 text-[13px] font-bold whitespace-nowrap">
                    {formatCurrency(stats.totalExecuted > 0 ? stats.totalExecuted : stats.totalValue, true)}
                  </td>
                  <td className="data-grid-cell text-right font-mono text-slate-900 text-[13px] font-bold whitespace-nowrap">
                    {formatCurrency(stats.totalObjectiveModifications, true)}
                  </td>
                  <td className="data-grid-cell text-right font-mono text-slate-900 text-[13px] font-bold whitespace-nowrap">
                    {formatCurrency(stats.totalPriceRevision, true)}
                  </td>
                  <td className="data-grid-cell"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {contractToDelete !== null && (
          <GenericConfirmationModal 
            title={viewMode === 'recycle-bin' ? 'Eliminar Definitivamente' : 'Confirmar Eliminação'}
            message={viewMode === 'recycle-bin' 
              ? 'Tem a certeza que deseja eliminar este contrato definitivamente? Esta ação não pode ser revertida.' 
              : 'Tem a certeza que deseja mover este contrato para a reciclagem?'}
            confirmText="Sim, Eliminar"
            onConfirm={() => {
              handleDelete(contractToDelete);
              setContractToDelete(null);
            }}
            onCancel={() => setContractToDelete(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isBulkDeleteModalOpen && (
          <GenericConfirmationModal 
            title={viewMode === 'recycle-bin' ? 'Eliminar Definitivamente' : 'Confirmar Eliminação'}
            message={viewMode === 'recycle-bin' 
              ? `Tem a certeza que deseja eliminar definitivamente ${selectedContracts.length} contrato(s)? Esta ação não pode ser revertida.` 
              : `Tem a certeza que deseja mover ${selectedContracts.length} contrato(s) para a reciclagem?`}
            confirmText="Sim, Eliminar"
            onConfirm={handleBulkDelete}
            onCancel={() => setIsBulkDeleteModalOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isEmptyRecycleBinModalOpen && (
          <GenericConfirmationModal 
            title="Esvaziar Reciclagem"
            message="Tem a certeza que deseja esvaziar a reciclagem? Todos os contratos serão eliminados definitivamente. Esta ação não pode ser revertida."
            confirmText="Sim, Esvaziar"
            onConfirm={handleEmptyRecycleBin}
            onCancel={() => setIsEmptyRecycleBinModalOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={cn(
              "fixed top-20 right-8 z-[100] px-6 py-4 rounded-2xl shadow-2xl border flex items-start gap-4 max-w-lg animate-in fade-in slide-in-from-right-4",
              toast.type === 'success' ? "bg-emerald-50 border-emerald-100 text-emerald-900" : "bg-red-50 border-red-100 text-red-900"
            )}
          >
            <div className="mt-1">
              {toast.type === 'success' ? <CheckCircle2 size={24} className="text-emerald-500" /> : <AlertCircle size={24} className="text-red-500" />}
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-[17px] font-semibold leading-tight">
                {toast.type === 'success' ? 'Sucesso' : 'Ocorreu um Erro'}
              </p>
              <p className="text-[15px] font-normal opacity-90 leading-relaxed whitespace-pre-line">
                {toast.message}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <ContractModal 
            key={editingContract?.id || 'new'}
            onClose={() => setIsModalOpen(false)}
            onSave={handleSave}
            onDelete={handleDelete}
            initialData={editingContract}
            isSaving={isSaving}
            isQuotaExceeded={isQuotaExceeded}
            setToast={setToast}
            userRole={user?.role}
            today={today}
          />
        )}
      </AnimatePresence>

      {/* User Management Modal */}
      <AnimatePresence>
        {isUserModalOpen && user && (
          <UserManagementModal 
            isOpen={isUserModalOpen}
            isQuotaExceeded={isQuotaExceeded}
            onClose={() => setIsUserModalOpen(false)}
            currentUser={user}
            onUpdateCurrentUser={(updated) => setUser(updated)}
            setToast={setToast}
          />
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <SettingsModal 
            isOpen={isSettingsOpen} 
            isQuotaExceeded={isQuotaExceeded}
            onClose={() => setIsSettingsOpen(false)}
            setToast={setToast}
          />
        )}
      </AnimatePresence>

      {/* Import Modal */}
      <AnimatePresence>
        {isImportModalOpen && (
          <ImportModal 
            isOpen={isImportModalOpen}
            isQuotaExceeded={isQuotaExceeded}
            onClose={() => setIsImportModalOpen(false)}
            existingContracts={contracts}
            onImportSuccess={(importedList, updatedExistingIds) => {
              // Garante que o utilizador está no modo de contratos ativos e limpa termos de pesquisa para ver os contratos recém-importados
              setViewMode('active');
              setSearchTerm('');
              setSelectedPhases([]);
              setSelectedProcedureTypes([]);
              setSelectedContractTypes([]);
              setManagerFilter('Todos');
              setTechnicalDirectionFilter('Todos');

              setContracts(prev => {
                const map = new Map<string, Contract>();
                // Preservar contratos existentes que não foram atualizados
                prev.forEach(c => map.set(c.id, c));
                // Inserir ou sobrepor os contratos importados/atualizados
                importedList.forEach(c => {
                  map.set(c.id, {
                    ...map.get(c.id),
                    ...c,
                    deleted: false
                  });
                });
                return Array.from(map.values());
              });
            }}
            setToast={setToast}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: React.ReactNode;
  icon: React.ReactNode;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, icon, color }) => {
  const colorVariants: Record<string, string> = {
    brand: "bg-brand-light text-brand-dark border-brand",
    blue: "bg-brand-light text-brand-dark border-brand",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    slate: "bg-slate-50 text-slate-600 border-slate-100",
  };

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex items-center gap-3">
      <div className={cn("p-2 rounded-xl border flex-shrink-0", colorVariants[color])}>
        {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { size: 20 }) : icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-normal text-slate-400 uppercase tracking-wider mb-0.5 leading-tight truncate" title={title}>{title}</p>
        <p className="text-2xl font-normal text-slate-900 tracking-tight">{value}</p>
        {subtitle && (
          <div className="text-[11px] font-normal text-slate-500 mt-0.5 leading-tight">
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

function GenericConfirmationModal({ 
  title, 
  message, 
  confirmText, 
  onConfirm, 
  onCancel, 
  isDestructive = true 
}: { 
  title: string; 
  message: string; 
  confirmText: string; 
  onConfirm: () => void; 
  onCancel: () => void; 
  isDestructive?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200"
      >
        <div className="p-6 text-center space-y-4">
          <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center ${isDestructive ? 'bg-red-100 text-red-600' : 'bg-brand-light text-brand-dark'}`}>
            <AlertCircle size={24} />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-normal text-slate-900">
              {title}
            </h3>
            <p className="text-lg text-slate-500">
              {message}
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-lg font-normal transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 px-4 py-2.5 text-slate-900 rounded-xl text-lg font-normal transition-colors shadow-lg ${isDestructive ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20' : 'bg-brand hover:bg-brand-dark shadow-brand/20'}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

const createDefaultMilestones = (count = 60) => 
  Array.from({ length: count }, () => ({ descricao: '', dataFatura: '', numero: '', valorFaturado: '' }));

const getDefaultContractInput = (): ContractInput => ({
  code: '',
  title: '',
  isWritten: true,
  procedureType: '',
  contractType: '',
  vendor: '',
  vendorNumber: '',
  vendorContacts: '',
  adjudicationNature: '',
  cpv: '',
  cpvDescription: '',
  openingAuthorization: '',
  adjudicationAuthorization: '',
  object: '',
  signatureDate: '',
  building: '',
  dmInfo: '',
  price: '',
  orderNote: '',
  caution: '',
  technicalManagementDirection: '',
  guaranteeType: '',
  guaranteeValue: 0,
  guaranteeRelease: '',
  retentionRight: '',
  pareceres: '',
  pareceresValorAcumulado: '',
  opinionObject: '',
  sharepointLink: '',
  linkPD: '',
  linkPED: '',
  localFolderLink: '',
  suspensoes: '',
  novaDataFimContrato: '',
  revisoes: '',
  revisoesValorAcumulado: '',
  numeroRevisoesPrecos: '',
  incumprimentos: '',
  sancoesValorAcumulado: '',
  modificacoesObjetivas: '',
  valorAcumuladoTrabalhosComplementares: '',
  valorAcumuladoTrabalhosMenos: '',
  valorAcumuladoModificacoesExcluindo: '',
  valorAcumuladoModificacoesObjetivas: '0 €',
  numeroAdendas: '',
  cessaoPosicaoContratual: '',
  subcontratacaoSujeitaAutorizacao: '',
  extincaoCausa: '',
  extincaoValor: '',
  avaliacaoObservacoes: '',
  comunicacoesObservacoes: '',
  prazosNovaDataInicio: '',
  prazosNovaDataFim: '',
  planosPagamentoFaturamentos: '',
  prorrogacoesPrazos: '',
  valorTotalDespesas: '0,00 €',
  valorTotalExecutado: '0,00 €',
  percentagem: '0,00%',
  dataUltimaFaturacao: '',
  prazosMilestones: createDefaultMilestones(60),
  opinionObservations: '',
  priceRevisionObject: '',
  revisionNumber: '',
  revisionValue: 0,
  revisionPeriod: '',
  boardDeliberationRevision: '',
  revisionCommitmentNumber: '',
  priceRevisionObservations: '',
  modifications: '',
  objectiveModificationObject: '',
  modificationNumber: '',
  modificationValue: 0,
  boardDeliberationModifications: '',
  objectiveModificationObservations: '',
  subjectiveModificationObject: '',
  subjectiveModificationObservations: '',
  hasSubcontracting: '',
  subcontractingObject: '',
  subcontractingIdent: '',
  subcontractingValue: 0,
  breachTermination: '',
  breachObject: '',
  breachValue: 0,
  boardDeliberationBreach: '',
  breachObservations: '',
  terminationObject: '',
  terminationDate: '',
  terminationValue: 0,
  boardDeliberationTermination: '',
  terminationObservations: '',
  globalValue: 0,
  consumption: 0,
  autosValue: 0,
  neGlobalValue: 0,
  autosConsumption: 0,
  autosBalance: 0,
  neGlobalConsumption: 0,
  neGlobalBalance: 0,
  contractualPrice: '',
  manager: '',
  interlocutor: '',
  technicalDirection: '',
  cocontratanteManager: '',
  legalManager: '',
  technicalManager: '',
  ngccManager: '',
  phase: 'Aguarda Consignação/PSS',
  startDate: '',
  endDate: '',
  validityDate: '',
  endDateYear1: '',
  endDateYear2: '',
  renewalYear1: 30,
  renewalYear2: 30,
  isRenewalYear1: false,
  isRenewalYear2: false,
  contractDuration: '',
  description: '',
  attachments: [],
  fiscal: '',
  department: '',
  externalLink: ''
});

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 border border-slate-200 shadow-xl rounded-xl">
        <p className="text-[13px] font-normal text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-xl font-normal text-brand-dark">
          {payload[0].value} <span className="text-[15px] font-normal text-slate-400 ml-1">Contratos</span>
        </p>
      </div>
    );
  }
  return null;
};

interface ContractModalProps {
  onClose: () => void;
  onSave: (data: ContractInput) => void;
  onDelete: (id: string) => void;
  initialData: Contract | null;
  isSaving: boolean;
  isQuotaExceeded: boolean;
  setToast: (toast: { message: string, type: 'success' | 'error' } | null) => void;
  userRole?: string;
  today: Date;
}

const ContractModal: React.FC<ContractModalProps> = ({ onClose, onSave, onDelete, initialData, isSaving, isQuotaExceeded, setToast, userRole, today }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<string>('proc_contract');
  const [modTab, setModTab] = useState<'objetivas' | 'subjetivas' | 'subcontratacao'>('objetivas');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const [formData, setFormData] = useState<ContractInput>(() => {
    const defaultInput = getDefaultContractInput();
    const base = initialData ? { ...defaultInput, ...initialData } : defaultInput;
    
    // Ensure no null/undefined values for controlled inputs
    const sanitized = { ...base };
    (Object.keys(defaultInput) as Array<keyof ContractInput>).forEach(key => {
      if (sanitized[key] === null || sanitized[key] === undefined) {
        (sanitized as any)[key] = (defaultInput as any)[key];
      }
    });

    // Ensure all strings are strings and all numbers are numbers
    (Object.keys(sanitized) as Array<keyof ContractInput>).forEach(key => {
      if (typeof (defaultInput as any)[key] === 'string' && typeof sanitized[key] !== 'string') {
        (sanitized as any)[key] = String(sanitized[key] || '');
      } else if (typeof (defaultInput as any)[key] === 'number' && typeof sanitized[key] !== 'number') {
        (sanitized as any)[key] = Number(sanitized[key] || 0);
      }
    });

    // Garantir que a tabela de marcos / autos tem pelo menos 60 linhas e recolher dados
    let rawMilestones = sanitized.prazosMilestones;
    if (!Array.isArray(rawMilestones) || rawMilestones.every((m: any) => !m || (!m.descricao && !m.valorFaturado && !m.dataFatura && !m.numero))) {
      if (Array.isArray((sanitized as any).milestones) && (sanitized as any).milestones.length > 0) {
        rawMilestones = (sanitized as any).milestones;
      } else if (Array.isArray((sanitized as any).autos) && (sanitized as any).autos.length > 0) {
        rawMilestones = (sanitized as any).autos;
      } else if (Array.isArray((sanitized as any).autosMedicao) && (sanitized as any).autosMedicao.length > 0) {
        rawMilestones = (sanitized as any).autosMedicao;
      } else if (Array.isArray((sanitized as any).medicoes) && (sanitized as any).medicoes.length > 0) {
        rawMilestones = (sanitized as any).medicoes;
      }
    }

    // Se ainda não tiver itens preenchidos, procurar propriedades como auto1, marco1, etc.
    const hasExistingMilestoneData = Array.isArray(rawMilestones) && rawMilestones.some((m: any) => m && (m.descricao || m.valorFaturado || m.dataFatura || m.numero));
    if (!hasExistingMilestoneData) {
      const extractedMap: Record<number, { descricao?: string; dataFatura?: string; numero?: string; valorFaturado?: string }> = {};
      Object.entries(sanitized).forEach(([k, v]) => {
        if (v === null || v === undefined || v === '') return;
        const mMatch = k.match(/(?:marco|auto|medicao|faturacao)\s*[-_]?\s*(\d+)(?:[-_]?\s*(.*))?/i);
        if (mMatch) {
          const idx = parseInt(mMatch[1], 10);
          const sub = (mMatch[2] || '').toLowerCase();
          if (!extractedMap[idx]) extractedMap[idx] = {};
          if (sub.includes('desc')) {
            extractedMap[idx].descricao = String(v).trim();
          } else if (sub.includes('data') || sub.includes('mes') || sub.includes('ano')) {
            extractedMap[idx].dataFatura = formatDatePt(v) || String(v);
          } else if (sub.includes('ne') || sub.includes('num')) {
            extractedMap[idx].numero = String(v).trim();
          } else if (sub.includes('val') || !sub) {
            const num = parseCurrency(v);
            extractedMap[idx].valorFaturado = num > 0 ? formatCurrency(num) : String(v).trim();
            if (!extractedMap[idx].descricao) {
              extractedMap[idx].descricao = `Auto de Medição nº ${idx}`;
            }
          }
        }
      });
      const indices = Object.keys(extractedMap).map(Number).sort((a, b) => a - b);
      if (indices.length > 0) {
        rawMilestones = indices.map(idx => ({
          descricao: extractedMap[idx].descricao || `Auto de Medição nº ${idx}`,
          dataFatura: extractedMap[idx].dataFatura || '',
          numero: extractedMap[idx].numero || '',
          valorFaturado: extractedMap[idx].valorFaturado || ''
        }));
      }
    }

    const ensure60Milestones = (list: any[]) => {
      const existing = Array.isArray(list) 
        ? list.map((m: any) => ({
            descricao: m?.descricao || '',
            dataFatura: m?.dataFatura ? (formatDatePt(m.dataFatura) || m.dataFatura) : '',
            numero: m?.numero || '',
            valorFaturado: m?.valorFaturado ? (typeof m.valorFaturado === 'number' ? formatCurrency(m.valorFaturado) : String(m.valorFaturado)) : ''
          }))
        : [];
      while (existing.length < 60) {
        existing.push({ descricao: '', dataFatura: '', numero: '', valorFaturado: '' });
      }
      return existing;
    };
    sanitized.prazosMilestones = ensure60Milestones(rawMilestones);

    // Se o campo code contiver um código CPV (ex: 45454100-5):
    if (/^\d{8}(-\d)?$/.test(String(sanitized.code || '').trim())) {
      if (!sanitized.cpv) {
        sanitized.cpv = String(sanitized.code).trim();
      }
      // Se o code for igual ao CPV, gera uma referência de contrato válida
      if (String(sanitized.code).trim() === String(sanitized.cpv).trim()) {
        sanitized.code = `CT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      }
    }

    // Se o campo code estiver vazio, verificar se veio com outro nome nas propriedades
    if (!sanitized.code || !String(sanitized.code).trim()) {
      sanitized.code = 
        sanitized.referencia ||
        sanitized.ref ||
        sanitized.procedimento ||
        sanitized.procedimentoAquisitivo ||
        sanitized.processo ||
        sanitized.numeroContrato ||
        sanitized.contractCode ||
        `CT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // Se o campo vendor contiver morada/contactos e vendorContacts estiver vazio:
    if (looksLikeContacts(sanitized.vendor) && !sanitized.vendorContacts) {
      sanitized.vendorContacts = String(sanitized.vendor).trim();
    }

    // Se vendorNumber estiver vazio, verificar propriedades alternativas ou extrair NIF
    if (!sanitized.vendorNumber || !String(sanitized.vendorNumber).trim()) {
      sanitized.vendorNumber = 
        sanitized.nif ||
        sanitized.nipc ||
        sanitized.numeroFornecedor ||
        sanitized.codFornecedor ||
        sanitized.codigofornecedor ||
        sanitized.nfornecedor ||
        '';

      if (!sanitized.vendorNumber) {
        const combined = `${sanitized.vendor || ''} ${sanitized.vendorContacts || ''}`;
        const nifMatch = combined.match(/(?:nif|nipc)[:\s]*([1235689]\d{8})/i) ||
                         String(sanitized.vendorContacts || '').match(/\b([1235689]\d{8})\b/);
        if (nifMatch) {
          sanitized.vendorNumber = nifMatch[1];
        }
      }
    }

    // Normalize dropdown values to match options case-insensitively
    const normalizeValue = (val: string, options: string[]) => {
      if (!val) return '';
      const found = options.find(opt => opt.toLowerCase().trim() === val.toLowerCase().trim());
      return found || '';
    };

    sanitized.procedureType = normalizeValue(sanitized.procedureType, [
      'Ajuste direto simplificado', 'Ajuste direto', 'Ajuste direto por motivos materiais',
      'Consulta prévia', 'Concurso público sem publicação no JOUE',
      'Concurso público com publicação no JOUE', 'Concurso limitado por prévia qualificação'
    ]);

    sanitized.adjudicationNature = normalizeValue(sanitized.adjudicationNature, [
      'Empreitada', 'Fiscalização e coordenação de segurança em obra', 'Estudos e Projetos'
    ]);

    sanitized.phase = normalizeValue(sanitized.phase, [
      'Aguarda Consignação/PSS', 'Em execução', 'Em execução/Aguarda Obra',
      'Em Assistência Técnica à Obra', 'Aguarda Conta Final', 
      'Aguarda Licença de Utilização', 'Em Garantia', 'Concluído',
      'Fechado', 'Findo/Arquivado', 'Cancelado'
    ]);

    // se "dias para o final" tiver o valor de 0 ou menos, passar a fase para "Terminado"

    if (sanitized.attachments) {
      sanitized.attachments = sanitized.attachments.map((att, idx) => ({
        id: att.id || `att-${idx}`,
        name: att.name || '',
        url: att.url || '',
        type: att.type || 'link',
        uploadDate: att.uploadDate || today.toISOString()
      }));
    }

    if (Array.isArray(sanitized.prazosMilestones)) {
      sanitized.prazosMilestones = sanitized.prazosMilestones.map((m: any) => ({
        ...m,
        dataFatura: formatDatePt(m.dataFatura),
      }));
    }

    if (sanitized.dataUltimaFaturacao) {
      sanitized.dataUltimaFaturacao = toIsoDate(sanitized.dataUltimaFaturacao) || sanitized.dataUltimaFaturacao;
    }

    // Sincronizar e normalizar datas de início e fim para formato ISO (AAAA-MM-DD)
    const rawStart = sanitized.prazosNovaDataInicio || sanitized.prazosDataInicio || sanitized.startDate || sanitized.Datainiciocontrato || sanitized.datainiciocontrato || '';
    const rawEnd = sanitized.prazosNovaDataFim || sanitized.prazosDataFim || sanitized.endDate || sanitized.DataFimContrato || sanitized.datafimcontrato || sanitized.novaDataFimContrato || '';
    const isoStart = toIsoDate(rawStart) || rawStart;
    const isoEnd = toIsoDate(rawEnd) || rawEnd;

    sanitized.startDate = isoStart;
    sanitized.endDate = isoEnd;
    sanitized.prazosNovaDataInicio = isoStart;
    sanitized.prazosNovaDataFim = isoEnd;
    sanitized.prazosDataInicio = isoStart;
    sanitized.prazosDataFim = isoEnd;
    sanitized.Datainiciocontrato = isoStart;
    sanitized.DataFimContrato = isoEnd;

    const formatCurrencyField = (val: any) => {
      if (!val || val === '0,00 €' || val === '0 €') return val || '';
      if (typeof val === 'string' && val.includes('€')) return val;
      const num = parseCurrency(val);
      if (num > 0) {
        return num.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u00A0/g, ' ') + ' €';
      }
      return val;
    };

    sanitized.pareceresValorAcumulado = formatCurrencyField(sanitized.pareceresValorAcumulado);
    sanitized.revisoesValorAcumulado = formatCurrencyField(sanitized.revisoesValorAcumulado);
    sanitized.sancoesValorAcumulado = formatCurrencyField(sanitized.sancoesValorAcumulado);
    sanitized.valorAcumuladoTrabalhosComplementares = formatCurrencyField(sanitized.valorAcumuladoTrabalhosComplementares);
    sanitized.valorAcumuladoTrabalhosMenos = formatCurrencyField(sanitized.valorAcumuladoTrabalhosMenos);
    sanitized.valorAcumuladoModificacoesExcluindo = formatCurrencyField(sanitized.valorAcumuladoModificacoesExcluindo);
    sanitized.valorAcumuladoModificacoesObjetivas = formatCurrencyField(sanitized.valorAcumuladoModificacoesObjetivas);
    sanitized.extincaoValor = formatCurrencyField(sanitized.extincaoValor);

    return sanitized;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const rawStart = formData.startDate || formData.prazosNovaDataInicio || formData.Datainiciocontrato || formData.prazosDataInicio || formData.signatureDate || '';
    const rawEnd = formData.endDate || formData.prazosNovaDataFim || formData.DataFimContrato || formData.prazosDataFim || formData.novaDataFimContrato || '';
    const start = toIsoDate(rawStart) || rawStart;
    const end = toIsoDate(rawEnd) || rawEnd;
    const priceVal = formData.price || formData.contractualPrice || '';

    // Auto-terminar se dias para o final for 0 ou menos
    const daysRemaining = calculateDaysRemaining(end, today);
    let finalPhase = formData.phase;
    if (end && daysRemaining <= 0 && !['Fechado', 'Findo/Arquivado', 'Cancelado'].includes(formData.phase)) {
      finalPhase = 'Findo/Arquivado';
    }

    const codeVal = (formData.code || '').trim() || `CT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    onSave({
      ...formData,
      code: codeVal,
      startDate: start,
      endDate: end,
      prazosNovaDataInicio: start,
      prazosNovaDataFim: end,
      prazosDataInicio: start,
      prazosDataFim: end,
      Datainiciocontrato: start,
      DataFimContrato: end,
      price: priceVal,
      contractualPrice: priceVal,
      phase: finalPhase,
      executedValue: parseCurrency(formData.valorTotalExecutado),
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setToast({ message: 'A enviar arquivo...', type: 'success' });
      
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formDataUpload,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro no upload do servidor');
      }

      const { url, name } = await response.json();

      const newAttachment = {
        id: generateId(),
        name: name,
        url: url,
        type: 'file',
        uploadDate: new Date().toISOString()
      };
      setFormData({ ...formData, attachments: [...(formData.attachments || []), newAttachment] });
      setToast({ message: 'Arquivo enviado com sucesso!', type: 'success' });
    } catch (error: any) {
      console.error('Erro no upload:', error);
      setToast({ message: `Erro no upload: ${error.message}`, type: 'error' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddLink = () => {
    const newAttachment = {
      id: generateId(),
      name: '',
      url: '',
      type: 'link',
      uploadDate: new Date().toISOString()
    };
    setFormData({ ...formData, attachments: [...(formData.attachments || []), newAttachment] });
    setToast({ message: 'Novo campo de link adicionado', type: 'success' });
  };

  // Parser de dados tabulados / colados do Excel
  const parseClipboardMilestones = (text: string) => {
    if (!text || !text.trim()) return [];
    const rawLines = text.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
    
    // Ignorar linha de cabeçalho se copiada
    const firstLineLower = (rawLines[0] || '').toLowerCase();
    let lines = rawLines;
    if (
      firstLineLower.includes('descri') || 
      firstLineLower.includes('marco') || 
      firstLineLower.includes('auto') || 
      (firstLineLower.includes('valor') && firstLineLower.includes('data'))
    ) {
      lines = rawLines.slice(1);
    }

    return lines.map((line) => {
      let cols: string[] = [];
      if (line.includes('\t')) {
        cols = line.split('\t');
      } else if (line.includes(';')) {
        cols = line.split(';');
      } else {
        cols = [line];
      }
      cols = cols.map(c => c.trim().replace(/^["']|["']$/g, ''));

      // Se a primeira coluna for um índice de linha (ex: 1, 2, ... 60) e houver 3 ou mais colunas
      if (cols.length >= 3 && /^\d+$/.test(cols[0]) && Number(cols[0]) <= 500) {
        cols = cols.slice(1);
      }

      let descricao = '';
      let dataFatura = '';
      let numero = '';
      let valorFaturado = '';

      if (cols.length >= 4) {
        descricao = cols[0];
        dataFatura = formatDatePt(cols[1]) || cols[1];
        numero = cols[2];
        const valNum = parseCurrency(cols[3]);
        valorFaturado = valNum > 0 ? formatCurrency(valNum) : (cols[3] || '');
      } else if (cols.length === 3) {
        descricao = cols[0];
        if (/\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}/.test(cols[1])) {
          dataFatura = formatDatePt(cols[1]) || cols[1];
          const valNum = parseCurrency(cols[2]);
          valorFaturado = valNum > 0 ? formatCurrency(valNum) : (cols[2] || '');
        } else {
          numero = cols[1];
          const valNum = parseCurrency(cols[2]);
          valorFaturado = valNum > 0 ? formatCurrency(valNum) : (cols[2] || '');
        }
      } else if (cols.length === 2) {
        descricao = cols[0];
        const valNum = parseCurrency(cols[1]);
        if (valNum > 0 || cols[1].includes('€') || /^\d+([.,]\d+)?$/.test(cols[1])) {
          valorFaturado = valNum > 0 ? formatCurrency(valNum) : cols[1];
        } else {
          dataFatura = formatDatePt(cols[1]) || cols[1];
        }
      } else if (cols.length === 1) {
        const valNum = parseCurrency(cols[0]);
        if (valNum > 0 && /^\d+([.,]\d+)?(\s*€)?$/.test(cols[0])) {
          valorFaturado = formatCurrency(valNum);
        } else {
          descricao = cols[0];
        }
      }

      return { descricao, dataFatura, numero, valorFaturado };
    });
  };

  // Colar diretamente na tabela com Ctrl+V a partir de qualquer célula
  const handleTablePaste = (
    e: React.ClipboardEvent, 
    startIndex: number, 
    fieldName: 'descricao' | 'dataFatura' | 'numero' | 'valorFaturado'
  ) => {
    const pasteText = e.clipboardData.getData('text');
    if (!pasteText) return;

    const hasTabs = pasteText.includes('\t');
    const hasNewlines = pasteText.includes('\n');

    if (!hasTabs && !hasNewlines) {
      // Colagem padrão de texto numa única célula
      return;
    }

    e.preventDefault();

    const lines = pasteText.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
    const currentMilestones = [...(formData.prazosMilestones || [])];

    // Colagem de uma única coluna com múltiplas linhas (ex: coluna de valores ou de datas)
    if (!hasTabs && hasNewlines) {
      lines.forEach((lineText, offset) => {
        const targetIdx = startIndex + offset;
        while (currentMilestones.length <= targetIdx) {
          currentMilestones.push({ descricao: '', dataFatura: '', numero: '', valorFaturado: '' });
        }
        let val = lineText.trim();
        if (fieldName === 'dataFatura') val = formatDatePt(val) || val;
        if (fieldName === 'valorFaturado') {
          const num = parseCurrency(val);
          val = num > 0 ? formatCurrency(num) : val;
        }
        currentMilestones[targetIdx] = {
          ...currentMilestones[targetIdx],
          [fieldName]: val
        };
      });
      setFormData({ ...formData, prazosMilestones: currentMilestones });
      setToast({ message: `${lines.length} valores inseridos na coluna a partir da linha ${startIndex + 1}!`, type: 'success' });
      return;
    }

    // Colagem de tabela completa (múltiplas colunas e linhas)
    const parsedRows = parseClipboardMilestones(pasteText);
    parsedRows.forEach((row, offset) => {
      const targetIdx = startIndex + offset;
      while (currentMilestones.length <= targetIdx) {
        currentMilestones.push({ descricao: '', dataFatura: '', numero: '', valorFaturado: '' });
      }
      currentMilestones[targetIdx] = {
        descricao: row.descricao || currentMilestones[targetIdx].descricao || '',
        dataFatura: row.dataFatura || currentMilestones[targetIdx].dataFatura || '',
        numero: row.numero || currentMilestones[targetIdx].numero || '',
        valorFaturado: row.valorFaturado || currentMilestones[targetIdx].valorFaturado || '',
      };
    });

    setFormData({ ...formData, prazosMilestones: currentMilestones });
    setToast({ message: `${parsedRows.length} linhas coladas do Excel com sucesso a partir da linha ${startIndex + 1}!`, type: 'success' });
  };

  // Navegação rápida estilo Excel com Enter e setas Cima / Baixo
  const handleMilestoneKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>, 
    rowIndex: number, 
    colName: string
  ) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextInput = document.querySelector(`input[data-row="${rowIndex + 1}"][data-col="${colName}"]`) as HTMLInputElement;
      if (nextInput) nextInput.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevInput = document.querySelector(`input[data-row="${rowIndex - 1}"][data-col="${colName}"]`) as HTMLInputElement;
      if (prevInput) prevInput.focus();
    }
  };

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    setToast({ message: 'A gerar relatório PDF completo de todos os separadores...', type: 'success' });

    try {
      const doc = new jsPDF();
      
      // Suporte para caracteres em Português usando a fonte CDN com timeout de 1.5s
      let fontName = "helvetica";
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);

        const blobToBase64 = (blob: Blob): Promise<string> => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.readAsDataURL(blob);
          });
        };
        
        const [robotoReq, robotoBoldReq] = await Promise.all([
          fetch("https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Regular.ttf", { signal: controller.signal }),
          fetch("https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Medium.ttf", { signal: controller.signal })
        ]);
        clearTimeout(timeoutId);
        
        if (robotoReq.ok && robotoBoldReq.ok) {
          const robotoBlob = await robotoReq.blob();
          const robotoBoldBlob = await robotoBoldReq.blob();
          
          const robotoBase64 = await blobToBase64(robotoBlob);
          const robotoBoldBase64 = await blobToBase64(robotoBoldBlob);
          
          doc.addFileToVFS("Roboto-Regular.ttf", robotoBase64);
          doc.addFont("Roboto-Regular.ttf", "Roboto", "normal", "Identity-H");
          
          doc.addFileToVFS("Roboto-Medium.ttf", robotoBoldBase64);
          doc.addFont("Roboto-Medium.ttf", "Roboto", "bold", "Identity-H");
          
          fontName = "Roboto";
          doc.setFont(fontName);
        }
      } catch (e) {
        console.warn("Utilizando fonte standard Helvetica para o PDF.", e);
      }

    // Cabeçalho Principal do Relatório
    doc.setFont(fontName, "bold");
    doc.setFontSize(15);
    doc.setTextColor(15, 30, 62);
    doc.text("RELATÓRIO INDIVIDUAL DE CONTRATO", 14, 16);

    // Data de emissão alinhada à direita na mesma linha do título principal (nunca colide)
    doc.setFont(fontName, "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Emitido em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 196, 16, { align: 'right' });

    // Linha de Referência e Estado
    doc.setFont(fontName, "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    const refAndPhase = `Referência: ${formData.code || 'S/ Ref'}   |   Estado: ${formData.phase || 'N/A'}`;
    doc.text(refAndPhase, 14, 21.5);

    // Cocontratante em linha própria com quebra automática para evitar sobreposição mesmo com nomes longos
    const vendorRaw = `Cocontratante: ${formData.vendor || 'N/A'}`;
    const vendorLines = doc.splitTextToSize(vendorRaw, 182);
    doc.text(vendorLines, 14, 26);

    const vendorExtraHeight = (vendorLines.length - 1) * 3.5;
    const dividerY = 28.5 + vendorExtraHeight;

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.line(14, dividerY, 196, dividerY);

    let yPos = dividerY + 4.5;

    // Helper robusto para criar tabelas estruturadas para cada um dos separadores
    const addTabSection = (
      sectionTitle: string,
      items: Array<{ label: string; value: any }>
    ) => {
      const rows: Array<[string, string]> = [];
      
      items.forEach(item => {
        let rawVal = item.value;
        if (rawVal === null || rawVal === undefined) return;
        let strVal = stripHtml(String(rawVal)).trim();
        strVal = fixPortugueseMojibake(strVal);
        if (strVal === 'undefined' || strVal === 'null' || strVal === 'NaN') return;
        
        if (strVal !== '') {
          rows.push([item.label, strVal]);
        }
      });

      const bodyData: any[] = rows.length > 0
        ? rows
        : [[
            { content: 'Sem registos associados a este separador.', styles: { fontStyle: 'italic', textColor: [140, 150, 165] } },
            { content: '—', styles: { fontStyle: 'italic', textColor: [140, 150, 165], halign: 'center' } }
          ]];

      if (yPos > 260) {
        doc.addPage();
        yPos = 20;
      }

      autoTable(doc, {
        startY: yPos,
        columns: [{ dataKey: 0 }, { dataKey: 1 }],
        head: [[{ content: sectionTitle.toUpperCase(), colSpan: 2 }]],
        body: bodyData,
        theme: 'grid',
        styles: {
          font: fontName,
          fontSize: 8.5,
          cellPadding: 2.2,
          textColor: [30, 41, 59],
          lineColor: [226, 232, 240],
          lineWidth: 0.15,
          valign: 'top',
        },
        headStyles: {
          fillColor: [15, 30, 62],
          textColor: [255, 255, 255],
          font: fontName,
          fontStyle: 'bold',
          fontSize: 9,
          halign: 'left',
          cellPadding: 3,
        },
        columnStyles: {
          0: { cellWidth: 56, fontStyle: 'bold', textColor: [51, 65, 85], fillColor: [248, 250, 252] },
          1: { cellWidth: 'auto', textColor: [15, 23, 42] },
        },
        margin: { left: 14, right: 14 },
        pageBreak: 'auto',
      });

      yPos = (doc as any).lastAutoTable?.finalY && !isNaN((doc as any).lastAutoTable.finalY)
        ? (doc as any).lastAutoTable.finalY + 5 
        : yPos + 22;
    };

    // 1. Procedimento e Contrato
    addTabSection("1. Procedimento e Contrato", [
      { label: "Referência do Contrato", value: formData.code || formData.referencia || formData.ref },
      { label: "Número de Fornecedor", value: formData.vendorNumber || formData.nif || formData.nipc },
      { label: "Código CPV", value: formData.cpv },
      { label: "Descrição CPV", value: formData.cpvDescription },
      { label: "Cocontratante", value: formData.vendor },
      { label: "Objeto do Contrato", value: formData.title || formData.object },
      { label: "Data de Assinatura do Contrato", value: safeFormatDate(formData.signatureDate) },
      { label: "Estado do Contrato", value: formData.phase },
      { label: "Contrato no SharePoint", value: formData.sharepointLink },
      { label: "Edifício", value: formData.building },
      { label: "Tipo de Contrato", value: formData.contractType },
      { label: "Tipo de Procedimento", value: formData.procedureType },
      { label: "Link P & D", value: formData.linkPD || formData.linkPED },
      { label: "Contactos Cocontratante", value: formData.vendorContacts },
      { label: "D.M. Abertura e D.M. Adjudicação", value: formData.dmInfo || formData.openingAuthorization || formData.adjudicationAuthorization },
      { label: "Preço Contratual", value: formData.price || formData.contractualPrice || (formData.globalValue ? formatCurrency(formData.globalValue) : '') },
      { label: "Nota de Encomenda", value: formData.orderNote },
      { label: "Caução", value: formData.caution },
      { label: "Direção com a Gestão Técnica", value: formData.technicalManagementDirection || formData.technicalDirection },
      { label: "Gestor do Contrato", value: formData.manager || formData.technicalManager || formData.interlocutor },
    ]);

    // 2. Pareceres Jurídicos
    addTabSection("2. Pareceres Jurídicos", [
      { label: "Pareceres", value: formData.pareceres || formData.opinionObject || formData.opinionObservations },
      { label: "Valor acumulado pagamentos decorrentes de pareceres jurídicos", value: formData.pareceresValorAcumulado ? (formData.pareceresValorAcumulado.includes('€') ? formData.pareceresValorAcumulado : `${formData.pareceresValorAcumulado} €`) : '' },
    ]);

    // 3. Suspensões do Contrato
    addTabSection("3. Suspensões do Contrato", [
      { label: "Suspensões", value: formData.suspensoes },
      { label: "Nova data fim do contrato", value: safeFormatDate(formData.novaDataFimContrato) },
    ]);

    // 4. Revisão de Preços
    addTabSection("4. Revisão de Preços", [
      { label: "Revisões", value: formData.revisoes || formData.priceRevisionObject || formData.priceRevisionObservations },
      { label: "Valores acumulados revisões de preços", value: formData.revisoesValorAcumulado || (formData.revisionValue ? formatCurrency(formData.revisionValue) : '') },
      { label: "Número de revisões de Preços", value: formData.numeroRevisoesPrecos || formData.revisionNumber },
      { label: "Período / Deliberação", value: [formData.revisionPeriod, formData.boardDeliberationRevision, formData.revisionCommitmentNumber].filter(Boolean).join(' | ') },
    ]);

    // 5. Incumprimento do Contrato e Sanções
    addTabSection("5. Incumprimento do Contrato e Sanções", [
      { label: "Incumprimentos e sanções", value: formData.incumprimentos || formData.breachObject || formData.breachObservations },
      { label: "Valores acumulados de sanções aplicadas", value: formData.sancoesValorAcumulado || (formData.breachValue ? formatCurrency(formData.breachValue) : '') },
      { label: "Deliberação", value: formData.boardDeliberationBreach },
    ]);

    // 6. Modificações Objetivas do Contrato
    addTabSection("6. Modificações Objetivas do Contrato", [
      { label: "Modificações objetivas", value: formData.modificacoesObjetivas || formData.objectiveModificationObject || formData.objectiveModificationObservations || formData.modifications },
      { label: "Valor acumulado trabalhos complementares/a mais", value: formData.valorAcumuladoTrabalhosComplementares },
      { label: "Valor acumulado de trabalhos a menos", value: formData.valorAcumuladoTrabalhosMenos },
      { label: "Valor acumulado modificações excluindo trabalhos a mais ou a menos", value: formData.valorAcumuladoModificacoesExcluindo },
      { label: "Valor acumulado modificações objetivas", value: formData.valorAcumuladoModificacoesObjetivas || (formData.modificationValue ? formatCurrency(formData.modificationValue) : '') },
      { label: "Número de Adendas", value: formData.numeroAdendas || formData.modificationNumber },
      { label: "Deliberação", value: formData.boardDeliberationModifications },
    ]);

    // 7. Modificações Subjetivas do Contrato
    addTabSection("7. Modificações Subjetivas do Contrato", [
      { label: "Cessão da Posição Contratual", value: formData.cessaoPosicaoContratual || formData.subjectiveModificationObject || formData.subjectiveModificationObservations },
      { label: "Subcontratação (quando sujeita a autorização)", value: formData.subcontratacaoSujeitaAutorizacao || formData.subcontractingObject || (formData.hasSubcontracting ? 'Sim' : '') },
      { label: "Subcontratado / Identificação", value: formData.subcontractingIdent },
      { label: "Valor da Subcontratação", value: formData.subcontractingValue ? formatCurrency(formData.subcontractingValue) : '' },
    ]);

    // 8. Extinção do Contrato
    addTabSection("8. Extinção do Contrato", [
      { label: "Causa, data, D.M., sanção, execução, observações", value: formData.extincaoCausa || formData.terminationObject || formData.terminationObservations },
      { label: "Data de Extinção", value: safeFormatDate(formData.terminationDate) },
      { label: "Valor associado", value: formData.extincaoValor || (formData.terminationValue ? formatCurrency(formData.terminationValue) : '') },
      { label: "Deliberação", value: formData.boardDeliberationTermination },
    ]);

    // 9. Avaliação do Fornecedor
    addTabSection("9. Avaliação do Fornecedor", [
      { label: "Avaliação e observações", value: formData.avaliacaoObservacoes },
    ]);

    // 10. Comunicações Importantes
    addTabSection("10. Comunicações Importantes", [
      { label: "Comunicações importantes e observações", value: formData.comunicacoesObservacoes },
    ]);

    // 11. Prazos de Execução do Contrato
    addTabSection("11. Prazos de Execução do Contrato", [
      { label: "Data início contrato", value: safeFormatDate(formData.prazosNovaDataInicio || formData.startDate) },
      { label: "Data fim contrato", value: safeFormatDate(formData.prazosNovaDataFim || formData.endDate || formData.validityDate) },
      { label: "Prazos e Pagamentos Contratados", value: formData.planosPagamentoFaturamentos },
      { label: "Prorrogações de Prazos", value: formData.prorrogacoesPrazos },
      { label: "Valor total de despesas aprovada(contratos, adendas, indemnizações, juros, etc.)", value: formData.valorTotalDespesas },
      { label: "Valor Total Executado", value: formData.valorTotalExecutado },
      { label: "Percentagem Executada", value: formData.percentagem ? (formData.percentagem.toString().includes('%') ? formData.percentagem : `${formData.percentagem}%`) : '' },
      { label: "Data da Ultima Validação", value: safeFormatDate(formData.dataUltimaFaturacao) },
      { label: "Pasta Local / Rede", value: formData.localFolderLink },
    ]);

    // Tabela de Marcos de Execução e Faturação (se existirem)
    const validMilestones = Array.isArray(formData.prazosMilestones)
      ? formData.prazosMilestones.filter((m: any) => 
          (m.descricao && String(m.descricao).trim()) || 
          (m.dataFatura && String(m.dataFatura).trim()) || 
          (m.numero && String(m.numero).trim()) || 
          (m.valorFaturado && String(m.valorFaturado).trim())
        )
      : [];

    if (validMilestones.length > 0) {
      if (yPos > 240) { doc.addPage(); yPos = 20; }

      const milestoneRows = validMilestones.map((m: any, idx: number) => {
        const rawVal = (m.valorFaturado || '').toString().trim();
        let formattedVal = '-';
        if (rawVal) {
          formattedVal = rawVal.includes('€') ? rawVal : `${rawVal} €`;
        }
        return [
          (idx + 1).toString(),
          stripHtml(m.descricao || '-'),
          stripHtml(formatDatePt(m.dataFatura) || '-'),
          stripHtml(m.numero || '-'),
          formattedVal
        ];
      });

      const footData: any[][] = [];
      if (formData.valorTotalExecutado && formData.valorTotalExecutado !== '0,00 €' && formData.valorTotalExecutado !== '0') {
        footData.push([
          '',
          'Total Executado',
          '',
          '',
          formData.valorTotalExecutado.includes('€') ? formData.valorTotalExecutado : `${formData.valorTotalExecutado} €`
        ]);
      }

      autoTable(doc, {
        startY: yPos,
        head: [
          [{ content: 'MARCOS DE EXECUÇÃO E FATURAÇÃO', colSpan: 5, styles: { halign: 'left', fillColor: [30, 58, 95] } }],
          ['#', 'Descrição do Marco', 'Data (Dia/Mês/Ano)', 'NE', 'Valor Validado (€)']
        ],
        body: milestoneRows,
        foot: footData.length > 0 ? footData : undefined,
        theme: 'grid',
        styles: {
          font: fontName,
          fontSize: 8.5,
          cellPadding: 2.5,
          textColor: [30, 41, 59],
          lineColor: [226, 232, 240],
          lineWidth: 0.15,
        },
        headStyles: {
          fillColor: [30, 58, 95],
          textColor: [255, 255, 255],
          font: fontName,
          fontStyle: 'bold',
          halign: 'center',
        },
        footStyles: {
          fillColor: [241, 245, 249],
          textColor: [15, 30, 62],
          font: fontName,
          fontStyle: 'bold',
          halign: 'right',
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 'auto', halign: 'left' },
          2: { cellWidth: 32, halign: 'center' },
          3: { cellWidth: 30, halign: 'center' },
          4: { cellWidth: 38, halign: 'right', fontStyle: 'bold' },
        },
        margin: { left: 14, right: 14 },
      });

      yPos = (doc as any).lastAutoTable?.finalY && !isNaN((doc as any).lastAutoTable.finalY)
        ? (doc as any).lastAutoTable.finalY + 5 
        : yPos + 25;
    }

    // Tabela de Documentos e Anexos (se existirem)
    const validAttachments = Array.isArray(formData.attachments) && formData.attachments.length > 0
      ? formData.attachments.filter((a: any) => a.name && String(a.name).trim())
      : [];

    if (validAttachments.length > 0) {
      if (yPos > 240) { doc.addPage(); yPos = 20; }

      const attachmentRows = validAttachments.map((att: any, idx: number) => [
        (idx + 1).toString(),
        att.name || 'Documento',
        att.type || 'Ficheiro',
        safeFormatDate(att.uploadDate) || '-'
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [
          [{ content: 'DOCUMENTOS E ANEXOS ASSOCIADOS', colSpan: 4, styles: { halign: 'left', fillColor: [30, 58, 95] } }],
          ['#', 'Nome do Ficheiro / Documento', 'Tipo', 'Data de Registo']
        ],
        body: attachmentRows,
        theme: 'grid',
        styles: {
          font: fontName,
          fontSize: 8.5,
          cellPadding: 2.5,
          textColor: [30, 41, 59],
          lineColor: [226, 232, 240],
          lineWidth: 0.15,
        },
        headStyles: {
          fillColor: [30, 58, 95],
          textColor: [255, 255, 255],
          font: fontName,
          fontStyle: 'bold',
          halign: 'center',
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 'auto', halign: 'left' },
          2: { cellWidth: 35, halign: 'center' },
          3: { cellWidth: 35, halign: 'center' },
        },
        margin: { left: 14, right: 14 },
      });

      yPos = (doc as any).lastAutoTable?.finalY && !isNaN((doc as any).lastAutoTable.finalY)
        ? (doc as any).lastAutoTable.finalY + 5 
        : yPos + 25;
    }

    // Numeração de páginas e rodapé em todas as páginas
    const totalPages = (doc.internal as any).getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont(fontName, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(14, 287, 196, 287);

      const footerText = `Contrato: ${formData.code || 'S/ Ref'}${formData.vendor ? `  |  ${formData.vendor}` : ''}`;
      doc.text(
        footerText,
        14,
        292,
        { maxWidth: 145 }
      );
      doc.text(
        `Página ${i} de ${totalPages}`,
        196,
        292,
        { align: 'right' }
      );
    }

    const safeFilename = `Contrato_${(formData.code || "Novo").replace(/[\/\\?%*:|"<>]/g, '_')}.pdf`;
    
    // Descarregar diretamente o ficheiro PDF (apenas uma única caixa de download)
    try {
      doc.save(safeFilename);
    } catch (saveErr) {
      console.warn("Download via doc.save falhou, a usar fallback de link:", saveErr);
      try {
        const pdfBlob = doc.output('blob');
        const blobUrl = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = safeFilename;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          if (document.body.contains(link)) {
            document.body.removeChild(link);
          }
          URL.revokeObjectURL(blobUrl);
        }, 1000);
      } catch (anchorErr) {
        console.warn("Download via link bloqueado:", anchorErr);
      }
    }

    setToast({ message: 'Relatório PDF descarregado com sucesso!', type: 'success' });
  } catch (err: any) {
    console.error("Erro na geração do PDF:", err);
    setToast({ message: `Erro ao gerar PDF: ${err.message || 'Tente novamente.'}`, type: 'error' });
  } finally {
    setIsGeneratingPDF(false);
  }
};

  const tabs = [
    { id: 'proc_contract', label: 'Procedimento e Contrato' },
    { id: 'pareceres', label: 'Pareceres Jurídicos' },
    { id: 'suspensoes', label: 'Suspensões do Contrato' },
    { id: 'precos', label: 'Revisão de Preços' },
    { id: 'sancoes', label: 'Incumprimento do Contrato e Sanções' },
    { id: 'mod_obj', label: 'Modificações Objetivas do Contrato' },
    { id: 'mod_sub', label: 'Modificações Subjetivas do Contrato' },
    { id: 'extincao', label: 'Extinção do Contrato' },
    { id: 'avaliacao', label: 'Avaliação do Fornecedor' },
    { id: 'comunicacoes', label: 'Comunicações Importantes' },
    { id: 'prazos', label: 'Prazos de Execução do Contrato' },
  ] as const;

  useEffect(() => {
    const total = (formData.prazosMilestones || []).reduce((sum: number, milestone: any) => {
      const val = parseCurrency(milestone.valorFaturado);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
    
    const formattedTotal = total.toLocaleString('pt-PT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).replace(/\u00A0/g, ' ') + ' €';

    const despesasVal = parseCurrency(formData.valorTotalDespesas);
    let autoPct = formData.percentagem;
    if (despesasVal > 0) {
      autoPct = ((total / despesasVal) * 100).toLocaleString('pt-PT', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).replace(/\u00A0/g, ' ') + '%';
    } else if (!formData.percentagem || formData.percentagem === 'NaN') {
      autoPct = '0,00%';
    }

    const shouldUpdateTotal = formData.valorTotalExecutado !== formattedTotal;
    const shouldUpdatePct = (despesasVal > 0 && formData.percentagem !== autoPct) || formData.percentagem === 'NaN';

    if (shouldUpdateTotal || shouldUpdatePct) {
      setFormData(prev => ({
        ...prev,
        ...(shouldUpdateTotal ? { valorTotalExecutado: formattedTotal } : {}),
        ...(shouldUpdatePct ? { percentagem: autoPct } : {}),
      }));
    }
  }, [formData.prazosMilestones, formData.valorTotalDespesas, formData.valorTotalExecutado, formData.percentagem, setFormData]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden border border-slate-200 my-6"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
          <div>
            <h2 className="text-2xl font-normal text-slate-900 tracking-tight">
              {initialData ? 'Editar Contrato' : 'Novo Contrato'}
            </h2>
            <p className="text-[13px] font-normal text-slate-400 uppercase tracking-widest mt-0.5">
              {initialData ? `ID: ${initialData.code}` : 'Preencha os dados do novo contrato'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-all active:scale-95 group">
              <X size={20} className="text-slate-400 group-hover:text-slate-600" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-white p-3 gap-2 overflow-x-auto no-scrollbar">
          {tabs.map((tab, idx) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-4 py-2.5 text-[13px] font-bold uppercase tracking-wider transition-all rounded-xl whitespace-nowrap flex items-center gap-2 border cursor-pointer min-h-[44px] shrink-0",
                  isActive 
                    ? "text-white bg-blue-700 border-blue-800 shadow-md ring-2 ring-blue-500/25 scale-[1.01]"  
                    : "text-slate-700 bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 border-slate-200 shadow-2xs hover:shadow-xs"
                )}
              >
                <span className={cn(
                  "w-6 h-6 rounded-lg flex items-center justify-center text-xs font-mono font-bold shrink-0",
                  isActive ? "bg-white/25 text-white shadow-inner" : "bg-slate-100 text-slate-600 border border-slate-200"
                )}>
                  {idx + 1}
                </span>
                <span className="leading-tight">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {activeTab === 'proc_contract' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              
              {/* Row 1: Referência, Fornecedor, CPV */}
              <div className="flex flex-col md:flex-row gap-4 items-start">
                <div className="flex-1 space-y-1 w-full">
                  <div className="flex items-center justify-between">
                    <label className="text-[13px] font-medium text-slate-600 flex items-center">
                      Referência do Contrato <span className="text-red-500 ml-1">*</span>
                    </label>
                    {!formData.code && (
                      <button
                        type="button"
                        onClick={() => {
                          const autoRef = `CT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
                          setFormData(prev => ({ ...prev, code: autoRef }));
                        }}
                        className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer flex items-center gap-1"
                        title="Gerar automaticamente uma referência única de contrato"
                      >
                        ⚡ Gerar Referência
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="ex: CT-2026-001 ou Proc. 123/2026"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-slate-400 text-sm"
                    value={formData.code || ''}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  />
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-[11px] text-slate-400">Número do procedimento aquisitivo</p>
                    {!formData.code && (
                      <span className="text-[11px] text-amber-600 font-medium">
                        Campo obrigatório (clique em ⚡ Gerar Referência se não tiver)
                      </span>
                    )}
                  </div>

                  {/* Alerta/botão inteligente caso o valor de code seja um código CPV */}
                  {/^\d{8}(-\d)?$/.test((formData.code || '').trim()) && (
                    <div className="mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          const cpvVal = (formData.code || '').trim();
                          const autoRef = `CT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
                          setFormData(prev => ({
                            ...prev,
                            cpv: cpvVal,
                            code: autoRef
                          }));
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors cursor-pointer"
                        title="Mover para Código CPV e gerar referência de contrato"
                      >
                        <span>⚠️ <strong>{formData.code}</strong> é um Código CPV. Clique para mover para o campo <strong>Código CPV</strong></span>
                      </button>
                    </div>
                  )}
                </div>
                <div className="w-full md:w-64 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[13px] font-medium text-slate-600">Numero de Fornecedor:</label>
                    {!formData.vendorNumber && (
                      <button
                        type="button"
                        onClick={() => {
                          const combined = `${formData.vendor || ''} ${formData.vendorContacts || ''}`;
                          const match = combined.match(/(?:nif|nipc)[:\s]*([1235689]\d{8})/i) ||
                                        String(formData.vendorContacts || '').match(/\b([1235689]\d{8})\b/);
                          if (match) {
                            setFormData(prev => ({ ...prev, vendorNumber: match[1] }));
                          } else {
                            const gen = `FORN-${Math.floor(10000 + Math.random() * 90000)}`;
                            setFormData(prev => ({ ...prev, vendorNumber: gen }));
                          }
                        }}
                        className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                        title="Extrair NIF dos contactos ou gerar número de fornecedor"
                      >
                        ⚡ Preencher
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="N.º Fornecedor ou NIF"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-slate-400 text-sm"
                    value={formData.vendorNumber || ''}
                    onChange={(e) => setFormData({ ...formData, vendorNumber: e.target.value })}
                  />
                </div>
                <div className="w-full md:w-72 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[13px] font-medium text-slate-600 block">Código CPV:</label>
                    {/^\d{8}(-\d)?$/.test((formData.code || '').trim()) && !formData.cpv && (
                      <button
                        type="button"
                        onClick={() => {
                          const cpvVal = (formData.code || '').trim();
                          const autoRef = `CT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
                          setFormData(prev => ({
                            ...prev,
                            cpv: cpvVal,
                            code: autoRef
                          }));
                        }}
                        className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                      >
                        Mover de Referência
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-slate-400 text-sm"
                    value={formData.cpv || ''}
                    onChange={(e) => setFormData({ ...formData, cpv: e.target.value })}
                    placeholder="ex: 45454100-5"
                  />
                </div>
              </div>

              {/* Row 2: Cocontratante */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[13px] font-medium text-slate-600">Cocontratante</label>
                  {looksLikeContacts(formData.vendor) && (
                    <button
                      type="button"
                      onClick={() => {
                        const val = formData.vendor;
                        setFormData(prev => ({
                          ...prev,
                          vendorContacts: val,
                          vendor: prev.vendor === val ? '' : prev.vendor
                        }));
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors cursor-pointer shadow-2xs"
                      title="Mover para Contactos cocontratante"
                    >
                      <span>⚠️ Isto são contactos. Clique para <strong>Mover para Contactos cocontratante</strong></span>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  className="w-full px-3 py-1.5 bg-[#F2F2F2] border border-slate-300 text-slate-700 outline-none focus:border-slate-400 text-sm"
                  value={formData.vendor || ''}
                  onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                  placeholder="Nome da empresa / cocontratante"
                />
                {looksLikeContacts(formData.vendor) && (
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    O texto acima contém morada/telefone/email. Clique no botão de aviso acima para mover diretamente para <strong>Contactos cocontratante</strong>.
                  </p>
                )}
              </div>

              {/* Row 3: Objeto */}
              <div className="space-y-1 pt-2">
                <label className="text-[13px] font-medium text-slate-600">Objeto do contrato</label>
                <input
                  type="text"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-slate-400 text-sm"
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div className="h-px bg-slate-200 my-4"></div>

              {/* Row 4: Datas, Estado, Sharepoint, Edifício */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="space-y-1">
                  <label className="text-[13px] font-medium text-slate-600 flex items-center">
                    Data de assinatura do contrato <span className="text-red-500 ml-1">*</span>
                  </label>
                  <DateInput
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-slate-400 text-sm"
                    value={formData.signatureDate || ''}
                    onChange={(e: any) => setFormData({ ...formData, signatureDate: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[13px] font-medium text-slate-600">Estado do contrato</label>
                  <select
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-slate-400 text-sm"
                    value={formData.phase || ''}
                    onChange={(e) => setFormData({ ...formData, phase: e.target.value })}
                  >
                    <option value=""></option>
                    <option value="Aguarda Consignação/PSS">Aguarda Consignação/PSS</option>
                    <option value="Em execução">Em execução</option>
                    <option value="Em execução/Aguarda Obra">Em execução/Aguarda Obra</option>
                    <option value="Em Assistência Técnica à Obra">Em Assistência Técnica à Obra</option>
                    <option value="Aguarda Conta Final">Aguarda Conta Final</option>
                    <option value="Aguarda Licença de Utilização">Aguarda Licença de Utilização</option>
                    <option value="Em Garantia">Em Garantia</option>
                    <option value="Concluído">Concluído</option>
                    <option value="Fechado">Fechado</option>
                    <option value="Findo/Arquivado">Findo/Arquivado</option>
                    <option value="Cancelado">Cancelado</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[13px] font-medium text-slate-600">Contrato no SharePoint</label>
                  <div className="flex items-center border border-slate-300 bg-white px-2 py-1.5">
                    <span className="mr-2 text-blue-500">🌍</span>
                    <input
                      type="text"
                      placeholder="Clique aqui para inserir um hiperlink."
                      className="w-full bg-transparent outline-none text-sm text-slate-700"
                      value={formData.sharepointLink || ''}
                      onChange={(e) => setFormData({ ...formData, sharepointLink: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[13px] font-medium text-slate-600">Edifício</label>
                  <input
                    type="text"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-slate-400 text-sm"
                    value={formData.building || ''}
                    onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                  />
                </div>
              </div>

              {/* Row 5: Tipo Contrato, Tipo Procedimento, Link P & D (3 colunas, 1 linha) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <label className="text-[13px] font-medium text-slate-600">Tipo de contrato</label>
                  <select
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-slate-400 text-sm"
                    value={formData.contractType || ''}
                    onChange={(e) => setFormData({ ...formData, contractType: e.target.value })}
                  >
                    <option value=""></option>
                    <option value="Empreitada">Empreitada</option>
                    <option value="Fiscalização e coordenação de segurança em obra">Fiscalização e coordenação de segurança em obra</option>
                    <option value="Estudos e Projetos">Estudos e Projetos</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[13px] font-medium text-slate-600">Tipo de procedimento</label>
                  <select
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-slate-400 text-sm"
                    value={formData.procedureType || ''}
                    onChange={(e) => setFormData({ ...formData, procedureType: e.target.value })}
                  >
                    <option value=""></option>
                    <option value="Ajuste direto simplificado">Ajuste direto simplificado</option>
                    <option value="Ajuste direto">Ajuste direto</option>
                    <option value="Ajuste direto por motivos materiais">Ajuste direto por motivos materiais</option>
                    <option value="Consulta prévia">Consulta prévia</option>
                    <option value="Concurso público sem publicação no JOUE">Concurso público sem publicação no JOUE</option>
                    <option value="Concurso público com publicação no JOUE">Concurso público com publicação no JOUE</option>
                    <option value="Concurso limitado por prévia qualificação">Concurso limitado por prévia qualificação</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[13px] font-medium text-slate-600">Link P & D</label>
                  <div className="flex items-center border border-slate-300 bg-white px-2 py-1.5 focus-within:border-slate-400">
                    <span className="mr-2 text-blue-500 text-sm">🌍</span>
                    <input
                      type="text"
                      placeholder="Clique aqui para inserir um hiperlink."
                      className="w-full bg-transparent outline-none text-sm text-slate-700"
                      value={formData.linkPD || formData.linkPED || ''}
                      onChange={(e) => setFormData({ ...formData, linkPD: e.target.value, linkPED: e.target.value })}
                    />
                    {(formData.linkPD || formData.linkPED) && (
                      <a
                        href={(formData.linkPD || formData.linkPED).startsWith('http') ? (formData.linkPD || formData.linkPED) : `https://${formData.linkPD || formData.linkPED}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-1 text-blue-600 hover:text-blue-800 p-0.5 shrink-0"
                        title="Abrir Link P & D"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div className="h-px bg-slate-200 my-4"></div>

              {/* Row 6: Contactos */}
              <div className="space-y-1 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-[13px] font-medium text-slate-600">Contactos cocontratante:</label>
                  {looksLikeContacts(formData.vendor) && (
                    <button
                      type="button"
                      onClick={() => {
                        const val = formData.vendor;
                        setFormData(prev => ({
                          ...prev,
                          vendorContacts: val,
                          vendor: ''
                        }));
                      }}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer hover:underline"
                    >
                      Mover de Cocontratante
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-slate-400 text-sm"
                  value={formData.vendorContacts || ''}
                  onChange={(e) => setFormData({ ...formData, vendorContacts: e.target.value })}
                  placeholder="Morada, telefone, email, website..."
                />
              </div>

              {/* Row 7: D.M. */}
              <div className="space-y-1 pt-4">
                <label className="text-[13px] font-medium text-slate-600">D.M. abertura e D.M. adjudicação:</label>
                <input
                  type="text"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-slate-400 text-sm"
                  value={formData.dmInfo || ''}
                  onChange={(e) => setFormData({ ...formData, dmInfo: e.target.value })}
                />
              </div>

              <div className="h-px bg-slate-200 my-4"></div>

              {/* Row 8: Preço, Nota Encomenda */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-1">
                  <label className="text-[13px] font-medium text-slate-600">Preço Contratual</label>
                  <input
                    type="text"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-slate-400 text-sm"
                    value={formData.price || ''}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[13px] font-medium text-slate-600">Nota de encomenda</label>
                  <input
                    type="text"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-slate-400 text-sm"
                    value={formData.orderNote || ''}
                    onChange={(e) => setFormData({ ...formData, orderNote: e.target.value })}
                  />
                </div>
              </div>

              {/* Row 9: Caução */}
              <div className="space-y-1 pt-4">
                <label className="text-[13px] font-medium text-slate-600">Caução</label>
                <input
                  type="text"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-slate-400 text-sm"
                  value={formData.caution || ''}
                  onChange={(e) => setFormData({ ...formData, caution: e.target.value })}
                />
                <p className="text-[11px] text-slate-400 mt-0.5">Tipo, referência, valor, observações, etc.</p>
              </div>

              <div className="h-px bg-slate-200 my-4"></div>

              {/* Row 10: Direção, Gestor */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-1">
                  <label className="text-[13px] font-medium text-slate-600">Direção com a gestão técnica</label>
                  <select
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-slate-400 text-sm"
                    value={formData.technicalManagementDirection || ''}
                    onChange={(e) => setFormData({ ...formData, technicalManagementDirection: e.target.value })}
                  >
                    <option value=""></option>
                    <option value="DIPO/UEP">DIPO/UEP</option>
                    <option value="DIPO/UGO">DIPO/UGO</option>
                    <option value="DIPO/UAT">DIPO/UAT</option>
                    <option value="DIMIC">DIMIC</option>
                    <option value="DIBP">DIBP</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[13px] font-medium text-slate-600">Gestor</label>
                  <input
                    type="text"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-slate-400 text-sm"
                    value={formData.manager || ''}
                    onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
                  />
                  <p className="text-[11px] text-slate-400 mt-0.5">Nome e contacto Gestor técnico:</p>
                </div>
              </div>

            </div>
          )}

          {activeTab === 'pareceres' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="space-y-1">
                <label className="text-[13px] font-medium text-slate-600">Pareceres</label>
                <textarea
                  rows={4}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-slate-400 text-sm resize-y"
                  value={formData.pareceres || ''}
                  onChange={(e) => setFormData({ ...formData, pareceres: e.target.value })}
                />
                <p className="text-[11px] text-slate-400 mt-0.5">Objeto dos pareceres, referências SharePoint, D.M.'s, Observações, etc</p>
              </div>

              <div className="space-y-1 pt-2">
                <label className="text-[13px] font-medium text-slate-600">Valor acumulado pagamentos decorrentes de pareceres jurídicos (€)</label>
                <input
                  type="text"
                  placeholder="0,00 €"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-brand text-sm font-semibold"
                  value={formData.pareceresValorAcumulado || ''}
                  onChange={(e) => setFormData({ ...formData, pareceresValorAcumulado: e.target.value })}
                  onBlur={(e) => {
                    const val = parseCurrency(e.target.value);
                    if (e.target.value.trim() && val > 0) {
                      const formatted = val.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u00A0/g, ' ') + ' €';
                      setFormData({ ...formData, pareceresValorAcumulado: formatted });
                    }
                  }}
                />
              </div>
            </div>
          )}

          {activeTab === 'suspensoes' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="space-y-1">
                <label className="text-[13px] font-medium text-slate-600">Suspensões</label>
                <textarea
                  rows={4}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-slate-400 text-sm resize-y"
                  value={formData.suspensoes || ''}
                  onChange={(e) => setFormData({ ...formData, suspensoes: e.target.value })}
                />
                <p className="text-[11px] text-slate-400 mt-0.5">Motivos, duração, D.M., observações, etc..</p>
              </div>

              <div className="space-y-1 pt-2 w-full md:w-64">
                <label className="text-[13px] font-medium text-slate-600">Nova data fim do contrato</label>
                <DateInput
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-slate-400 text-sm"
                  value={formData.novaDataFimContrato || ''}
                  onChange={(e: any) => setFormData({ ...formData, novaDataFimContrato: e.target.value })}
                />
              </div>
            </div>
          )}

          {activeTab === 'precos' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="space-y-1">
                <label className="text-[13px] font-medium text-slate-600">Revisões</label>
                <textarea
                  rows={4}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-slate-400 text-sm resize-y"
                  value={formData.revisoes || ''}
                  onChange={(e) => setFormData({ ...formData, revisoes: e.target.value })}
                />
                <p className="text-[11px] text-slate-400 mt-0.5">Valores, D.M.'s, periodos, C.Compras, NE's, Sharepoint's, observações</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-1">
                  <label className="text-[13px] font-medium text-slate-600">Valores acumulados revisões de preços (€)</label>
                  <input
                    type="text"
                    placeholder="0,00 €"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-brand text-sm font-semibold"
                    value={formData.revisoesValorAcumulado || ''}
                    onChange={(e) => setFormData({ ...formData, revisoesValorAcumulado: e.target.value })}
                    onBlur={(e) => {
                      const val = parseCurrency(e.target.value);
                      if (e.target.value.trim() && val > 0) {
                        const formatted = val.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u00A0/g, ' ') + ' €';
                        setFormData({ ...formData, revisoesValorAcumulado: formatted });
                      }
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[13px] font-medium text-slate-600">Numero de revisões de Preços:</label>
                  <input
                    type="text"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-brand text-sm"
                    value={formData.numeroRevisoesPrecos || ''}
                    onChange={(e) => setFormData({ ...formData, numeroRevisoesPrecos: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sancoes' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="space-y-1">
                <label className="text-[13px] font-medium text-slate-600">Incumprimentos e sanções</label>
                <textarea
                  rows={4}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-slate-400 text-sm resize-y"
                  value={formData.incumprimentos || formData.breachObject || ''}
                  onChange={(e) => setFormData({ ...formData, incumprimentos: e.target.value, breachObject: e.target.value })}
                />
                <p className="text-[11px] text-slate-400 mt-0.5">Motivos, valores, Sharepoints, D.M.'s, observações</p>
              </div>

              <div className="space-y-1 pt-2 w-full md:w-full">
                <label className="text-[13px] font-medium text-slate-600">Valores acumulados de sanções aplicadas (€)</label>
                <input
                  type="text"
                  placeholder="0,00 €"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-brand text-sm font-semibold"
                  value={formData.sancoesValorAcumulado || ''}
                  onChange={(e) => setFormData({ ...formData, sancoesValorAcumulado: e.target.value })}
                  onBlur={(e) => {
                    const val = parseCurrency(e.target.value);
                    if (e.target.value.trim() && val > 0) {
                      const formatted = val.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u00A0/g, ' ') + ' €';
                      setFormData({ ...formData, sancoesValorAcumulado: formatted });
                    }
                  }}
                />
              </div>
            </div>
          )}

          {activeTab === 'mod_obj' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="space-y-1">
                <label className="text-[13px] font-medium text-slate-600">Modificações objetivas</label>
                <textarea
                  rows={4}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-slate-400 text-sm resize-y"
                  value={formData.modificacoesObjetivas || ''}
                  onChange={(e) => setFormData({ ...formData, modificacoesObjetivas: e.target.value })}
                />
                <p className="text-[11px] text-slate-400 mt-0.5">Objetos, D.M.'s, valores, NE's, Sharepoints, observações, etc.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-1">
                  <label className="text-[13px] font-medium text-slate-600">Valor acumulado trabalhos complementares/a mais (€)</label>
                  <input
                    type="text"
                    placeholder="0,00 €"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-brand text-sm font-semibold"
                    value={formData.valorAcumuladoTrabalhosComplementares || ''}
                    onChange={(e) => setFormData({ ...formData, valorAcumuladoTrabalhosComplementares: e.target.value })}
                    onBlur={(e) => {
                      const val = parseCurrency(e.target.value);
                      if (e.target.value.trim() && val > 0) {
                        const formatted = val.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u00A0/g, ' ') + ' €';
                        setFormData({ ...formData, valorAcumuladoTrabalhosComplementares: formatted });
                      }
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[13px] font-medium text-slate-600">Valor acumulado de trabalhos a menos (€)</label>
                  <input
                    type="text"
                    placeholder="0,00 €"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-brand text-sm font-semibold"
                    value={formData.valorAcumuladoTrabalhosMenos || ''}
                    onChange={(e) => setFormData({ ...formData, valorAcumuladoTrabalhosMenos: e.target.value })}
                    onBlur={(e) => {
                      const val = parseCurrency(e.target.value);
                      if (e.target.value.trim() && val > 0) {
                        const formatted = val.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u00A0/g, ' ') + ' €';
                        setFormData({ ...formData, valorAcumuladoTrabalhosMenos: formatted });
                      }
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                <div className="space-y-1">
                  <label className="text-[13px] font-medium text-slate-600">Valor acumulado modificações excluindo trabalhos a mais ou a menos (€)</label>
                  <input
                    type="text"
                    placeholder="0,00 €"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-brand text-sm font-semibold"
                    value={formData.valorAcumuladoModificacoesExcluindo || ''}
                    onChange={(e) => setFormData({ ...formData, valorAcumuladoModificacoesExcluindo: e.target.value })}
                    onBlur={(e) => {
                      const val = parseCurrency(e.target.value);
                      if (e.target.value.trim() && val > 0) {
                        const formatted = val.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u00A0/g, ' ') + ' €';
                        setFormData({ ...formData, valorAcumuladoModificacoesExcluindo: formatted });
                      }
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[13px] font-medium text-slate-600">Valor acumulado modificações objetivas (€)</label>
                  <input
                    type="text"
                    placeholder="0,00 €"
                    className="w-full px-3 py-1.5 bg-[#F2F2F2] border border-slate-300 text-slate-700 outline-none focus:border-brand text-sm font-semibold"
                    value={formData.valorAcumuladoModificacoesObjetivas || ''}
                    onChange={(e) => setFormData({ ...formData, valorAcumuladoModificacoesObjetivas: e.target.value })}
                    onBlur={(e) => {
                      const val = parseCurrency(e.target.value);
                      if (e.target.value.trim() && val > 0) {
                        const formatted = val.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u00A0/g, ' ') + ' €';
                        setFormData({ ...formData, valorAcumuladoModificacoesObjetivas: formatted });
                      }
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[13px] font-medium text-slate-600">Numero de Adendas:</label>
                  <input
                    type="text"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-brand text-sm"
                    value={formData.numeroAdendas || ''}
                    onChange={(e) => setFormData({ ...formData, numeroAdendas: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'mod_sub' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="space-y-1">
                <label className="text-[13px] font-medium text-slate-600">Cessão da Posição Contratual</label>
                <textarea
                  rows={4}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-slate-400 text-sm resize-y"
                  value={formData.cessaoPosicaoContratual || ''}
                  onChange={(e) => setFormData({ ...formData, cessaoPosicaoContratual: e.target.value })}
                />
                <p className="text-[11px] text-slate-400 mt-0.5">Motivo, Sharepoint, D.M., cedente e cessionário, observações</p>
              </div>

              <div className="space-y-1 pt-2">
                <label className="text-[13px] font-medium text-slate-600">Subcontratação (quando sujeita a autorização)</label>
                <textarea
                  rows={4}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-slate-400 text-sm resize-y"
                  value={formData.subcontratacaoSujeitaAutorizacao || ''}
                  onChange={(e) => setFormData({ ...formData, subcontratacaoSujeitaAutorizacao: e.target.value })}
                />
                <p className="text-[11px] text-slate-400 mt-0.5">Subcontratado, SharePoint, D.M., data efeitos, observações</p>
              </div>
            </div>
          )}

          {activeTab === 'extincao' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="space-y-1">
                <label className="text-[13px] font-medium text-slate-600">Causa, data, D.M., sanção, execução, observações:</label>
                <textarea
                  rows={4}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-slate-400 text-sm resize-y"
                  value={formData.extincaoCausa || ''}
                  onChange={(e) => setFormData({ ...formData, extincaoCausa: e.target.value })}
                />
              </div>

              <div className="space-y-1 pt-2 w-full">
                <label className="text-[13px] font-medium text-slate-600">Valor associado (€)</label>
                <input
                  type="text"
                  placeholder="0,00 €"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-brand text-sm font-semibold"
                  value={formData.extincaoValor || ''}
                  onChange={(e) => setFormData({ ...formData, extincaoValor: e.target.value })}
                  onBlur={(e) => {
                    const val = parseCurrency(e.target.value);
                    if (e.target.value.trim() && val > 0) {
                      const formatted = val.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u00A0/g, ' ') + ' €';
                      setFormData({ ...formData, extincaoValor: formatted });
                    }
                  }}
                />
              </div>
            </div>
          )}

          {activeTab === 'avaliacao' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="space-y-1 w-full">
                <label className="text-[13px] font-medium text-slate-600">Avaliação e observações:</label>
                <textarea
                  rows={4}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-slate-400 text-sm resize-y"
                  value={formData.avaliacaoObservacoes || ''}
                  onChange={(e) => setFormData({ ...formData, avaliacaoObservacoes: e.target.value })}
                />
              </div>
            </div>
          )}

          {activeTab === 'comunicacoes' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="space-y-1 w-full">
                <label className="text-[13px] font-medium text-slate-600">Comunicações importantes e observações:</label>
                <textarea
                  rows={4}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-slate-400 text-sm resize-y"
                  value={formData.comunicacoesObservacoes || ''}
                  onChange={(e) => setFormData({ ...formData, comunicacoesObservacoes: e.target.value })}
                />
              </div>
            </div>
          )}

          {activeTab === 'prazos' && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                <div className="space-y-1">
                  <label className="text-[13px] font-medium text-slate-600">Data início contrato:</label>
                  <input
                    type="date"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-slate-400 text-sm"
                    value={formData.prazosNovaDataInicio || formData.startDate || formData.Datainiciocontrato || formData.prazosDataInicio || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({
                        ...formData,
                        prazosNovaDataInicio: val,
                        prazosDataInicio: val,
                        startDate: val,
                        Datainiciocontrato: val
                      });
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[13px] font-medium text-slate-600">Data fim contrato:</label>
                  <input
                    type="date"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-slate-400 text-sm"
                    value={formData.prazosNovaDataFim || formData.endDate || formData.DataFimContrato || formData.prazosDataFim || formData.novaDataFimContrato || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({
                        ...formData,
                        prazosNovaDataFim: val,
                        prazosDataFim: val,
                        endDate: val,
                        DataFimContrato: val,
                        novaDataFimContrato: val
                      });
                    }}
                  />
                  <p className="text-[11px] text-slate-400 mt-0.5">Vai atualizar a Data limite de vigor/prazo de execução do contrato.</p>
                </div>
              </div>

              <div className="space-y-1 w-full pt-4">
                <label className="text-[13px] font-medium text-slate-600">Prazos e Pagamentos Contratados:</label>
                <textarea
                  rows={6}
                  className="w-full px-3 py-1.5 bg-[#F2F2F2] border border-slate-300 text-slate-700 outline-none focus:border-slate-400 text-sm resize-y"
                  value={formData.planosPagamentoFaturamentos || ''}
                  onChange={(e) => setFormData({ ...formData, planosPagamentoFaturamentos: e.target.value })}
                />
              </div>

              <div className="space-y-1 w-full pt-4">
                <label className="text-[13px] font-medium text-slate-600">Prorrogações de Prazos:</label>
                <textarea
                  rows={4}
                  className="w-full px-3 py-1.5 bg-[#F2F2F2] border border-slate-300 text-slate-700 outline-none focus:border-slate-400 text-sm resize-y"
                  value={formData.prorrogacoesPrazos || ''}
                  onChange={(e) => setFormData({ ...formData, prorrogacoesPrazos: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-6 items-end">
                <div className="space-y-1">
                  <label className="text-[13px] font-medium text-slate-600 block">Valor total de despesas aprovada(contratos, adendas, indemnizações, juros, etc.)</label>
                  <input
                    type="text"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-slate-400 text-sm font-semibold"
                    value={formData.valorTotalDespesas || '0,00 €'}
                    onChange={(e) => setFormData({ ...formData, valorTotalDespesas: e.target.value })}
                    onBlur={(e) => {
                      const val = parseCurrency(e.target.value);
                      if (e.target.value.trim() && val > 0) {
                        const formatted = val.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u00A0/g, ' ') + ' €';
                        setFormData({ ...formData, valorTotalDespesas: formatted });
                      }
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[13px] font-medium text-slate-600 block">Valor Total Executado</label>
                  <input
                    type="text"
                    className="w-full px-3 py-1.5 bg-slate-100 border border-slate-300 text-slate-700 outline-none focus:border-slate-400 text-sm font-semibold"
                    value={formData.valorTotalExecutado || '0,00 €'}
                    readOnly
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[13px] font-medium text-slate-600 block">Percentagem</label>
                  <input
                    type="text"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-slate-400 text-sm font-semibold"
                    value={formData.percentagem || '0,00%'}
                    onChange={(e) => setFormData({ ...formData, percentagem: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[13px] font-medium text-slate-600">Data da Ultima Validação</label>
                  <input
                    type="date"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 text-slate-700 outline-none focus:border-slate-400 text-sm"
                    value={formData.dataUltimaFaturacao || ''}
                    onChange={(e) => setFormData({ ...formData, dataUltimaFaturacao: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-3 pt-6">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Tabela de Marcos / Autos de Medição e Faturação
                    </span>
                    <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-full border border-slate-200">
                      {(formData.prazosMilestones || []).length} linhas
                    </span>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs max-h-[620px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-slate-100 z-10 shadow-xs">
                      <tr className="bg-slate-100 text-slate-700 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                        <th className="py-2.5 px-3 w-12 text-center">#</th>
                        <th className="py-2.5 px-3">Descrição</th>
                        <th className="py-2.5 px-3 w-40 text-center">Data (Dia/Mês/Ano)</th>
                        <th className="py-2.5 px-3 w-28">NE</th>
                        <th className="py-2.5 px-3 w-40 text-right">Valor Validado (€)</th>
                        <th className="py-2.5 px-2 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(formData.prazosMilestones || []).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400 text-sm">
                            Nenhum marco de faturação. Clique em "Adicionar linha à tabela" para começar.
                          </td>
                        </tr>
                      ) : (
                        (formData.prazosMilestones || []).map((milestone: any, index: number) => (
                          <tr key={index} className="hover:bg-slate-50/70 transition-colors group">
                            <td className="py-2 px-3 text-center text-xs font-semibold text-slate-400 group-hover:text-slate-700">
                              {index + 1}
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                type="text"
                                data-row={index}
                                data-col="descricao"
                                placeholder={`Descrição do marco / auto ${index + 1}...`}
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-700 outline-none focus:border-brand text-sm"
                                value={milestone.descricao || ''}
                                onPaste={(e) => handleTablePaste(e, index, 'descricao')}
                                onKeyDown={(e) => handleMilestoneKeyDown(e, index, 'descricao')}
                                onChange={(e) => {
                                  const newMilestones = [...(formData.prazosMilestones || [])];
                                  newMilestones[index] = { ...newMilestones[index], descricao: e.target.value };
                                  setFormData({ ...formData, prazosMilestones: newMilestones });
                                }}
                              />
                            </td>
                            <td className="py-1.5 px-2">
                              <div className="relative flex items-center">
                                <input
                                  type="text"
                                  data-row={index}
                                  data-col="dataFatura"
                                  placeholder="DD/MM/AAAA"
                                  className="w-full pl-2.5 pr-7 py-1.5 bg-white border border-slate-300 rounded text-slate-700 outline-none focus:border-brand text-sm text-center font-mono"
                                  value={milestone.dataFatura || ''}
                                  onPaste={(e) => handleTablePaste(e, index, 'dataFatura')}
                                  onKeyDown={(e) => handleMilestoneKeyDown(e, index, 'dataFatura')}
                                  onChange={(e) => {
                                    const newMilestones = [...(formData.prazosMilestones || [])];
                                    newMilestones[index] = { ...newMilestones[index], dataFatura: e.target.value };
                                    setFormData({ ...formData, prazosMilestones: newMilestones });
                                  }}
                                  onBlur={(e) => {
                                    const formatted = formatDatePt(e.target.value);
                                    if (formatted && formatted !== e.target.value) {
                                      const newMilestones = [...(formData.prazosMilestones || [])];
                                      newMilestones[index] = { ...newMilestones[index], dataFatura: formatted };
                                      setFormData({ ...formData, prazosMilestones: newMilestones });
                                    }
                                  }}
                                />
                                <label className="absolute right-1.5 text-slate-400 hover:text-slate-700 cursor-pointer p-0.5" title="Selecionar data (Dia, Mês, Ano)">
                                  <Calendar size={14} />
                                  <input
                                    type="date"
                                    className="sr-only"
                                    value={toIsoDate(milestone.dataFatura) || ''}
                                    onChange={(e) => {
                                      if (e.target.value) {
                                        const formatted = formatDatePt(e.target.value);
                                        const newMilestones = [...(formData.prazosMilestones || [])];
                                        newMilestones[index] = { ...newMilestones[index], dataFatura: formatted };
                                        setFormData({ ...formData, prazosMilestones: newMilestones });
                                      }
                                    }}
                                  />
                                </label>
                              </div>
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                type="text"
                                data-row={index}
                                data-col="numero"
                                placeholder="Ex: 50"
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-700 outline-none focus:border-brand text-sm text-center"
                                value={milestone.numero || ''}
                                onPaste={(e) => handleTablePaste(e, index, 'numero')}
                                onKeyDown={(e) => handleMilestoneKeyDown(e, index, 'numero')}
                                onChange={(e) => {
                                  const newMilestones = [...(formData.prazosMilestones || [])];
                                  newMilestones[index] = { ...newMilestones[index], numero: e.target.value };
                                  setFormData({ ...formData, prazosMilestones: newMilestones });
                                }}
                              />
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                type="text"
                                data-row={index}
                                data-col="valorFaturado"
                                placeholder="0,00 €"
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-700 outline-none focus:border-brand text-sm font-semibold text-right"
                                value={milestone.valorFaturado || ''}
                                onPaste={(e) => handleTablePaste(e, index, 'valorFaturado')}
                                onKeyDown={(e) => handleMilestoneKeyDown(e, index, 'valorFaturado')}
                                onChange={(e) => {
                                  const newMilestones = [...(formData.prazosMilestones || [])];
                                  newMilestones[index] = { ...newMilestones[index], valorFaturado: e.target.value };
                                  setFormData({ ...formData, prazosMilestones: newMilestones });
                                }}
                                onBlur={(e) => {
                                  const val = parseCurrency(e.target.value);
                                  if (e.target.value.trim() && val > 0) {
                                    const formatted = val.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u00A0/g, ' ') + ' €';
                                    const newMilestones = [...(formData.prazosMilestones || [])];
                                    newMilestones[index] = { ...newMilestones[index], valorFaturado: formatted };
                                    setFormData({ ...formData, prazosMilestones: newMilestones });
                                  }
                                }}
                              />
                            </td>
                            <td className="py-1.5 px-2 text-center">
                              <button
                                type="button"
                                title="Limpar ou remover linha"
                                onClick={() => {
                                  const newMilestones = [...(formData.prazosMilestones || [])];
                                  if (newMilestones.length > 60) {
                                    newMilestones.splice(index, 1);
                                  } else {
                                    newMilestones[index] = { descricao: '', dataFatura: '', numero: '', valorFaturado: '' };
                                  }
                                  setFormData({ ...formData, prazosMilestones: newMilestones });
                                }}
                                className="w-7 h-7 inline-flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {(formData.prazosMilestones || []).length > 0 && (
                      <tfoot className="sticky bottom-0 bg-slate-50 z-10 border-t-2 border-slate-300 shadow-xs">
                        <tr className="bg-slate-50 font-semibold text-slate-700 text-xs">
                          <td colSpan={4} className="py-2.5 px-3 text-right">Total Executado:</td>
                          <td className="py-2.5 px-3 text-right text-brand font-bold text-sm">
                            {formData.valorTotalExecutado || '0,00 €'}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const newMilestones = [...(formData.prazosMilestones || [])];
                      newMilestones.push({ descricao: '', dataFatura: '', numero: '', valorFaturado: '' });
                      setFormData({ ...formData, prazosMilestones: newMilestones });
                    }}
                    className="flex-1 py-2 border-2 border-dashed border-slate-300 hover:border-brand text-slate-600 hover:text-brand transition-colors text-sm font-medium rounded-lg flex items-center justify-center gap-2 bg-slate-50/50 hover:bg-white"
                  >
                    <span>+</span> Adicionar linha à tabela
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const newMilestones = [...(formData.prazosMilestones || [])];
                      for (let i = 0; i < 10; i++) {
                        newMilestones.push({ descricao: '', dataFatura: '', numero: '', valorFaturado: '' });
                      }
                      setFormData({ ...formData, prazosMilestones: newMilestones });
                    }}
                    className="px-4 py-2 border border-slate-300 hover:border-slate-400 text-slate-700 hover:bg-slate-50 transition-colors text-sm font-medium rounded-lg"
                  >
                    + 10 Linhas
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 pt-6">
                <label className="text-[13px] font-medium text-slate-600">Anexos</label>
                <div className="mt-1">
                  <label className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded text-sm cursor-pointer hover:bg-slate-50 transition-colors w-fit">
                    <Paperclip size={16} />
                    Clicar aqui para anexar um ficheiro
                    <input
                      type="file"
                      className="hidden"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        const newAttachments = files.map(file => ({
                          name: file.name,
                          url: URL.createObjectURL(file),
                          type: file.type
                        }));
                        setFormData({ 
                          ...formData, 
                          attachments: [...(formData.attachments || []), ...newAttachments] 
                        });
                      }}
                    />
                  </label>
                </div>
                {(formData.attachments || []).length > 0 && (
                  <div className="mt-4 space-y-2">
                    {(formData.attachments || []).map((file: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                            <FileText size={16} />
                          </div>
                          <span className="text-sm font-medium text-slate-700">{file.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const newAttachments = [...(formData.attachments || [])];
                            newAttachments.splice(index, 1);
                            setFormData({ ...formData, attachments: newAttachments });
                          }}
                          className="text-slate-400 hover:text-red-500 transition-colors p-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'tech' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="space-y-1.5">
                <label className="text-[15px] font-normal text-slate-500 uppercase">Objeto</label>
                <div className="quill-wrapper">
                  <ReactQuill
                    theme="snow"
                    value={formData.object}
                    onChange={(content) => setFormData({ ...formData, object: fixPortugueseMojibake(content) })}
                    modules={{
                      toolbar: [
                        ['bold', 'italic', 'underline'],
                        [{'list': 'ordered'}, {'list': 'bullet'}],
                        ['clean']
                      ],
                    }}
                  />
                </div>
              </div>

            </div>
          )}

          {activeTab === 'fin' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Financial Fields - Line 1 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[15px] font-normal text-slate-500 uppercase">Valor do Contrato (€)</label>
                  <div className="relative">
                    <FormattedInput
                      className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-lg focus:ring-2 focus:ring-brand-light focus:border-brand outline-none text-brand-dark font-mono font-normal"
                      value={formData.globalValue}
                      onChange={(val: number) => setFormData({ ...formData, globalValue: val })}
                    />
                    <Euro className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[15px] font-normal text-slate-500 uppercase">Valor dos Autos (€)</label>
                  <div className="relative">
                    <FormattedInput
                      className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-lg focus:ring-2 focus:ring-brand-light focus:border-brand outline-none text-brand-dark font-mono font-normal"
                      value={formData.autosValue}
                      onChange={(val: number) => setFormData({ ...formData, autosValue: val })}
                    />
                    <Euro className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[15px] font-normal text-slate-500 uppercase">Valor para NE Global (€)</label>
                  <div className="relative">
                    <FormattedInput
                      className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-lg focus:ring-2 focus:ring-brand-light focus:border-brand outline-none text-brand-dark font-mono font-normal"
                      value={formData.neGlobalValue}
                      onChange={(val: number) => setFormData({ ...formData, neGlobalValue: val })}
                    />
                    <Euro className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  </div>
                </div>
              </div>
              {/* Financial Fields - Line 4 */}
              <div className="space-y-1.5">
                <label className="text-[15px] font-normal text-slate-500 uppercase">Preço Contratual</label>
                <div className="quill-wrapper">
                  <ReactQuill
                    theme="snow"
                    value={formData.contractualPrice}
                    onChange={(content) => setFormData({ ...formData, contractualPrice: fixPortugueseMojibake(content) })}
                    modules={{
                      toolbar: [
                        ['bold', 'italic', 'underline'],
                        [{'list': 'ordered'}, {'list': 'bullet'}],
                        ['clean']
                      ],
                    }}
                  />
                </div>
              </div>

            </div>
          )}

          {activeTab === 'mgmt' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="space-y-1.5">
                <label className="text-[15px] font-normal text-slate-500 uppercase">Gestor e interlocutor do contrato</label>
                <div className="quill-wrapper">
                  <ReactQuill
                    theme="snow"
                    value={formData.interlocutor}
                    onChange={(content) => setFormData({ ...formData, interlocutor: fixPortugueseMojibake(content) })}
                    modules={{
                      toolbar: [
                        [{ 'header': [1, 2, false] }],
                        ['bold', 'italic', 'underline', 'strike', 'blockquote'],
                        [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
                        ['link', 'clean']
                      ],
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-5 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[15px] font-normal text-slate-500 uppercase">Direção Técnica</label>
                  <select
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-lg focus:ring-2 focus:ring-brand-light focus:border-brand outline-none appearance-none cursor-pointer"
                    value={formData.technicalDirection}
                    onChange={(e) => setFormData({ ...formData, technicalDirection: e.target.value })}
                  >
                    <option value="">Selecione uma direção</option>
                    <option value="DIPO/UEP">DIPO/UEP</option>
                    <option value="DIPO/UGO">DIPO/UGO</option>
                    <option value="DIPO/UAT">DIPO/UAT</option>
                    <option value="DIMIC">DIMIC</option>
                    <option value="DIBP">DIBP</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[15px] font-normal text-slate-500 uppercase">Gestor de contrato cocontratante</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-lg focus:ring-2 focus:ring-brand-light focus:border-brand outline-none"
                    value={formData.cocontratanteManager}
                    onChange={(e) => setFormData({ ...formData, cocontratanteManager: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[15px] font-normal text-slate-500 uppercase">Gestor Jurídico SCML</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-lg focus:ring-2 focus:ring-brand-light focus:border-brand outline-none"
                    value={formData.legalManager}
                    onChange={(e) => setFormData({ ...formData, legalManager: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[15px] font-normal text-slate-500 uppercase">Gestor Técnico SCML</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-lg focus:ring-2 focus:ring-brand-light focus:border-brand outline-none"
                    value={formData.technicalManager}
                    onChange={(e) => setFormData({ ...formData, technicalManager: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'extra' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Pareceres Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-normal text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-2">Pareceres Jurídicos</h3>
                
                <div className="space-y-1.5">
                  <label className="text-[15px] font-normal text-slate-500 uppercase">Referência SharePoint Link</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-lg focus:ring-2 focus:ring-brand-light focus:border-brand outline-none"
                    value={formData.sharepointLink}
                    onChange={(e) => setFormData({ ...formData, sharepointLink: e.target.value })}
                  />
                </div>
              </div>

              {/* Revisão de Preços Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-normal text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-2">Revisão de Preços</h3>

                <div className="space-y-1.5">
                  <label className="text-[15px] font-normal text-slate-500 uppercase">Objeto Revisão de Preços</label>
                  <div className="quill-wrapper">
                    <ReactQuill
                      theme="snow"
                      value={formData.priceRevisionObject}
                      onChange={(content) => setFormData({ ...formData, priceRevisionObject: fixPortugueseMojibake(content) })}
                      modules={{
                        toolbar: [
                          ['bold', 'italic', 'underline'],
                          ['clean']
                        ],
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[15px] font-normal text-slate-500 uppercase">Nº de Revisões</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-lg focus:ring-2 focus:ring-brand-light focus:border-brand outline-none"
                      value={formData.revisionNumber}
                      onChange={(e) => setFormData({ ...formData, revisionNumber: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[15px] font-normal text-slate-500 uppercase">Valor da Revisão (€)</label>
                    <div className="relative">
                      <FormattedInput
                        className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none text-brand-dark font-mono font-normal"
                        value={formData.revisionValue}
                        onChange={(val: number) => setFormData({ ...formData, revisionValue: val })}
                      />
                      <Euro className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[15px] font-normal text-slate-500 uppercase">Período da Revisão</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                      value={formData.revisionPeriod}
                      onChange={(e) => setFormData({ ...formData, revisionPeriod: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[15px] font-normal text-slate-500 uppercase">Deliberação de Mesa Revisão</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                      value={formData.boardDeliberationRevision}
                      onChange={(e) => setFormData({ ...formData, boardDeliberationRevision: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[15px] font-normal text-slate-500 uppercase">N.E. da Revisão</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                      value={formData.revisionCommitmentNumber}
                      onChange={(e) => setFormData({ ...formData, revisionCommitmentNumber: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[15px] font-normal text-slate-500 uppercase">Observações da Revisão de Preços</label>
                  <div className="quill-wrapper">
                    <ReactQuill
                      theme="snow"
                      value={formData.priceRevisionObservations}
                      onChange={(content) => setFormData({ ...formData, priceRevisionObservations: fixPortugueseMojibake(content) })}
                      modules={{
                        toolbar: [
                          ['bold', 'italic', 'underline'],
                          [{'list': 'ordered'}, {'list': 'bullet'}],
                          ['clean']
                        ],
                      }}
                    />
                  </div>
                </div>
              </div>

            </div>
          )}

          {activeTab === 'mod' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              
              {/* Sub-tab Navigation */}
              <div className="flex border border-slate-200 bg-white p-3 rounded-2xl gap-3 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setModTab('objetivas')}
                  className={cn(
                    "px-6 py-3.5 text-sm font-bold uppercase tracking-wider transition-all rounded-xl whitespace-nowrap border cursor-pointer min-h-[54px]",
                    modTab === 'objetivas'
                      ? "text-white bg-blue-700 border-blue-800 shadow-md ring-2 ring-blue-500/20"
                      : "text-slate-700 bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border-slate-200 shadow-xs"
                  )}
                >
                  Modificações Objetivas
                </button>
                <button
                  type="button"
                  onClick={() => setModTab('subjetivas')}
                  className={cn(
                    "px-6 py-3.5 text-sm font-bold uppercase tracking-wider transition-all rounded-xl whitespace-nowrap border cursor-pointer min-h-[54px]",
                    modTab === 'subjetivas'
                      ? "text-white bg-blue-700 border-blue-800 shadow-md ring-2 ring-blue-500/20"
                      : "text-slate-700 bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border-slate-200 shadow-xs"
                  )}
                >
                  Modificações Subjetivas
                </button>
                <button
                  type="button"
                  onClick={() => setModTab('subcontratacao')}
                  className={cn(
                    "px-6 py-3.5 text-sm font-bold uppercase tracking-wider transition-all rounded-xl whitespace-nowrap border cursor-pointer min-h-[54px]",
                    modTab === 'subcontratacao'
                      ? "text-white bg-blue-700 border-blue-800 shadow-md ring-2 ring-blue-500/20"
                      : "text-slate-700 bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border-slate-200 shadow-xs"
                  )}
                >
                  Subcontratação
                </button>
              </div>

              {modTab === 'objetivas' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  {/* Modificações Objetivas */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-normal text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-2">Modificações Objetivas</h3>
                    
                    <div className="space-y-1.5">
                      <label className="text-[15px] font-normal text-slate-500 uppercase">Objeto Modificações Objetivas</label>
                      <div className="quill-wrapper">
                        <ReactQuill
                          theme="snow"
                          value={formData.objectiveModificationObject}
                          onChange={(content) => setFormData({ ...formData, objectiveModificationObject: fixPortugueseMojibake(content) })}
                          modules={{
                            toolbar: [
                              ['bold', 'italic', 'underline'],
                              ['clean']
                            ],
                          }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-1.5">
                        <label className="text-[15px] font-normal text-slate-500 uppercase">Número de Modificações</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                          value={formData.modificationNumber}
                          onChange={(e) => setFormData({ ...formData, modificationNumber: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[15px] font-normal text-slate-500 uppercase">Valor da Modificação (€)</label>
                        <div className="relative">
                          <FormattedInput
                            className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none text-brand-dark font-mono font-normal"
                            value={formData.modificationValue}
                            onChange={(val: number) => setFormData({ ...formData, modificationValue: val })}
                          />
                          <Euro className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[15px] font-normal text-slate-500 uppercase">Deliberação de Mesa</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                          value={formData.boardDeliberationModifications}
                          onChange={(e) => setFormData({ ...formData, boardDeliberationModifications: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[15px] font-normal text-slate-500 uppercase">Observações das Modificações Objetivas</label>
                      <div className="quill-wrapper">
                        <ReactQuill
                          theme="snow"
                          value={formData.objectiveModificationObservations}
                          onChange={(content) => setFormData({ ...formData, objectiveModificationObservations: fixPortugueseMojibake(content) })}
                          modules={{
                            toolbar: [
                              ['bold', 'italic', 'underline'],
                              [{'list': 'ordered'}, {'list': 'bullet'}],
                              ['clean']
                            ],
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {modTab === 'subjetivas' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  {/* Modificações Subjetivas */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-normal text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-2">Modificações Subjetivas</h3>

                    <div className="space-y-1.5">
                      <label className="text-[15px] font-normal text-slate-500 uppercase">Objeto Modificações Subjetivas</label>
                      <div className="quill-wrapper">
                        <ReactQuill
                          theme="snow"
                          value={formData.subjectiveModificationObject}
                          onChange={(content) => setFormData({ ...formData, subjectiveModificationObject: fixPortugueseMojibake(content) })}
                          modules={{
                            toolbar: [
                              ['bold', 'italic', 'underline'],
                              ['clean']
                            ],
                          }}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[15px] font-normal text-slate-500 uppercase">Observações das Modificações Subjetivas</label>
                      <div className="quill-wrapper">
                        <ReactQuill
                          theme="snow"
                          value={formData.subjectiveModificationObservations}
                          onChange={(content) => setFormData({ ...formData, subjectiveModificationObservations: fixPortugueseMojibake(content) })}
                          modules={{
                            toolbar: [
                              ['bold', 'italic', 'underline'],
                              [{'list': 'ordered'}, {'list': 'bullet'}],
                              ['clean']
                            ],
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {modTab === 'subcontratacao' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  {/* Subcontratação */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-normal text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-2">Subcontratação</h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-[15px] font-normal text-slate-500 uppercase">Existiu necessidade de subcontratar? - Sim ou Não</label>
                        <select
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                          value={formData.hasSubcontracting || ''}
                          onChange={(e) => setFormData({ ...formData, hasSubcontracting: e.target.value })}
                        >
                          <option value="">Selecione...</option>
                          <option value="Sim">Sim</option>
                          <option value="Não">Não</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[15px] font-normal text-slate-500 uppercase">Valor contratual por sub-contratados (€)</label>
                        <div className="relative">
                          <FormattedInput
                            className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none text-brand-dark font-mono font-normal"
                            value={formData.subcontractingValue || 0}
                            onChange={(val: number) => setFormData({ ...formData, subcontractingValue: val })}
                          />
                          <Euro className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[15px] font-normal text-slate-500 uppercase">Objeto da subcontratação</label>
                      <div className="quill-wrapper">
                        <ReactQuill
                          theme="snow"
                          value={formData.subcontractingObject || ''}
                          onChange={(content) => setFormData({ ...formData, subcontractingObject: fixPortugueseMojibake(content) })}
                          modules={{
                            toolbar: [
                              ['bold', 'italic', 'underline'],
                              ['clean']
                            ],
                          }}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[15px] font-normal text-slate-500 uppercase">Identificação dos Adjudicatários sub-contratados ou membros do agrupamento Adjudicatário sub-contratados</label>
                      <div className="quill-wrapper">
                        <ReactQuill
                          theme="snow"
                          value={formData.subcontractingIdent || ''}
                          onChange={(content) => setFormData({ ...formData, subcontractingIdent: fixPortugueseMojibake(content) })}
                          modules={{
                            toolbar: [
                              ['bold', 'italic', 'underline'],
                              ['clean']
                            ],
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {activeTab === 'ext' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              
              {/* Incumprimento */}
              <div className="space-y-4">
                <h3 className="text-lg font-normal text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-2">Incumprimento</h3>
                
                <div className="space-y-1.5">
                  <label className="text-[15px] font-normal text-slate-500 uppercase">Incumprimentos e sanções</label>
                  <div className="quill-wrapper">
                    <ReactQuill
                      theme="snow"
                      value={formData.incumprimentos || formData.breachObject || ''}
                      onChange={(content) => {
                        const fixed = fixPortugueseMojibake(content);
                        setFormData({ ...formData, incumprimentos: fixed, breachObject: fixed });
                      }}
                      modules={{
                        toolbar: [
                          ['bold', 'italic', 'underline'],
                          ['clean']
                        ],
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[15px] font-normal text-slate-500 uppercase">Valor do Incumprimento (€)</label>
                    <div className="relative">
                      <FormattedInput
                        className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none text-brand-dark font-mono font-normal"
                        value={formData.breachValue}
                        onChange={(val: number) => setFormData({ ...formData, breachValue: val })}
                      />
                      <Euro className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[15px] font-normal text-slate-500 uppercase">Deliberação de Mesa</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                      value={formData.boardDeliberationBreach}
                      onChange={(e) => setFormData({ ...formData, boardDeliberationBreach: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[15px] font-normal text-slate-500 uppercase">Observações do Incumprimento</label>
                  <div className="quill-wrapper">
                    <ReactQuill
                      theme="snow"
                      value={formData.breachObservations}
                      onChange={(content) => setFormData({ ...formData, breachObservations: fixPortugueseMojibake(content) })}
                      modules={{
                        toolbar: [
                          ['bold', 'italic', 'underline'],
                          [{'list': 'ordered'}, {'list': 'bullet'}],
                          ['clean']
                        ],
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Extinção */}
              <div className="space-y-4">
                <h3 className="text-lg font-normal text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-2">Extinção</h3>

                <div className="space-y-1.5">
                  <label className="text-[15px] font-normal text-slate-500 uppercase">Objeto da Extinção</label>
                  <div className="quill-wrapper">
                    <ReactQuill
                      theme="snow"
                      value={formData.terminationObject}
                      onChange={(content) => setFormData({ ...formData, terminationObject: fixPortugueseMojibake(content) })}
                      modules={{
                        toolbar: [
                          ['bold', 'italic', 'underline'],
                          ['clean']
                        ],
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[15px] font-normal text-slate-500 uppercase">Data da Extinção</label>
                    <DateInput
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                      value={formData.terminationDate}
                      onChange={(e: any) => setFormData({ ...formData, terminationDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[15px] font-normal text-slate-500 uppercase">Valor da Extinção (€)</label>
                    <div className="relative">
                      <FormattedInput
                        className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none text-brand-dark font-mono font-normal"
                        value={formData.terminationValue}
                        onChange={(val: number) => setFormData({ ...formData, terminationValue: val })}
                      />
                      <Euro className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[15px] font-normal text-slate-500 uppercase">Deliberação de Mesa</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                      value={formData.boardDeliberationTermination}
                      onChange={(e) => setFormData({ ...formData, boardDeliberationTermination: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[15px] font-normal text-slate-500 uppercase">Observações da Extinção</label>
                  <div className="quill-wrapper">
                    <ReactQuill
                      theme="snow"
                      value={formData.terminationObservations}
                      onChange={(content) => setFormData({ ...formData, terminationObservations: fixPortugueseMojibake(content) })}
                      modules={{
                        toolbar: [
                          ['bold', 'italic', 'underline'],
                          [{'list': 'ordered'}, {'list': 'bullet'}],
                          ['clean']
                        ],
                      }}
                    />
                  </div>
                </div>
              </div>

            </div>
          )}

          {activeTab === 'attach' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Pasta no Servidor Section */}
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 text-brand-dark">
                  <Folder size={20} />
                  <h3 className="text-lg font-medium uppercase tracking-wider">Pasta no Servidor</h3>
                </div>
                <div className="space-y-2">
                  <label className="text-[13px] font-normal text-slate-500 uppercase tracking-widest">CAMINHO DA PASTA LOCAL</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-lg focus:ring-4 focus:ring-brand/10 focus:border-brand outline-none transition-all"
                        value={formData.localFolderLink || ''}
                        onChange={(e) => setFormData({ ...formData, localFolderLink: e.target.value })}
                        placeholder="\\servidor\caminho\para\pasta"
                      />
                      <Folder className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(formData.localFolderLink || '');
                          setToast({ message: 'Caminho copiado para a área de transferência!', type: 'success' });
                        }}
                        className="px-4 py-3 bg-white border border-slate-200 text-slate-600 hover:text-brand hover:border-brand rounded-xl transition-all shadow-sm font-medium"
                      >
                        Copiar
                      </button>

                    </div>
                  </div>
                  <p className="text-xs text-[#5B6B8A] italic opacity-70">
                    Nota: Caminhos de rede locais podem não abrir diretamente no navegador por questões de segurança.
                  </p>
                </div>
              </div>


            </div>
          )}

          <div className="pt-8 flex justify-between items-center border-t border-slate-100">
            <div>
              {initialData && userRole === 'admin' && (
                <button
                  type="button"
                  onClick={() => {
                    onDelete(initialData.id);
                    onClose();
                  }}
                  className="px-6 py-2.5 text-lg font-normal text-red-600 hover:bg-red-50 rounded-2xl transition-all flex items-center gap-2 active:scale-95"
                >
                  <Trash2 size={18} />
                  Eliminar Contrato
                </button>
              )}
            </div>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={isGeneratingPDF}
                className="px-6 py-2.5 text-lg font-normal text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 rounded-2xl transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
                title="Exportar dados do contrato para PDF"
              >
                {isGeneratingPDF ? (
                  <>
                    <Clock className="animate-spin text-slate-500" size={18} />
                    A gerar PDF...
                  </>
                ) : (
                  <>
                    <FileText size={18} />
                    Exportar PDF
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 text-lg font-normal text-slate-500 hover:bg-slate-100 rounded-2xl transition-all active:scale-95"
              >
                Cancelar
              </button>
              <div className="relative">
                <button
                  type="submit"
                  disabled={isSaving || isQuotaExceeded}
                  className="px-10 py-2.5 bg-brand hover:bg-brand-dark disabled:bg-brand/70 text-slate-900 text-lg font-normal rounded-2xl transition-all shadow-lg shadow-brand/20 active:scale-95 flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <Clock className="animate-spin" size={18} />
                      A guardar...
                    </>
                  ) : isQuotaExceeded ? (
                    <>
                      <AlertCircle size={18} />
                      Quota Excedida
                    </>
                  ) : (
                    <>
                      <Check size={18} />
                      Salvar Contrato
                    </>
                  )}
                </button>
                {isQuotaExceeded && (
                  <div 
                    className="absolute inset-0 cursor-not-allowed" 
                    onClick={() => setToast({ message: 'Limite de quota do Firebase atingido. Por favor, aguarde o reset da quota.', type: 'error' })}
                  />
                )}
              </div>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
