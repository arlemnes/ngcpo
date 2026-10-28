import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Server, 
  RefreshCw, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  FolderOpen, 
  Monitor, 
  X, 
  ArrowRight,
  ShieldCheck,
  HardDrive,
  Upload,
  Database,
  Link2,
  Copy,
  Check,
  Terminal,
  ExternalLink
} from 'lucide-react';
import { 
  ExcelDatabaseConfig, 
  getExcelConfig, 
  saveExcelConfig, 
  isFileSystemAccessSupported, 
  isRunningInIframe,
  savePersistedHandle, 
  clearPersistedHandle,
  readContractsFromHandle,
  writeContractsToHandle,
  generateExcelBuffer
} from '../lib/excelDatabase';
import { 
  fetchServerStatus, 
  fetchServerContracts, 
  uploadExcelToServer, 
  updateServerExcelPath, 
  ServerExcelStatus 
} from '../lib/serverExcelApi';
import { Contract } from '../types';

interface ExcelDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  contracts: Contract[];
  onSyncContractsFromExcel: (loadedContracts: Contract[]) => void;
  activeFileHandle: any | null;
  setActiveFileHandle: (handle: any | null) => void;
  isExcelMode: boolean;
  setIsExcelMode: (active: boolean) => void;
  onInstallWindows?: () => void;
  isInstallable?: boolean;
  initialTab?: 'excel' | 'desktop';
  setToast?: (toast: { message: string; type: 'success' | 'error' }) => void;
}

