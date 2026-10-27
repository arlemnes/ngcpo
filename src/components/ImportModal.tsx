import React, { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  Download, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  RefreshCw, 
  FileCheck, 
  Layers, 
  AlertTriangle,
  Database,
  ArrowRight,
  HelpCircle
} from 'lucide-react';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Contract, ContractInput } from '../types';
import { looksLikeContacts, formatDatePt, parseCurrency, formatCurrency, toIsoDate } from '../lib/utils';

// Função de sanitização profunda para garantir que o Firestore nunca recebe undefined ou protótipos complexos
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

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  isQuotaExceeded: boolean;
  existingContracts?: Contract[];
  onImportComplete?: (count: number) => void;
  onImportSuccess?: (importedContracts: Contract[], updatedExistingIds: string[]) => void;
  setToast?: (toast: { message: string; type: 'success' | 'error' } | null) => void;
}

// Normaliza cabeçalhos para mapeamento flexível sem problemas de acentuação ou pontuação
const normalizeHeader = (header: string): string => {
  return String(header || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
};

const parseExcelDate = (val: any): string => {
  return toIsoDate(val);
};

const parseExcelCurrency = (val: any): { numeric: number; formatted: string } => {
  if (val === null || val === undefined || val === '') {
    return { numeric: 0, formatted: '' };
  }
  if (typeof val === 'number') {
    return {
      numeric: val,
      formatted: val.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
    };
  }
  const str = String(val).trim();
  let clean = str.replace(/[€$£\s\u00A0]/g, '');
  if (clean.includes(',') && clean.includes('.')) {
    const lastComma = clean.lastIndexOf(',');
    const lastDot = clean.lastIndexOf('.');
    if (lastComma > lastDot) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else {
      clean = clean.replace(/,/g, '');
    }
  } else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  }
  const num = parseFloat(clean);
  const validNum = isNaN(num) ? 0 : num;
  return {
    numeric: validNum,
    formatted: str.includes('€') ? str : (validNum ? `${validNum.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u00A0/g, ' ')} €` : '')
  };
};

