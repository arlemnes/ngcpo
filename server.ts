import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import * as XLSX from 'xlsx';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Body parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Directories
const DATA_DIR = path.resolve(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Serve attachments statically
app.use('/Anexos', express.static(path.join(__dirname, 'Anexos')));


const CONFIG_FILE = path.join(DATA_DIR, 'server_config.json');
const DEFAULT_EXCEL_PATH = path.join(DATA_DIR, 'contratos_database.xlsx');

interface ServerConfig {
  excelFilePath: string;
  autoBackup: boolean;
  lastBackupTime?: string;
  sharedFolderPath?: string;
}

function getServerConfig(): ServerConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Error reading server config:', err);
  }
  return {
    excelFilePath: DEFAULT_EXCEL_PATH,
    autoBackup: true,
  };
}

function saveServerConfig(config: ServerConfig): void {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving server config:', err);
  }
}

// Initial seed contracts for when database is newly created
const SEED_CONTRACTS = [
  {
    id: 'c-2025-001',
    code: 'CP/001/2025',
    vendorNumber: 'F004291',
    cpv: '50700000-2',
    cpvDescription: 'Serviços de reparação e manutenção de instalações em edifícios',
    vendor: 'Efacec Engenharia e Manutenção, S.A.',
    title: 'Manutenção Preventiva e Corretiva dos Sistemas AVAC e Eletromecânicos dos Edifícios Centrais',
    signatureDate: '2025-01-15',
    startDate: '2025-02-01',
    endDate: '2027-01-31',
    phase: 'Em execução',
    sharepointLink: 'https://scml.sharepoint.com/sites/contratos/CP001-2025',
    building: 'Sede Central - Largo Trindade Coelho',
    contractType: 'Prestação de Serviços',
    procedureType: 'Concurso Público',
    linkPD: 'PD-2024-8901',
    linkPED: 'PD-2024-8901',
    vendorContacts: 'contato@efacec.pt | 210 000 000',
    dmInfo: 'DM 142/2024 de Abertura; DM 005/2025 de Adjudicação',
    price: 345000.00,
    contractualPrice: 345000.00,
    globalValue: 345000.00,
    orderNote: 'NE-2025-00452',
    caution: 'Garantia Bancária n.º 998822 (5%)',
    technicalManagementDirection: 'Direção de Gestão de Edifícios e Instalações',
    manager: 'Luís Rocha',
    pareceres: 'Parecer favorável DGEI n.º 12/2025',
    pareceresValorAcumulado: '0 €',
    suspensoes: 'Nenhuma',
    novaDataFimContrato: '2027-01-31',
    revisoes: 'Prevista revisão anual de preços por fórmula legal',
    revisoesValorAcumulado: '0 €',
    modificacoesObjetivas: 'Nenhuma',
    valorAcumuladoModificacoesObjetivas: '0 €',
    executedValue: 57500.00,
    deleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'c-2025-002',
    code: 'CP/002/2025',
    vendorNumber: 'F001850',
    cpv: '90910000-9',
    cpvDescription: 'Serviços de limpeza',
    vendor: 'ISS Facility Services, Lda.',
    title: 'Prestação de Serviços de Higienização, Limpeza Especializada e Gestão de Resíduos',
    signatureDate: '2025-01-20',
    startDate: '2025-02-01',
    endDate: '2026-01-31',
    phase: 'Em execução',
    sharepointLink: 'https://scml.sharepoint.com/sites/contratos/CP002-2025',
    building: 'Instalações de Saúde e Ação Social',
    contractType: 'Prestação de Serviços',
    procedureType: 'Concurso Público',
    linkPD: 'PD-2024-9120',
    linkPED: 'PD-2024-9120',
    vendorContacts: 'comercial@pt.issworld.com | 217 000 111',
    dmInfo: 'DM 155/2024 de Abertura; DM 008/2025 de Adjudicação',
    price: 198500.00,
    contractualPrice: 198500.00,
    globalValue: 198500.00,
    orderNote: 'NE-2025-00678',
    caution: 'Seguro-caução n.º SC-45678',
    technicalManagementDirection: 'Direção de Ação Social',
    manager: 'Belmira Martins',
    pareceres: 'Parecer DGI n.º 04/2025',
    pareceresValorAcumulado: '0 €',
    suspensoes: 'Nenhuma',
    novaDataFimContrato: '2026-01-31',
    revisoes: 'Sem revisões registadas',
    revisoesValorAcumulado: '0 €',
    modificacoesObjetivas: 'Nenhuma',
    valorAcumuladoModificacoesObjetivas: '0 €',
    executedValue: 33080.00,
    deleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'c-2025-003',
    code: 'AJ/014/2025',
    vendorNumber: 'F007621',
    cpv: '45453000-7',
    cpvDescription: 'Trabalhos de reabilitação geral',
    vendor: 'Teixeira Duarte - Engenharia e Construções, S.A.',
    title: 'Empreitada de Conservação e Restauro de Coberturas e Fachadas do Edifício Histórico',
    signatureDate: '2025-02-05',
    startDate: '2025-03-01',
    endDate: '2025-11-30',
    phase: 'Aguarda Consignação/PSS',
    sharepointLink: 'https://scml.sharepoint.com/sites/contratos/AJ014-2025',
    building: 'Palácio de São Roque',
    contractType: 'Empreitada',
    procedureType: 'Ajuste Direto',
    linkPD: 'PD-2025-0104',
    linkPED: 'PD-2025-0104',
    vendorContacts: 'obras@teixeiraduarte.pt',
    dmInfo: 'DM 012/2025 de Abertura e Adjudicação',
    price: 142800.00,
    contractualPrice: 142800.00,
    globalValue: 142800.00,
    orderNote: 'NE-2025-01122',
    caution: 'Depósito de garantia 7.140,00 €',
    technicalManagementDirection: 'Direção do Património Edificado',
    manager: 'Maria Frazão',
    pareceres: 'Aprovado pelo Conselho de Administração',
    pareceresValorAcumulado: '0 €',
    suspensoes: 'Nenhuma',
    novaDataFimContrato: '2025-11-30',
    revisoes: 'Nenhuma',
    revisoesValorAcumulado: '0 €',
    modificacoesObjetivas: 'Nenhuma',
    valorAcumuladoModificacoesObjetivas: '0 €',
    executedValue: 0.00,
    deleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'c-2025-004',
    code: 'CP/005/2024',
    vendorNumber: 'F003319',
    cpv: '79710000-4',
    cpvDescription: 'Serviços de segurança',
    vendor: 'Securitas Serviços de Segurança, S.A.',
    title: 'Serviços de Vigilância Humana e Segurança Ativa para Imóveis e Instalações',
    signatureDate: '2024-11-10',
    startDate: '2024-12-01',
    endDate: '2026-11-30',
    phase: 'Em execução',
    sharepointLink: 'https://scml.sharepoint.com/sites/contratos/CP005-2024',
    building: 'Rede Geral de Imóveis',
    contractType: 'Prestação de Serviços',
    procedureType: 'Concurso Público',
    linkPD: 'PD-2024-7711',
    linkPED: 'PD-2024-7711',
    vendorContacts: 'vigilancia@securitas.pt',
    dmInfo: 'DM 110/2024 de Abertura; DM 189/2024 de Adjudicação',
    price: 520000.00,
    contractualPrice: 520000.00,
    globalValue: 520000.00,
    orderNote: 'NE-2024-09872',
    caution: 'Garantia Bancária n.º G-44321',
    technicalManagementDirection: 'Direção de Segurança e Prevenção',
    manager: 'Maria José',
    pareceres: 'Conforme regras de contratação pública',
    pareceresValorAcumulado: '0 €',
    suspensoes: 'Nenhuma',
    novaDataFimContrato: '2026-11-30',
    revisoes: 'Sem revisões registadas',
    revisoesValorAcumulado: '0 €',
    modificacoesObjetivas: 'Nenhuma',
    valorAcumuladoModificacoesObjetivas: '0 €',
    executedValue: 173330.00,
    deleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

const SEED_USERS = [
  { id: 'user-1', username: 'luis.rocha', email: 'luis.rocha@scml.pt', role: 'admin' },
];

function contractsToRows(contracts: any[]): any[] {
  return contracts.map((c) => ({
    'Referência': c.code || c.referencia || '',
    'Número de Fornecedor': c.vendorNumber || '',
    'Código CPV': c.cpv || '',
    'Cocontratante': c.vendor || '',
    'Objeto do contrato': c.title || c.object || '',
    'Data de assinatura do contrato': c.signatureDate || '',
    'Estado do contrato': c.phase || '',
    'Contrato no SharePoint': c.sharepointLink || '',
    'Edifício': c.building || '',
    'Tipo de contrato': c.contractType || '',
    'Tipo de procedimento': c.procedureType || '',
    'Contactos cocontratante': c.vendorContacts || '',
    'D.M. abertura e D.M. adjudicação': c.dmInfo || '',
    'Preço Contratual': Number(c.price || c.contractualPrice || c.globalValue || 0),
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
    'Total executado': Number(c.executedValue || c.valorTotalExecutado || 0),
    'Eliminado': c.deleted ? 'SIM' : 'NÃO',
    'ID': c.id || '',
    'CriadoEm': c.createdAt || new Date().toISOString(),
    'AtualizadoEm': c.updatedAt || new Date().toISOString(),
  }));
}

function normalizeHeaderStr(str: any): string {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function parseExcelDateStr(val: any): string {
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

function parseExcelPriceNum(val: any): number {
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

function sheetToJsonWithSmartHeader(ws: XLSX.WorkSheet | undefined): any[] {
  if (!ws) return [];

  // 1. Recalculate range in case ws['!ref'] was set incorrectly or truncated
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

  // 2. Scan the first 15 rows to find the true header row
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
      const cellStr = normalizeHeaderStr(cell);
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

  // 3. Extract JSON using detected header row
  const rawRows: any[] = XLSX.utils.sheet_to_json(ws, {
    range: bestHeaderRowIndex,
    defval: '',
  });

  // 4. Filter out completely empty or total summary rows
  return rawRows.filter(row => {
    if (!row || typeof row !== 'object') return false;
    const values = Object.values(row).map(v => String(v || '').trim()).filter(Boolean);
    if (values.length === 0) return false;
    if (values.length === 1 && /^totai?s?$/i.test(values[0])) return false;
    return true;
  });
}

function getBestContractsSheet(wb: XLSX.WorkBook): string {
  if (!wb.SheetNames || wb.SheetNames.length === 0) return '';
  if (wb.SheetNames.length === 1) return wb.SheetNames[0];

  const excludedSheets = ['utilizadores', 'users', 'config', 'configuracao', 'instrucoes', 'instrucao', 'legenda', 'resumo', 'indices'];

  // Score candidate sheets
  let bestSheet = '';
  let highestScore = -1;

  for (const name of wb.SheetNames) {
    const norm = normalizeHeaderStr(name);
    if (excludedSheets.some(ex => norm.includes(ex))) continue;

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

function rowsToContracts(rows: any[]): any[] {
  return rows.map((r, index) => {
    // Map of normalized header -> raw value
    const normalizedMap = new Map<string, any>();
    for (const [key, val] of Object.entries(r)) {
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        normalizedMap.set(normalizeHeaderStr(key), val);
      }
    }

    const getVal = (exactKeys: string[], normalizedKeys: string[] = []): any => {
      for (const k of exactKeys) {
        if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') {
          return r[k];
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

    // Check if code was mistaken for a CPV (e.g. 50700000-2)
    const isCpvPattern = /^\d{8}(-\d)?$/.test(code);
    if (isCpvPattern || !code) {
      // Scan other fields for typical contract / procedure reference format (e.g., CP/001/2025, AJ/14/2024, CT-1234, 123/2024)
      for (const [colName, colVal] of Object.entries(r)) {
        const valStr = String(colVal || '').trim();
        if (!valStr) continue;
        const normCol = normalizeHeaderStr(colName);
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
      code = `C-${index + 1}`;
    }

    // 2. Resolve Price & Financial Values
    const rawPrice = getVal(
      ['Preço Contratual', 'Preco Contratual', 'Preço Contratual Global', 'Valor Contratual', 'Valor Global', 'Preço', 'Preco', 'Valor', 'globalValue', 'price', 'contractualPrice'],
      ['precocontratual', 'precocontratualglobal', 'valorcontratual', 'valorglobal', 'preco', 'montante', 'price', 'globalvalue']
    );
    const globalValue = parseExcelPriceNum(rawPrice);

    const rawExecuted = getVal(
      ['Total executado', 'Total Executado', 'Valor Total Executado', 'Valor Executado', 'executedValue', 'valorTotalExecutado'],
      ['totalexecutado', 'valortotalexecutado', 'valorexecutado', 'executedvalue']
    );
    const executedValue = parseExcelPriceNum(rawExecuted);

    // 3. Resolve Vendor & Vendor Number
    let vendor = String(getVal(
      ['Cocontratante', 'Fornecedor', 'Nome do Cocontratante', 'Nome do Fornecedor', 'Adjudicatário', 'Adjudicatario', 'vendor'],
      ['cocontratante', 'fornecedor', 'adjudicatario', 'razaosocial', 'vendor']
    )).trim();

    let vendorNumber = String(getVal(
      ['Número de Fornecedor', 'Numero de Fornecedor', 'Nº de Fornecedor', 'N.º Fornecedor', 'Nº Fornecedor', 'NIF', 'NIPC', 'vendorNumber'],
      ['numerodefornecedor', 'numfornecedor', 'nfornecedor', 'nif', 'nipc', 'codigofornecedor', 'credor', 'vendornumber']
    )).trim();

    const vendorContacts = String(getVal(
      ['Contactos cocontratante', 'Contactos do cocontratante', 'Contactos Fornecedor', 'Contactos', 'Morada', 'vendorContacts'],
      ['contactoscocontratante', 'contactosfornecedor', 'contactos', 'morada', 'telefone', 'email', 'contacts']
    )).trim();

    // If vendorNumber is empty, look for 9-digit Portuguese NIF
    if (!vendorNumber && (vendorContacts || vendor)) {
      const combined = `${vendor} ${vendorContacts}`;
      const nifMatch = combined.match(/\b([1235689]\d{8})\b/);
      if (nifMatch) {
        vendorNumber = nifMatch[1];
      }
    }

    // 4. Resolve Title / Objeto
    let title = String(getVal(
      ['Objeto do contrato', 'Objeto do Contrato', 'Objeto', 'Objecto do contrato', 'Objecto', 'Título', 'Titulo', 'Designação', 'Designacao', 'title'],
      ['objetodocontrato', 'objeto', 'objectodocontrato', 'objecto', 'titulo', 'designacao', 'descricaodocontrato', 'descricao', 'title']
    )).trim();
    if (!title) {
      title = code;
    }

    // 5. Resolve CPV
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

    // 6. Dates
    const signatureDate = parseExcelDateStr(getVal(
      ['Data de assinatura do contrato', 'Data de assinatura', 'Data Assinatura', 'Assinatura', 'signatureDate'],
      ['datadeassinaturadocontrato', 'datadeassinatura', 'dataassinatura', 'assinatura', 'signaturedate']
    ));

    const startDate = parseExcelDateStr(getVal(
      ['Data de início do contrato', 'Data início contrato', 'Data de início', 'Data Início', 'Data Inicio', 'Início', 'Inicio', 'Consignação', 'startDate'],
      ['datadeiniciodocontrato', 'datainiciocontrato', 'datainicio', 'datadeinicio', 'datainicial', 'inicio', 'startdate', 'consignacao']
    ));

    const endDate = parseExcelDateStr(getVal(
      ['Data de fim do contrato', 'Data fim contrato', 'Data de fim', 'Data Fim', 'Fim', 'Termo', 'Conclusão', 'endDate'],
      ['datadefimdocontrato', 'datafimcontrato', 'datafim', 'datadefim', 'datafinal', 'fim', 'conclusao', 'enddate', 'termo']
    ));

    const novaDataFimContrato = parseExcelDateStr(getVal(
      ['Nova data fim do contrato', 'Nova Data Fim', 'novaDataFimContrato'],
      ['novadatafimdocontrato', 'novadatafim', 'novadatafimcontrato']
    ));

    // 7. Phase & Types
    const phase = String(getVal(
      ['Estado do contrato', 'Estado', 'Fase', 'Status', 'phase'],
      ['estadodocontrato', 'estadocontrato', 'estado', 'fase', 'status', 'situacao', 'phase']
    )).trim() || 'Em execução';

    const contractType = String(getVal(
      ['Tipo de contrato', 'Tipo de Contrato', 'Tipo Contrato', 'contractType'],
      ['tipodecontrato', 'tipocontrato', 'contracttype']
    )).trim() || 'Prestação de Serviços';

    const procedureType = String(getVal(
      ['Tipo de procedimento', 'Tipo de Procedimento', 'Tipo Procedimento', 'procedureType'],
      ['tipodeprocedimento', 'tipoprocedimento', 'proceduretype']
    )).trim();

    // 8. Other Fields
    const sharepointLink = String(getVal(
      ['Contrato no SharePoint', 'SharePoint', 'Sharepoint', 'Link SharePoint', 'sharepointLink'],
      ['contratonosharepoint', 'sharepoint', 'linksharepoint', 'sharepointlink']
    )).trim();

    const building = String(getVal(
      ['Edifício', 'Edificio', 'Local', 'building'],
      ['edificio', 'local', 'instalacao', 'building']
    )).trim();

    const linkPD = String(getVal(
      ['Link P & D', 'Link P&D', 'Link PED', 'Link PD', 'linkPD', 'linkPED'],
      ['linkpd', 'linkped', 'linkpd']
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

    const pareceres = String(getVal(['Pareceres', 'pareceres'], ['pareceres', 'parecer'])).trim();
    const pareceresValorAcumulado = String(getVal(['Valor acumulado pareceres', 'pareceresValorAcumulado'], ['valoracumuladopareceres', 'pareceresvaloracumulado'])).trim();
    const suspensoes = String(getVal(['Suspensões', 'Suspensoes', 'suspensoes'], ['suspensoes', 'suspensao'])).trim();
    const revisoes = String(getVal(['Revisões de preços', 'Revisões', 'revisoes'], ['revisoesdeprecos', 'revisoes', 'revisao'])).trim();
    const revisoesValorAcumulado = String(getVal(['Revisões valor acumulado', 'revisoesValorAcumulado'], ['revisoesvaloracumulado', 'valoracumuladorevisoes'])).trim();
    const modificacoesObjetivas = String(getVal(['Modificações objetivas', 'Modificações Objetivas', 'modificacoesObjetivas'], ['modificacoesobjetivas'])).trim();
    const valorAcumuladoModificacoesObjetivas = String(getVal(['Valor acumulado modificações objetivas', 'valorAcumuladoModificacoesObjetivas'], ['valoracumuladomodificacoesobjetivas'])).trim() || '0 €';

    const isDeleted = String(r['Eliminado'] || '').toUpperCase() === 'SIM' || r['deleted'] === true;
    const cleanCode = normalizeHeaderStr(code);
    const stableId = String(r['ID'] || r['id'] || (cleanCode ? `c-${cleanCode}` : `c-row-${index + 1}`));

    return {
      id: stableId,
      code,
      vendorNumber,
      cpv,
      cpvDescription,
      vendor: vendor || 'N/A',
      title,
      signatureDate,
      startDate,
      endDate,
      phase,
      sharepointLink,
      building,
      contractType,
      procedureType,
      linkPD,
      linkPED: linkPD,
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
      deleted: isDeleted,
      createdAt: String(r['CriadoEm'] || r['createdAt'] || new Date().toISOString()),
      updatedAt: String(r['AtualizadoEm'] || r['updatedAt'] || new Date().toISOString()),
    };
  });
}

function writeWorkbook(filePath: string, contracts: any[], users?: any[]): void {
  const wb = XLSX.utils.book_new();

  // 1. Contratos Sheet
  const rows = contractsToRows(contracts);
  const wsContracts = XLSX.utils.json_to_sheet(rows);
  wsContracts['!cols'] = [
    { wch: 18 }, // ID
    { wch: 16 }, // Referencia
    { wch: 16 }, // Num Fornecedor
    { wch: 14 }, // CPV
    { wch: 30 }, // Desc CPV
    { wch: 30 }, // Cocontratante
    { wch: 45 }, // Objeto
    { wch: 16 }, // Data Assinatura
    { wch: 16 }, // Data Inicio
    { wch: 16 }, // Data Fim
    { wch: 22 }, // Estado
    { wch: 35 }, // SharePoint
    { wch: 25 }, // Edificio
    { wch: 22 }, // Tipo Contrato
    { wch: 22 }, // Tipo Procedimento
    { wch: 25 }, // Link PD
    { wch: 30 }, // Contactos
    { wch: 30 }, // DM
    { wch: 18 }, // Preco
    { wch: 18 }, // Nota Encomenda
    { wch: 16 }, // Caucao
    { wch: 30 }, // Direcao
    { wch: 20 }, // Gestor
    { wch: 25 }, // Pareceres
    { wch: 18 }, // Valor Pareceres
    { wch: 20 }, // Suspensoes
    { wch: 16 }, // Nova Data Fim
    { wch: 25 }, // Revisoes
    { wch: 18 }, // Valor Revisoes
    { wch: 25 }, // Modificacoes
    { wch: 18 }, // Valor Modificacoes
    { wch: 18 }, // Total Executado
    { wch: 12 }, // Eliminado
    { wch: 25 }, // CriadoEm
    { wch: 25 }, // AtualizadoEm
  ];
  XLSX.utils.book_append_sheet(wb, wsContracts, 'Contratos');

  // 2. Utilizadores Sheet
  const effectiveUsers = users || readUsersFromExcel(filePath) || SEED_USERS;
  const wsUsers = XLSX.utils.json_to_sheet(effectiveUsers);
  wsUsers['!cols'] = [
    { wch: 15 },
    { wch: 25 },
    { wch: 35 },
    { wch: 15 },
  ];
  XLSX.utils.book_append_sheet(wb, wsUsers, 'Utilizadores');

  // 3. Info Sheet
  const infoRows = [
    { Parametro: 'Nome da Base de Dados', Valor: 'Gestor de Contratos Públicos - Servidor Excel' },
    { Parametro: 'Última Atualização', Valor: new Date().toLocaleString('pt-PT') },
    { Parametro: 'Total de Contratos', Valor: contracts.length },
    { Parametro: 'Versão do Esquema', Valor: '2.0.0 (Servidor Excel de Dados)' },
  ];
  const wsInfo = XLSX.utils.json_to_sheet(infoRows);
  XLSX.utils.book_append_sheet(wb, wsInfo, 'Configuracao');

  // Write file atomically (temp file then rename/copy to avoid Windows network SMB locks)
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tempPath = path.join(dir, `temp_${Date.now()}_${path.basename(filePath)}`);
  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

  try {
    fs.writeFileSync(tempPath, Buffer.from(buffer));
    try {
      fs.renameSync(tempPath, filePath);
    } catch (renameErr) {
      // Fallback for Windows SMB / network shares / EPERM:
      fs.copyFileSync(tempPath, filePath);
      try { fs.unlinkSync(tempPath); } catch {}
    }
  } catch (writeErr) {
    // If temp file writing failed, write directly to destination
    fs.writeFileSync(filePath, Buffer.from(buffer));
  }
}

function readUsersFromExcel(filePath: string): any[] {
  try {
    if (!fs.existsSync(filePath)) return SEED_USERS;
    const buffer = fs.readFileSync(filePath);
    const wb = XLSX.read(buffer, { type: 'buffer' });
    if (wb.SheetNames.includes('Utilizadores')) {
      const ws = wb.Sheets['Utilizadores'];
      const rawUsers = XLSX.utils.sheet_to_json(ws);
      if (rawUsers && rawUsers.length > 0) {
        return rawUsers;
      }
    }
  } catch (err) {
    console.warn('Could not read users from Excel:', err);
  }
  return SEED_USERS;
}

function readContractsFromExcel(filePath: string): any[] {
  try {
    if (!fs.existsSync(filePath)) {
      writeWorkbook(filePath, SEED_CONTRACTS, SEED_USERS);
      return SEED_CONTRACTS;
    }
    const buffer = fs.readFileSync(filePath);
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });

    const excludedSheets = ['utilizadores', 'users', 'config', 'configuracao', 'instrucoes', 'instrucao', 'legenda', 'resumo', 'indices'];
    const allContracts: any[] = [];
    const seenCodes = new Set<string>();

    // 1. Scan and combine contracts from all sheets that contain contract data
    for (const name of wb.SheetNames) {
      const norm = normalizeHeaderStr(name);
      if (excludedSheets.some(ex => norm.includes(ex))) continue;

      const ws = wb.Sheets[name];
      if (!ws) continue;

      const rawRows = sheetToJsonWithSmartHeader(ws);
      if (!rawRows || rawRows.length === 0) continue;

      const sheetContracts = rowsToContracts(rawRows);
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
    const contractsSheetName = getBestContractsSheet(wb);
    const ws = wb.Sheets[contractsSheetName];
    if (!ws) {
      return [];
    }
    const rawRows = sheetToJsonWithSmartHeader(ws);
    return rowsToContracts(rawRows);
  } catch (err) {
    console.error('Error reading contracts from Excel file:', err);
    return [];
  }
}

// Ensure default Excel database exists on server boot
const initialConfig = getServerConfig();
if (!fs.existsSync(initialConfig.excelFilePath)) {
  console.log(`[Servidor Excel] Criando ficheiro inicial em: ${initialConfig.excelFilePath}`);
  writeWorkbook(initialConfig.excelFilePath, SEED_CONTRACTS, SEED_USERS);
} else {
  console.log(`[Servidor Excel] Ficheiro existente detetado em: ${initialConfig.excelFilePath}`);
}

// ================= API ENDPOINTS =================

// 1. Server Status
app.get('/api/server-excel/status', (req: Request, res: Response) => {
  try {
    const config = getServerConfig();
    const filePath = config.excelFilePath;
    const exists = fs.existsSync(filePath);
    let sizeBytes = 0;
    let mtime = null;

    if (exists) {
      const stats = fs.statSync(filePath);
      sizeBytes = stats.size;
      mtime = stats.mtime.toISOString();
    }

    const contracts = readContractsFromExcel(filePath);
    const activeContracts = contracts.filter(c => !c.deleted).length;
    const deletedContracts = contracts.filter(c => c.deleted).length;

    res.json({
      connected: true,
      mode: 'server-excel',
      filePath,
      exists,
      sizeBytes,
      lastModified: mtime,
      totalContracts: contracts.length,
      activeContracts,
      deletedContracts,
      serverTime: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ connected: false, error: err.message });
  }
});

// 2. GET all contracts
app.get('/api/contracts', (req: Request, res: Response) => {
  try {
    const config = getServerConfig();
    const contracts = readContractsFromExcel(config.excelFilePath);
    res.json({
      success: true,
      contracts,
      total: contracts.length,
      filePath: config.excelFilePath,
    });
  } catch (err: any) {
    console.error('API GET /api/contracts error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. POST single contract (create or update)
app.post('/api/contracts', (req: Request, res: Response) => {
  try {
    const { contract } = req.body;
    if (!contract) {
      return res.status(400).json({ success: false, error: 'Dados do contrato ausentes' });
    }

    const config = getServerConfig();
    const contracts = readContractsFromExcel(config.excelFilePath);

    const now = new Date().toISOString();
    let savedContract: any;

    const targetCode = normalizeHeaderStr(contract.code || contract.referencia || '');
    const cleanId = String(contract.id || '').trim();

    const existingIndex = contracts.findIndex(c => {
      if (cleanId && String(c.id || '').trim() === cleanId) return true;
      if (targetCode) {
        const cCode = normalizeHeaderStr(c.code || c.referencia || '');
        if (cCode && cCode === targetCode) return true;
      }
      return false;
    });

    if (existingIndex >= 0) {
      // Update
      savedContract = {
        ...contracts[existingIndex],
        ...contract,
        id: contracts[existingIndex].id || cleanId || (targetCode ? `c-${targetCode}` : `c-${Date.now()}`),
        updatedAt: now,
      };
      contracts[existingIndex] = savedContract;
    } else {
      // Create
      savedContract = {
        ...contract,
        id: cleanId || (targetCode ? `c-${targetCode}` : `c-${Date.now()}`),
        deleted: contract.deleted || false,
        createdAt: contract.createdAt || now,
        updatedAt: now,
      };
      contracts.unshift(savedContract);
    }

    writeWorkbook(config.excelFilePath, contracts);

    res.json({
      success: true,
      contract: savedContract,
      message: 'Contrato gravado com sucesso no Excel do servidor!',
    });
  } catch (err: any) {
    console.error('API POST /api/contracts error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. POST batch contracts (full sync / bulk changes / import)
app.post('/api/contracts/batch', (req: Request, res: Response) => {
  try {
    const { contracts, mode } = req.body; // mode: 'replace' | 'merge'
    if (!Array.isArray(contracts)) {
      return res.status(400).json({ success: false, error: 'Lista de contratos inválida' });
    }

    const config = getServerConfig();
    let finalList: any[];

    if (mode === 'merge') {
      const existing = readContractsFromExcel(config.excelFilePath);
      const existingMap = new Map(existing.map(c => [c.id, c]));
      for (const item of contracts) {
        existingMap.set(item.id, { ...existingMap.get(item.id), ...item, updatedAt: new Date().toISOString() });
      }
      finalList = Array.from(existingMap.values());
    } else {
      // 'replace' or standard bulk update
      finalList = contracts;
    }

    writeWorkbook(config.excelFilePath, finalList);

    res.json({
      success: true,
      count: finalList.length,
      message: `${finalList.length} contratos guardados com sucesso no Excel do servidor!`,
    });
  } catch (err: any) {
    console.error('API POST /api/contracts/batch error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. DELETE single contract
app.delete('/api/contracts/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const permanent = req.query.permanent === 'true';
    const queryCode = String(req.query.code || '').trim().toLowerCase();

    const config = getServerConfig();
    let contracts = readContractsFromExcel(config.excelFilePath);

    const targetId = String(id || '').trim().toLowerCase();
    const decodedTarget = decodeURIComponent(targetId);

    const cleanTargetId = targetId.replace(/[^a-z0-9]/g, '');
    const cleanQueryCode = queryCode.replace(/[^a-z0-9]/g, '');

    const matchesTarget = (c: any) => {
      const cId = String(c.id || '').trim().toLowerCase();
      const cCode = String(c.code || c.referencia || c.ref || c.procedimento || '').trim().toLowerCase();
      const cleanCId = cId.replace(/[^a-z0-9]/g, '');
      const cleanCCode = cCode.replace(/[^a-z0-9]/g, '');

      if (targetId && (cId === targetId || cCode === targetId)) return true;
      if (decodedTarget && (cId === decodedTarget || cCode === decodedTarget)) return true;
      if (queryCode && (cCode === queryCode || cId === queryCode)) return true;

      // Cleaned comparisons (ignores punctuation and spaces, e.g. "C-369" vs "c369")
      if (cleanTargetId && (cleanCId === cleanTargetId || cleanCCode === cleanTargetId)) return true;
      if (cleanQueryCode && (cleanCCode === cleanQueryCode || cleanCId === cleanQueryCode)) return true;

      return false;
    };

    const initialLength = contracts.length;
    if (permanent) {
      contracts = contracts.filter(c => !matchesTarget(c));
    } else {
      contracts = contracts.map(c => matchesTarget(c) ? { ...c, deleted: true, updatedAt: new Date().toISOString() } : c);
    }

    writeWorkbook(config.excelFilePath, contracts);

    res.json({
      success: true,
      modified: contracts.length !== initialLength || !permanent,
      remaining: contracts.length,
      message: permanent ? 'Contrato removido definitivamente do Excel do servidor.' : 'Contrato movido para a reciclagem no Excel do servidor.',
    });
  } catch (err: any) {
    console.error('API DELETE /api/contracts/:id error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Download server Excel file
app.get('/api/excel/download', (req: Request, res: Response) => {
  try {
    const config = getServerConfig();
    if (!fs.existsSync(config.excelFilePath)) {
      writeWorkbook(config.excelFilePath, SEED_CONTRACTS, SEED_USERS);
    }
    const filename = path.basename(config.excelFilePath);
    res.download(config.excelFilePath, filename);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Download Windows Internet Shortcut (.url)
app.get('/api/download-shortcut', (req: Request, res: Response) => {
  const shortcutPath = path.join(__dirname, 'REC - Gestor de Contratos.url');
  if (fs.existsSync(shortcutPath)) {
    res.download(shortcutPath, 'REC - Gestor de Contratos.url');
  } else {
    const content = `[InternetShortcut]\r\nURL=https://ais-pre-mu5vm6zvknh6tz224iwmns-28704400424.europe-west2.run.app\r\nIconIndex=0\r\n`;
    res.setHeader('Content-Disposition', 'attachment; filename="REC - Gestor de Contratos.url"');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(content);
  }
});

// Download HTML launcher (.html)
app.get('/api/download-launcher', (req: Request, res: Response) => {
  const htmlPath = path.join(__dirname, 'REC - Gestor de Contratos.html');
  if (fs.existsSync(htmlPath)) {
    res.download(htmlPath, 'REC - Gestor de Contratos.html');
  } else {
    res.status(404).send('Not found');
  }
});

// Download Windows batch (.bat)
app.get('/api/download-bat', (req: Request, res: Response) => {
  const batPath = path.join(__dirname, 'ABRIR_APLICACAO.bat');
  if (fs.existsSync(batPath)) {
    res.download(batPath, 'ABRIR_APLICACAO.bat');
  } else {
    res.status(404).send('Not found');
  }
});

// Download INICIAR_SISTEMA.bat
app.get('/api/download-iniciar-bat', (req: Request, res: Response) => {
  const batPath = path.join(__dirname, 'INICIAR_SISTEMA.bat');
  if (fs.existsSync(batPath)) {
    res.download(batPath, 'INICIAR_SISTEMA.bat');
  } else {
    res.status(404).send('Not found');
  }
});

// Download Complete Local System Package (.zip)
app.get('/api/download-sistema-zip', (req: Request, res: Response) => {
  try {
    const zipPath = path.join(__dirname, 'public', 'downloads', 'sistema_contratos_local.zip');
    // Ensure fresh package
    try {
      execSync(`python3 -c "
import os, zipfile
zip_path = '${zipPath}'
os.makedirs(os.path.dirname(zip_path), exist_ok=True)
excluded_dirs = {'node_modules', '.git', 'dist', '.aistudio', '.cache'}
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in excluded_dirs and not d.startswith('.')]
        for f in files:
            if f.endswith('.zip') or f.startswith('.'):
                continue
            full_path = os.path.join(root, f)
            arcname = os.path.relpath(full_path, '.')
            zipf.write(full_path, arcname)
"`, { stdio: 'ignore' });
    } catch {}

    if (fs.existsSync(zipPath)) {
      res.download(zipPath, 'sistema_contratos_scml_local.zip');
    } else {
      res.status(404).send('Pacote ZIP não encontrado');
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// 7. Upload new Excel file to replace/update server database
app.post('/api/excel/upload', (req: Request, res: Response) => {
  try {
    const { fileBase64, fileName, sheetName: requestedSheetName } = req.body;
    if (!fileBase64) {
      return res.status(400).json({ success: false, error: 'Nenhum ficheiro fornecido' });
    }

    const config = getServerConfig();
    const buffer = Buffer.from(fileBase64, 'base64');
    const parsedWb = XLSX.read(buffer, { type: 'buffer', cellDates: true });

    let importedContracts: any[] = [];
    const excludedSheets = ['utilizadores', 'users', 'config', 'configuracao', 'instrucoes', 'instrucao', 'legenda', 'resumo', 'indices'];
    const seenCodes = new Set<string>();

    if (requestedSheetName && parsedWb.Sheets[requestedSheetName]) {
      const rawRows = sheetToJsonWithSmartHeader(parsedWb.Sheets[requestedSheetName]);
      importedContracts = rowsToContracts(rawRows);
    } else {
      for (const name of parsedWb.SheetNames) {
        const norm = normalizeHeaderStr(name);
        if (excludedSheets.some(ex => norm.includes(ex))) continue;
        const ws = parsedWb.Sheets[name];
        if (!ws) continue;
        const rawRows = sheetToJsonWithSmartHeader(ws);
        if (!rawRows || rawRows.length === 0) continue;
        const sheetContracts = rowsToContracts(rawRows);
        for (const c of sheetContracts) {
          const codeKey = (c.code || c.id || '').trim().toLowerCase();
          if (codeKey && !seenCodes.has(codeKey)) {
            seenCodes.add(codeKey);
            importedContracts.push(c);
          } else if (!codeKey) {
            importedContracts.push(c);
          }
        }
      }

      if (importedContracts.length === 0) {
        const sheetName = getBestContractsSheet(parsedWb);
        if (sheetName && parsedWb.Sheets[sheetName]) {
          const rawRows = sheetToJsonWithSmartHeader(parsedWb.Sheets[sheetName]);
          importedContracts = rowsToContracts(rawRows);
        }
      }
    }

    if (importedContracts.length === 0) {
      return res.status(400).json({ success: false, error: 'Nenhuma folha com dados de contratos encontrada no ficheiro Excel.' });
    }

    // Save as current Excel DB
    writeWorkbook(config.excelFilePath, importedContracts);

    res.json({
      success: true,
      count: importedContracts.length,
      contracts: importedContracts,
      message: `Ficheiro "${fileName || 'Excel'}" carregado e guardado com sucesso no servidor (${importedContracts.length} contratos detetados)!`,
    });
  } catch (err: any) {
    console.error('API POST /api/excel/upload error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Update server Excel file path configuration
app.post('/api/server-excel/config', (req: Request, res: Response) => {
  try {
    const { excelFilePath } = req.body;
    if (!excelFilePath || typeof excelFilePath !== 'string') {
      return res.status(400).json({ success: false, error: 'Caminho inválido' });
    }

    const resolved = path.isAbsolute(excelFilePath) ? excelFilePath : path.resolve(DATA_DIR, excelFilePath);
    const config = getServerConfig();
    config.excelFilePath = resolved;
    saveServerConfig(config);

    // If file does not exist at new path, create it with current data
    if (!fs.existsSync(resolved)) {
      writeWorkbook(resolved, SEED_CONTRACTS, SEED_USERS);
    }

    const contracts = readContractsFromExcel(resolved);

    res.json({
      success: true,
      filePath: resolved,
      totalContracts: contracts.length,
      message: `Caminho do ficheiro Excel do servidor atualizado para: ${resolved}`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Attachments Upload
app.post('/api/attachments/upload', (req: Request, res: Response) => {
  try {
    const { fileBase64, fileName, contractCode } = req.body;
    if (!fileBase64 || !contractCode) {
      return res.status(400).json({ success: false, error: 'Dados insuficientes' });
    }

    const annexDir = path.join(__dirname, 'Anexos');
    if (!fs.existsSync(annexDir)) {
      fs.mkdirSync(annexDir);
    }
    
    // Sanitize filename
    const safeContractCode = contractCode.replace(/[^a-z0-9]/gi, '_');
    const safeFileName = path.basename(fileName).replace(/[^a-z0-9.]/gi, '_');
    const finalFileName = `${safeContractCode}_${safeFileName}`;
    const filePath = path.join(annexDir, finalFileName);
    
    const buffer = Buffer.from(fileBase64, 'base64');
    fs.writeFileSync(filePath, buffer);
    
    res.json({ success: true, filePath: `/Anexos/${finalFileName}` });
  } catch (err: any) {
    console.error('API POST /api/attachments/upload error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. Users API
app.get('/api/users', (req: Request, res: Response) => {
  try {
    const config = getServerConfig();
    const users = readUsersFromExcel(config.excelFilePath);
    res.json({ success: true, users });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/users', (req: Request, res: Response) => {
  try {
    const { users } = req.body;
    if (!Array.isArray(users)) {
      return res.status(400).json({ success: false, error: 'Lista de utilizadores inválida' });
    }
    const config = getServerConfig();
    const contracts = readContractsFromExcel(config.excelFilePath);
    writeWorkbook(config.excelFilePath, contracts, users);
    res.json({ success: true, users, message: 'Utilizadores guardados no Excel do servidor!' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Health check endpoint for instant container readiness
app.get('/health', (req: Request, res: Response) => {
  res.status(200).send('OK');
});

// ================= VITE DEV / PROD STATIC =================

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';
  const distPath = path.resolve(__dirname, 'dist');

  // Start listening immediately so port 3000 binds in <10ms and health checks pass instantaneously
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`-----------------------------------------------------`);
    console.log(`[SERVIDOR EXCEL DE DADOS ACTIVO]`);
    console.log(`Porta: ${PORT}`);
    console.log(`Ficheiro Excel: ${getServerConfig().excelFilePath}`);
    console.log(`Modo: ${isProduction ? 'Produção' : 'Desenvolvimento'}`);
    console.log(`Sem dependência de Firebase - 100% Excel no Servidor`);
    console.log(`-----------------------------------------------------`);
  });

  if (isProduction || fs.existsSync(path.join(distPath, 'index.html'))) {
    console.log('[Servidor] A servir pasta dist estática.');
    // Optimized static asset caching for hashed production assets
    app.use('/assets', express.static(path.join(distPath, 'assets'), {
      maxAge: '1y',
      immutable: true,
    }));
    app.use(express.static(distPath, {
      maxAge: 0,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        }
      }
    }));
    app.get('*', (req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    console.log('[Servidor] A iniciar Vite em modo middleware de desenvolvimento...');
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    app.use('*', async (req: Request, res: Response, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200)
          .set({
            'Content-Type': 'text/html',
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          })
          .end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  }
}

startServer();