export const ExcelDatabaseModal: React.FC<ExcelDatabaseModalProps> = ({
  isOpen,
  onClose,
  contracts,
  onSyncContractsFromExcel,
  activeFileHandle,
  setActiveFileHandle,
  isExcelMode,
  setIsExcelMode,
  onInstallWindows,
  isInstallable,
  initialTab = 'excel',
  setToast,
}) => {
  const [config, setConfig] = useState<ExcelDatabaseConfig>(getExcelConfig());
  const [serverStatus, setServerStatus] = useState<ServerExcelStatus | null>(null);
  const [serverCustomPath, setServerCustomPath] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [fileActionError, setFileActionError] = useState<string | null>(null);
  const [fileActionSuccess, setFileActionSuccess] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'excel' | 'desktop'>(initialTab);
  const [customShortcutUrl, setCustomShortcutUrl] = useState<string>(() => {
    const current = typeof window !== 'undefined' ? window.location.origin : '';
    if (current.includes('ais-dev-')) {
      return current.replace('ais-dev-', 'ais-pre-');
    }
    return current || 'https://ais-pre-mu5vm6zvknh6tz224iwmns-28704400424.europe-west2.run.app';
  });
  const [copiedLink, setCopiedLink] = useState(false);

  const fileUploadInputRef = React.useRef<HTMLInputElement>(null);
  const fallbackFileInputRef = React.useRef<HTMLInputElement>(null);
  const isFsSupported = isFileSystemAccessSupported();
  const isInIframe = isRunningInIframe();

  useEffect(() => {
    setConfig(getExcelConfig());
    if (initialTab) {
      setActiveTab(initialTab);
    }
    // Fetch live status of the server Excel file
    fetchServerStatus().then(st => {
      if (st) {
        setServerStatus(st);
        setServerCustomPath(st.filePath || '');
      }
    });
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  // Refresh server status and contracts
  const handleSyncWithDataServer = async () => {
    setIsProcessing(true);
    setStatusMessage(null);
    try {
      const res = await fetchServerContracts();
      if (res && Array.isArray(res.contracts)) {
        onSyncContractsFromExcel(res.contracts);
        const st = await fetchServerStatus();
        if (st) setServerStatus(st);
        setStatusMessage({
          text: `Sincronização concluída com sucesso! ${res.contracts.length} contratos atualizados a partir do servidor de dados Excel.`,
          type: 'success',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        text: `Erro ao sincronizar com o servidor: ${err.message}`,
        type: 'error',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Upload an Excel file to replace/update server database
  const handleUploadExcelToServer = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setStatusMessage(null);
    try {
      const result = await uploadExcelToServer(file);
      if (result.success && result.contracts) {
        onSyncContractsFromExcel(result.contracts);
        const st = await fetchServerStatus();
        if (st) setServerStatus(st);
        setStatusMessage({
          text: `Ficheiro "${file.name}" carregado e guardado no servidor com sucesso! (${result.count} contratos).`,
          type: 'success',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        text: `Erro ao enviar ficheiro para o servidor: ${err.message}`,
        type: 'error',
      });
    } finally {
      setIsProcessing(false);
      if (fileUploadInputRef.current) {
        fileUploadInputRef.current.value = '';
      }
    }
  };

  // Update server Excel file path configuration
  const handleUpdateServerPath = async () => {
    if (!serverCustomPath.trim()) return;
    setIsProcessing(true);
    setStatusMessage(null);
    try {
      const result = await updateServerExcelPath(serverCustomPath.trim());
      if (result.success) {
        const st = await fetchServerStatus();
        if (st) setServerStatus(st);
        const loaded = await fetchServerContracts();
        if (loaded.contracts) onSyncContractsFromExcel(loaded.contracts);
        setStatusMessage({
          text: `Caminho do ficheiro Excel no servidor atualizado para: ${result.filePath} (${result.totalContracts} contratos)`,
          type: 'success',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        text: `Erro ao atualizar caminho no servidor: ${err.message}`,
        type: 'error',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Download direct server Excel file
  const handleDownloadServerExcel = () => {
    window.location.href = '/api/excel/download';
    setStatusMessage({
      text: 'A transferir a cópia atual do ficheiro Excel do servidor...',
      type: 'info',
    });
  };

  // Direct fallback upload for local file (works in all browsers, inside and outside iframes)
  const handleDirectFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setFileActionError(null);
    setFileActionSuccess(null);
    setStatusMessage(null);
    try {
      const result = await uploadExcelToServer(file);
      if (result.success && result.contracts) {
        onSyncContractsFromExcel(result.contracts);
        const st = await fetchServerStatus();
        if (st) setServerStatus(st);
        const msg = `Ficheiro "${file.name}" sincronizado com sucesso! ${result.count} contratos atualizados na aplicação e servidor.`;
        setFileActionSuccess(msg);
        setStatusMessage({ text: msg, type: 'success' });
        if (setToast) setToast({ message: msg, type: 'success' });
      }
    } catch (err: any) {
      const errMsg = `Erro ao carregar ficheiro: ${err.message || 'Falha no ficheiro'}`;
      setFileActionError(errMsg);
      setStatusMessage({ text: errMsg, type: 'error' });
      if (setToast) setToast({ message: errMsg, type: 'error' });
    } finally {
      setIsProcessing(false);
      if (e.target) e.target.value = '';
    }
  };

  // Select local Excel file via File System Access API
  const handleSelectNetworkExcel = async () => {
    setFileActionError(null);
    setFileActionSuccess(null);
    setStatusMessage(null);
    setIsProcessing(true);

    if (isInIframe) {
      setIsProcessing(false);
      const msg = 'O navegador bloqueia o acesso direto a ficheiros quando a aplicação está na pré-visualização (iframe). Abra a aplicação numa nova aba ou carregue o ficheiro abaixo!';
      setFileActionError('iframe_blocked');
      setStatusMessage({ text: msg, type: 'error' });
      if (setToast) setToast({ message: msg, type: 'error' });
      return;
    }

    try {
      if (!isFsSupported || !(window as any).showOpenFilePicker) {
        throw new Error('A API nativa de acesso a ficheiros não está ativa neste navegador.');
      }

      const [handle] = await (window as any).showOpenFilePicker({
        types: [
          {
            description: 'Folha de Cálculo Excel (*.xlsx, *.xls)',
            accept: {
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
              'application/vnd.ms-excel': ['.xls'],
            },
          },
        ],
        multiple: false,
      });

      if (!handle) {
        setIsProcessing(false);
        return;
      }

      const loadedContracts = await readContractsFromHandle(handle);
      await savePersistedHandle(handle);
      setActiveFileHandle(handle);
      setIsExcelMode(true);

      const newConfig: ExcelDatabaseConfig = {
        ...config,
        fileName: handle.name,
        lastSyncTime: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };
      setConfig(newConfig);
      saveExcelConfig(newConfig);

      if (loadedContracts.length > 0) {
        onSyncContractsFromExcel(loadedContracts);
        const msg = `Ligado com sucesso a "${handle.name}". Carregados ${loadedContracts.length} contratos!`;
        setFileActionSuccess(msg);
        setStatusMessage({
          text: msg,
          type: 'success',
        });
        if (setToast) setToast({ message: msg, type: 'success' });
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setIsProcessing(false);
        return;
      }
      console.warn('Erro ao ligar ao ficheiro Excel:', err);
      let errMsg = err.message || 'Operação cancelada';
      if (err.name === 'SecurityError' || String(err).includes('Cross origin iframes')) {
        setFileActionError('iframe_blocked');
        errMsg = 'O navegador bloqueou a abertura do ficheiro porque a aplicação está em modo de pré-visualização (iframe). Abra a aplicação numa nova aba!';
      } else {
        setFileActionError(errMsg);
      }
      setStatusMessage({
        text: `Erro ao ligar ao ficheiro: ${errMsg}`,
        type: 'error',
      });
      if (setToast) setToast({ message: errMsg, type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Download Windows Desktop Shortcut (.url file)
  const handleDownloadWindowsShortcut = () => {
    let targetUrl = customShortcutUrl.trim();
    if (targetUrl.includes('ais-dev-')) {
      targetUrl = targetUrl.replace('ais-dev-', 'ais-pre-');
    }
    if (!targetUrl) {
      targetUrl = 'https://ais-pre-mu5vm6zvknh6tz224iwmns-28704400424.europe-west2.run.app';
    }
    const shortcutContent = `[InternetShortcut]\r\nURL=${targetUrl}\r\nIconIndex=0\r\n`;
    const blob = new Blob([shortcutContent], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'REC- NGCPO.url';
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage({
      text: `Atalho "REC- NGCPO.url" descarregado com o URL partilhado: ${targetUrl}`,
      type: 'success',
    });
  };

  // Download HTML Launcher (Bulletproof for network folders Y:\, prevents .download suffix and GPO blocks)
  const handleDownloadHtmlLauncher = () => {
    let targetUrl = customShortcutUrl.trim();
    if (targetUrl.includes('ais-dev-')) {
      targetUrl = targetUrl.replace('ais-dev-', 'ais-pre-');
    }
    if (!targetUrl) {
      targetUrl = 'https://ais-pre-mu5vm6zvknh6tz224iwmns-28704400424.europe-west2.run.app';
    }
    const htmlContent = `<!DOCTYPE html>
<html lang="pt">
<head>
    <meta charset="UTF-8">
    <title>REC - Gestor de Contratos</title>
    <meta http-equiv="refresh" content="0;url=${targetUrl}">
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; background: #f1f5f9; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; color: #1e293b; }
        .card { background: white; padding: 40px; border-radius: 24px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); text-align: center; max-width: 480px; width: 100%; }
        h2 { margin-top: 0; color: #0f172a; font-size: 20px; }
        p { color: #64748b; font-size: 14px; line-height: 1.5; }
        .btn { display: inline-block; margin-top: 20px; background: #0f172a; color: white; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 14px; transition: background 0.2s; }
        .btn:hover { background: #1e293b; }
    </style>
</head>
<body>
    <div class="card">
        <h2>A aceder ao REC - Gestor de Contratos...</h2>
        <p>A abrir a aplicação. Se o navegador não redirecionar automaticamente, clique no botão abaixo.</p>
        <a href="${targetUrl}" class="btn">Abrir Aplicação Agora</a>
    </div>
</body>
</html>`;
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'REC - Gestor de Contratos.html';
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage({
      text: `Lançador HTML "REC - Gestor de Contratos.html" descarregado com sucesso para o URL de equipa: ${targetUrl}`,
      type: 'success',
    });
  };

  // Download Windows Batch Launcher (.bat)
  const handleDownloadBatLauncher = () => {
    let targetUrl = customShortcutUrl.trim();
    if (targetUrl.includes('ais-dev-')) {
      targetUrl = targetUrl.replace('ais-dev-', 'ais-pre-');
    }
    if (!targetUrl) {
      targetUrl = 'https://ais-pre-mu5vm6zvknh6tz224iwmns-28704400424.europe-west2.run.app';
    }
    const batContent = `@echo off\r\nchcp 65001 >nul\r\ntitle REC - Gestor de Contratos\r\necho A abrir a aplicacao no seu navegador...\r\nstart "" "${targetUrl}"\r\ntimeout /t 2 >nul\r\nexit\r\n`;
    const blob = new Blob([batContent], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ABRIR_APLICACAO.bat';
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage({
      text: `Ficheiro "ABRIR_APLICACAO.bat" descarregado com sucesso!`,
      type: 'success',
    });
  };

  // Download Complete Local System (.zip)
  const handleDownloadSistemaZip = () => {
    window.location.href = '/api/download-sistema-zip';
    setStatusMessage({
      text: 'A transferir o pacote completo do sistema (sistema_contratos_scml_local.zip)...',
      type: 'info',
    });
  };

  // Download INICIAR_SISTEMA.bat
  const handleDownloadIniciarBat = () => {
    window.location.href = '/api/download-iniciar-bat';
    setStatusMessage({
      text: 'A transferir o ficheiro INICIAR_SISTEMA.bat...',
      type: 'info',
    });
  };

  // Copy direct link to clipboard
  const handleCopyLink = () => {
    let targetUrl = customShortcutUrl.trim();
    if (targetUrl.includes('ais-dev-')) {
      targetUrl = targetUrl.replace('ais-dev-', 'ais-pre-');
    }
    if (!targetUrl) {
      targetUrl = 'https://ais-pre-mu5vm6zvknh6tz224iwmns-28704400424.europe-west2.run.app';
    }
    navigator.clipboard.writeText(targetUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
    setStatusMessage({
      text: `Link direto copiado para a área de transferência: ${targetUrl}`,
      type: 'success',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">
                Servidor de Dados Excel (Sem Firebase)
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Base de Dados partilhada em folha de cálculo Excel no servidor
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-6 pt-3 bg-slate-50/40 gap-2">
          <button
            onClick={() => setActiveTab('excel')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all cursor-pointer border-b-2 ${
              activeTab === 'excel'
                ? 'bg-white text-emerald-700 border-emerald-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-700 border-transparent hover:bg-white/50'
            }`}
          >
            <Database size={15} />
            Base de Dados Excel no Servidor
          </button>
          <button
            onClick={() => setActiveTab('desktop')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all cursor-pointer border-b-2 ${
              activeTab === 'desktop'
                ? 'bg-white text-blue-700 border-blue-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-700 border-transparent hover:bg-white/50'
            }`}
          >
            <Monitor size={15} />
            Desktop Windows & Atalho
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {statusMessage && (
            <div
              className={`p-4 rounded-2xl text-xs font-medium flex items-start gap-3 border ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  : statusMessage.type === 'error'
                  ? 'bg-red-50 text-red-900 border-red-200'
                  : 'bg-blue-50 text-blue-900 border-blue-200'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">{statusMessage.text}</div>
            </div>
          )}

          {activeTab === 'excel' && (
            <div className="space-y-6">
              {/* Server Excel Active Banner */}
              <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-900 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 font-bold text-sm text-emerald-950">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
                    Base de Dados Excel Ativa no Servidor
                  </div>
                  <span className="px-2.5 py-0.5 bg-emerald-200 text-emerald-900 rounded-full text-[11px] font-bold uppercase tracking-wider">
                    Sem Firebase
                  </span>
                </div>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  A aplicação está ligada ao ficheiro de dados do servidor (<strong>data/contratos_database.xlsx</strong>). Se efetuou alterações ou tem novos contratos no Excel da sua pasta partilhada de rede (ex: <strong>Drive Y:\</strong> com 374 registos), clique no botão <strong>Carregar / Substituir Excel</strong> abaixo para atualizar a aplicação, ou use <strong>Vincular Diretamente ao Excel da Pasta</strong>.
                </p>

                {serverStatus && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
                    <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Contratos</span>
                      <span className="text-base font-bold text-emerald-950">{serverStatus.totalContracts}</span>
                    </div>
                    <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Ativos</span>
                      <span className="text-base font-bold text-emerald-950">{serverStatus.activeContracts}</span>
                    </div>
                    <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Reciclagem</span>
                      <span className="text-base font-bold text-slate-600">{serverStatus.deletedContracts}</span>
                    </div>
                    <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Tamanho Ficheiro</span>
                      <span className="text-base font-bold text-emerald-950">
                        {serverStatus.sizeBytes ? `${(serverStatus.sizeBytes / 1024).toFixed(1)} KB` : 'Ativo'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 1. Sync button */}
                <button
                  onClick={handleSyncWithDataServer}
                  disabled={isProcessing}
                  className="p-4 rounded-2xl border border-slate-200 bg-white hover:bg-emerald-50/50 hover:border-emerald-300 transition-all text-left group shadow-xs cursor-pointer flex flex-col justify-between gap-3"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                    <RefreshCw size={18} className={isProcessing ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-300"} />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-800">Sincronizar Agora</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Recarrega alterações do ficheiro Excel do servidor.</p>
                  </div>
                </button>

                {/* 2. Download server Excel */}
                <button
                  onClick={handleDownloadServerExcel}
                  className="p-4 rounded-2xl border border-slate-200 bg-white hover:bg-blue-50/50 hover:border-blue-300 transition-all text-left group shadow-xs cursor-pointer flex flex-col justify-between gap-3"
                >
                  <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center">
                    <Download size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-800">Descarregar Excel do Servidor</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Obtém uma cópia do ficheiro .xlsx completo.</p>
                  </div>
                </button>

                {/* 3. Upload new Excel */}
                <label className="p-4 rounded-2xl border border-slate-200 bg-white hover:bg-purple-50/50 hover:border-purple-300 transition-all text-left group shadow-xs cursor-pointer flex flex-col justify-between gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center">
                    <Upload size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-800">Carregar / Substituir Excel</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Substitui o ficheiro de dados do servidor.</p>
                  </div>
                  <input
                    ref={fileUploadInputRef}
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleUploadExcelToServer}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Path Config on Server */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center gap-2">
                  <HardDrive size={16} className="text-slate-600" />
                  <h3 className="text-xs font-bold text-slate-800">
                    Caminho do Ficheiro Excel no Servidor de Dados
                  </h3>
                </div>
                <p className="text-xs text-slate-500">
                  Pode definir um caminho local ou uma pasta partilhada de rede do Windows (ex.: <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">\\servidor\partilha\contratos.xlsx</code> ou <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">data/contratos_database.xlsx</code>).
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={serverCustomPath}
                    onChange={(e) => setServerCustomPath(e.target.value)}
                    placeholder="data/contratos_database.xlsx ou \\servidor\partilha\contratos.xlsx"
                    className="flex-1 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                  />
                  <button
                    onClick={handleUpdateServerPath}
                    disabled={isProcessing}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    Guardar Caminho
                  </button>
                </div>
              </div>

              {/* Client-side File System Access API para Drive Y: e Pastas de Rede */}
              <div className="p-5 rounded-2xl border-2 border-emerald-500/40 bg-emerald-50/60 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <FolderOpen size={18} className="text-emerald-700" />
                      <h4 className="text-sm font-bold text-emerald-950">
                        {activeFileHandle ? `Ficheiro Vinculado: ${activeFileHandle.name}` : "Vincular Diretamente ao Excel da Pasta (Drive Y:)"}
                      </h4>
                      {activeFileHandle ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                          Ligado & Ativo
                        </span>
                      ) : isInIframe ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold">
                          Modo Pré-visualização (Iframe)
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-emerald-800 leading-relaxed">
                      {activeFileHandle
                        ? "O navegador está diretamente ligado a este ficheiro Excel. Qualquer alteração feita na aplicação grava imediatamente na sua pasta de rede. (Nota: Se o ficheiro estiver aberto no Microsoft Excel, feche-o para que as alterações possam ser gravadas)."
                        : "Ligue a aplicação ao seu ficheiro contratos_database.xlsx na pasta partilhada (ex: Y:\\...\\data\\contratos_database.xlsx) para gravar e sincronizar automaticamente cada contrato."}
                    </p>
                  </div>

                  {/* Ações */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {/* Botão Vincular com FileSystemPicker */}
                    <button
                      type="button"
                      onClick={handleSelectNetworkExcel}
                      disabled={isProcessing}
                      className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <HardDrive size={15} />
                      <span>{activeFileHandle ? 'Trocar Ficheiro' : 'Selecionar contratos_database.xlsx'}</span>
                    </button>

                    {/* Botão Carregar Ficheiro (Alternativa imediata e compatível com iframes) */}
                    <input
                      ref={fallbackFileInputRef}
                      type="file"
                      accept=".xlsx, .xls"
                      onChange={handleDirectFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fallbackFileInputRef.current?.click()}
                      disabled={isProcessing}
                      className="px-3.5 py-2.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-95 flex items-center justify-center gap-1.5"
                      title="Carregar e sincronizar o ficheiro Excel do seu computador diretamente para a aplicação"
                    >
                      <Upload size={14} className="text-emerald-700" />
                      <span>Carregar Ficheiro</span>
                    </button>
                  </div>
                </div>

                {/* Se estiver em Iframe ou se deu erro de Iframe */}
                {(isInIframe || fileActionError === 'iframe_blocked') && (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-semibold">
                          Por que nada acontece ao clicar na pré-visualização?
                        </p>
                        <p className="text-amber-800 text-[11px] leading-relaxed">
                          Por regras de segurança dos navegadores (Google Chrome e Microsoft Edge), o acesso direto a ficheiros do computador <strong>é bloqueado quando a aplicação está dentro de uma janela de pré-visualização (iframe)</strong>.
                        </p>
                        <p className="text-amber-800 text-[11px] leading-relaxed">
                          Para vincular diretamente ao ficheiro da sua pasta/Drive Y:, clique em <strong>"Abrir em Nova Aba"</strong> (fora da janela de pré-visualização). Ou clique no botão <strong>"Carregar Ficheiro"</strong> ao lado para carregar os seus contratos agora mesmo!
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1 pl-6">
                      <a
                        href={customShortcutUrl || window.location.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                      >
                        <ExternalLink size={13} />
                        <span>Abrir Aplicação em Nova Aba</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => fallbackFileInputRef.current?.click()}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                      >
                        <Upload size={13} />
                        <span>Carregar Ficheiro Agora</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Mensagens de Sucesso / Erro inline */}
                {fileActionSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
                    <span>{fileActionSuccess}</span>
                  </div>
                )}

                {fileActionError && fileActionError !== 'iframe_blocked' && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2">
                    <AlertCircle size={16} className="text-rose-600 shrink-0" />
                    <span>{fileActionError}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'desktop' && (
            <div className="space-y-5">
              {/* Option 1: Correr na Vossa Rede / Computador (100% Sem Cloud) */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-50 border-2 border-blue-400 text-slate-900 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Server size={22} />
                    </div>
                    <div>
                      <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider">
                        Opção 1: 100% Sem Cloud
                      </span>
                      <h4 className="text-sm font-bold text-slate-950 mt-0.5">Executar Localmente no Computador ou Servidor da Rede</h4>
                      <p className="text-xs text-slate-600">
                        A aplicação corre no vosso Windows e acede diretamente ao ficheiro Excel na pasta partilhada (Drive Y:\)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleDownloadSistemaZip}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm cursor-pointer active:scale-95"
                    >
                      <Download size={15} />
                      <span>Descarregar Sistema (.zip)</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadIniciarBat}
                      className="px-3.5 py-2.5 bg-white border border-blue-300 text-blue-900 hover:bg-blue-100 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <Download size={14} />
                      <span>INICIAR_SISTEMA.bat</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-blue-200 text-xs">
                  <div className="bg-white/80 p-3 rounded-xl border border-blue-200/60">
                    <span className="font-bold text-blue-900 block mb-1">1. Extrair para uma Pasta</span>
                    <span className="text-slate-600 text-[11px] leading-relaxed">
                      Descarregue o ficheiro .zip e extraia para o seu computador (ex: C:\GestorContratos) ou para a pasta partilhada.
                    </span>
                  </div>
                  <div className="bg-white/80 p-3 rounded-xl border border-blue-200/60">
                    <span className="font-bold text-blue-900 block mb-1">2. Clicar no INICIAR_SISTEMA.bat</span>
                    <span className="text-slate-600 text-[11px] leading-relaxed">
                      Dê duplo clique no <code className="bg-blue-100 px-1 py-0.5 rounded font-mono text-blue-900">INICIAR_SISTEMA.bat</code>. O sistema arranca e abre automaticamente o browser.
                    </span>
                  </div>
                  <div className="bg-white/80 p-3 rounded-xl border border-blue-200/60">
                    <span className="font-bold text-blue-900 block mb-1">3. Ligar ao Excel da Drive Y:\</span>
                    <span className="text-slate-600 text-[11px] leading-relaxed">
                      No modal "Excel Servidor", defina o caminho exato do Excel (ex: <code className="bg-blue-100 px-1 py-0.5 rounded font-mono text-blue-900">Y:\...contratos_database.xlsx</code>).
                    </span>
                  </div>
                </div>
              </div>

              {/* Direct Link Banner */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <Link2 size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-emerald-950">Link Direto da Aplicação (Partilhado)</h4>
                      <p className="text-xs text-emerald-700">Qualquer utilizador com este link e a chave de acesso pode entrar</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                    >
                      {copiedLink ? <Check size={14} className="text-emerald-200" /> : <Copy size={14} />}
                      <span>{copiedLink ? 'Link Copiado!' : 'Copiar Link'}</span>
                    </button>
                    <a
                      href={customShortcutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold transition-all inline-flex items-center gap-1"
                    >
                      <ExternalLink size={13} />
                      <span>Abrir</span>
                    </a>
                  </div>
                </div>

                <div className="bg-white/90 p-2.5 rounded-xl border border-emerald-200 font-mono text-xs text-emerald-900 break-all select-all flex items-center justify-between gap-2">
                  <span>{customShortcutUrl}</span>
                </div>
                
                <div className="text-[11px] text-emerald-800 font-medium">
                  🔑 <strong>Credenciais de Acesso:</strong> Utilizador: <code className="bg-white px-1.5 py-0.5 rounded border border-emerald-200 font-bold">gestor@scml.pt</code> | Chave da Pasta: <code className="bg-white px-1.5 py-0.5 rounded border border-emerald-200 font-bold">scml2026</code>
                </div>
              </div>

              {/* Launcher Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Option 1: Desktop Shortcut (.url) */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all space-y-3 flex flex-col justify-between shadow-xs">
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 uppercase tracking-wider inline-block">
                      Recomendado p/ Windows
                    </span>
                    <h4 className="text-sm font-bold text-slate-800">Atalho .url</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Atalho tradicional do Windows. Coloque na pasta partilhada <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">Y:\...</code> ou no Ambiente de Trabalho.
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadWindowsShortcut}
                    className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Download size={14} />
                    Descarregar .url
                  </button>
                </div>

                {/* Option 2: HTML Launcher for Network Folders */}
                <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/30 space-y-3 flex flex-col justify-between shadow-xs">
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 uppercase tracking-wider inline-block">
                      Compatível c/ Rede
                    </span>
                    <h4 className="text-sm font-bold text-slate-800">Lançador .html</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Ficheiro HTML que abre direto no navegador sem avisos do Windows sobre segurança de rede.
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadHtmlLauncher}
                    className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Download size={14} />
                    Descarregar .html
                  </button>
                </div>

                {/* Option 3: Windows Batch Script (.bat) */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all space-y-3 flex flex-col justify-between shadow-xs">
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 uppercase tracking-wider inline-block">
                      Script Windows
                    </span>
                    <h4 className="text-sm font-bold text-slate-800">Ficheiro .bat</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Script executável para Windows que abre o navegador predefinido com 2 cliques.
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadBatLauncher}
                    className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Download size={14} />
                    Descarregar .bat
                  </button>
                </div>

                {/* Option 4: Windows PWA App */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all space-y-3 flex flex-col justify-between shadow-xs">
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 uppercase tracking-wider inline-block">
                      Aplicação Local
                    </span>
                    <h4 className="text-sm font-bold text-slate-800">Instalar App</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Instala o Gestor de Contratos no Windows com ícone próprio na barra de tarefas.
                    </p>
                  </div>
                  {onInstallWindows && isInstallable ? (
                    <button
                      onClick={onInstallWindows}
                      className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <Monitor size={14} />
                      Instalar App
                    </button>
                  ) : (
                    <div className="p-2.5 bg-slate-50 rounded-xl text-[11px] text-slate-600 border border-slate-200 text-center font-medium">
                      Disponível no menu do navegador (ícone instalar).
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-600" />
            <span>Motor de Dados: Folha de Cálculo Excel no Servidor (100% Sem Firebase)</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-all cursor-pointer active:scale-95"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
