import * as XLSX from 'xlsx';
import { Contract } from '../types';
import { fixPortugueseMojibake, stripHtml } from './utils';

const DB_STORE_NAME = 'contratos_excel_sync';
const DB_KEY_HANDLE = 'network_excel_file_handle';
const DB_KEY_CONFIG = 'network_excel_config';

export interface ExcelDatabaseConfig {
  fileName: string;
  filePathHint?: string;
  lastSyncTime?: string;
  autoSaveOnChange: boolean;
  createBackupOnSave: boolean;
  sheetName: string;
}

// IndexedDB Helper to persist FileSystemFileHandle across browser & desktop sessions
async function getIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ContratosDesktopDB', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE_NAME)) {
        db.createObjectStore(DB_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function savePersistedHandle(handle: any): Promise<void> {
  try {
    const db = await getIndexedDB();
    const tx = db.transaction(DB_STORE_NAME, 'readwrite');
    tx.objectStore(DB_STORE_NAME).put(handle, DB_KEY_HANDLE);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Could not save handle to IndexedDB:', err);
  }
}

export async function getPersistedHandle(): Promise<any | null> {
  try {
    const db = await getIndexedDB();
    const tx = db.transaction(DB_STORE_NAME, 'readonly');
    const request = tx.objectStore(DB_STORE_NAME).get(DB_KEY_HANDLE);
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function clearPersistedHandle(): Promise<void> {
  try {
    const db = await getIndexedDB();
    const tx = db.transaction(DB_STORE_NAME, 'readwrite');
    tx.objectStore(DB_STORE_NAME).delete(DB_KEY_HANDLE);
  } catch (err) {
    console.warn('Could not clear handle from IndexedDB:', err);
  }
}

export function saveExcelConfig(config: ExcelDatabaseConfig) {
  try {
    localStorage.setItem(DB_KEY_CONFIG, JSON.stringify(config));
  } catch {}
}

export function getExcelConfig(): ExcelDatabaseConfig {
  try {
    const saved = localStorage.getItem(DB_KEY_CONFIG);
    if (saved) return JSON.parse(saved);
  } catch {}
  return {
    fileName: '',
    autoSaveOnChange: true,
    createBackupOnSave: false,
    sheetName: 'Contratos',
  };
}

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window;
}

export function isRunningInIframe(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
}

// Convert contracts array to XLSX Worksheet
export function contractsToWorksheet(contracts: Contract[]): XLSX.WorkSheet {
  const rows = contracts.map(c => {
    return {
      'Referência': c.code || (c as any).referencia || '',
      'Número de Fornecedor': c.vendorNumber || '',
      'Código CPV': c.cpv || '',
      'Cocontratante': c.vendor || '',
      'Objeto do contrato': stripHtml(c.title || c.object || ''),
      'Data de assinatura do contrato': c.signatureDate || '',
      'Estado do contrato': c.phase || '',
      'Contrato no SharePoint': c.sharepointLink || '',
      'Edifício': c.building || '',
      'Tipo de contrato': c.contractType || '',
      'Tipo de procedimento': c.procedureType || '',
      'Contactos cocontratante': c.vendorContacts || '',
      'D.M. abertura e D.M. adjudicação': c.dmInfo || '',
      'Preço Contratual': c.price || c.contractualPrice || c.globalValue || 0,
      'Data de início do contrato': c.startDate || '',
      'Data de fim do contrato': c.endDate || '',
      'Descrição CPV': c.cpvDescription || '',
      'Link P & D': c.linkPD || c.linkPED || '',
      'Nota de encomenda': c.orderNote || '',
      'Caução': c.caution || '',
      'Direção com a gestão técnica': c.technicalManagementDirection || '',
      'Gestor': c.manager || '',
      'Pareceres': c.pareceres || '',
      'Valor acumulado pareceres': c.pareceresValorAcumulado || '',
      'Suspensões': c.suspensoes || '',
      'Nova data fim do contrato': c.novaDataFimContrato || '',
      'Revisões de preços': c.revisoes || '',
      'Revisões valor acumulado': c.revisoesValorAcumulado || '',
      'Modificações objetivas': c.modificacoesObjetivas || '',
      'Valor acumulado modificações objetivas': c.valorAcumuladoModificacoesObjetivas || '',
      'Total executado': c.executedValue || c.valorTotalExecutado || 0,
      'Eliminado': c.deleted ? 'SIM' : 'NÃO',
      'ID': c.id || '',
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  
  // Set nice column widths
  const colWidths = [
    { wch: 16 }, // Referencia
    { wch: 14 }, // Fornecedor
    { wch: 12 }, // CPV
    { wch: 25 }, // Descricao CPV
    { wch: 25 }, // Cocontratante
    { wch: 35 }, // Objeto
    { wch: 14 }, // Data Assinatura
    { wch: 14 }, // Data Inicio
    { wch: 14 }, // Data Fim
    { wch: 22 }, // Estado
    { wch: 30 }, // SharePoint
    { wch: 18 }, // Edificio
    { wch: 20 }, // Tipo de Contrato
    { wch: 25 }, // Tipo de Procedimento
    { wch: 30 }, // Link P & D
    { wch: 25 }, // Contactos
    { wch: 25 }, // DM Info
    { wch: 16 }, // Preco
    { wch: 18 }, // Nota de Encomenda
    { wch: 14 }, // Caucao
    { wch: 25 }, // Direcao
    { wch: 20 }, // Gestor
  ];
  ws['!cols'] = colWidths;
  return ws;
}

function normalizeHeaderKey(str: any): string {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function parseExcelDateString(val: any): string {
  if (val === null || val === undefined || val === '') return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof val === 'number' && val > 20000 && val < 60000) {
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, '0');
      const d = String(date.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  const str = String(val).trim();
  if (!str) return '';
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
  }
  const ymdMatch = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
  }
  return str;
}

function parseExcelPriceNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  let str = String(val).trim();
  str = str.replace(/[€$£\s\u00A0]/g, '');
  if (!str) return 0;
  if (str.includes(',') && str.includes('.')) {
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    if (lastComma > lastDot) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function findBestSheet(wb: XLSX.WorkBook): string {
  if (!wb.SheetNames || wb.SheetNames.length === 0) return '';
  if (wb.SheetNames.length === 1) return wb.SheetNames[0];

  const excluded = ['utilizadores', 'users', 'config', 'configuracao', 'instrucoes', 'instrucao', 'legenda', 'resumo', 'indices'];
  let bestSheet = '';
  let highestScore = -1;

  for (const name of wb.SheetNames) {
    const norm = normalizeHeaderKey(name);
    if (excluded.some(ex => norm.includes(ex))) continue;

    const ws = wb.Sheets[name];
    let rowCount = 0;
    if (ws && ws['!ref']) {
      try {
        const range = XLSX.utils.decode_range(ws['!ref']);
        rowCount = range.e.r - range.s.r + 1;
      } catch {
        rowCount = Object.keys(ws).length;
      }
    }

    let nameBonus = 0;
    if (norm.includes('contrato') || norm.includes('ngcpo') || norm.includes('dados') || norm.includes('basedados') || norm.includes('bd')) {
      nameBonus = 1000;
    }

    const score = rowCount + nameBonus;
    if (score > highestScore) {
      highestScore = score;
      bestSheet = name;
    }
  }

  return bestSheet || wb.SheetNames[0];
}

function sheetToJsonWithSmartHeader(ws: XLSX.WorkSheet | undefined): any[] {
  if (!ws) return [];

  const cellKeys = Object.keys(ws).filter(k => !k.startsWith('!'));
  if (cellKeys.length === 0) return [];

  let minR = Infinity, maxR = -1, minC = Infinity, maxC = -1;
  for (const k of cellKeys) {
    try {
      const decoded = XLSX.utils.decode_cell(k);
      if (decoded.r < minR) minR = decoded.r;
      if (decoded.r > maxR) maxR = decoded.r;
      if (decoded.c < minC) minC = decoded.c;
      if (decoded.c > maxC) maxC = decoded.c;
    } catch {
      // ignore non-cell properties
    }
  }

  if (maxR >= 0 && maxC >= 0 && minR < Infinity && minC < Infinity) {
    ws['!ref'] = XLSX.utils.encode_range({
      s: { r: minR, c: minC },
      e: { r: maxR, c: maxC }
    });
  }

  const matrix: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (matrix.length === 0) return [];

  const knownHeaderKeywords = [
    'contrato', 'referencia', 'codigo', 'procedimento', 'processo',
    'objeto', 'cocontratante', 'fornecedor', 'preco', 'valor',
    'inicio', 'fim', 'estado', 'fase', 'gestor', 'direcao', 'modificac'
  ];

  let bestHeaderRowIndex = 0;
  let bestHeaderScore = -1;

  for (let r = 0; r < Math.min(matrix.length, 15); r++) {
    const row = matrix[r];
    if (!Array.isArray(row)) continue;

    let score = 0;
    let textCells = 0;
    for (const cell of row) {
      const cellStr = normalizeHeaderKey(cell);
      if (!cellStr) continue;
      textCells++;
      for (const kw of knownHeaderKeywords) {
        if (cellStr.includes(kw)) {
          score += 3;
          break;
        }
      }
    }

    const totalScore = score + (textCells >= 3 ? 2 : 0);
    if (totalScore > bestHeaderScore && score > 0) {
      bestHeaderScore = totalScore;
      bestHeaderRowIndex = r;
    }
  }

  const rawRows: any[] = XLSX.utils.sheet_to_json(ws, {
    range: bestHeaderRowIndex,
    defval: '',
  });

  return rawRows.filter(row => {
    if (!row || typeof row !== 'object') return false;
    const values = Object.values(row).map(v => String(v || '').trim()).filter(Boolean);
    if (values.length === 0) return false;
    if (values.length === 1 && /^totai?s?$/i.test(values[0])) return false;
    return true;
  });
}

export function rawRowsToContracts(rawRows: any[]): Contract[] {
  return rawRows.map((row, idx) => {
    const normalizedMap = new Map<string, any>();
    for (const [key, val] of Object.entries(row)) {
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        normalizedMap.set(normalizeHeaderKey(key), val);
      }
    }

    const getVal = (exactKeys: string[], normalizedKeys: string[] = []): any => {
      for (const k of exactKeys) {
        if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
          return row[k];
        }
      }
      for (const nk of normalizedKeys) {
        if (normalizedMap.has(nk)) {
          return normalizedMap.get(nk);
        }
      }
      for (const nk of normalizedKeys) {
        if (nk.length < 4) continue;
        for (const [keyNorm, val] of normalizedMap.entries()) {
          if (keyNorm.includes(nk)) {
            return val;
          }
        }
      }
      return '';
    };

    // 1. Resolve Contract Reference / Code (MUST NEVER default to C-X if ANY valid identifier exists)
    let code = String(getVal(
      [
        'Referência do Contrato', 'Referencia do Contrato', 'Referência', 'Referencia',
        'Código', 'Codigo', 'code', 'Nº Procedimento', 'N.º Procedimento', 'Nº de Procedimento',
        'N.º de Procedimento', 'Nº do Procedimento', 'N.º do Procedimento', 'Procedimento',
        'Procedimento Aquisitivo', 'N.º Procedimento Aquisitivo', 'Nº Procedimento Aquisitivo',
        'Nº Processo', 'N.º Processo', 'Processo', 'Processo Aquisitivo',
        'Ref.ª', 'Refª', 'Ref.', 'Ref', 'Nº Contrato', 'N.º Contrato', 'Nº do Contrato', 'N.º do Contrato',
        'Referência Interna', 'Referencia Interna'
      ],
      [
        'referenciadocontrato', 'referenciacontrato', 'referencia',
        'codigodocontrato', 'codigocontrato', 'codigo',
        'ndoprocedimentoaquisitivo', 'nprocedimentoaquisitivo', 'procedimentoaquisitivo',
        'ndoprocedimento', 'nprocedimento', 'ndeprocedimento', 'numerodoprocedimento', 'procedimento',
        'processoaquisitivo', 'ndoprocesso', 'nprocesso', 'ndeprocesso', 'numerodoprocesso', 'processo',
        'numcontrato', 'numerocontrato', 'numerodecontrato', 'numerodocontrato',
        'ncontrato', 'ndocontrato', 'ndecontrato',
        'refcontrato', 'refdocontrato', 'refa', 'ref', 'code',
        'nprocedimentoreferenciainterna', 'referenciainterna'
      ]
    )).trim();

    const isCpvPattern = /^\d{8}(-\d)?$/.test(code);
    if (isCpvPattern || !code) {
      for (const [colName, colVal] of Object.entries(row)) {
        const valStr = String(colVal || '').trim();
        if (!valStr) continue;
        const normCol = normalizeHeaderKey(colName);
        if (normCol.includes('cpv') || normCol.includes('fornecedor') || normCol.includes('preco') || normCol.includes('data') || normCol.includes('valor')) {
          continue;
        }
        if (/^(?:CP|AJ|CT|CD|PD|CC|PE|C|NE|DM)\s*[\/\-]\s*\w+/i.test(valStr) || /^\d{1,5}\s*[\/\-]\s*(?:20\d\d|\d{2})/i.test(valStr)) {
          code = valStr;
          break;
        }
      }
    }

    if (!code) {
      code = `C-${idx + 1}`;
    }

    let title = fixPortugueseMojibake(String(getVal(
      ['Objeto do contrato', 'Objeto do Contrato', 'Objeto', 'Objecto do contrato', 'Objecto', 'Título', 'Titulo', 'Designação', 'Designacao', 'title'],
      ['objetodocontrato', 'objeto', 'objectodocontrato', 'objecto', 'titulo', 'designacao', 'descricaodocontrato', 'descricao', 'title']
    ))).trim();
    if (!title) {
      title = code;
    }

    let vendor = fixPortugueseMojibake(String(getVal(
      ['Cocontratante', 'Fornecedor', 'Nome do Cocontratante', 'Nome do Fornecedor', 'Adjudicatário', 'Adjudicatario', 'vendor'],
      ['cocontratante', 'fornecedor', 'adjudicatario', 'razaosocial', 'vendor']
    ))).trim();

    let vendorNumber = String(getVal(
      ['Número de Fornecedor', 'Numero de Fornecedor', 'Nº de Fornecedor', 'N.º Fornecedor', 'Nº Fornecedor', 'NIF', 'NIPC', 'vendorNumber'],
      ['numerodefornecedor', 'numfornecedor', 'nfornecedor', 'nif', 'nipc', 'codigofornecedor', 'credor', 'vendornumber']
    )).trim();

    const vendorContacts = String(getVal(
      ['Contactos cocontratante', 'Contactos do cocontratante', 'Contactos Fornecedor', 'Contactos', 'Morada', 'vendorContacts'],
      ['contactoscocontratante', 'contactosfornecedor', 'contactos', 'morada', 'telefone', 'email', 'contacts']
    )).trim();

    if (!vendorNumber && (vendorContacts || vendor)) {
      const combined = `${vendor} ${vendorContacts}`;
      const nifMatch = combined.match(/\b([1235689]\d{8})\b/);
      if (nifMatch) {
        vendorNumber = nifMatch[1];
      }
    }

    let cpv = String(getVal(
      ['Código CPV', 'Codigo CPV', 'CPV', 'cpv'],
      ['codigocpv', 'codcpv', 'cpv']
    )).trim();
    if (!cpv && isCpvPattern) {
      cpv = code;
    }

    const cpvDescription = String(getVal(
      ['Descrição CPV', 'Descricao CPV', 'Designação CPV', 'cpvDescription'],
      ['descricaocpv', 'designacaocpv', 'cpvdescription']
    )).trim();

    const phase = fixPortugueseMojibake(String(getVal(
      ['Estado do contrato', 'Estado', 'Fase', 'Status', 'phase'],
      ['estadodocontrato', 'estadocontrato', 'estado', 'fase', 'status', 'situacao', 'phase']
    ))).trim() || 'Em execução';

    const contractType = fixPortugueseMojibake(String(getVal(
      ['Tipo de contrato', 'Tipo de Contrato', 'Tipo Contrato', 'contractType'],
      ['tipodecontrato', 'tipocontrato', 'contracttype']
    ))).trim() || 'Prestação de Serviços';

    const procedureType = fixPortugueseMojibake(String(getVal(
      ['Tipo de procedimento', 'Tipo de Procedimento', 'Tipo Procedimento', 'procedureType'],
      ['tipodeprocedimento', 'tipoprocedimento', 'proceduretype']
    ))).trim();

    const linkPD = String(getVal(
      ['Link P & D', 'Link P&D', 'Link PED', 'Link PD', 'linkPD', 'linkPED'],
      ['linkpd', 'linkped', 'linkpd']
    )).trim();

    const sharepointLink = String(getVal(
      ['Contrato no SharePoint', 'SharePoint', 'Sharepoint', 'Link SharePoint', 'sharepointLink'],
      ['contratonosharepoint', 'sharepoint', 'linksharepoint', 'sharepointlink']
    )).trim();

    const building = String(getVal(
      ['Edifício', 'Edificio', 'Local', 'building'],
      ['edificio', 'local', 'instalacao', 'building']
    )).trim();

    const dmInfo = String(getVal(
      ['D.M. abertura e D.M. adjudicação', 'DM Abertura / Adjudicação', 'DM Info', 'dmInfo'],
      ['dmaberturaedmadjudicacao', 'dminfo', 'dm']
    )).trim();

    const orderNote = String(getVal(
      ['Nota de encomenda', 'Nota de Encomenda', 'Nota Encomenda', 'NE', 'orderNote'],
      ['notadeencomenda', 'notaencomenda', 'ne', 'ordernote']
    )).trim();

    const caution = String(getVal(
      ['Caução', 'Caucao', 'Garantia', 'caution'],
      ['caucao', 'garantia', 'caution']
    )).trim();

    const technicalManagementDirection = String(getVal(
      ['Direção com a gestão técnica', 'Direcao com a gestao tecnica', 'Direção Técnica', 'Direcao Tecnica', 'DGEI', 'technicalManagementDirection'],
      ['direcaocomagestaotecnica', 'direcaotecnica', 'direcao', 'dgt', 'gestaotecnica']
    )).trim();

    const manager = String(getVal(
      ['Gestor', 'Gestor do Contrato', 'Responsável', 'manager'],
      ['gestor', 'gestordecontrato', 'responsavel', 'manager']
    )).trim();

    const signatureDate = parseExcelDateString(getVal(
      ['Data de assinatura do contrato', 'Data de assinatura', 'Data Assinatura', 'Assinatura', 'signatureDate'],
      ['datadeassinaturadocontrato', 'datadeassinatura', 'dataassinatura', 'assinatura', 'signaturedate']
    ));

    const startDate = parseExcelDateString(getVal(
      ['Data de início do contrato', 'Data início contrato', 'Data de início', 'Data Início', 'Data Inicio', 'Início', 'Inicio', 'Consignação', 'startDate'],
      ['datadeiniciodocontrato', 'datainiciocontrato', 'datainicio', 'datadeinicio', 'datainicial', 'inicio', 'startdate', 'consignacao']
    ));

    const endDate = parseExcelDateString(getVal(
      ['Data de fim do contrato', 'Data fim contrato', 'Data de fim', 'Data Fim', 'Fim', 'Termo', 'Conclusão', 'endDate'],
      ['datadefimdocontrato', 'datafimcontrato', 'datafim', 'datadefim', 'datafinal', 'fim', 'conclusao', 'enddate', 'termo']
    ));

    const novaDataFimContrato = parseExcelDateString(getVal(
      ['Nova data fim do contrato', 'Nova Data Fim', 'novaDataFimContrato'],
      ['novadatafimdocontrato', 'novadatafim', 'novadatafimcontrato']
    ));

    const priceRaw = getVal(
      ['Preço Contratual', 'Preco Contratual', 'Preço Contratual Global', 'Valor Contratual', 'Valor Global', 'Preço', 'Preco', 'Valor', 'globalValue', 'price', 'contractualPrice'],
      ['precocontratual', 'precocontratualglobal', 'valorcontratual', 'valorglobal', 'preco', 'montante', 'price', 'globalvalue']
    );
    const globalValue = parseExcelPriceNumber(priceRaw);

    const rawExecuted = getVal(
      ['Total executado', 'Total Executado', 'Valor Total Executado', 'Valor Executado', 'executedValue', 'valorTotalExecutado'],
      ['totalexecutado', 'valortotalexecutado', 'valorexecutado', 'executedvalue']
    );
    const executedValue = parseExcelPriceNumber(rawExecuted);

    const pareceres = String(getVal(['Pareceres', 'pareceres'], ['pareceres', 'parecer'])).trim();
    const pareceresValorAcumulado = String(getVal(['Valor acumulado pareceres', 'pareceresValorAcumulado'], ['valoracumuladopareceres', 'pareceresvaloracumulado'])).trim();
    const suspensoes = String(getVal(['Suspensões', 'Suspensoes', 'suspensoes'], ['suspensoes', 'suspensao'])).trim();
    const revisoes = String(getVal(['Revisões de preços', 'Revisões', 'revisoes'], ['revisoesdeprecos', 'revisoes', 'revisao'])).trim();
    const revisoesValorAcumulado = String(getVal(['Revisões valor acumulado', 'revisoesValorAcumulado'], ['revisoesvaloracumulado', 'valoracumuladorevisoes'])).trim();
    const modificacoesObjetivas = String(getVal(['Modificações objetivas', 'Modificações Objetivas', 'modificacoesObjetivas'], ['modificacoesobjetivas'])).trim();
    const valorAcumuladoModificacoesObjetivas = String(getVal(['Valor acumulado modificações objetivas', 'valorAcumuladoModificacoesObjetivas'], ['valoracumuladomodificacoesobjetivas'])).trim() || '0 €';

    return {
      id: row['id'] || `excel-${idx}-${Date.now()}`,
      code,
      title,
      vendor: vendor || 'N/A',
      phase,
      contractType,
      procedureType,
      linkPD,
      linkPED: linkPD,
      sharepointLink,
      vendorNumber,
      cpv,
      cpvDescription,
      signatureDate,
      startDate,
      endDate,
      building,
      vendorContacts,
      dmInfo,
      price: globalValue,
      contractualPrice: globalValue,
      globalValue,
      orderNote,
      caution,
      technicalManagementDirection,
      manager,
      pareceres,
      pareceresValorAcumulado,
      suspensoes,
      novaDataFimContrato,
      revisoes,
      revisoesValorAcumulado,
      modificacoesObjetivas,
      valorAcumuladoModificacoesObjetivas,
      executedValue,
      createdAt: row['createdAt'] || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });
}

// Convert Workbook/Buffer into Contract array across ALL sheets containing contracts
export function worksheetToContracts(wb: XLSX.WorkBook): Contract[] {
  const excluded = ['utilizadores', 'users', 'config', 'configuracao', 'instrucoes', 'instrucao', 'legenda', 'resumo', 'indices'];
  const allContracts: Contract[] = [];
  const seenCodes = new Set<string>();

  // 1. Scan and combine contracts from all sheets that contain contract data
  for (const sheetName of wb.SheetNames) {
    const norm = normalizeHeaderKey(sheetName);
    if (excluded.some(ex => norm.includes(ex))) continue;

    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    const rawRows = sheetToJsonWithSmartHeader(ws);
    if (!rawRows || rawRows.length === 0) continue;

    const sheetContracts = rawRowsToContracts(rawRows);
    for (const c of sheetContracts) {
      const codeKey = (c.code || c.id || '').trim().toLowerCase();
      if (codeKey && !seenCodes.has(codeKey)) {
        seenCodes.add(codeKey);
        allContracts.push(c);
      } else if (!codeKey) {
        allContracts.push(c);
      }
    }
  }

  if (allContracts.length > 0) {
    return allContracts;
  }

  // Fallback: pick best single sheet
  const sheetName = findBestSheet(wb);
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  const rawRows = sheetToJsonWithSmartHeader(ws);
  return rawRowsToContracts(rawRows);
}

// Generate Excel Buffer from contracts
export function generateExcelBuffer(contracts: Contract[], targetSheetName?: string): ArrayBuffer {
  const cfg = getExcelConfig();
  const sheetName = targetSheetName || cfg.sheetName || 'Contratos';
  const wb = XLSX.utils.book_new();
  const ws = contractsToWorksheet(contracts);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return wbout;
}

// Write directly to file handle (Network/Local Excel File)
export async function writeContractsToHandle(contracts: Contract[], fileHandle: any): Promise<boolean> {
  try {
    const buffer = generateExcelBuffer(contracts);
    const writable = await fileHandle.createWritable();
    await writable.write(buffer);
    await writable.close();
    return true;
  } catch (err: any) {
    console.error('Failed writing contracts to Excel file handle:', err);
    const msg = String(err?.message || err || '').toLowerCase();
    if (msg.includes('in use') || msg.includes('locked') || err?.name === 'NoModificationAllowedError' || err?.name === 'InvalidStateError') {
      const customErr = new Error('O ficheiro Excel está aberto no Microsoft Excel! Feche o Excel no seu computador para permitir a gravação automática.');
      (customErr as any).isLockedByExcel = true;
      throw customErr;
    }
    throw err;
  }
}

// Read contracts from file handle
export async function readContractsFromHandle(fileHandle: any): Promise<Contract[]> {
  try {
    const file = await fileHandle.getFile();
    const arrayBuffer = await file.arrayBuffer();
    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    const bestSheet = findBestSheet(wb);
    if (bestSheet) {
      const cfg = getExcelConfig();
      saveExcelConfig({ ...cfg, sheetName: bestSheet, fileName: fileHandle.name });
    }
    return worksheetToContracts(wb);
  } catch (err) {
    console.error('Failed reading contracts from Excel file handle:', err);
    throw err;
  }
}
