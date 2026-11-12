/* =============================================================================
   CTC App Standard — funcionalidades.js
   Versao: 1.4.0 (1.1.0: secao 07 — acesso, senhas e base JSON;
                  1.3.0: secao 08 — senha cifrada, imagem da logo, armazenamento de versoes;
                  1.4.0: secao 09 — nuvem Firebase configuravel pelo administrador)
   Modulo ES sem dependencias. Pode ser usado sozinho (sem componentes.js).

   CONTEUDO
   01. Texto e utilidades gerais   normalizarTexto, escaparHtml, gerarId, debounce, obterValor
   02. Numeros e moeda (pt-BR)     paraNumero, formatarNumero, formatarMoeda,
                                   formatarMoedaCompacta, formatarPercentual
   03. Datas                       paraData, dataDeSerialExcel, formatarData,
                                   adicionarMeses, listarMeses, diferencaEmMeses
   04. Pesquisa, filtros, ordenacao pesquisar, filtrar, valoresUnicos, compararValores,
                                   ordenar, paginar, aplicarConsulta, somar, agruparPor
   05. Validacao                   validarCPF, validarCNPJ, validarValor,
                                   obterValoresFormulario, preencherFormulario,
                                   validarFormulario, limparErros, definirErroCampo
   06. Notificacoes (toast)        notificar, toast
   07. Acesso e base de dados      gerarHash, gerarSal, normalizarLogin, criarCredencial,
                                   verificarSenha, lerArquivoJSON, baixarJSON,
                                   criarBaseVazia, validarBase, prepararBaseParaSalvar,
                                   nomeArquivoBase, criarSessao, protegerSaida
   08. Cifra, imagem e versoes     criptografiaDisponivel, cifrarTexto, decifrarTexto,
                                   lerImagemComoDataURL, criarArmazenamentoNavegador
   09. Nuvem (Firebase)            interpretarConfigFirebase, criarArmazenamentoFirebase,
                                   criarArmazenamentoNuvem

   Convencao: nomes de funcoes em portugues; valores de "tipo/variante" iguais
   aos modificadores do design-system.css (success, danger, warning, info).
   ========================================================================== */

const LOCALE = 'pt-BR';


/* =============================================================================
   01. TEXTO E UTILIDADES GERAIS
   ========================================================================== */

