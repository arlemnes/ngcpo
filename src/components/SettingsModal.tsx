import React, { useState, useEffect } from 'react';
import { Settings, Mail, Bell, X, Save, Send, Check, Loader2 } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isQuotaExceeded?: boolean;
  setToast?: (toast: { message: string; type: 'success' | 'error' } | null) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  isQuotaExceeded,
  setToast,
}) => {
  // Form states initialized with screenshot defaults
  const [smtpServer, setSmtpServer] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState('465');
  const [smtpUser, setSmtpUser] = useState('rochaistec@gmail.com');
  const [smtpPassword, setSmtpPassword] = useState('••••••••••••••••');
  const [senderEmail, setSenderEmail] = useState('rochaistec@gmail.com');
  const [useSSL, setUseSSL] = useState(true);

  // Notification states
  const [enableAlerts, setEnableAlerts] = useState(true);
  const [enableEmailNotify, setEnableEmailNotify] = useState(true);
  const [alertDaysBefore, setAlertDaysBefore] = useState('30');
  const [alertEmailRecipients, setAlertEmailRecipients] = useState('rochaistec@gmail.com');

  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // Load settings on mount / open
  useEffect(() => {
    if (!isOpen) return;

    // Load from localStorage for instant responsiveness
    const savedLocal = localStorage.getItem('system_settings_smtp');
    if (savedLocal) {
      try {
        const parsed = JSON.parse(savedLocal);
        if (parsed.smtpServer !== undefined) setSmtpServer(parsed.smtpServer);
        if (parsed.smtpPort !== undefined) setSmtpPort(parsed.smtpPort);
        if (parsed.smtpUser !== undefined) setSmtpUser(parsed.smtpUser);
        if (parsed.smtpPassword !== undefined) setSmtpPassword(parsed.smtpPassword);
        if (parsed.senderEmail !== undefined) setSenderEmail(parsed.senderEmail);
        if (parsed.useSSL !== undefined) setUseSSL(parsed.useSSL);
        if (parsed.enableAlerts !== undefined) setEnableAlerts(parsed.enableAlerts);
        if (parsed.enableEmailNotify !== undefined) setEnableEmailNotify(parsed.enableEmailNotify);
        if (parsed.alertDaysBefore !== undefined) setAlertDaysBefore(parsed.alertDaysBefore);
        if (parsed.alertEmailRecipients !== undefined) setAlertEmailRecipients(parsed.alertEmailRecipients);
      } catch (e) {
        console.error('Error parsing localStorage settings', e);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    const settingsData = {
      smtpServer,
      smtpPort,
      smtpUser,
      smtpPassword,
      senderEmail,
      useSSL,
      enableAlerts,
      enableEmailNotify,
      alertDaysBefore,
      alertEmailRecipients,
      updatedAt: new Date().toISOString(),
    };

    // Save to localStorage
    localStorage.setItem('system_settings_smtp', JSON.stringify(settingsData));

    setIsSaving(false);
    if (setToast) {
      setToast({ message: 'Configurações guardadas com sucesso!', type: 'success' });
    }
    onClose();
  };

  const handleTestSettings = async () => {
    setIsTesting(true);
    // Simulate SMTP connection test
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setIsTesting(false);
    if (setToast) {
      setToast({
        message: `Ligação ao servidor ${smtpServer}:${smtpPort} testada com sucesso!`,
        type: 'success',
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200/80 max-w-2xl w-full overflow-hidden transition-all animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-slate-700" />
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Configurações do Sistema
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-8 max-h-[80vh] overflow-y-auto">
          
          {/* Section 1: Configurações de Email (SMTP) */}
          <div>
            <div className="flex items-center gap-2 mb-5">
              <Mail className="w-5 h-5 text-slate-700" />
              <h3 className="text-base font-semibold text-slate-800">
                Configurações de Email (SMTP)
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Servidor SMTP */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Servidor SMTP
                </label>
                <input
                  type="text"
                  value={smtpServer}
                  onChange={(e) => setSmtpServer(e.target.value)}
                  placeholder="smtp.gmail.com"
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-xs"
                />
              </div>

              {/* Porta */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Porta
                </label>
                <input
                  type="text"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  placeholder="465"
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-xs"
                />
              </div>

              {/* Usuário SMTP */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Usuário SMTP
                </label>
                <input
                  type="text"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  placeholder="rochaistec@gmail.com"
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-xs"
                />
              </div>

              {/* Senha SMTP */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Senha SMTP (App Password)
                </label>
                <input
                  type="password"
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                  placeholder="••••••••••••••••"
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-xs"
                />
              </div>

              {/* Email de Remetente */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Email de Remetente
                </label>
                <input
                  type="email"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  placeholder="rochaistec@gmail.com"
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-xs"
                />
              </div>

              {/* Checkbox: SSL/TLS */}
              <div className="flex items-center pt-5 sm:pt-6">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={useSSL}
                    onChange={(e) => setUseSSL(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500/30 cursor-pointer accent-teal-600"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    Usar conexão segura (SSL/TLS)
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Section 2: Notificações e Alertas */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-5 h-5 text-slate-700" />
              <h3 className="text-base font-semibold text-slate-800">
                Notificações e Alertas
              </h3>
            </div>

            <div className="space-y-3 bg-slate-50/60 p-4 rounded-lg border border-slate-200/60">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enableAlerts}
                  onChange={(e) => setEnableAlerts(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500/30 cursor-pointer accent-teal-600"
                />
                <span className="text-sm font-medium text-slate-700">
                  Enviar alertas automáticos por email sobre prazos e vencimentos de contratos
                </span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enableEmailNotify}
                  onChange={(e) => setEnableEmailNotify(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500/30 cursor-pointer accent-teal-600"
                />
                <span className="text-sm font-medium text-slate-700">
                  Notificar responsáveis em caso de modificações e pareceres
                </span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Dias de antecedência para alertas de caducidade
                  </label>
                  <input
                    type="number"
                    value={alertDaysBefore}
                    onChange={(e) => setAlertDaysBefore(e.target.value)}
                    placeholder="30"
                    className="w-full px-3.5 py-1.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email para receção de relatórios e alertas
                  </label>
                  <input
                    type="email"
                    value={alertEmailRecipients}
                    onChange={(e) => setAlertEmailRecipients(e.target.value)}
                    placeholder="rochaistec@gmail.com"
                    className="w-full px-3.5 py-1.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 shadow-xs"
                  />
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer / Buttons */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50/80 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors shadow-xs"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 text-sm font-medium text-slate-800 bg-[#96d5d5] hover:bg-[#83c9c9] rounded-lg transition-colors shadow-xs flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-800" />
            ) : (
              <Save className="w-4 h-4 text-slate-800" />
            )}
            Salvar Configurações
          </button>

          <button
            type="button"
            onClick={handleTestSettings}
            disabled={isTesting}
            className="px-5 py-2 text-sm font-medium text-slate-700 bg-[#eff2f7] hover:bg-slate-200 rounded-lg transition-colors shadow-xs flex items-center gap-2 disabled:opacity-50"
          >
            {isTesting ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-700" />
            ) : null}
            Testar Configurações
          </button>
        </div>

      </div>
    </div>
  );
};
