import React from 'react';
import { formatCurrency } from '../lib/utils';

export const DashboardStats = ({ stats }: { stats: any }) => {
  const cards = [
    { title: 'TOTAL DE CONTRATOS', value: stats.totalContracts, icon: '📋' },
    { title: 'VALOR TOTAL DE DESPESAS APROVADAS', value: formatCurrency(stats.totalApprovedExpenses || stats.totalContractualPrice || stats.totalValue, true), icon: '📈' },
    { title: 'VALOR TOTAL EXECUTADO', value: formatCurrency(stats.totalExecuted || stats.totalValue, true), icon: '€' },
    { 
      title: '% DIFERENÇA (DESPESAS / EXECUTADO)', 
      value: `${(stats.differencePercentage ?? 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`, 
      icon: '%' 
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-4 px-6 py-6">
      {cards.map((card, i) => (
        <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-slate-400 text-xs font-bold mb-1">{card.title}</div>
          <div className="text-2xl font-bold text-slate-800">{card.value}</div>
        </div>
      ))}
    </div>
  );
};