/** Remove acentos, converte para minusculas e apara espacos. Usado na pesquisa. */
export function normalizarTexto(valor) {
  if (valor == null) return '';
  return String(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Escapa caracteres especiais de HTML (para quando for inevitavel usar innerHTML). */
export function escaparHtml(valor) {
  const mapa = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(valor ?? '').replace(/[&<>"']/g, (c) => mapa[c]);
}

let contadorId = 0;
/** Gera um id unico na pagina (ex.: para ligar label e input). */
export function gerarId(prefixo = 'ctc') {
  contadorId += 1;
  return `${prefixo}-${Date.now().toString(36)}-${contadorId}`;
}

/**
 * Atrasa a execucao de uma funcao ate o usuario parar de digitar.
 * Retorna uma funcao com o metodo .cancelar().
 */
export function debounce(funcao, espera = 250) {
  let timer = null;
  const executar = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => funcao(...args), espera);
  };
  executar.cancelar = () => clearTimeout(timer);
  return executar;
}

/**
 * Le um valor de um objeto por caminho ("cliente.nome") ou por funcao (linha => ...).
 */
export function obterValor(objeto, caminho) {
  if (typeof caminho === 'function') return caminho(objeto);
  if (caminho == null) return undefined;
  return String(caminho)
    .split('.')
    .reduce((atual, chave) => (atual == null ? undefined : atual[chave]), objeto);
}


/* =============================================================================
   02. NUMEROS E MOEDA (pt-BR)
   ========================================================================== */

const cacheFormatadores = new Map();
function formatador(opcoes) {
  const chave = JSON.stringify(opcoes);
  if (!cacheFormatadores.has(chave)) {
    cacheFormatadores.set(chave, new Intl.NumberFormat(LOCALE, opcoes));
  }
  return cacheFormatadores.get(chave);
}

/**
 * Converte texto em numero, aceitando o formato brasileiro.
 *   "1.234,56" -> 1234.56     "R$ 1.234,56" -> 1234.56     "12,5%" -> 12.5
 *   "(1.234,56)" -> -1234.56  "1.234" -> 1234 (ponto como milhar)   "1.5" -> 1.5
 * Retorna null quando o valor nao e numerico.
 */
export function paraNumero(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  if (valor == null) return null;
  let texto = String(valor).trim();
  if (texto === '') return null;

  let negativo = false;
  if (/^\(.*\)$/.test(texto)) {
    negativo = true;
    texto = texto.slice(1, -1);
  }
  texto = texto.replace(/R\$|%|\s|\u00a0/g, '');

  if (texto.includes(',')) {
    texto = texto.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(texto)) {
    texto = texto.replace(/\./g, '');
  }

  if (!/^-?\d*\.?\d+$/.test(texto)) return null;
  const numero = Number(texto);
  if (!Number.isFinite(numero)) return null;
  return negativo ? -numero : numero;
}

/**
 * Formata numero no padrao brasileiro.
 * casas: numero fixo de casas decimais. Sem casas: ate 2 casas, sem zeros a direita.
 */
export function formatarNumero(valor, casas, { vazio = '—' } = {}) {
  const numero = paraNumero(valor);
  if (numero == null) return vazio;
  const opcoes = casas == null
    ? { minimumFractionDigits: 0, maximumFractionDigits: 2 }
    : { minimumFractionDigits: casas, maximumFractionDigits: casas };
  return formatador(opcoes).format(numero);
}

/** Formata em Real: 1234.5 -> "R$ 1.234,50". simbolo:false -> "1.234,50". */
export function formatarMoeda(valor, { casas = 2, simbolo = true, vazio = '—' } = {}) {
  const numero = paraNumero(valor);
  if (numero == null) return vazio;
  const opcoes = simbolo
    ? { style: 'currency', currency: 'BRL', minimumFractionDigits: casas, maximumFractionDigits: casas }
    : { minimumFractionDigits: casas, maximumFractionDigits: casas };
  return formatador(opcoes).format(numero);
}

/** Formato curto para indicadores: 1250000 -> "R$ 1,25 mi". */
export function formatarMoedaCompacta(valor, { casas = 2, vazio = '—' } = {}) {
  const numero = paraNumero(valor);
  if (numero == null) return vazio;
  return formatador({
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: casas,
  }).format(numero);
}

/**
 * Formata percentual.
 *   formatarPercentual(12.5)                 -> "12,5%"  (valor ja em %)
 *   formatarPercentual(0.125, {fracao:true}) -> "12,5%"  (valor em fracao)
 */
export function formatarPercentual(valor, { casas = 1, fracao = false, vazio = '—' } = {}) {
  const numero = paraNumero(valor);
  if (numero == null) return vazio;
  return formatador({
    style: 'percent',
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(fracao ? numero : numero / 100);
}


/* =============================================================================
   03. DATAS
   Datas "aaaa-mm-dd" sao lidas no fuso local (evita o deslocamento de um dia
   que acontece com new Date("2024-01-05") em fusos negativos, como o Brasil).
   ========================================================================== */

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function dataValida(ano, mes, dia) {
  const data = new Date(ano, mes - 1, dia);
  const ok = data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia;
  return ok ? data : null;
}

const doisDigitos = (n) => String(n).padStart(2, '0');

/**
 * Converte para Date. Aceita: Date, timestamp, "aaaa-mm-dd", "aaaa-mm",
 * "dd/mm/aaaa", "mm/aaaa" e textos ISO com hora. Retorna null se invalido.
 */
export function paraData(valor) {
  if (valor == null || valor === '') return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : new Date(valor.getTime());
  if (typeof valor === 'number') {
    const data = new Date(valor);
    return Number.isNaN(data.getTime()) ? null : data;
  }
  const texto = String(valor).trim();
  let m = texto.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (m) return dataValida(+m[1], +m[2], m[3] ? +m[3] : 1);
  m = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return dataValida(+m[3], +m[2], +m[1]);
  m = texto.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) return dataValida(+m[2], +m[1], 1);
  const data = new Date(texto);
  return Number.isNaN(data.getTime()) ? null : data;
}

/** Converte o numero de serie de data do Excel (ex.: 45292) em Date local. */
export function dataDeSerialExcel(serial) {
  const numero = paraNumero(serial);
  if (numero == null) return null;
  const utc = new Date(Math.round((numero - 25569) * 86400000));
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}

/**
 * Formata datas. Formatos:
 *   'curta' (padrao) 05/01/2024     'longa'     5 de janeiro de 2024
 *   'mes-ano'        jan/2024       'mes-ano-longo' janeiro de 2024
 *   'data-hora'      05/01/2024 14:30
 *   'iso'            2024-01-05     'iso-mes'   2024-01
 */
export function formatarData(valor, formato = 'curta', { vazio = '—' } = {}) {
  const data = paraData(valor);
  if (!data) return vazio;
  const d = data.getDate();
  const m = data.getMonth();
  const a = data.getFullYear();
  switch (formato) {
    case 'longa': return `${d} de ${MESES[m]} de ${a}`;
    case 'mes-ano': return `${MESES_CURTOS[m]}/${a}`;
    case 'mes-ano-longo': return `${MESES[m]} de ${a}`;
    case 'data-hora': return `${doisDigitos(d)}/${doisDigitos(m + 1)}/${a} ${doisDigitos(data.getHours())}:${doisDigitos(data.getMinutes())}`;
    case 'iso': return `${a}-${doisDigitos(m + 1)}-${doisDigitos(d)}`;
    case 'iso-mes': return `${a}-${doisDigitos(m + 1)}`;
    case 'curta':
    default: return `${doisDigitos(d)}/${doisDigitos(m + 1)}/${a}`;
  }
}

/** Soma (ou subtrai) meses. Dia 31 + 1 mes vira o ultimo dia do mes seguinte. */
export function adicionarMeses(valor, quantidade) {
  const data = paraData(valor);
  if (!data) return null;
  const dia = data.getDate();
  const resultado = new Date(data.getFullYear(), data.getMonth() + quantidade, 1);
  const ultimoDia = new Date(resultado.getFullYear(), resultado.getMonth() + 1, 0).getDate();
  resultado.setDate(Math.min(dia, ultimoDia));
  return resultado;
}

/** Lista os meses entre duas datas (inclusive) no formato "aaaa-mm". */
export function listarMeses(inicio, fim) {
  const a = paraData(inicio);
  const b = paraData(fim);
  if (!a || !b) return [];
  const lista = [];
  const atual = new Date(a.getFullYear(), a.getMonth(), 1);
  const limite = new Date(b.getFullYear(), b.getMonth(), 1);
  while (atual <= limite) {
    lista.push(`${atual.getFullYear()}-${doisDigitos(atual.getMonth() + 1)}`);
    atual.setMonth(atual.getMonth() + 1);
  }
  return lista;
}

/** Diferenca em meses-calendario (fim - inicio). jan/2024 -> mar/2024 = 2. */
export function diferencaEmMeses(inicio, fim) {
  const a = paraData(inicio);
  const b = paraData(fim);
  if (!a || !b) return null;
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}


/* =============================================================================
   04. PESQUISA, FILTROS, ORDENACAO E PAGINACAO
   Todas as funcoes recebem uma lista e devolvem uma lista NOVA (nao alteram a original).
   ========================================================================== */

function valoresPesquisaveis(item) {
  return Object.values(item).filter((v) => v == null || typeof v !== 'object');
}

/**
 * Pesquisa textual sem acento e sem diferenciar maiusculas.
 * Todas as palavras digitadas precisam aparecer (em qualquer campo informado).
 *   pesquisar(lista, 'joao silva', ['nome', 'email'])
 */
export function pesquisar(lista, termo, campos) {
  const palavras = normalizarTexto(termo).split(/\s+/).filter(Boolean);
  if (!palavras.length) return lista.slice();
  return lista.filter((item) => {
    const valores = campos && campos.length
      ? campos.map((c) => obterValor(item, c))
      : valoresPesquisaveis(item);
    const alvo = valores.map(normalizarTexto).join(' ');
    return palavras.every((p) => alvo.includes(p));
  });
}

function criterioVazio(criterio) {
  if (criterio == null || criterio === '') return true;
  if (Array.isArray(criterio)) return criterio.length === 0;
  if (typeof criterio === 'object' && !(criterio instanceof Date) && !(criterio instanceof RegExp)) {
    return ['min', 'max', 'de', 'ate'].every((k) => criterio[k] == null || criterio[k] === '');
  }
  return false;
}

function atendeCriterio(valor, criterio, item) {
  if (typeof criterio === 'function') return Boolean(criterio(valor, item));
  if (criterio instanceof RegExp) return criterio.test(String(valor ?? ''));
  if (Array.isArray(criterio)) return criterio.map(String).includes(String(valor ?? ''));
  if (typeof criterio === 'object') {
    if ('de' in criterio || 'ate' in criterio) {
      const data = paraData(valor);
      if (!data) return false;
      const de = paraData(criterio.de);
      const ate = paraData(criterio.ate);
      if (de && data < de) return false;
      if (ate && data > ate) return false;
      return true;
    }
    const numero = paraNumero(valor);
    if (numero == null) return false;
    const min = paraNumero(criterio.min);
    const max = paraNumero(criterio.max);
    if (min != null && numero < min) return false;
    if (max != null && numero > max) return false;
    return true;
  }
  return String(valor ?? '') === String(criterio);
}

/**
 * Filtra por criterios combinados (todos precisam ser atendidos).
 * Criterio vazio ('' / null / [] / {}) e ignorado.
 *   filtrar(lista, {
 *     status: 'Ativo',                       // igualdade
 *     categoria: ['A', 'B'],                 // um dos valores
 *     valor: { min: 1000, max: 5000 },       // faixa numerica
 *     data: { de: '2024-01-01', ate: '2024-06-30' }, // faixa de datas
 *     nome: /^Jo/i,                          // expressao regular
 *     saldo: (v) => v > 0,                   // funcao
 *   })
 */
export function filtrar(lista, criterios = {}) {
  const ativos = Object.entries(criterios).filter(([, c]) => !criterioVazio(c));
  if (!ativos.length) return lista.slice();
  return lista.filter((item) =>
    ativos.every(([campo, criterio]) => atendeCriterio(obterValor(item, campo), criterio, item)));
}

const colador = new Intl.Collator(LOCALE, { numeric: true, sensitivity: 'base' });

/** Valores distintos e nao vazios de um campo (para montar opcoes de filtro). */
export function valoresUnicos(lista, campo, { ordenado = true } = {}) {
  const conjunto = new Set();
  lista.forEach((item) => {
    const v = obterValor(item, campo);
    if (v != null && v !== '') conjunto.add(v);
  });
  const resultado = [...conjunto];
  return ordenado ? resultado.sort((a, b) => compararValores(a, b)) : resultado;
}

/**
 * Compara dois valores para ordenacao. tipo: 'auto' | 'texto' | 'numero' |
 * 'moeda' | 'percentual' | 'data'. Retorna negativo, zero ou positivo.
 */
export function compararValores(a, b, tipo = 'auto') {
  if (tipo === 'numero' || tipo === 'moeda' || tipo === 'percentual') {
    return (paraNumero(a) ?? 0) - (paraNumero(b) ?? 0);
  }
  if (tipo === 'data') {
    return (paraData(a)?.getTime() ?? 0) - (paraData(b)?.getTime() ?? 0);
  }
  if (tipo === 'auto') {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    if (a instanceof Date && b instanceof Date) return a - b;
  }
  return colador.compare(String(a), String(b));
}

/**
 * Ordena por um ou varios campos. Valores vazios sempre ficam no fim.
 *   ordenar(lista, 'nome')
 *   ordenar(lista, 'valor', 'desc', 'moeda')
 *   ordenar(lista, [{ campo: 'categoria' }, { campo: 'valor', direcao: 'desc', tipo: 'numero' }])
 */
export function ordenar(lista, campoOuCriterios, direcao = 'asc', tipo = 'auto') {
  if (!campoOuCriterios) return lista.slice();
  const criterios = Array.isArray(campoOuCriterios)
    ? campoOuCriterios
    : [{ campo: campoOuCriterios, direcao, tipo }];

  return lista.slice().sort((x, y) => {
    for (const c of criterios) {
      const a = obterValor(x, c.campo);
      const b = obterValor(y, c.campo);
      const aVazio = a == null || a === '';
      const bVazio = b == null || b === '';
      if (aVazio && bVazio) continue;
      if (aVazio) return 1;
      if (bVazio) return -1;
      const r = compararValores(a, b, c.tipo || 'auto');
      if (r !== 0) return (c.direcao === 'desc' ? -r : r);
    }
    return 0;
  });
}

/** Divide a lista em paginas. pagina comeca em 1. porPagina 0 = sem paginacao. */
export function paginar(lista, pagina = 1, porPagina = 25) {
  const total = lista.length;
  if (!porPagina || porPagina <= 0) {
    return { itens: lista.slice(), pagina: 1, totalPaginas: 1, total, inicio: total ? 1 : 0, fim: total };
  }
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const atual = Math.min(Math.max(1, pagina), totalPaginas);
  const inicio = (atual - 1) * porPagina;
  const itens = lista.slice(inicio, inicio + porPagina);
  return {
    itens,
    pagina: atual,
    totalPaginas,
    total,
    inicio: total ? inicio + 1 : 0,
    fim: inicio + itens.length,
  };
}

/**
 * Aplica pesquisa -> filtros -> ordenacao -> paginacao em sequencia.
 *   aplicarConsulta(lista, {
 *     busca: 'texto', camposBusca: ['nome'],
 *     filtros: { status: 'Ativo' },
 *     ordenacao: { campo: 'valor', direcao: 'desc', tipo: 'numero' },
 *     pagina: 1, porPagina: 25,
 *   })
 * Retorna { itens (pagina atual), filtrados (todos os filtrados), totalGeral, paginacao }.
 */
export function aplicarConsulta(lista, {
  busca = '', camposBusca, filtros = {}, ordenacao, pagina = 1, porPagina = 0,
} = {}) {
  let resultado = pesquisar(lista, busca, camposBusca);
  resultado = filtrar(resultado, filtros);
  if (ordenacao && ordenacao.campo) {
    resultado = ordenar(resultado, ordenacao.campo, ordenacao.direcao, ordenacao.tipo);
  }
  const paginacao = paginar(resultado, pagina, porPagina);
  return { itens: paginacao.itens, filtrados: resultado, totalGeral: lista.length, paginacao };
}

/** Soma os valores numericos de um campo (ignora vazios e textos invalidos). */
export function somar(lista, campo) {
  return lista.reduce((total, item) => total + (paraNumero(obterValor(item, campo)) ?? 0), 0);
}

/** Agrupa a lista por um campo. Retorna Map(valor -> itens[]), na ordem de aparicao. */
export function agruparPor(lista, campo) {
  const grupos = new Map();
  lista.forEach((item) => {
    const chave = obterValor(item, campo);
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(item);
  });
  return grupos;
}


/* =============================================================================
   05. VALIDACAO DE FORMULARIOS
   ========================================================================== */

/** Valida CPF pelos digitos verificadores (aceita com ou sem mascara). */
export function validarCPF(valor) {
  const cpf = String(valor ?? '').replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = (base) => {
    let soma = 0;
    for (let i = 0; i < base.length; i += 1) soma += Number(base[i]) * (base.length + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d1 = digito(cpf.slice(0, 9));
  const d2 = digito(cpf.slice(0, 10));
  return d1 === Number(cpf[9]) && d2 === Number(cpf[10]);
}

/** Valida CNPJ numerico pelos digitos verificadores (aceita com ou sem mascara). */
export function validarCNPJ(valor) {
  const cnpj = String(valor ?? '').replace(/\D/g, '');
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const digito = (base) => {
    const pesos = base.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = base.split('').reduce((t, n, i) => t + Number(n) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = digito(cnpj.slice(0, 12));
  const d2 = digito(cnpj.slice(0, 13));
  return d1 === Number(cnpj[12]) && d2 === Number(cnpj[13]);
}

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Valida um valor segundo regras. Retorna a mensagem de erro ou null.
 * Regras: obrigatorio, tipo ('numero'|'moeda'|'percentual'|'email'|'data'|'cpf'|'cnpj'),
 *         minimo, maximo (numero ou data, conforme o tipo), minCaracteres, maxCaracteres,
 *         padrao (RegExp), mensagemPadrao, validar(valor, valores) -> true | 'mensagem',
 *         mensagem (substitui qualquer mensagem padrao).
 */
export function validarValor(valor, regras = {}, valores = {}) {
  const msg = (padrao) => regras.mensagem || padrao;
  const vazio = valor == null || valor === false
    || (typeof valor === 'string' && valor.trim() === '')
    || (Array.isArray(valor) && valor.length === 0);

  if (vazio) return regras.obrigatorio ? msg('Preencha este campo.') : null;

  const texto = String(valor).trim();
  const tipo = regras.tipo;

  if (tipo === 'numero' || tipo === 'moeda' || tipo === 'percentual') {
    const numero = paraNumero(valor);
    if (numero == null) return msg('Informe um número válido.');
    if (regras.minimo != null && numero < regras.minimo) {
      return msg(`O valor mínimo é ${tipo === 'moeda' ? formatarMoeda(regras.minimo) : formatarNumero(regras.minimo)}.`);
    }
    if (regras.maximo != null && numero > regras.maximo) {
      return msg(`O valor máximo é ${tipo === 'moeda' ? formatarMoeda(regras.maximo) : formatarNumero(regras.maximo)}.`);
    }
  }
  if (tipo === 'data') {
    const data = paraData(valor);
    if (!data) return msg('Informe uma data válida.');
    const min = paraData(regras.minimo);
    const max = paraData(regras.maximo);
    if (min && data < min) return msg(`A data deve ser a partir de ${formatarData(min)}.`);
    if (max && data > max) return msg(`A data deve ser até ${formatarData(max)}.`);
  }
  if (tipo === 'email' && !REGEX_EMAIL.test(texto)) return msg('Informe um e-mail válido.');
  if (tipo === 'cpf' && !validarCPF(texto)) return msg('CPF inválido.');
  if (tipo === 'cnpj' && !validarCNPJ(texto)) return msg('CNPJ inválido.');

  if (regras.minCaracteres != null && texto.length < regras.minCaracteres) {
    return msg(`Use pelo menos ${regras.minCaracteres} caracteres.`);
  }
  if (regras.maxCaracteres != null && texto.length > regras.maxCaracteres) {
    return msg(`Use no máximo ${regras.maxCaracteres} caracteres.`);
  }
  if (regras.padrao instanceof RegExp && !regras.padrao.test(texto)) {
    return regras.mensagemPadrao || msg('Formato inválido.');
  }
  if (typeof regras.validar === 'function') {
    const r = regras.validar(valor, valores);
    if (r !== true && r != null && r !== '') return typeof r === 'string' ? r : msg('Valor inválido.');
  }
  return null;
}

/**
 * Le os valores de um <form> pelo atributo name.
 * - checkbox unico -> true/false; varios checkbox com o mesmo nome -> array dos marcados
 * - radio -> valor marcado (ou null); select multiple -> array
 * - data-tipo="numero|moeda|percentual" -> numero (formato brasileiro aceito)
 * - demais campos -> texto aparado
 */
export function obterValoresFormulario(form) {
  const valores = {};
  const elementos = [...form.elements].filter((el) => el.name && !el.disabled && el.type !== 'submit' && el.type !== 'button');
  const contagem = {};
  elementos.forEach((el) => { contagem[el.name] = (contagem[el.name] || 0) + 1; });

  elementos.forEach((el) => {
    const nome = el.name;
    if (el.type === 'checkbox') {
      if (contagem[nome] > 1) {
        valores[nome] = valores[nome] || [];
        if (el.checked) valores[nome].push(el.value);
      } else {
        valores[nome] = el.checked;
      }
      return;
    }
    if (el.type === 'radio') {
      if (!(nome in valores)) valores[nome] = null;
      if (el.checked) valores[nome] = el.value;
      return;
    }
    if (el.tagName === 'SELECT' && el.multiple) {
      valores[nome] = [...el.selectedOptions].map((o) => o.value);
      return;
    }
    const tipoDado = el.dataset.tipo;
    if (tipoDado === 'numero' || tipoDado === 'moeda' || tipoDado === 'percentual') {
      valores[nome] = paraNumero(el.value);
      return;
    }
    valores[nome] = typeof el.value === 'string' ? el.value.trim() : el.value;
  });
  return valores;
}

/** Preenche um <form> a partir de um objeto. Campos data-tipo="moeda" recebem formatacao. */
export function preencherFormulario(form, valores = {}) {
  Object.entries(valores).forEach(([nome, valor]) => {
    const campos = [...form.elements].filter((el) => el.name === nome);
    campos.forEach((el) => {
      if (el.type === 'checkbox') {
        el.checked = Array.isArray(valor) ? valor.map(String).includes(el.value) : Boolean(valor);
      } else if (el.type === 'radio') {
        el.checked = String(valor) === el.value;
      } else if (el.tagName === 'SELECT' && el.multiple) {
        const lista = (Array.isArray(valor) ? valor : [valor]).map(String);
        [...el.options].forEach((o) => { o.selected = lista.includes(o.value); });
      } else if (el.dataset.tipo === 'moeda') {
        el.value = valor == null || valor === '' ? '' : formatarMoeda(valor, { simbolo: false });
      } else if (el.dataset.tipo === 'numero' || el.dataset.tipo === 'percentual') {
        el.value = valor == null || valor === '' ? '' : formatarNumero(valor);
      } else {
        el.value = valor ?? '';
      }
    });
  });
}

function campoContainer(el) {
  return el.closest('.ctc-field');
}

/**
 * Mostra (ou limpa, com mensagem vazia) o erro de um campo, aplicando as
 * classes do design system: .ctc-field.is-invalid e .ctc-field__error.
 */
export function definirErroCampo(form, nome, mensagem) {
  const elementos = [...form.elements].filter((el) => el.name === nome);
  if (!elementos.length) return;
  const container = campoContainer(elementos[0]);
  elementos.forEach((el) => {
    if (mensagem) el.setAttribute('aria-invalid', 'true');
    else el.removeAttribute('aria-invalid');
  });
  if (!container) return;
  container.classList.toggle('is-invalid', Boolean(mensagem));
  let erro = container.querySelector('.ctc-field__error');
  if (!erro) {
    erro = document.createElement('div');
    erro.className = 'ctc-field__error';
    erro.id = `${elementos[0].id || gerarId('campo')}-erro`;
    container.append(erro);
  }
  erro.textContent = mensagem || '';
  const descritores = (elementos[0].getAttribute('aria-describedby') || '').split(/\s+/).filter((d) => d && d !== erro.id);
  if (mensagem) descritores.push(erro.id);
  if (descritores.length) elementos[0].setAttribute('aria-describedby', descritores.join(' '));
  else elementos[0].removeAttribute('aria-describedby');
}

/** Remove todos os erros exibidos no formulario. */
export function limparErros(form) {
  const nomes = new Set([...form.elements].map((el) => el.name).filter(Boolean));
  nomes.forEach((nome) => definirErroCampo(form, nome, ''));
}

/** Monta regras a partir dos atributos HTML (required, min, max, minlength, maxlength, pattern, data-tipo). */
function regrasDosAtributos(el) {
  const regras = {};
  if (el.required) regras.obrigatorio = true;
  if (el.dataset.tipo) regras.tipo = el.dataset.tipo;
  else if (el.type === 'email') regras.tipo = 'email';
  else if (el.type === 'date' || el.type === 'month') regras.tipo = 'data';
  if (el.min !== undefined && el.min !== '') regras.minimo = regras.tipo === 'data' ? el.min : Number(el.min);
  if (el.max !== undefined && el.max !== '') regras.maximo = regras.tipo === 'data' ? el.max : Number(el.max);
  if (el.minLength > 0) regras.minCaracteres = el.minLength;
  if (el.maxLength > 0) regras.maxCaracteres = el.maxLength;
  if (el.pattern) regras.padrao = new RegExp(`^(?:${el.pattern})$`);
  return regras;
}

/**
 * Valida o formulario inteiro.
 * esquema (opcional): { nomeDoCampo: regras }. Sem esquema, as regras sao lidas
 * dos atributos HTML. Quando ha esquema, ele complementa os atributos.
 * Exibe os erros nos campos e foca o primeiro invalido.
 * Retorna { valido, erros: { nome: mensagem }, valores }.
 */
export function validarFormulario(form, esquema = {}, { focar = true } = {}) {
  const valores = obterValoresFormulario(form);
  const erros = {};
  const nomes = new Set([
    ...[...form.elements].map((el) => el.name).filter(Boolean),
    ...Object.keys(esquema),
  ]);

  nomes.forEach((nome) => {
    const el = [...form.elements].find((e) => e.name === nome);
    if (el && el.disabled) return;
    const regras = { ...(el ? regrasDosAtributos(el) : {}), ...(esquema[nome] || {}) };
    const mensagem = validarValor(valores[nome], regras, valores);
    if (mensagem) erros[nome] = mensagem;
    definirErroCampo(form, nome, mensagem);
  });

  const valido = Object.keys(erros).length === 0;
  if (!valido && focar) {
    const primeiro = [...form.elements].find((el) => erros[el.name]);
    if (primeiro) primeiro.focus();
  }
  return { valido, erros, valores };
}


/* =============================================================================
   06. NOTIFICACOES (TOAST)
   Substitui alert(). Usa as classes .ctc-toast-region e .ctc-toast do design system.
   ========================================================================== */

const TIPOS_TOAST = ['success', 'danger', 'warning', 'info'];
const DURACAO_PADRAO = { success: 4000, info: 5000, warning: 7000, danger: 9000 };
const MAXIMO_TOASTS = 5;

const ICONES_TOAST = {
  success: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
  danger: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  warning: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 18v.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
};

function regiaoToast() {
  let regiao = document.querySelector('.ctc-toast-region');
  if (!regiao) {
    regiao = document.createElement('div');
    regiao.className = 'ctc-toast-region';
    regiao.setAttribute('aria-live', 'polite');
    document.body.append(regiao);
  }
  return regiao;
}

/**
 * Exibe uma notificacao temporaria.
 *   notificar('Alteracoes salvas')
 *   notificar({ tipo: 'danger', titulo: 'Falha ao importar', mensagem: 'Arquivo sem a aba X.',
 *               duracao: 0, acoes: [{ texto: 'Tentar de novo', onClick: () => ... }] })
 * tipo: success | danger | warning | info (padrao info). duracao em ms; 0 = so fecha no X.
 * Retorna { elemento, fechar }.
 */
export function notificar(opcoes) {
  const config = typeof opcoes === 'string' ? { titulo: opcoes } : { ...opcoes };
  const tipo = TIPOS_TOAST.includes(config.tipo) ? config.tipo : 'info';
  const duracao = config.duracao ?? DURACAO_PADRAO[tipo];
  const regiao = regiaoToast();

  const toastEl = document.createElement('div');
  toastEl.className = `ctc-toast ctc-toast--${tipo}`;
  toastEl.setAttribute('role', tipo === 'danger' ? 'alert' : 'status');

  const icone = document.createElement('span');
  icone.className = 'ctc-toast__icon';
  icone.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES_TOAST[tipo]}</svg>`;

  const corpo = document.createElement('div');
  corpo.className = 'ctc-toast__body';
  if (config.titulo) {
    const titulo = document.createElement('div');
    titulo.className = 'ctc-toast__title';
    titulo.textContent = config.titulo;
    corpo.append(titulo);
  }
  if (config.mensagem) {
    const msg = document.createElement('div');
    msg.className = 'ctc-toast__msg';
    msg.textContent = config.mensagem;
    corpo.append(msg);
  }

  let fechado = false;
  let timer = null;
  const fechar = () => {
    if (fechado) return;
    fechado = true;
    clearTimeout(timer);
    toastEl.classList.add('is-leaving');
    const remover = () => toastEl.remove();
    toastEl.addEventListener('animationend', remover, { once: true });
    setTimeout(remover, 400);
  };

  if (Array.isArray(config.acoes) && config.acoes.length) {
    const acoes = document.createElement('div');
    acoes.className = 'ctc-toast__actions';
    config.acoes.forEach((acao) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `ctc-btn ctc-btn--sm ${acao.variante ? `ctc-btn--${acao.variante}` : 'ctc-btn--outline'}`;
      btn.textContent = acao.texto;
      btn.addEventListener('click', () => {
        if (typeof acao.onClick === 'function') acao.onClick();
        if (acao.fechar !== false) fechar();
      });
      acoes.append(btn);
    });
    corpo.append(acoes);
  }

  const btnFechar = document.createElement('button');
  btnFechar.type = 'button';
  btnFechar.className = 'ctc-toast__close';
  btnFechar.setAttribute('aria-label', 'Fechar notificação');
  btnFechar.textContent = '×';
  btnFechar.addEventListener('click', fechar);

  toastEl.append(icone, corpo, btnFechar);
  regiao.append(toastEl);

  const ativos = regiao.querySelectorAll('.ctc-toast:not(.is-leaving)');
  if (ativos.length > MAXIMO_TOASTS) ativos[0].querySelector('.ctc-toast__close')?.click();

  const iniciarTimer = () => { if (duracao > 0) timer = setTimeout(fechar, duracao); };
  toastEl.addEventListener('mouseenter', () => clearTimeout(timer));
  toastEl.addEventListener('mouseleave', () => { if (!fechado) iniciarTimer(); });
  iniciarTimer();

  return { elemento: toastEl, fechar };
}

/** Atalhos: toast.sucesso('Salvo'), toast.erro('Falhou', 'detalhe'), toast.aviso(...), toast.info(...) */
export const toast = {
  sucesso: (titulo, mensagem, extra = {}) => notificar({ ...extra, tipo: 'success', titulo, mensagem }),
  erro: (titulo, mensagem, extra = {}) => notificar({ ...extra, tipo: 'danger', titulo, mensagem }),
  aviso: (titulo, mensagem, extra = {}) => notificar({ ...extra, tipo: 'warning', titulo, mensagem }),
  info: (titulo, mensagem, extra = {}) => notificar({ ...extra, tipo: 'info', titulo, mensagem }),
};



/* =============================================================================
   07. ACESSO E BASE DE DADOS (JSON)
   IMPORTANTE: sem servidor, toda verificacao de senha roda no navegador.
   Isso funciona como CONTROLE DE USO (evita edicao acidental), nao como
   seguranca contra quem abrir o codigo-fonte. Senhas nunca sao guardadas em
   texto: so o resumo SHA-256 de "sal:senha".
   ========================================================================== */

const K_SHA256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const paraHex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
const rotacionar = (x, n) => (x >>> n) | (x << (32 - n));

/** SHA-256 em JavaScript puro: usado quando crypto.subtle nao esta disponivel. */
function sha256Puro(bytes) {
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const tamanho = bytes.length;
  const total = ((tamanho + 9 + 63) >> 6) << 6;
  const bloco = new Uint8Array(total);
  bloco.set(bytes);
  bloco[tamanho] = 0x80;
  const visao = new DataView(bloco.buffer);
  const bits = tamanho * 8;
  visao.setUint32(total - 8, Math.floor(bits / 0x100000000));
  visao.setUint32(total - 4, bits >>> 0);
  const W = new Uint32Array(64);
  for (let inicio = 0; inicio < total; inicio += 64) {
    for (let i = 0; i < 16; i += 1) W[i] = visao.getUint32(inicio + i * 4);
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotacionar(W[i - 15], 7) ^ rotacionar(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotacionar(W[i - 2], 17) ^ rotacionar(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i += 1) {
      const S1 = rotacionar(e, 6) ^ rotacionar(e, 11) ^ rotacionar(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K_SHA256[i] + W[i]) >>> 0;
      const S0 = rotacionar(a, 2) ^ rotacionar(a, 13) ^ rotacionar(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  return [...H].map((x) => x.toString(16).padStart(8, '0')).join('');
}

/** Resumo SHA-256 (hexadecimal) de um texto. Funciona inclusive em arquivo aberto do disco. */
export async function gerarHash(texto) {
  const bytes = new TextEncoder().encode(String(texto));
  if (globalThis.crypto && globalThis.crypto.subtle) {
    try {
      return paraHex(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes)));
    } catch (erro) {
      /* segue para a versao em JavaScript puro */
    }
  }
  return sha256Puro(bytes);
}

/** Valor aleatorio usado para "temperar" cada senha antes do resumo. */
export function gerarSal(tamanho = 16) {
  const bytes = new Uint8Array(tamanho);
  if (globalThis.crypto && globalThis.crypto.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < tamanho; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return paraHex(bytes);
}

/** Login sem espacos nas pontas e em minusculas ("Joao.Silva " -> "joao.silva"). */
export function normalizarLogin(login) {
  return String(login ?? '').trim().toLowerCase();
}

/**
 * Cria a credencial de um usuario. A senha em texto NAO e devolvida.
 * Com senhaMestra (senha do administrador), guarda tambem uma copia CIFRADA da
 * senha (AES-GCM), que so pode ser revelada por quem souber a senha mestra.
 */
export async function criarCredencial({ login, nome = '', senha, senhaMestra }) {
  const sal = gerarSal();
  const credencial = {
    login: normalizarLogin(login),
    nome: String(nome).trim(),
    sal,
    hash: await gerarHash(`${sal}:${senha}`),
    criadoEm: new Date().toISOString(),
  };
  if (senhaMestra && criptografiaDisponivel()) {
    credencial.senhaCifrada = await cifrarTexto(senha, senhaMestra, sal);
  }
  return credencial;
}

/** Confere uma senha contra { sal, hash }. Retorna Promise<boolean>. */
export async function verificarSenha(senha, { sal = '', hash = '' } = {}) {
  if (!hash) return false;
  return (await gerarHash(`${sal}:${senha}`)) === hash;
}

/** Le um arquivo .json escolhido pelo usuario. Retorna Promise<objeto>. */
export function lerArquivoJSON(arquivo) {
  return new Promise((resolver, rejeitar) => {
    if (!arquivo) { rejeitar(new Error('Nenhum arquivo selecionado.')); return; }
    const leitor = new FileReader();
    leitor.onerror = () => rejeitar(new Error('Não foi possível ler o arquivo.'));
    leitor.onload = () => {
      try {
        resolver(JSON.parse(String(leitor.result).replace(/^\uFEFF/, '')));
      } catch (erro) {
        rejeitar(new Error('O arquivo não é um JSON válido.'));
      }
    };
    leitor.readAsText(arquivo, 'utf-8');
  });
}

/** Baixa um objeto como arquivo .json. */
export function baixarJSON(objeto, nomeArquivo = 'base.json') {
  const blob = new Blob([JSON.stringify(objeto, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo.endsWith('.json') ? nomeArquivo : `${nomeArquivo}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Estrutura padrao de base (provisoria, versao 1):
 * { formato, versao, salvoEm, controladores: [{ login, nome, sal, hash, criadoEm }], dados: { ... } }
 * "dados" pertence a cada aplicativo; esta biblioteca nao interpreta seu conteudo.
 */
export function criarBaseVazia(formato) {
  return { formato, versao: 1, salvoEm: null, controladores: [], dados: {} };
}

/** Confere se um objeto lido e uma base do aplicativo. Retorna { valida, erros, base }. */
export function validarBase(objeto, { formato } = {}) {
  const erros = [];
  if (!objeto || typeof objeto !== 'object' || Array.isArray(objeto)) {
    return { valida: false, erros: ['O conteúdo do arquivo não é um objeto JSON.'], base: null };
  }
  if (!objeto.formato) erros.push('O arquivo não identifica o formato da base (campo "formato").');
  else if (formato && objeto.formato !== formato) erros.push(`Este arquivo pertence a outro aplicativo (formato "${objeto.formato}").`);
  if (objeto.controladores != null && !Array.isArray(objeto.controladores)) erros.push('O campo "controladores" deve ser uma lista.');
  if (objeto.dados != null && (typeof objeto.dados !== 'object' || Array.isArray(objeto.dados))) erros.push('O campo "dados" deve ser um objeto.');
  const controladores = Array.isArray(objeto.controladores) ? objeto.controladores : [];
  controladores.forEach((c, i) => {
    if (!c || !c.login || !c.hash) erros.push(`Controlador nº ${i + 1} sem login ou senha.`);
  });
  if (erros.length) return { valida: false, erros, base: null };
  return {
    valida: true,
    erros: [],
    base: {
      ...objeto,
      versao: objeto.versao ?? 1,
      controladores: controladores.map((c) => ({ ...c, login: normalizarLogin(c.login) })),
      dados: objeto.dados ?? {},
    },
  };
}

/** Copia da base pronta para exportar, com a data/hora do salvamento. */
export function prepararBaseParaSalvar(base) {
  return { ...base, salvoEm: new Date().toISOString() };
}

/** Nome de arquivo com data e hora: prefixo_2026-10-26_1430.json */
export function nomeArquivoBase(prefixo = 'base') {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${prefixo}_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.json`;
}

/**
 * Estado da sessao de uso do aplicativo.
 * perfil: 'administrador' | 'controlador' | 'visualizador'
 * Retorna { obter, iniciar, podeEditar, marcarAlteracao, limparAlteracoes, assinar }.
 */
export function criarSessao() {
  const estado = { perfil: null, usuario: null, base: null, nomeArquivo: null, alteracoes: 0, ultimoSalvamento: null };
  const ouvintes = new Set();
  const avisar = () => ouvintes.forEach((fn) => fn({ ...estado }));
  return {
    obter: () => ({ ...estado }),
    iniciar({ perfil, usuario = null, base, nomeArquivo = null }) {
      Object.assign(estado, { perfil, usuario, base, nomeArquivo, alteracoes: 0, ultimoSalvamento: base?.salvoEm ?? null });
      avisar();
    },
    podeEditar: () => estado.perfil === 'controlador' || estado.perfil === 'administrador',
    marcarAlteracao() { estado.alteracoes += 1; avisar(); },
    limparAlteracoes(nomeArquivo) {
      estado.alteracoes = 0;
      estado.ultimoSalvamento = new Date().toISOString();
      if (nomeArquivo) estado.nomeArquivo = nomeArquivo;
      avisar();
    },
    assinar(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); },
  };
}


/**
 * Pede confirmacao do navegador ao fechar/recarregar a pagina com alteracoes nao salvas.
 * Retorna uma funcao que desliga a protecao (usar antes de uma saida intencional).
 */
export function protegerSaida(sessao) {
  const aoSair = (evento) => {
    if (sessao.podeEditar() && sessao.obter().alteracoes > 0) {
      evento.preventDefault();
      evento.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', aoSair);
  return () => window.removeEventListener('beforeunload', aoSair);
}



/* =============================================================================
   08. CIFRA DE SENHAS, IMAGEM DA LOGO E ARMAZENAMENTO DE VERSOES
   ========================================================================== */

const bytesParaBase64 = (bytes) => {
  let texto = '';
  bytes.forEach((b) => { texto += String.fromCharCode(b); });
  return btoa(texto);
};
const base64ParaBytes = (base64) => Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

/** true quando o navegador oferece criptografia (AES/PBKDF2). Chrome e Edge: sim, inclusive em arquivo local. */
export function criptografiaDisponivel() {
  return Boolean(globalThis.crypto && globalThis.crypto.subtle);
}

async function derivarChave(senhaMestra, sal) {
  const codificador = new TextEncoder();
  const material = await crypto.subtle.importKey('raw', codificador.encode(senhaMestra), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: codificador.encode(`ctc-cifra:${sal}`), iterations: 150000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Cifra um texto com AES-GCM; a chave vem da senha mestra (PBKDF2). Retorna { iv, dados } em base64. */
export async function cifrarTexto(texto, senhaMestra, sal) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const chave = await derivarChave(senhaMestra, sal);
  const cifrado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chave, new TextEncoder().encode(texto));
  return { iv: bytesParaBase64(iv), dados: bytesParaBase64(new Uint8Array(cifrado)) };
}

/** Decifra { iv, dados }. Lanca erro se a senha mestra estiver errada ou o conteudo alterado. */
export async function decifrarTexto(cifra, senhaMestra, sal) {
  const chave = await derivarChave(senhaMestra, sal);
  const aberto = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ParaBytes(cifra.iv) },
    chave,
    base64ParaBytes(cifra.dados),
  );
  return new TextDecoder().decode(aberto);
}

/**
 * Le uma imagem escolhida pelo usuario e devolve um data URL (PNG) reduzido,
 * para caber na base JSON. ladoMaximo em pixels (padrao 256).
 */
export function lerImagemComoDataURL(arquivo, { ladoMaximo = 256, tamanhoMaximoMB = 5 } = {}) {
  return new Promise((resolver, rejeitar) => {
    if (!arquivo) { rejeitar(new Error('Nenhuma imagem selecionada.')); return; }
    if (!/^image\/(png|jpeg|gif|webp|svg\+xml)$/.test(arquivo.type)) {
      rejeitar(new Error('Use uma imagem PNG, JPG, GIF, WEBP ou SVG.'));
      return;
    }
    if (arquivo.size > tamanhoMaximoMB * 1024 * 1024) {
      rejeitar(new Error(`A imagem deve ter no máximo ${tamanhoMaximoMB} MB.`));
      return;
    }
    const url = URL.createObjectURL(arquivo);
    const imagem = new Image();
    imagem.onerror = () => { URL.revokeObjectURL(url); rejeitar(new Error('Não foi possível ler a imagem.')); };
    imagem.onload = () => {
      const escala = Math.min(1, ladoMaximo / Math.max(imagem.width || ladoMaximo, imagem.height || ladoMaximo));
      const largura = Math.max(1, Math.round((imagem.width || ladoMaximo) * escala));
      const altura = Math.max(1, Math.round((imagem.height || ladoMaximo) * escala));
      const tela = document.createElement('canvas');
      tela.width = largura;
      tela.height = altura;
      tela.getContext('2d').drawImage(imagem, 0, 0, largura, altura);
      URL.revokeObjectURL(url);
      resolver(tela.toDataURL('image/png'));
    };
    imagem.src = url;
  });
}

/**
 * Armazenamento de versoes da base NO PROPRIO NAVEGADOR (IndexedDB).
 * PROVISORIO: e o "provedor" usado pelos botoes de nuvem ate a nuvem real ser
 * definida. Um provedor de nuvem futuro deve oferecer os mesmos metodos:
 *   listar() -> [{ id, nome, salvoEm, autor, tamanho }]
 *   salvar({ nome, base, autor }) -> { id, ... }
 *   substituir(id, { base, autor }) -> { id, ... }
 *   abrir(id) -> { id, nome, salvoEm, autor, base }
 *   remover(id)
 * Os dados ficam apenas neste computador e neste navegador.
 */
export function criarArmazenamentoNavegador({ banco = 'ctc-app', descricao = 'Neste navegador (provisório)' } = {}) {
  const LOJA = 'versoes';
  let conexao = null;

  function abrirBanco() {
    if (conexao) return Promise.resolve(conexao);
    return new Promise((resolver, rejeitar) => {
      if (!globalThis.indexedDB) { rejeitar(new Error('Este navegador não permite armazenamento local.')); return; }
      const pedido = indexedDB.open(banco, 1);
      pedido.onupgradeneeded = () => pedido.result.createObjectStore(LOJA, { keyPath: 'id' });
      pedido.onsuccess = () => { conexao = pedido.result; resolver(conexao); };
      pedido.onerror = () => rejeitar(new Error('Não foi possível abrir o armazenamento local.'));
    });
  }

  async function transacao(modo, operacao) {
    const db = await abrirBanco();
    return new Promise((resolver, rejeitar) => {
      const tx = db.transaction(LOJA, modo);
      const pedido = operacao(tx.objectStore(LOJA));
      tx.oncomplete = () => resolver(pedido ? pedido.result : undefined);
      tx.onerror = () => rejeitar(tx.error || new Error('Falha no armazenamento local.'));
    });
  }

  const resumo = ({ base, ...meta }) => meta;

  return {
    descricao,
    async listar() {
      const todos = (await transacao('readonly', (loja) => loja.getAll())) || [];
      return todos.map(resumo).sort((a, b) => String(b.salvoEm).localeCompare(String(a.salvoEm)));
    },
    async salvar({ nome, base, autor }) {
      const registro = {
        id: gerarId('versao'),
        nome: String(nome).trim(),
        salvoEm: new Date().toISOString(),
        autor: autor || '',
        tamanho: JSON.stringify(base).length,
        base,
      };
      await transacao('readwrite', (loja) => loja.put(registro));
      return resumo(registro);
    },
    async substituir(id, { base, autor }) {
      const atual = await transacao('readonly', (loja) => loja.get(id));
      if (!atual) throw new Error('Versão não encontrada.');
      const registro = { ...atual, base, autor: autor || atual.autor, salvoEm: new Date().toISOString(), tamanho: JSON.stringify(base).length };
      await transacao('readwrite', (loja) => loja.put(registro));
      return resumo(registro);
    },
    async abrir(id) {
      const registro = await transacao('readonly', (loja) => loja.get(id));
      if (!registro) throw new Error('Versão não encontrada.');
      return registro;
    },
    async remover(id) {
      await transacao('readwrite', (loja) => loja.delete(id));
    },
  };
}



/* =============================================================================
   09. NUVEM (FIREBASE / FIRESTORE)
   O SDK do Firebase e carregado sob demanda do endereco oficial (gstatic), so
   quando uma configuracao e usada. Sem configuracao, nada e baixado.
   Estrutura no Firestore (por colecao "x"):
     x/{id}           -> { nome, salvoEm, autor, tamanho }   (lista leve)
     x_conteudo/{id}  -> { conteudo: "<base JSON em texto>" }
   ATENCAO: sem login do Firebase, as regras do Firestore precisam liberar
   leitura/escrita; qualquer pessoa com a configuracao acessa os dados.
   ========================================================================== */

/** Versao do SDK do Firebase usada (a mesma do aplicativo de referencia). */
export const VERSAO_SDK_FIREBASE = '12.18.0';
const LIMITE_DOCUMENTO = 900000; // Firestore: 1 MiB por documento (margem de seguranca)

/**
 * Le o trecho de configuracao copiado do console do Firebase ("firebaseConfig")
 * e extrai os campos. Aceita o trecho com const, imports, comentarios etc.
 * Retorna { valido, config, erros }.
 */
export function interpretarConfigFirebase(texto) {
  const config = {};
  const padrao = /["']?(apiKey|authDomain|projectId|storageBucket|messagingSenderId|appId|measurementId|databaseURL)["']?\s*:\s*["'`]([^"'`]+)["'`]/g;
  let achado = padrao.exec(String(texto ?? ''));
  while (achado) {
    config[achado[1]] = achado[2].trim();
    achado = padrao.exec(String(texto ?? ''));
  }
  const erros = ['apiKey', 'projectId', 'appId']
    .filter((campo) => !config[campo])
    .map((campo) => `Campo "${campo}" não encontrado no texto colado.`);
  if (!config.authDomain && config.projectId) config.authDomain = `${config.projectId}.firebaseapp.com`;
  return { valido: erros.length === 0, config, erros };
}

function traduzirErroFirebase(erro) {
  const codigo = String(erro && (erro.code || erro.message) || '');
  if (/permission-denied|insufficient permissions/i.test(codigo)) return 'Sem permissão no Firestore: ajuste as regras de segurança do banco para permitir leitura e escrita.';
  if (/unavailable|offline|network|Failed to fetch|NetworkError/i.test(codigo)) return 'Não foi possível falar com o Firebase. Verifique a conexão com a internet.';
  if (/not-found|NOT_FOUND|does not exist/i.test(codigo)) return 'Banco Firestore não encontrado neste projeto. Crie o Firestore Database no console do Firebase.';
  if (/invalid-api-key|api-key-not-valid|API key not valid/i.test(codigo)) return 'A apiKey da configuração não é válida.';
  if (/importing|dynamically imported module|Failed to load module/i.test(codigo)) return 'Não foi possível carregar o Firebase. Verifique a internet ou se o acesso a gstatic.com está liberado.';
  return erro && erro.message ? erro.message : 'Erro desconhecido no Firebase.';
}

function comPrazo(promessa, ms, mensagem) {
  let timer;
  const limite = new Promise((_, rejeitar) => { timer = setTimeout(() => rejeitar(new Error(mensagem)), ms); });
  return Promise.race([promessa, limite]).finally(() => clearTimeout(timer));
}

/**
 * Provedor de versoes no Firestore, com os mesmos metodos do armazenamento do navegador:
 * listar, salvar, substituir, abrir, remover.
 */
export function criarArmazenamentoFirebase({ config, colecao = 'ctc_versoes', versaoSdk = VERSAO_SDK_FIREBASE, prazoMs = 20000 } = {}) {
  let pronto = null;
  const colecaoConteudo = `${colecao}_conteudo`;
  const prazo = (p) => comPrazo(p, prazoMs, 'O Firebase não respondeu a tempo. Verifique a internet e as regras do Firestore.');

  function iniciar() {
    if (!pronto) {
      pronto = (async () => {
        const endereco = `https://www.gstatic.com/firebasejs/${versaoSdk}`;
        const [moduloApp, fs] = await Promise.all([
          import(`${endereco}/firebase-app.js`),
          import(`${endereco}/firebase-firestore.js`),
        ]);
        const app = moduloApp.initializeApp(config, gerarId('ctc-firebase'));
        return { fs, db: fs.getFirestore(app) };
      })().catch((erro) => {
        pronto = null;
        throw new Error(traduzirErroFirebase(erro));
      });
    }
    return pronto;
  }

  async function executar(operacao) {
    const { fs, db } = await iniciar();
    try {
      return await prazo(operacao(fs, db));
    } catch (erro) {
      throw new Error(traduzirErroFirebase(erro));
    }
  }

  function serializar(base) {
    const conteudo = JSON.stringify(base);
    if (conteudo.length > LIMITE_DOCUMENTO) {
      throw new Error(`A base tem ${Math.round(conteudo.length / 1024)} KB e passa do limite de cerca de 900 KB por salvamento no Firestore. Reduza a logo ou fale com o suporte para dividir a base.`);
    }
    return conteudo;
  }

  return {
    descricao: `Firebase — projeto ${config.projectId}`,
    listar() {
      return executar(async (fs, db) => {
        const resultado = await fs.getDocs(fs.query(fs.collection(db, colecao), fs.orderBy('salvoEm', 'desc')));
        return resultado.docs.map((d) => ({ id: d.id, ...d.data() }));
      });
    },
    salvar({ nome, base, autor }) {
      const conteudo = serializar(base);
      return executar(async (fs, db) => {
        const ref = fs.doc(fs.collection(db, colecao));
        const meta = { nome: String(nome).trim(), salvoEm: new Date().toISOString(), autor: autor || '', tamanho: conteudo.length };
        const lote = fs.writeBatch(db);
        lote.set(ref, meta);
        lote.set(fs.doc(db, colecaoConteudo, ref.id), { conteudo });
        await lote.commit();
        return { id: ref.id, ...meta };
      });
    },
    substituir(id, { base, autor }) {
      const conteudo = serializar(base);
      return executar(async (fs, db) => {
        const refMeta = fs.doc(db, colecao, id);
        const atual = await fs.getDoc(refMeta);
        if (!atual.exists()) throw new Error('Versão não encontrada na nuvem.');
        const meta = { ...atual.data(), salvoEm: new Date().toISOString(), autor: autor || atual.data().autor || '', tamanho: conteudo.length };
        const lote = fs.writeBatch(db);
        lote.set(refMeta, meta);
        lote.set(fs.doc(db, colecaoConteudo, id), { conteudo });
        await lote.commit();
        return { id, ...meta };
      });
    },
    abrir(id) {
      return executar(async (fs, db) => {
        const [meta, dados] = await Promise.all([fs.getDoc(fs.doc(db, colecao, id)), fs.getDoc(fs.doc(db, colecaoConteudo, id))]);
        if (!meta.exists() || !dados.exists()) throw new Error('Versão não encontrada na nuvem.');
        return { id, ...meta.data(), base: JSON.parse(dados.data().conteudo) };
      });
    },
    remover(id) {
      return executar(async (fs, db) => {
        const lote = fs.writeBatch(db);
        lote.delete(fs.doc(db, colecao, id));
        lote.delete(fs.doc(db, colecaoConteudo, id));
        await lote.commit();
      });
    },
  };
}

/**
 * Armazenamento usado pelos botoes de nuvem: Firebase quando o administrador
 * configurou, senao o armazenamento alternativo (ex.: o do navegador).
 * A configuracao fica guardada neste navegador (localStorage) e tambem pode
 * viajar dentro da base (campo "nuvem.firebase").
 *   criarArmazenamentoNuvem({ chave: 'ctc-app-base', colecao: 'ctc_app_base_versoes', alternativo })
 * Metodos extras: configurar(config, { testar }), removerConfig(), obterConfig(), usandoFirebase().
 */
export function criarArmazenamentoNuvem({ chave = 'ctc-app', colecao = 'ctc_versoes', alternativo } = {}) {
  const CHAVE_CONFIG = `${chave}:firebase-config`;
  const ler = () => {
    try { return JSON.parse(localStorage.getItem(CHAVE_CONFIG) || 'null'); } catch (erro) { return null; }
  };
  let config = ler();
  let firebase = null;
  const atual = () => {
    if (!config) return alternativo;
    if (!firebase) firebase = criarArmazenamentoFirebase({ config, colecao });
    return firebase;
  };
  return {
    get descricao() { return atual().descricao; },
    usandoFirebase: () => Boolean(config),
    obterConfig: () => (config ? { ...config } : null),
    /** Testa a conexao (listando as versoes) e, se der certo, passa a usar o Firebase. */
    async configurar(novaConfig, { testar = true } = {}) {
      const provedor = criarArmazenamentoFirebase({ config: novaConfig, colecao });
      const versoes = testar ? await provedor.listar() : null;
      config = { ...novaConfig };
      firebase = provedor;
      try { localStorage.setItem(CHAVE_CONFIG, JSON.stringify(config)); } catch (erro) { /* navegador sem armazenamento */ }
      return { versoes };
    },
    removerConfig() {
      config = null;
      firebase = null;
      try { localStorage.removeItem(CHAVE_CONFIG); } catch (erro) { /* ignora */ }
    },
    listar: (...args) => atual().listar(...args),
    salvar: (...args) => atual().salvar(...args),
    substituir: (...args) => atual().substituir(...args),
    abrir: (...args) => atual().abrir(...args),
    remover: (...args) => atual().remover(...args),
  };
}
