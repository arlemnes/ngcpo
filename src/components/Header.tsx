import React from 'react';
import { Plus, Download, Upload, Settings, LogOut, Folder, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';

interface HeaderProps {
  onNewContract: () => void;
  onImport: () => void;
  onSettings: () => void;
  onLogout: () => void;
  viewMode: 'active' | 'recycle-bin';
  setViewMode: (mode: 'active' | 'recycle-bin') => void;
  user: any;
}

export const Header = ({ onNewContract, onImport, onSettings, onLogout, viewMode, setViewMode, user }: HeaderProps) => (
  <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
    <div className="flex items-center gap-4">
      <div className="p-2 bg-blue-100 rounded-lg text-blue-700">
        <Folder size={24} />
      </div>
      <div>
        <h1 className="text-xl font-bold text-slate-900">REC- NGCPO</h1>
        <p className="text-sm text-slate-500">SISTEMA DE GESTÃO E CONTROLO</p>
      </div>
      <div className="flex ml-6 bg-slate-100 p-1 rounded-lg">
        <button 
          onClick={() => setViewMode('active')}
          className={cn("px-4 py-1.5 text-sm font-medium rounded-md", viewMode === 'active' ? "bg-white shadow-sm" : "text-slate-600")}
        >
          Ativos
        </button>
        <button 
          onClick={() => setViewMode('recycle-bin')}
          className={cn("px-4 py-1.5 text-sm font-medium rounded-md flex items-center gap-2", viewMode === 'recycle-bin' ? "bg-white shadow-sm" : "text-slate-600")}
        >
          <RefreshCw size={14} /> Reciclagem
        </button>
      </div>
    </div>
    
    <div className="flex items-center gap-3">
      <button onClick={onNewContract} className="flex items-center gap-2 px-4 py-2 bg-cyan-200 text-slate-800 rounded-lg hover:bg-cyan-300">
        <Plus size={18} /> Novo Contrato
      </button>
      <div className="h-6 w-px bg-slate-200 mx-2" />
      <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"><Download size={20} /></button>
      <button onClick={onImport} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"><Upload size={20} /></button>
      <button onClick={onSettings} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"><Settings size={20} /></button>
      <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
        <div className="flex flex-col items-end">
          <span className="text-xs text-slate-400">UTILIZADOR</span>
          <span className="text-sm font-medium text-slate-700">{user?.username || 'Utilizador'}</span>
        </div>
        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">
          {user?.username?.[0]?.toUpperCase() || 'U'}
        </div>
        <button onClick={onLogout} className="text-slate-400 hover:text-red-600"><LogOut size={18} /></button>
      </div>
    </div>
  </header>
);
