import { Contract } from '../types';

export interface ServerExcelStatus {
  connected: boolean;
  mode: string;
  filePath: string;
  exists: boolean;
  sizeBytes: number;
  lastModified: string | null;
  totalContracts: number;
  activeContracts: number;
  deletedContracts: number;
  serverTime: string;
}

export async function fetchServerStatus(): Promise<ServerExcelStatus | null> {
  try {
    const res = await fetch('/api/server-excel/status');
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('Erro ao verificar estado do servidor Excel:', err);
    return null;
  }
}

export async function fetchServerContracts(): Promise<{ success: boolean; contracts: Contract[]; total: number; filePath?: string }> {
  try {
    const res = await fetch('/api/contracts');
    if (!res.ok) {
      throw new Error(`Erro do servidor (${res.status})`);
    }
    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error('Falha ao carregar contratos do servidor Excel:', err);
    throw err;
  }
}

export async function saveServerContract(contract: Contract): Promise<Contract> {
  try {
    const res = await fetch('/api/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contract }),
    });
    if (!res.ok) {
      throw new Error(`Erro ao gravar contrato (${res.status})`);
    }
    const data = await res.json();
    return data.contract;
  } catch (err: any) {
    console.error('Falha ao gravar contrato no servidor Excel:', err);
    throw err;
  }
}

export async function saveServerContractsBatch(contracts: Contract[], mode: 'replace' | 'merge' = 'replace'): Promise<{ count: number }> {
  try {
    const res = await fetch('/api/contracts/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contracts, mode }),
    });
    if (!res.ok) {
      throw new Error(`Erro ao guardar lote no servidor (${res.status})`);
    }
    const data = await res.json();
    return { count: data.count };
  } catch (err: any) {
    console.error('Falha ao guardar lote de contratos no servidor Excel:', err);
    throw err;
  }
}

export async function deleteServerContract(id: string, permanent: boolean = false, code?: string): Promise<void> {
  try {
    const params = new URLSearchParams();
    if (permanent) params.set('permanent', 'true');
    if (code) params.set('code', code);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`/api/contracts/${encodeURIComponent(id)}${qs}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Erro ao eliminar contrato no servidor (${res.status})`);
    }
  } catch (err: any) {
    console.error('Falha ao eliminar contrato no servidor Excel:', err);
    throw err;
  }
}

export async function uploadExcelToServer(file: File): Promise<{ success: boolean; count: number; contracts: Contract[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1];
        const res = await fetch('/api/excel/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileBase64: base64, fileName: file.name }),
        });
        if (!res.ok) {
          throw new Error(`Erro ao carregar ficheiro para o servidor (${res.status})`);
        }
        const data = await res.json();
        resolve(data);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler ficheiro local'));
    reader.readAsDataURL(file);
  });
}

export async function updateServerExcelPath(excelFilePath: string): Promise<{ success: boolean; filePath: string; totalContracts: number }> {
  const res = await fetch('/api/server-excel/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ excelFilePath }),
  });
  if (!res.ok) {
    throw new Error(`Erro ao configurar caminho do ficheiro (${res.status})`);
  }
  return await res.json();
}