// Dicionário de sinónimos de colunas para mapeamento inteligente
const FIELD_SYNONYMS: Record<string, string[]> = {
  cpv: ['codigocpv', 'cpv', 'codcpv', 'codigodocpv'],
  cpvDescription: ['descricaocpv', 'designacaocpv', 'descricaodocpv'],
  code: [
    'referenciadocontrato', 'referenciacontrato', 'referencia', 'codigodocontrato', 'codigocontrato',
    'numcontrato', 'numerodecontrato', 'numerodocontrato', 'ncontrato', 'ndocontrato', 'ndecontrato',
    'refcontrato', 'refdocontrato', 'ndoprocedimentoaquisitivo', 'nprocedimentoaquisitivo',
    'procedimentoaquisitivo', 'ndoprocedimento', 'nprocedimento', 'ndeprocedimento', 'numerodoprocedimento',
    'procedimento', 'processoaquisitivo', 'nprocesso', 'ndoprocesso', 'ndeprocesso', 'numerodoprocesso',
    'processo', 'ref', 'code', 'nprocedimentoreferenciainterna', 'numerodoprocedimentoreferenciainterna'
  ],
  title: ['objetodocontrato', 'objeto', 'objecto', 'objectodocontrato', 'titulo', 'designacao', 'designacaodocontrato', 'title', 'descricaodocontrato', 'descricao'],
  vendor: ['cocontratante', 'nomecocontratante', 'nomedococontratante', 'fornecedor', 'nomefornecedor', 'nomedofornecedor', 'adjudicatario', 'nomeadjudicatario', 'empresa', 'razaosocial', 'vendor'],
  vendorNumber: [
    'numerodefornecedor', 'numfornecedor', 'nfornecedor', 'ndefornecedor', 'ndofornecedor',
    'numerodofornecedor', 'numerofornecedor', 'codigofornecedor', 'codfornecedor', 'codigodofornecedor',
    'idfornecedor', 'contafornecedor', 'nif', 'nipc', 'niffornecedor', 'nipcfornecedor',
    'nifcocontratante', 'nipccocontratante', 'vendornumber', 'suppliernumber', 'ncredor', 'credor'
  ],
  vendorContacts: ['contactoscocontratante', 'contactosdococontratante', 'contactosfornecedor', 'contactosdofornecedor', 'contactos', 'morada', 'moradacocontratante', 'moradafornecedor', 'moradadaempresa', 'endereco', 'sede', 'telefone', 'email', 'site', 'vendorcontacts', 'contacts'],
  phase: ['estadodocontrato', 'estado', 'fase', 'status', 'phase', 'situacao', 'estadocontrato'],
  contractualPrice: ['precocontratual', 'valorglobal', 'preco', 'montante', 'valorcontratual', 'price', 'globalvalue', 'precocontratualglobal'],
  procedureType: ['tipodeprocedimento', 'procedimento', 'tipoprocedimento'],
  contractType: ['tipodecontrato', 'tipocontrato', 'tipo'],
  signatureDate: ['datadeassinaturadocontrato', 'datadeassinatura', 'dataassinatura', 'assinatura', 'signaturedate', 'datadaassinaturadocontratoinicial'],
  startDate: [
    'datainiciocontrato', 'datainicio', 'dataincio', 'datainciocontrato', 'inicio', 'incio', 'consignacao', 'startdate',
    'prazosdatainicio', 'prazosnovadatainicio', 'datadeiniciodocontrato',
    'datadeinicio', 'datainicial'
  ],
  endDate: [
    'datafimcontrato', 'datafim', 'fim', 'conclusao', 'enddate',
    'prazosdatafim', 'prazosnovadatainim', 'prazosnovadatafim',
    'datadefimdocontrato', 'datadefim', 'datafinal', 'datalimitedevigor', 'termo', 'datatermo'
  ],
  manager: ['gestor', 'gestordecontrato', 'responsavel', 'manager', 'gestortecnico'],
  technicalManagementDirection: ['direcaocomagestaotecnica', 'direcaotecnica', 'direcao', 'dgt', 'gestaotecnica'],
  building: ['edificio', 'local', 'building', 'instalacao'],
  sharepointLink: ['contratonosharepoint', 'sharepoint', 'linksharepoint', 'sharepointlink', 'link'],
  linkPD: ['linkped', 'linkpd', 'linkp&d', 'pedlink', 'pdlink', 'linkdep&d', 'linkp_d'],
  orderNote: ['notadeencomenda', 'notaencomenda', 'ne', 'ordernote', 'numerodanotadeencomenda'],
  caution: ['caucao', 'garantia', 'caution', 'valordacaucao'],
  dmInfo: ['dmaberturaedmadjudicacao', 'dmabertura', 'dmadjudicacao', 'dminfo', 'despachomanutencao'],
  pareceres: ['pareceres', 'pareceresjuridicos', 'parecer'],
  pareceresValorAcumulado: ['valoracumuladopagamentosdecorrentesdepareceresjuridicos', 'valoracumuladopareceres', 'valoracumuladopagamentos', 'pareceresvaloracumulado'],
  suspensoes: ['suspensoes', 'suspensoesdocontrato', 'suspensao'],
  novaDataFimContrato: ['novadatafimdocontrato', 'novadatafim', 'novadatafimcontrato'],
  revisoes: ['revisoes', 'revisoesdeprecos', 'revisao'],
  revisoesValorAcumulado: [
    'valoresacumuladosrevisoesdeprecos', 'valoresacumuladosrevisaodeprecos',
    'valoracumuladorevisoesdeprecos', 'valoracumuladorevisaodeprecos',
    'valoracumuladorevisoes', 'valorrevisoesprecos', 'revisoesvaloracumulado',
    'valoracumuladorevisao', 'valoresacumuladosrevisao'
  ],
  numeroRevisoesPrecos: ['numeroderevisoesdeprecos', 'numrevisoesprecos', 'numerorevisoesprecos', 'nrevisoesprecos', 'numeroderevisoes', 'numrevisoes'],
  incumprimentos: ['incumprimentosesancoes', 'incumprimentos', 'sancoes', 'incumprimento'],
  sancoesValorAcumulado: ['valoresacumuladosdesancoesaplicadas', 'valoresacumuladosdesancoes', 'valorsancoes', 'sancoesvaloracumulado', 'valoracumuladosancoes'],
  modificacoesObjetivas: ['modificacoesobjetivas', 'modificacoesobjectivas', 'modificacaoobjetiva', 'modificacaoobjectiva'],
  valorAcumuladoTrabalhosComplementares: ['valoracumuladotrabalhoscomplementaresamais', 'trabalhoscomplementares', 'trabalhosamais', 'valoracumuladotrabalhoscomplementares', 'trabalhoscomplementaresamais'],
  valorAcumuladoTrabalhosMenos: ['valoracumuladodetrabalhosamenos', 'trabalhosamenos', 'valortrabalhosamenos'],
  valorAcumuladoModificacoesExcluindo: ['valoracumuladomodificacoesexcluindotrabalhosamaisouamenos', 'modificacoesexcluindotrabalhos', 'modificacoesexcluindoamaisouamenos'],
  valorAcumuladoModificacoesObjetivas: [
    'valoracumuladomodificacoesobjetivas', 'valoracumuladomodificacoesobjectivas',
    'valoresacumuladosmodificacoesobjetivas', 'valoresacumuladosmodificacoesobjectivas',
    'modificacoesobjetivasvaloracumulado', 'modificacoesobjectivasvaloracumulado',
    'valoracumuladomodificacaoobjetiva', 'valoracumuladomodificacaoobjectiva'
  ],
  numeroAdendas: ['numerodeadendas', 'numadendas', 'nadendas', 'numeroadendas', 'adendas'],
  cessaoPosicaoContratual: ['cessaodaposicaocontratual', 'cessaoposicao', 'cessaoposicaocontratual'],
  subcontratacaoSujeitaAutorizacao: ['subcontratacaoquandosujeitaaautorizacao', 'subcontratacao', 'subcontratacaosujeitaaautorizacao'],
  extincaoCausa: ['causadatadmsancaoexecucaoobservacoes', 'causaextincao', 'extincao', 'causaextincaocontrato'],
  extincaoValor: ['valorassociado', 'valorextincao', 'extincaovalor', 'valorassociadoaextincao'],
  avaliacaoObservacoes: ['avaliacaoeobservacoes', 'avaliacao', 'observacoesavaliacao', 'avaliacaofornecedor'],
  comunicacoesObservacoes: ['comunicacoesimportanteseobservacoes', 'comunicacoes', 'observacoescomunicacoes', 'comunicacoesimportantes'],
  planosPagamentoFaturamentos: ['prazosepagamentoscontratados', 'planospagamento', 'pagamentoscontratados', 'planosdefaturacao'],
  prorrogacoesPrazos: ['prorrogacoesdeprazos', 'prorrogacoesprazos', 'prorrogacoes', 'prorrogacaodeprazos'],
  valorTotalDespesas: [
    'valortotaldedespesasaprovadacontratosadendasindemnizacoesjurosetc',
    'valortotaldedespesasaprovadas',
    'valortotaldedespesasaprovada',
    'valortotaldespesasaprovadas',
    'valortotaldespesas',
    'totaldespesasaprovadas',
    'totaldedespesasaprovadas',
    'despesasaprovadas',
    'totaldespesas',
    'valortotaldedespesa'
  ],
  valorTotalExecutado: [
    'valortotalexecutado',
    'valorexecutado',
    'totalexecutado',
    'executadototal',
    'executado',
    'montanteexecutado',
    'faturadototal',
    'totalfaturado',
    'valortotaldefaturacao'
  ],
  percentagem: ['percentagem', 'percentagemexecucao', 'percentagemexecutada', 'pct'],
  dataUltimaFaturacao: ['datadaultimavalidacao', 'dataultimafaturacao', 'ultimavalidacao', 'dataultimavalidacao', 'dataultimamedicao']
};

