import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

export function stripHtml(html: string) {
  const tmp = document.createElement("DIV");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

export function fixPortugueseMojibake(text: string) {
  return text; // Basic implementation
}

export function parseCurrency(value: number | string | undefined | null): number {
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  if (!value) return 0;
  let str = String(value).trim();
  // Remover símbolos de moeda, espaços regulares e espaços não separáveis (\u00A0)
  str = str.replace(/[€$£\s\u00A0]/g, '');
  if (!str) return 0;

  // Tratar separadores decimais e de milhares
  if (str.includes(',') && str.includes('.')) {
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    if (lastComma > lastDot) {
      // Formato europeu / português (ex: "1.234,56")
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato anglo-saxónico (ex: "1,234.56")
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    // Formato com vírgula decimal (ex: "23994,85")
    str = str.replace(',', '.');
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

export function formatCurrency(value: number | string | undefined | null, compact = false): string {
  if (value === undefined || value === null || value === '') return '0,00 €';
  const num = typeof value === 'number' ? value : parseCurrency(value);
  if (isNaN(num)) return '0,00 €';
  if (compact && num >= 1000000) {
    return `${(num / 1000000).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u00A0/g, ' ')}M €`;
  }
  return num.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u00A0/g, ' ') + ' €';
}

export function looksLikeContacts(text: string | null | undefined): boolean {
  if (!text) return false;
  const lower = String(text).toLowerCase();
  return (
    lower.includes('morada:') ||
    lower.includes('email:') ||
    lower.includes('telf') ||
    lower.includes('tel:') ||
    lower.includes('fax:') ||
    lower.includes('site:') ||
    lower.includes('http://') ||
    lower.includes('https://') ||
    (lower.includes('rua ') && lower.includes('@'))
  );
}

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', fev: '02', mar: '03', apr: '04', abr: '04',
  may: '05', mai: '05', jun: '06', jul: '07', aug: '08', ago: '08',
  sep: '09', set: '09', oct: '10', out: '10', nov: '11', dec: '12', dez: '12'
};

export function formatDatePt(val: any): string {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const day = String(val.getDate()).padStart(2, '0');
    const month = String(val.getMonth() + 1).padStart(2, '0');
    const year = val.getFullYear();
    return `${day}/${month}/${year}`;
  }

  let str = String(val).trim();
  if (!str) return '';

  // 1. String padrão do Date.toString(): ex: "Wed May 01 2019 00:00:00..."
  const jsDateMatch = str.match(/^[A-Za-z]{3}\s+([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})/);
  if (jsDateMatch) {
    const monthKey = jsDateMatch[1].toLowerCase();
    const month = MONTH_MAP[monthKey] || '01';
    const day = jsDateMatch[2].padStart(2, '0');
    const year = jsDateMatch[3];
    return `${day}/${month}/${year}`;
  }

  // 2. Formato DD/MM/AAAA, DD-MM-AAAA ou DD.MM.AAAA (ou 8 dígitos seguidos DDMMAAAA)
  const digitsOnlyMatch = str.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (digitsOnlyMatch) {
    const day = digitsOnlyMatch[1];
    const month = digitsOnlyMatch[2];
    const year = digitsOnlyMatch[3];
    if (Number(day) >= 1 && Number(day) <= 31 && Number(month) >= 1 && Number(month) <= 12) {
      return `${day}/${month}/${year}`;
    }
  }

  const ptMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (ptMatch) {
    const day = ptMatch[1].padStart(2, '0');
    const month = ptMatch[2].padStart(2, '0');
    const year = ptMatch[3];
    return `${day}/${month}/${year}`;
  }

  // 3. Formato ISO AAAA-MM-DD
  const isoMatch = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, '0');
    const day = isoMatch[3].padStart(2, '0');
    return `${day}/${month}/${year}`;
  }

  // 4. Número de série do Excel (ex: 43586)
  if (!isNaN(Number(str)) && Number(str) > 20000 && Number(str) < 70000) {
    const d = new Date(Math.round((Number(str) - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) {
      const day = String(d.getUTCDate()).padStart(2, '0');
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const year = d.getUTCFullYear();
      return `${day}/${month}/${year}`;
    }
  }

  // 5. Tentativa geral caso contenha timestamp ou fuso horário
  if (str.includes('GMT') || str.includes('T') || str.includes(':')) {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      const day = String(parsed.getDate()).padStart(2, '0');
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const year = parsed.getFullYear();
      return `${day}/${month}/${year}`;
    }
  }

  return str;
}

export function toIsoDate(val: any): string {
  if (val === null || val === undefined || val === '') return '';
  
  if (val instanceof Date && !isNaN(val.getTime())) {
    const year = val.getFullYear();
    const month = String(val.getMonth() + 1).padStart(2, '0');
    const day = String(val.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  if (typeof val === 'number') {
    if (val <= 0) return '';
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  let str = String(val).trim();
  if (!str) return '';

  // Se já for AAAA-MM-DD exatamente
  if (str.match(/^\d{4}-\d{2}-\d{2}$/)) return str;

  // Extrair apenas a parte da data caso haja hora/timestamp
  const dateOnlyPart = str.split(/[T\s]/)[0];

  // DD/MM/AAAA ou DD-MM-AAAA ou DD.MM.AAAA
  const ptMatch = dateOnlyPart.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (ptMatch) {
    const day = ptMatch[1].padStart(2, '0');
    const month = ptMatch[2].padStart(2, '0');
    let year = ptMatch[3];
    if (year.length === 2) {
      year = parseInt(year, 10) > 50 ? `19${year}` : `20${year}`;
    }
    return `${year}-${month}-${day}`;
  }

  // AAAA-MM-DD
  const isoMatch = dateOnlyPart.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, '0');
    const day = isoMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Se for string numérica de número de série do Excel (ex: "45273")
  if (/^\d{4,6}$/.test(str)) {
    const num = parseInt(str, 10);
    const date = new Date(Math.round((num - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  const jsDateMatch = str.match(/^[A-Za-z]{3}\s+([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})/);
  if (jsDateMatch) {
    const monthKey = jsDateMatch[1].toLowerCase();
    const month = MONTH_MAP[monthKey] || '01';
    const day = jsDateMatch[2].padStart(2, '0');
    const year = jsDateMatch[3];
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return '';
}