// Resolução rigorosa do campo de destino a partir do cabeçalho da coluna Excel
const resolveFieldKey = (colHeader: string): string | null => {
  const norm = normalizeHeader(colHeader);
  if (!norm) return null;

  // 1. CPV SEMPRE PRIMEIRO: evita qualquer colisão com a palavra "código"
  if (norm.includes('cpv')) {
    if (norm.includes('desc') || norm.includes('design')) {
      return 'cpvDescription';
    }
    return 'cpv';
  }

  // 2. Correspondência exata em qualquer sinónimo
  for (const [key, synonyms] of Object.entries(FIELD_SYNONYMS)) {
    if (synonyms.includes(norm)) {
      return key;
    }
  }

  // 3. Contactos e Morada (SEMPRE ANTES DE FORNECEDOR / COCONTRATANTE)
  if (
    norm.includes('contact') ||
    norm.includes('contat') ||
    norm.includes('morada') ||
    norm.includes('endereco') ||
    norm.includes('sede') ||
    norm.includes('telef') ||
    norm.includes('email') ||
    norm.includes('fax') ||
    norm.includes('website') ||
    norm.includes('site')
  ) {
    return 'vendorContacts';
  }

  // 4. Número de Fornecedor / NIF / NIPC / Credor
  if (
    norm.includes('nif') ||
    norm.includes('nipc') ||
    ((norm.includes('fornecedor') || norm.includes('vendor') || norm.includes('cocontratante') || norm.includes('credor') || norm.includes('adjudicatario')) &&
      (norm.includes('num') || norm.includes('numero') || norm.includes('cod') || norm.startsWith('n') || norm.includes('id') || norm.includes('conta')))
  ) {
    return 'vendorNumber';
  }

  // 5. Nome do Cocontratante / Fornecedor (apenas nome)
  if (
    norm.includes('cocontratante') ||
    norm.includes('fornecedor') ||
    norm.includes('adjudicatario') ||
    norm.includes('razaosocial') ||
    norm === 'empresa' ||
    norm === 'vendor'
  ) {
    return 'vendor';
  }

  // 6. Datas de Início e Fim do Contrato (Alta Prioridade)
  if (
    norm === 'datainiciocontrato' ||
    norm === 'datainciocontrato' ||
    norm === 'datadeiniciodocontrato' ||
    norm === 'datainicio' ||
    norm === 'dataincio' ||
    norm === 'datadeinicio' ||
    norm === 'iniciocontrato' ||
    norm === 'inciocontrato' ||
    norm === 'datainicial' ||
    norm === 'inicio' ||
    norm === 'incio' ||
    norm === 'startdate' ||
    norm === 'consignacao' ||
    norm === 'prazosdatainicio' ||
    norm === 'prazosnovadatainicio' ||
    ((norm.includes('inic') || norm.includes('incio')) && !norm.includes('procedimento') && !norm.includes('modific') && !norm.includes('suspens'))
  ) {
    return 'startDate';
  }

  if (
    norm === 'datafimcontrato' ||
    norm === 'datadefimdocontrato' ||
    norm === 'datafim' ||
    norm === 'datadefim' ||
    norm === 'fimcontrato' ||
    norm === 'datafinal' ||
    norm === 'fim' ||
    norm === 'conclusao' ||
    norm === 'enddate' ||
    norm === 'prazosdatafim' ||
    norm === 'prazosnovadatafim' ||
    ((norm.includes('fim') || norm.includes('conclu') || norm.includes('termo')) && !norm.includes('nov') && !norm.includes('prorrog') && !norm.includes('suspens') && !norm.includes('modific'))
  ) {
    return 'endDate';
  }

  // 7. Outras Datas
  if (norm.includes('data') || norm.includes('date')) {
    if (norm.includes('assin')) return 'signatureDate';
    if (norm.includes('nov') || norm.includes('prorrog')) return 'novaDataFimContrato';
    if (norm.includes('valid') || norm.includes('fatur') || norm.includes('medicao')) return 'dataUltimaFaturacao';
  }

  // 8. Procedimento / Contrato (Tipos)
  if (norm.includes('procedimento') && (norm.includes('tipo') || norm.includes('tipodeprocedimento'))) {
    return 'procedureType';
  }
  if (norm.includes('contrato') && norm.includes('tipo')) {
    return 'contractType';
  }

  // 9. Referência do Contrato / Procedimento / Processo (NUNCA CPV)
  if (
    norm.includes('referencia') ||
    norm.includes('codigodocontrato') ||
    norm.includes('codigocontrato') ||
    norm.includes('numcontrato') ||
    norm.includes('numerocontrato') ||
    norm.includes('refcontrato') ||
    norm.includes('refdocontrato') ||
    norm.includes('procedimentoaquisitivo') ||
    norm.includes('processoaquisitivo') ||
    norm === 'procedimento' ||
    norm.startsWith('ndoprocedimento') ||
    norm.startsWith('nprocedimento') ||
    norm.startsWith('ndeprocedimento') ||
    norm.startsWith('numerodoprocedimento') ||
    norm === 'processo' ||
    norm.startsWith('ndoprocesso') ||
    norm.startsWith('nprocesso') ||
    norm.startsWith('ndeprocesso') ||
    norm.startsWith('numerodoprocesso') ||
    norm === 'contrato' ||
    norm.startsWith('ncontrato') ||
    norm.startsWith('ndocontrato') ||
    norm.startsWith('ndecontrato') ||
    norm === 'ref' ||
    norm === 'code'
  ) {
    return 'code';
  }

  // 10. Objeto / Título
  if (norm.includes('objeto') || norm.includes('objecto') || norm.includes('designacao') || norm.includes('titulo')) {
    return 'title';
  }

  // 11. Valores financeiros específicos
  if (norm.includes('trabalhoscomp') || norm.includes('trabalhosamais')) return 'valorAcumuladoTrabalhosComplementares';
  if (norm.includes('trabalhosamenos')) return 'valorAcumuladoTrabalhosMenos';
  if (norm.includes('modificacoesexcluindo')) return 'valorAcumuladoModificacoesExcluindo';
  if (norm.includes('valoracumuladomodificacoes') || norm.includes('valoresacumuladosmodificacoes') || norm.includes('modificacoesobjetivasvalor') || norm.includes('modificacoesobjectivasvalor')) {
    return 'valorAcumuladoModificacoesObjetivas';
  }
  if (norm === 'modificacoesobjetivas' || norm === 'modificacoesobjectivas' || (norm.includes('modificac') && (norm.includes('objetiv') || norm.includes('objectiv')))) {
    return 'modificacoesObjetivas';
  }
  if (norm.includes('sancoes') || norm.includes('penalidades')) return 'sancoesValorAcumulado';
  if (norm.includes('revisoes') || norm.includes('revisao')) {
    if (norm.includes('num') || norm.includes('nº') || norm.startsWith('n')) return 'numeroRevisoesPrecos';
    if (norm.includes('valor') || norm.includes('acumulado')) return 'revisoesValorAcumulado';
    return 'revisoes';
  }
  if (norm.includes('pareceres')) {
    if (norm.includes('valor')) return 'pareceresValorAcumulado';
    return 'pareceres';
  }
  if (norm.includes('executado') || norm.includes('totalexecutado') || norm.includes('valorexecutado')) return 'valorTotalExecutado';
  if (norm.includes('totaldespesa') || norm.includes('totaldedespesa') || norm.includes('despesasaprovadas')) return 'valorTotalDespesas';
  if (norm.includes('precocontratual') || norm.includes('valorglobal') || norm === 'preco' || norm === 'montante') return 'contractualPrice';

  // 12. Fallback com prevenção estrita de colisão em 'code'
  for (const [key, synonyms] of Object.entries(FIELD_SYNONYMS)) {
    if (key === 'code') continue; // nunca aceitar via include genérico
    if (synonyms.some(s => norm.includes(s))) {
      return key;
    }
  }

  return null;
};

export const ImportModal = ({
  isOpen,
  onClose,
  isQuotaExceeded,
  existingContracts = [],
  onImportComplete,
  onImportSuccess,
  setToast
}: ImportModalProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ContractInput[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  
  // Opção de importação: 'update' (atualizar existentes por código e criar novos), 'create_only' (apenas novos), 'override_all' (tudo novo)
  const [importMode, setImportMode] = useState<'update' | 'skip_existing' | 'create_all'>('update');
  
  // Estado de execução do envio para a base de dados
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; percent: number }>({ current: 0, total: 0, percent: 0 });
  const [importSuccessResult, setImportSuccessResult] = useState<{
    inserted: number;
    updated: number;
    skipped: number;
    total: number;
  } | null>(null);

  // Download do ficheiro modelo padrão
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Referência do Contrato': 'CT-2026-001',
        'Número de Fornecedor': 'F00123',
        'Código CPV': '45000000-7',
        'Descrição CPV': 'Trabalhos de Construção',
        'Cocontratante': 'Construções & Engenharia Lda',
        'Objeto do contrato': 'Requalificação e manutenção do edifício central',
        'Data de assinatura do contrato': '2026-01-15',
        'Estado do contrato': 'Em execução',
        'Contrato no SharePoint': 'https://sharepoint.com/contrato1',
        'Edifício': 'Sede Principal',
        'Tipo de contrato': 'Empreitada de Obras Públicas',
        'Tipo de procedimento': 'Concurso público sem publicação no JOUE',
        'Contactos cocontratante': 'geral@construcoes.pt | 210 000 000',
        'D.M. abertura e D.M. adjudicação': 'DM-01/2026 de 05/01/2026',
        'Preço Contratual': '150 000,00 €',
        'Nota de encomenda': 'NE-450012',
        'Caução': '7 500,00 € (Garantia Bancária nº 9876)',
        'Direção com a gestão técnica': 'Direção de Instalações e Equipamentos',
        'Gestor': 'Eng. Manuel Rocha',
        'Pareceres': 'Parecer favorável da assessoria jurídica nº PJ-2026/01',
        'Valor acumulado pagamentos decorrentes de pareceres jurídicos': '0,00 €',
        'Suspensões': '',
        'Nova data fim do contrato': '',
        'Revisões': '',
        'Valores acumulados revisões de preços': '0,00 €',
        'Numero de revisões de Preços': '',
        'Incumprimentos e sanções': '',
        'Valores acumulados de sanções aplicadas': '0,00 €',
        'Modificações objetivas': '',
        'Valor acumulado trabalhos complementares/a mais': '0,00 €',
        'Valor acumulado de trabalhos a menos': '0,00 €',
        'Valor acumulado modificações excluindo trabalhos a mais ou a menos': '0,00 €',
        'Valor acumulado modificações objetivas': '0,00 €',
        'Numero de Adendas': '0',
        'Cessão da Posição Contratual': '',
        'Subcontratação (quando sujeita a autorização)': '',
        'Causa, data, D.M., sanção, execução, observações': '',
        'Valor associado': '0,00 €',
        'Avaliação e observações': 'Bom desempenho técnico e cumprimento de prazos',
        'Comunicações importantes e observações': 'Comunicações periódicas realizadas por correio eletrónico',
        'Data início contrato': '2026-02-01',
        'Data fim contrato': '2026-12-31',
        'Prazos e Pagamentos Contratados': 'Pagamento a 30 dias após validação do auto de medição mensal',
        'Prorrogações de Prazos': '',
        'Valor total de despesas aprovada(contratos, adendas, indemnizações, juros, etc.)': '150 000,00 €',
        'Valor Total Executado': '25 000,00 €',
        'Percentagem': '16.67 %',
        'Data da Ultima Validação': '2026-03-01',
        'Marco 1 - Descrição': 'Auto de Medição nº 1 - Demolições e preparação',
        'Marco 1 - Data (Dia/Mês/Ano)': '15/02/2026',
        'Marco 1 - NE': 'NE-450012',
        'Marco 1 - Valor Validado': '12 500,00 €',
        'Marco 2 - Descrição': 'Auto de Medição nº 2 - Alvenarias e infraestruturas',
        'Marco 2 - Data (Dia/Mês/Ano)': '15/03/2026',
        'Marco 2 - NE': 'NE-450012',
        'Marco 2 - Valor Validado': '12 500,00 €'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contratos');
    XLSX.writeFile(wb, 'modelo_importacao_contratos.xlsx');
  };

  // Processamento do ficheiro carregado
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    processFile(selectedFile);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFile = e.dataTransfer.files?.[0];
    if (!droppedFile) return;
    processFile(droppedFile);
  };

  const processFile = (fileToProcess: File) => {
    setFile(fileToProcess);
    setParseError(null);
    setParsedRows([]);
    setImportSuccessResult(null);
    setIsParsing(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        setWorkbook(wb);
        setSheetNames(wb.SheetNames);
        
        // Selecionar por defeito a folha 'Contratos' se existir, senão a primeira
        const defaultSheet = wb.SheetNames.find(name => 
          name.toLowerCase().includes('contrato') || name.toLowerCase().includes('dados')
        ) || wb.SheetNames[0];
        
        setSelectedSheet(defaultSheet);
        parseSheet(wb, defaultSheet);
      } catch (err: any) {
        console.error('Erro ao ler ficheiro Excel:', err);
        setParseError(`Não foi possível processar o ficheiro Excel: ${err.message || 'Formato inválido'}`);
        setIsParsing(false);
      }
    };
    reader.onerror = () => {
      setParseError('Falha ao ler o ficheiro.');
      setIsParsing(false);
    };
    reader.readAsBinaryString(fileToProcess);
  };

  // Conversão das linhas da folha em objetos de Contrato
  const parseSheet = useCallback((wb: XLSX.WorkBook, sheetName: string) => {
    try {
      setIsParsing(true);
      setParseError(null);
      const ws = wb.Sheets[sheetName];
      if (!ws) {
        setParseError('Folha selecionada não encontrada.');
        setIsParsing(false);
        return;
      }

      // Converte para array de objetos (cada linha = { header: value })
      const rawJson = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
      if (rawJson.length === 0) {
        setParseError('A folha selecionada não contém linhas com dados.');
        setIsParsing(false);
        return;
      }

      // Se existir uma folha separada de "Marcos de Faturação / Autos", processá-la em paralelo
      const milestonesByContractCode: Record<string, any[]> = {};
      const milestoneSheetName = wb.SheetNames.find(s => {
        const n = normalizeHeader(s);
        return n.includes('marcos') || n.includes('milestone') || n.includes('auto') || n.includes('medicao') || n.includes('medicoes') || n.includes('faturacao');
      });
      if (milestoneSheetName && milestoneSheetName !== sheetName) {
        const msSheet = wb.Sheets[milestoneSheetName];
        if (msSheet) {
          const msRows = XLSX.utils.sheet_to_json<Record<string, any>>(msSheet, { defval: '' });
          msRows.forEach(row => {
            let refCode = '';
            let desc = '';
            let mesAno = '';
            let ne = '';
            let valor = '';

            Object.entries(row).forEach(([colHeader, colVal]) => {
              const norm = normalizeHeader(colHeader);
              const valStr = String(colVal || '').trim();
              if (norm.includes('referencia') || norm.includes('codigo') || norm === 'ref') {
                refCode = valStr;
              } else if (norm.includes('descricao')) {
                desc = valStr;
              } else if (norm.includes('mes') || norm.includes('ano') || norm.includes('data')) {
                mesAno = formatDatePt(colVal);
              } else if (norm === 'ne' || norm.includes('numero') || norm.includes('notaencomenda')) {
                ne = valStr;
              } else if (norm.includes('valor')) {
                valor = valStr;
              }
            });

            if (refCode && (desc || valor)) {
              if (!milestonesByContractCode[refCode]) {
                milestonesByContractCode[refCode] = [];
              }
              milestonesByContractCode[refCode].push({
                descricao: desc,
                dataFatura: mesAno,
                numero: ne,
                valorFaturado: valor
              });
            }
          });
        }
      }

      // Mapeamento linha a linha
      const mappedContracts: ContractInput[] = rawJson.map((row, index) => {
        const contract: Record<string, any> = {
          code: '',
          title: '',
          vendor: '',
          vendorNumber: '',
          vendorContacts: '',
          phase: 'Aguarda Consignação/PSS',
          contractualPrice: '',
          price: '',
          globalValue: 0,
          cpv: '',
          cpvDescription: '',
          procedureType: '',
          contractType: '',
          signatureDate: '',
          startDate: '',
          endDate: '',
          manager: '',
          technicalManagementDirection: '',
          building: '',
          sharepointLink: '',
          linkPD: '',
          orderNote: '',
          caution: '',
          dmInfo: '',
          pareceres: '',
          pareceresValorAcumulado: '',
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
          planosPagamentoFaturamentos: '',
          prorrogacoesPrazos: '',
          valorTotalDespesas: '0,00 €',
          valorTotalExecutado: '0,00 €',
          percentagem: '',
          dataUltimaFaturacao: '',
          prazosMilestones: [],
          isWritten: true,
          deleted: false
        };

        const inlineMilestonesMap: Record<number, { descricao?: string; dataFatura?: string; numero?: string; valorFaturado?: string }> = {};

        // Percorrer cada coluna da linha e correlacionar com o dicionário de campos
        Object.entries(row).forEach(([colHeader, rawValue]) => {
          if (rawValue === null || rawValue === undefined || rawValue === '') return;
          const norm = normalizeHeader(colHeader);

          // Verificar se é coluna de marco ou auto dinâmico (ex: "Auto 1", "Auto de Medição 1", "Marco 1", "Medição 1")
          const marcoMatch = colHeader.match(/(?:marco|auto(?:\s+de\s+medicao)?|medicao|faturacao|prestacao)\s*[-_]?\s*(\d+)(?:[-_]?\s*(.*))?/i);
          if (marcoMatch) {
            const marcoIdx = parseInt(marcoMatch[1], 10);
            const marcoSubfield = normalizeHeader(marcoMatch[2] || '');
            if (!inlineMilestonesMap[marcoIdx]) {
              inlineMilestonesMap[marcoIdx] = {};
            }
            if (marcoSubfield.includes('desc')) {
              inlineMilestonesMap[marcoIdx].descricao = String(rawValue).trim();
            } else if (marcoSubfield.includes('mes') || marcoSubfield.includes('ano') || marcoSubfield.includes('data')) {
              inlineMilestonesMap[marcoIdx].dataFatura = formatDatePt(rawValue) || String(rawValue).trim();
            } else if (marcoSubfield.includes('ne') || marcoSubfield.includes('num')) {
              inlineMilestonesMap[marcoIdx].numero = String(rawValue).trim();
            } else if (marcoSubfield.includes('valor') || !marcoSubfield) {
              const curr = parseExcelCurrency(rawValue);
              inlineMilestonesMap[marcoIdx].valorFaturado = curr.formatted || String(rawValue).trim();
              if (!inlineMilestonesMap[marcoIdx].descricao) {
                inlineMilestonesMap[marcoIdx].descricao = `Auto de Medição nº ${marcoIdx}`;
              }
            }
            return;
          }

          // Procurar correspondência rigorosa e disambiguada
          const targetKey = resolveFieldKey(colHeader);
          if (targetKey) {
            // Tratamento específico de tipo de dado
            if (['signatureDate', 'startDate', 'endDate', 'novaDataFimContrato', 'dataUltimaFaturacao'].includes(targetKey)) {
              const parsedDate = parseExcelDate(rawValue);
              contract[targetKey] = parsedDate;
              if (targetKey === 'startDate') {
                contract.prazosNovaDataInicio = parsedDate;
                contract.prazosDataInicio = parsedDate;
                contract.Datainiciocontrato = parsedDate;
              }
              if (targetKey === 'endDate') {
                contract.prazosNovaDataFim = parsedDate;
                contract.prazosDataFim = parsedDate;
                contract.DataFimContrato = parsedDate;
                contract.novaDataFimContrato = parsedDate;
              }
            } else if (['contractualPrice', 'price'].includes(targetKey)) {
              const curr = parseExcelCurrency(rawValue);
              contract.contractualPrice = curr.formatted;
              contract.price = curr.formatted;
              contract.globalValue = curr.numeric;
              if (!contract.valorTotalExecutado || contract.valorTotalExecutado === '0,00 €') {
                contract.valorTotalExecutado = curr.formatted;
                contract.executedValue = curr.numeric;
              }
            } else if ([
              'valorTotalExecutado',
              'valorTotalDespesas',
              'pareceresValorAcumulado',
              'revisoesValorAcumulado',
              'sancoesValorAcumulado',
              'valorAcumuladoTrabalhosComplementares',
              'valorAcumuladoTrabalhosMenos',
              'valorAcumuladoModificacoesExcluindo',
              'valorAcumuladoModificacoesObjetivas',
              'extincaoValor'
            ].includes(targetKey)) {
              const curr = parseExcelCurrency(rawValue);
              contract[targetKey] = curr.formatted;
              if (targetKey === 'valorTotalExecutado') {
                contract.executedValue = curr.numeric;
                contract.consumption = curr.numeric;
                if (!contract.globalValue && !contract.contractualPrice) {
                  contract.globalValue = curr.numeric;
                  contract.contractualPrice = curr.formatted;
                  contract.price = curr.formatted;
                }
              } else if (targetKey === 'valorTotalDespesas') {
                contract.approvedExpenses = curr.numeric;
              } else if (targetKey === 'valorAcumuladoModificacoesObjetivas') {
                contract.objectiveModifications = curr.numeric;
                contract.modificationValue = curr.numeric;
              } else if (targetKey === 'revisoesValorAcumulado') {
                contract.priceRevision = curr.numeric;
                contract.revisionValue = curr.numeric;
              }
            } else {
              contract[targetKey] = String(rawValue).trim();
              if (targetKey === 'title' && !contract.object) {
                contract.object = String(rawValue).trim();
              }
            }
          }
        });

        // Heurística de correção inteligente de CPV:
        // Se por qualquer razão o campo `code` recebeu um padrão típico de CPV (ex: 45454100-5)
        const isCpvPattern = /^\d{8}(-\d)?$/.test(String(contract.code || '').trim());
        if (isCpvPattern) {
          if (!contract.cpv) {
            contract.cpv = String(contract.code).trim();
          }
          // Se o code for idêntico ao CPV (porque a coluna tinha apenas CPV), gera referência de contrato
          if (contract.code.trim() === contract.cpv.trim()) {
            contract.code = `CT-${Date.now().toString().slice(-6)}-${index + 1}`;
          }
        }

        // Heurística de correção inteligente para Cocontratante vs Contactos:
        // Se o campo `vendor` contiver morada/telefone/email (ex: "Morada: Rua ... Telf ... Email ...")
        if (looksLikeContacts(contract.vendor)) {
          if (!contract.vendorContacts) {
            contract.vendorContacts = String(contract.vendor).trim();
          }
          contract.vendor = 'N/A';
        }

        // Se vendorNumber estiver vazio, tenta extrair NIF de vendorContacts ou vendor
        if (!contract.vendorNumber) {
          const combined = `${contract.vendor || ''} ${contract.vendorContacts || ''}`;
          const nifMatch = combined.match(/(?:nif|nipc)[:\s]*([1235689]\d{8})/i) ||
                           String(contract.vendorContacts || '').match(/\b([1235689]\d{8})\b/);
          if (nifMatch) {
            contract.vendorNumber = nifMatch[1];
          }
        }

        // Garantir dados mínimos essenciais
        if (!contract.code) {
          contract.code = `CT-${Date.now().toString().slice(-6)}-${index + 1}`;
        }
        if (!contract.title) {
          contract.title = contract.object || contract.code || `Contrato ${index + 1}`;
        }
        if (!contract.vendor) {
          contract.vendor = 'N/A';
        }

        // Montar lista de marcos (inline ou vinda da folha separada)
        const combinedMilestones: any[] = [];
        Object.keys(inlineMilestonesMap)
          .map(Number)
          .sort((a, b) => a - b)
          .forEach(idx => {
            const m = inlineMilestonesMap[idx];
            if (m.descricao || m.valorFaturado) {
              combinedMilestones.push({
                descricao: m.descricao || '',
                dataFatura: m.dataFatura || '',
                numero: m.numero || '',
                valorFaturado: m.valorFaturado || ''
              });
            }
          });

        if (milestonesByContractCode[contract.code]) {
          combinedMilestones.push(...milestonesByContractCode[contract.code]);
        }

        // Preencher slots até 60 para compatibilidade total com o formulário de edição
        const finalMilestones = Array.from({ length: 60 }, (_, i) => {
          if (combinedMilestones[i]) {
            return {
              descricao: combinedMilestones[i].descricao || '',
              dataFatura: combinedMilestones[i].dataFatura || '',
              numero: combinedMilestones[i].numero || '',
              valorFaturado: combinedMilestones[i].valorFaturado || ''
            };
          }
          return { descricao: '', dataFatura: '', numero: '', valorFaturado: '' };
        });

        contract.prazosMilestones = finalMilestones;
        if (combinedMilestones.length > 0 && (!contract.valorTotalExecutado || contract.valorTotalExecutado === '0,00 €')) {
          const sumMilestones = combinedMilestones.reduce((acc, m) => acc + parseExcelCurrency(m.valorFaturado).numeric, 0);
          contract.valorTotalExecutado = sumMilestones.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u00A0/g, ' ') + ' €';
          contract.executedValue = sumMilestones;
        }

        // Garantir sincronização e formato ISO rigoroso (AAAA-MM-DD) para todas as datas de início e fim do contrato
        const rawStart = contract.prazosNovaDataInicio || contract.prazosDataInicio || contract.startDate || contract.Datainiciocontrato || '';
        const rawEnd = contract.prazosNovaDataFim || contract.prazosDataFim || contract.endDate || contract.DataFimContrato || contract.novaDataFimContrato || '';

        if (rawStart) {
          const isoS = parseExcelDate(rawStart);
          contract.startDate = isoS;
          contract.prazosNovaDataInicio = isoS;
          contract.prazosDataInicio = isoS;
          contract.Datainiciocontrato = isoS;
        }
        if (rawEnd) {
          const isoE = parseExcelDate(rawEnd);
          contract.endDate = isoE;
          contract.prazosNovaDataFim = isoE;
          contract.prazosDataFim = isoE;
          contract.DataFimContrato = isoE;
          contract.novaDataFimContrato = isoE;
        }

        return contract;
      });

      setParsedRows(mappedContracts);
      setIsParsing(false);
    } catch (err: any) {
      console.error('Erro ao processar folha:', err);
      setParseError(`Erro no processamento dos dados: ${err.message || 'Falha desconhecida'}`);
      setIsParsing(false);
    }
  }, []);

  const handleSheetChange = (sheetName: string) => {
    setSelectedSheet(sheetName);
    if (workbook) {
      parseSheet(workbook, sheetName);
    }
  };

  // Comparação com contratos existentes para estatísticas
  const existingCodesMap = new Map<string, Contract>();
  existingContracts.forEach(c => {
    if (c.code) {
      existingCodesMap.set(c.code.trim().toLowerCase(), c);
    }
  });

  const rowStatusList = parsedRows.map(row => {
    const code = String(row.code || '').trim().toLowerCase();
    const isExisting = existingCodesMap.has(code);
    return {
      row,
      isExisting,
      existingDoc: isExisting ? existingCodesMap.get(code) : null
    };
  });

  const newCount = rowStatusList.filter(item => !item.isExisting).length;
  const existingCount = rowStatusList.filter(item => item.isExisting).length;

  // Execução da importação em lotes (batch writes) para o Firestore
  const handleExecuteImport = async () => {
    if (parsedRows.length === 0 || isImporting) return;
    if (isQuotaExceeded) {
      setToast?.({ message: 'A quota do Firebase está esgotada no momento.', type: 'error' });
      return;
    }

    setIsImporting(true);
    setProgress({ current: 0, total: parsedRows.length, percent: 0 });

    try {
      const now = new Date().toISOString();
      let insertedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      // Filtrar registos de acordo com o modo escolhido
      const itemsToProcess = rowStatusList.filter(item => {
        if (importMode === 'skip_existing' && item.isExisting) {
          skippedCount++;
          return false;
        }
        return true;
      });

      // Tamanho do lote (Firestore permite até 500 por batch)
      const BATCH_SIZE = 250;
      const totalBatches = Math.ceil(itemsToProcess.length / BATCH_SIZE);
      const allSavedContracts: Contract[] = [];
      const updatedExistingIds: string[] = [];

      for (let b = 0; b < totalBatches; b++) {
        const batch = writeBatch(db);
        const batchItems = itemsToProcess.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);

        for (const item of batchItems) {
          const contractData = {
            ...item.row,
            updatedAt: now,
            deleted: false
          };

          if (item.isExisting && item.existingDoc && importMode === 'update') {
            // Atualizar documento existente mantendo o ID
            const targetId = item.existingDoc.id;
            const docRef = doc(db, 'contracts', targetId);
            const sanitized = sanitizeForFirestore({
              ...item.existingDoc,
              ...contractData,
              updatedAt: now
            });
            batch.update(docRef, sanitized);
            updatedCount++;
            updatedExistingIds.push(targetId);
            allSavedContracts.push({
              id: targetId,
              ...sanitized
            } as Contract);
          } else {
            // Inserir novo documento
            const newDocRef = doc(collection(db, 'contracts'));
            const targetId = newDocRef.id;
            const sanitized = sanitizeForFirestore({
              ...contractData,
              id: targetId,
              createdAt: now,
              updatedAt: now
            });
            batch.set(newDocRef, sanitized);
            insertedCount++;
            allSavedContracts.push({
              id: targetId,
              ...sanitized
            } as Contract);
          }
        }

        // Grava lote no Firestore
        await batch.commit();

        const processedSoFar = Math.min((b + 1) * BATCH_SIZE, itemsToProcess.length);
        setProgress({
          current: processedSoFar,
          total: itemsToProcess.length,
          percent: Math.round((processedSoFar / itemsToProcess.length) * 100)
        });
      }

      setImportSuccessResult({
        inserted: insertedCount,
        updated: updatedCount,
        skipped: skippedCount,
        total: insertedCount + updatedCount
      });

      setToast?.({
        message: `Importação concluída! ${insertedCount} novos contratos e ${updatedCount} atualizados.`,
        type: 'success'
      });

      // Atualiza o estado da tabela imediatamente na aplicação principal
      onImportSuccess?.(allSavedContracts, updatedExistingIds);
      onImportComplete?.(insertedCount + updatedCount);
    } catch (err: any) {
      console.error('Erro durante importação para a base de dados:', err);
      const errMsg = err?.message || 'Falha ao guardar dados no Firestore.';
      setToast?.({
        message: `Erro na importação: ${errMsg}`,
        type: 'error'
      });
      setParseError(`Erro durante a gravação na base de dados: ${errMsg}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setWorkbook(null);
    setSheetNames([]);
    setSelectedSheet('');
    setParsedRows([]);
    setParseError(null);
    setImportSuccessResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-light text-brand-dark flex items-center justify-center border border-brand">
              <Upload size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Importar Contratos via Excel</h2>
              <p className="text-xs text-slate-500">Povoar ou atualizar a base de dados a partir de ficheiros .xlsx, .xls ou .csv</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isImporting}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Sucesso final */}
          {importSuccessResult ? (
            <div className="py-8 text-center space-y-6">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200 shadow-xs">
                <CheckCircle2 size={32} />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-slate-900">Importação Concluída com Sucesso!</h3>
                <p className="text-sm text-slate-600 max-w-md mx-auto">
                  A base de dados foi povoada com os dados do ficheiro Excel. Todos os dados já se encontram visíveis na tabela principal.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto pt-2">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="text-2xl font-bold text-emerald-600">{importSuccessResult.inserted}</div>
                  <div className="text-xs text-slate-500 font-medium mt-0.5">Novos Inseridos</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="text-2xl font-bold text-blue-600">{importSuccessResult.updated}</div>
                  <div className="text-xs text-slate-500 font-medium mt-0.5">Atualizados</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="text-2xl font-bold text-slate-600">{importSuccessResult.skipped}</div>
                  <div className="text-xs text-slate-500 font-medium mt-0.5">Ignorados</div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors"
                >
                  Importar Outro Ficheiro
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-brand text-slate-900 font-medium text-sm hover:bg-brand-dark transition-colors shadow-sm"
                >
                  Concluir e Ver Contratos
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Zona de Carregamento e Seleção */}
              {!file ? (
                <div className="space-y-4">
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-brand-dark rounded-3xl p-10 text-center cursor-pointer bg-slate-50/50 hover:bg-brand-light/30 transition-all group"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mx-auto text-brand-dark group-hover:scale-110 transition-transform">
                      <FileSpreadsheet size={32} />
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-slate-800">
                      Clique para escolher ou arraste o ficheiro Excel aqui
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Formatos suportados: .xlsx, .xls, .csv (compatível com exportações deste sistema)
                    </p>
                  </div>

                  {/* Banner de Ajuda / Download de Modelo */}
                  <div className="flex items-center justify-between p-4 bg-blue-50/70 border border-blue-100 rounded-2xl text-blue-900">
                    <div className="flex items-center gap-3">
                      <HelpCircle size={20} className="text-blue-600 shrink-0" />
                      <div className="text-xs">
                        <span className="font-semibold">Precisa de um modelo estruturado?</span>
                        <p className="text-blue-700">Descarregue o modelo Excel com todos os campos e colunas predefinidas.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadTemplate}
                      className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-blue-50 text-blue-700 text-xs font-semibold rounded-xl border border-blue-200 transition-colors shadow-2xs shrink-0"
                    >
                      <Download size={15} />
                      Descarregar Modelo
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Ficheiro selecionado e Folha */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                        <FileCheck size={22} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{file.name}</div>
                        <div className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {sheetNames.length > 1 && (
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-medium text-slate-600">Folha:</label>
                          <select
                            value={selectedSheet}
                            onChange={(e) => handleSheetChange(e.target.value)}
                            disabled={isImporting}
                            className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-brand font-medium"
                          >
                            {sheetNames.map(sheet => (
                              <option key={sheet} value={sheet}>{sheet}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={handleReset}
                        disabled={isImporting}
                        className="text-xs text-slate-500 hover:text-red-600 font-medium px-2 py-1 transition-colors"
                      >
                        Trocar ficheiro
                      </button>
                    </div>
                  </div>

                  {/* Mensagem de Erro de Parsing se houver */}
                  {parseError && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-700 text-sm">
                      <AlertCircle size={20} className="shrink-0 text-red-500" />
                      <span>{parseError}</span>
                    </div>
                  )}

                  {/* Resumo e Opções de Importação */}
                  {parsedRows.length > 0 && !isImporting && (
                    <div className="space-y-4">
                      {/* Cartões com Contadores */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                          <div className="text-xs font-medium text-slate-500">Linhas no Excel</div>
                          <div className="text-xl font-bold text-slate-800 mt-0.5">{parsedRows.length}</div>
                        </div>
                        <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-2xl">
                          <div className="text-xs font-medium text-emerald-700">Novos Contratos</div>
                          <div className="text-xl font-bold text-emerald-700 mt-0.5">{newCount}</div>
                        </div>
                        <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-2xl">
                          <div className="text-xs font-medium text-blue-700">Existentes na Base de Dados</div>
                          <div className="text-xl font-bold text-blue-700 mt-0.5">{existingCount}</div>
                        </div>
                      </div>

                      {/* Modo de Importação */}
                      <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
                        <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                          Comportamento para Contratos Existentes (Correspondência por Código)
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                          <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${importMode === 'update' ? 'bg-brand-light/30 border-brand text-slate-900 font-medium' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}>
                            <input
                              type="radio"
                              name="importMode"
                              value="update"
                              checked={importMode === 'update'}
                              onChange={() => setImportMode('update')}
                              className="mt-0.5 text-brand"
                            />
                            <div>
                              <div className="font-semibold">Atualizar e Inserir</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">Atualiza existentes e insere novos</div>
                            </div>
                          </label>

                          <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${importMode === 'skip_existing' ? 'bg-brand-light/30 border-brand text-slate-900 font-medium' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}>
                            <input
                              type="radio"
                              name="importMode"
                              value="skip_existing"
                              checked={importMode === 'skip_existing'}
                              onChange={() => setImportMode('skip_existing')}
                              className="mt-0.5 text-brand"
                            />
                            <div>
                              <div className="font-semibold">Apenas Novos</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">Ignora códigos já existentes</div>
                            </div>
                          </label>

                          <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${importMode === 'create_all' ? 'bg-brand-light/30 border-brand text-slate-900 font-medium' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}>
                            <input
                              type="radio"
                              name="importMode"
                              value="create_all"
                              checked={importMode === 'create_all'}
                              onChange={() => setImportMode('create_all')}
                              className="mt-0.5 text-brand"
                            />
                            <div>
                              <div className="font-semibold">Inserir Todos</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">Trata tudo como novo registo</div>
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* Pré-visualização da Tabela */}
                      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                        <div className="px-4 py-2.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
                          <span className="font-semibold uppercase tracking-wider">Pré-visualização dos Primeiros 5 Registos</span>
                          <span>A mostrar {Math.min(5, parsedRows.length)} de {parsedRows.length}</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                                <th className="py-2.5 px-3">Estado</th>
                                <th className="py-2.5 px-3">Referência</th>
                                <th className="py-2.5 px-3">Objeto / Título</th>
                                <th className="py-2.5 px-3">Cocontratante</th>
                                <th className="py-2.5 px-3">Fase</th>
                                <th className="py-2.5 px-3 text-right">Preço Contratual</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                              {rowStatusList.slice(0, 5).map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/60">
                                  <td className="py-2 px-3">
                                    {item.isExisting ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                        Existente
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        Novo
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 font-semibold text-slate-800">{item.row.code}</td>
                                  <td className="py-2 px-3 text-slate-700 max-w-xs truncate" title={item.row.title}>
                                    {item.row.title}
                                  </td>
                                  <td className="py-2 px-3 text-slate-600 truncate max-w-[150px]" title={item.row.vendor}>
                                    {item.row.vendor}
                                  </td>
                                  <td className="py-2 px-3 text-slate-600 truncate max-w-[120px]">
                                    {item.row.phase}
                                  </td>
                                  <td className="py-2 px-3 text-right font-medium text-slate-900">
                                    {item.row.price || item.row.contractualPrice || '0,00 €'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Estado de progresso da importação */}
                  {isImporting && (
                    <div className="py-8 px-6 bg-slate-50 border border-slate-200 rounded-3xl text-center space-y-4">
                      <div className="w-12 h-12 bg-brand-light text-brand-dark rounded-2xl flex items-center justify-center mx-auto border border-brand animate-spin">
                        <RefreshCw size={24} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-base font-bold text-slate-900">A Gravar Contratos na Base de Dados...</h4>
                        <p className="text-xs text-slate-500">
                          A sincronizar em tempo real com o Firestore ({progress.current} de {progress.total} registos processados)
                        </p>
                      </div>

                      {/* Barra de Progresso */}
                      <div className="w-full max-w-md mx-auto bg-slate-200 rounded-full h-3 overflow-hidden p-0.5">
                        <div
                          className="bg-brand h-full rounded-full transition-all duration-300 shadow-xs"
                          style={{ width: `${progress.percent}%` }}
                        />
                      </div>
                      <div className="text-xs font-semibold text-slate-600">{progress.percent}%</div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!importSuccessResult && (
          <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              disabled={isImporting}
              className="px-4 py-2 text-slate-600 hover:text-slate-900 text-sm font-medium transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>

            {file && parsedRows.length > 0 && !isImporting && (
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={isQuotaExceeded || isImporting}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand hover:bg-brand-dark text-slate-900 text-sm font-semibold rounded-2xl transition-all shadow-md shadow-brand/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Database size={16} />
                Gravar {parsedRows.length} Contratos na Base de Dados
              </button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};
