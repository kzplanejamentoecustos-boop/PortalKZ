/* =============================================================================
   Portal KZ Planejamento — app.js
   Versao: 1.0.0  (KZ App Standard v1.7)

   Ponto unico de entrada dos controles da KZ Planejamento:
   login (Firebase), escolha da obra, controles liberados e gestao de acessos.

   PERFIS
   - Gestor geral: cria obras, nomeia gestores de obra, ve tudo.
   - Gestor da obra: equipe e controles da propria obra.
   - Admin / Editor / Leitor: por obra e por controle.
   Quem garante as permissoes sao as regras do Firestore (firestore.rules).

   ESTRUTURA
   00. Configuracao
   01. Estado e carregamento do perfil
   02. Utilitarios
   03. Pagina: Minhas obras
   04. Pagina: Controles da obra (abrir)
   05. Pagina: Equipe da obra (gestor)
   06. Pagina: Configurar controles da obra (gestor)
   07. Pagina: Obras (gestor geral)
   08. Pagina: Usuarios (gestor geral)
   09. Montagem do aplicativo
   ========================================================================== */

import {
  h, montarAplicativo, criarPainel, criarKpi, criarBadge, criarAlerta, criarCard,
  criarTabela, criarFormulario, criarModal, confirmar, solicitarValor, criarBotao, toast, notificar,
} from './compartilhado/componentes.js';

import { formatarData, ordenar } from './compartilhado/funcionalidades.js';

import {
  iniciarFirebase, observarLogin, sair, carregarPerfil, garantirCadastro,
  criarTelaLogin, criarTelaAviso, abrirPainelSessao,
  PAPEIS, papelNoControle, codigoObra, criarObra, atualizarObra,
  listarMembros, salvarMembro, removerMembro, buscarUsuarioPorEmail, listarUsuarios,
  contarDocumentos, migrarColecao, cadastrarPessoa, enviarEmailDeSenha,
} from './compartilhado/acesso-kz.js';


/* =============================================================================
   00. CONFIGURACAO
   ========================================================================== */

/** Projeto Firebase da KZ (configuracao publica; a seguranca esta nas regras). */
const FIREBASE = {
  apiKey: 'AIzaSyCk1hdv3h8A2gDOcaZDRuRtceDiG2bvXOc',
  authDomain: 'kz-planejamento-e-custos.firebaseapp.com',
  projectId: 'kz-planejamento-e-custos',
  storageBucket: 'kz-planejamento-e-custos.firebasestorage.app',
  messagingSenderId: '755715307647',
  appId: '1:755715307647:web:6573d0437b23b880bae74a',
};

const MARCA = { logo: 'KZ', titulo: 'Portal KZ Planejamento' };
const RODAPE = 'KZ App Standard v1.7 — acesso controlado pelo Firebase (login e regras por obra).';
const ENDERECO = 'https://kzplanejamentoecustos-boop.github.io/';
const PORTAL_URL = `${ENDERECO}PortalKZ/`;

/** Controles basicos que toda obra nova recebe (o gestor pode desativar ou incluir proprios). */
const CONTROLES_BASICOS = {
  efetivo: { nome: 'Controle de Efetivo', url: `${ENDERECO}Efetivo/` },
  custos: { nome: 'Controle de Custos', url: `${ENDERECO}Controledecustos/` },
  medicao: { nome: 'Controle de Medição', url: `${ENDERECO}Controledemedi-o/` },
  faturamento: { nome: 'Faturamento Direto', url: `${ENDERECO}FaturamentoDireto/` },
  histograma: { nome: 'Histograma de Mão de Obra', url: `${ENDERECO}Histogramas/` },
  suprimentos: { nome: 'Plano de Suprimentos', url: `${ENDERECO}PLANODESUPRIMENTOS/` },
  cronograma: { nome: 'Cronograma Gerencial', url: `${ENDERECO}CronogramaGerencial/` },
  organograma: { nome: 'Organograma', url: `${ENDERECO}organograma/` },
  'relatorio-fotografico': { nome: 'Relatório Fotográfico', url: `${ENDERECO}RelatorioFotografico/` },
  'relatorio-bexup': { nome: 'Relatório BEXUP', url: `${ENDERECO}RELATORIOBEXUP/` },
};

/**
 * Migracao dos dados de antes do Portal (todos eram da WSF3).
 * Cada controle entra aqui quando o aplicativo dele passa a ler obras/{obra}/{controle}.
 */
const OBRA_MIGRACAO = 'wsf3';
const MIGRACOES = [
  { controle: 'efetivo', nome: 'Controle de Efetivo', origem: 'Controle de Efetivo' },
  { controle: 'faturamento', nome: 'Faturamento Direto (versões salvas)', origem: 'ctc_faturamento_direto_versoes', comConteudo: true },
];

const VARIANTE_PAPEL ={ admin: 'solid', editor: 'info', leitor: 'neutral' };
const CHAVE_OBRA = 'kz-portal-obra';


/* =============================================================================
   01. ESTADO E CARREGAMENTO DO PERFIL
   ========================================================================== */

let usuarioAtual = null;   // usuario do Firebase Auth
let perfil = null;         // { uid, email, nome, gestorGeral, obras: [...] }
let obraAtual = null;      // item de perfil.obras
let app = null;
let telaAguardando = null;

const telaLogin = criarTelaLogin({
  logo: MARCA.logo,
  titulo: MARCA.titulo,
  subtitulo: 'Acesso às obras e controles',
  rodape: RODAPE,
  permitirCriarConta: false,
});

function limparTela() {
  telaLogin.remover();
  if (telaAguardando) { telaAguardando.remover(); telaAguardando = null; }
  if (app) { app.destruir(); app = null; }
}

async function sairDoPortal() {
  try { await sair(); } catch (erro) { toast.erro('Não foi possível sair', erro.message); }
}

/** (Re)carrega o perfil e mostra a tela certa. pagina: pagina a abrir depois. */
async function recarregar(pagina) {
  if (!usuarioAtual) return;
  try {
    perfil = await carregarPerfil(usuarioAtual);
    if (!perfil.temCadastro) {
      await garantirCadastro(usuarioAtual);
      perfil.temCadastro = true;
    }
  } catch (erro) {
    limparTela();
    telaLogin.mostrar();
    toast.erro('Não foi possível carregar seu acesso', erro.message);
    return;
  }

  limparTela();
  // Todo mundo com login entra. Quem nao e gestor ve so "Minhas obras" e os controles liberados;
  // a obra so aparece se a pessoa tiver acesso a pelo menos um controle dela.
  perfil.obras = perfil.obras.filter((o) => ehGestorDaObra(o)
    || listaControles(o).some((c) => papelNoControle(o.membro, c.id)));

  const salva = lerObraSalva();
  obraAtual = perfil.obras.find((o) => o.id === (obraAtual && obraAtual.id))
    || perfil.obras.find((o) => o.id === salva)
    || perfil.obras[0] || null;
  // Sem pagina pedida (F5, link direto, login): fica na pagina do # da URL, se ela estiver no menu desta pessoa.
  const doHash = window.location.hash.slice(1);
  montarPortal(pagina || (paginaPermitida(doHash) ? doHash : 'inicio'));
}

/** A pagina aparece no menu desta pessoa, com a obra atual? */
function paginaPermitida(id) {
  if (id === 'inicio') return true;
  if (id === 'controles') return Boolean(obraAtual);
  if (id === 'equipe' || id === 'config-controles') return Boolean(obraAtual) && ehGestorDaObra(obraAtual);
  if (id === 'obras' || id === 'usuarios' || id === 'migracao') return Boolean(perfil && perfil.gestorGeral);
  return false;
}


/* =============================================================================
   02. UTILITARIOS
   ========================================================================== */

function lerObraSalva() {
  try { return localStorage.getItem(CHAVE_OBRA); } catch { return null; }
}
function guardarObra(id) {
  try { localStorage.setItem(CHAVE_OBRA, id); } catch { /* preferencia opcional */ }
}

const ehGestorDaObra = (obra) => Boolean(perfil.gestorGeral || (obra && obra.membro && obra.membro.gestor));

function selecionarObra(obra, pagina = 'controles') {
  obraAtual = obra;
  guardarObra(obra.id);
  montarPortal(pagina);
}

function listaControles(obra) {
  return ordenar(Object.entries((obra && obra.controles) || {}).map(([id, c]) => ({ id, ...c })), 'nome');
}

function badgePapel(papel) {
  return papel ? criarBadge({ texto: PAPEIS[papel] || papel, variante: VARIANTE_PAPEL[papel] }) : criarBadge({ texto: 'Sem acesso', variante: 'neutral' });
}

/** Resumo legivel das permissoes de um membro. */
function resumoAcesso(membro, obra) {
  if (membro.gestor) return 'Gestor da obra (todos os controles)';
  const papeis = membro.papeis || {};
  const partes = [];
  if (papeis['*']) partes.push(`Todos: ${PAPEIS[papeis['*']]}`);
  listaControles(obra).forEach((c) => {
    const p = papeis[c.id];
    if (p === 'nenhum') partes.push(`${c.nome}: sem acesso`);
    else if (p) partes.push(`${c.nome}: ${PAPEIS[p]}`);
  });
  return partes.join(' · ') || 'Sem acesso a controles';
}

/** Painel que mostra "Carregando..." e depois o conteudo de uma funcao assincrona. */
function painelAssincrono(config, carregar) {
  const painel = criarPainel({ ...config, conteudo: h('p', { class: 'ctc-text-muted ctc-text-sm' }, 'Carregando…') });
  carregar()
    .then((conteudo) => painel.definirConteudo(conteudo))
    .catch((erro) => painel.definirConteudo(criarAlerta({ tipo: 'danger', titulo: 'Erro ao carregar', mensagem: erro.message })));
  return painel;
}

function validarLink(valor) {
  try {
    const u = new URL(valor);
    return u.protocol === 'https:' ? true : 'Use um endereço que comece com https://';
  } catch {
    return 'Endereço inválido.';
  }
}


/* =============================================================================
   02b. LANCADOR DE APLICATIVOS (icones e cores de cada controle)
   ========================================================================== */

/** Desenho (SVG 24x24, traco) de cada controle. */
const ICONES_APP = {
  efetivo: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.2c3 .2 5.5 2.6 5.5 5.8"/>',
  custos: '<circle cx="12" cy="12" r="9"/><path d="M15 9.2c-.6-1-1.7-1.6-3-1.6-1.8 0-3 1-3 2.3 0 3.2 6 1.8 6 4.8 0 1.3-1.3 2.3-3 2.3-1.4 0-2.6-.6-3.2-1.7M12 6v1.6M12 16.9v1.6"/>',
  medicao: '<rect x="2.5" y="8" width="19" height="8" rx="1.5"/><path d="M6 8v3.5M9.5 8v2M13 8v3.5M16.5 8v2M20 8v3.5"/>',
  faturamento: '<path d="M6 3h12v18l-2.5-1.6L13 21l-2.5-1.6L8 21l-2-1.4V3z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  histograma: '<path d="M3 21h18"/><rect x="5" y="11" width="3" height="10"/><rect x="10.5" y="6" width="3" height="15"/><rect x="16" y="14" width="3" height="7"/>',
  suprimentos: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  cronograma: '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v3M16 3v3"/><path d="M7 13h6M10 16.5h7"/>',
  organograma: '<rect x="9" y="3" width="6" height="5" rx="1"/><rect x="3" y="16" width="6" height="5" rx="1"/><rect x="15" y="16" width="6" height="5" rx="1"/><path d="M12 8v4M6 16v-4h12v4"/>',
  'relatorio-fotografico': '<path d="M4 7.5h3l1.7-2.5h6.6L17 7.5h3a1 1 0 011 1V19a1 1 0 01-1 1H4a1 1 0 01-1-1V8.5a1 1 0 011-1z"/><circle cx="12" cy="13.3" r="3.6"/>',
  'relatorio-bexup': '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M8.5 10h7M8.5 13.5h7M8.5 17h4"/>',
  atividades: '<rect x="4" y="3.5" width="16" height="17.5" rx="2"/><path d="M8 9l1.5 1.5L12 8M8 15l1.5 1.5L12 14M14 9.5h3M14 15.5h3"/>',
  padrao: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
};
/** Cor de cada controle (classes kz-cor-N do portal.css). */
const COR_APP = {
  efetivo: 2, custos: 5, medicao: 3, faturamento: 1, histograma: 4, suprimentos: 7,
  cronograma: 8, organograma: 2, 'relatorio-fotografico': 6, 'relatorio-bexup': 7, atividades: 4,
};

/** Chave do icone: pelo codigo do controle ou, nos controles proprios, pelo nome. */
function chaveApp(controle) {
  if (ICONES_APP[controle.id]) return controle.id;
  const nome = String(controle.nome || '').toLowerCase();
  if (nome.includes('atividade')) return 'atividades';
  return Object.keys(ICONES_APP).find((k) => nome.includes(k.split('-')[0])) || 'padrao';
}

function iconeApp(chave, cor) {
  const caixa = h('span', { class: `kz-app__icone kz-cor-${cor}`, 'aria-hidden': 'true' });
  caixa.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONES_APP[chave]}</svg>`;
  return caixa;
}

/** Faixa colorida no topo da pagina. */
function faixaBoasVindas(titulo, texto, acao) {
  return h('div', { class: 'kz-boas-vindas' },
    h('div', {}, h('p', { class: 'kz-boas-vindas__titulo' }, titulo), h('p', { class: 'kz-boas-vindas__texto' }, texto)),
    acao ? h('div', { class: 'kz-boas-vindas__acao' }, acao) : null);
}

function primeiroNome() {
  return String(perfil.nome || '').split(/[\s.@]/)[0].replace(/^./, (l) => l.toUpperCase());
}


/* =============================================================================
   03. PAGINA: MINHAS OBRAS
   ========================================================================== */

function paginaInicio() {
  const obras = perfil.obras;
  const ativas = obras.filter((o) => o.situacao !== 'encerrada').length;

  const cartoes = obras.map((obra, i) => {
    const qtd = listaControles(obra).filter((c) => papelNoControle(obra.membro, c.id)).length;
    return h('button', { type: 'button', class: 'kz-app', onClick: () => selecionarObra(obra), title: `Abrir ${obra.nome}` },
      h('span', { class: `kz-app__icone kz-cor-${[7, 1, 2, 4, 3][i % 5]}`, 'aria-hidden': 'true' },
        h('span', { class: 'kz-app__sigla' }, obra.sigla || obra.id)),
      h('span', { class: 'kz-app__textos' },
        h('span', { class: 'kz-app__nome' }, obra.nome),
        h('span', { class: 'kz-app__linha' },
          obra.situacao === 'encerrada' ? criarBadge({ texto: 'Encerrada', variante: 'neutral' }) : criarBadge({ texto: 'Ativa', variante: 'success' })),
        h('span', { class: 'kz-app__papel' }, ehGestorDaObra(obra) ? `Você é gestor · ${qtd} aplicativo(s)` : `${qtd} aplicativo(s) liberado(s)`)));
  });

  const faixa = faixaBoasVindas(`Olá, ${primeiroNome()}!`, obras.length ? 'Escolha a obra para ver os seus aplicativos.' : 'Ainda não há obras liberadas para você.');
  const painelObras = criarPainel({
    titulo: 'Minhas obras', icone: 'painel',
    conteudo: obras.length ? h('div', { class: 'kz-apps kz-apps--obras' }, cartoes) : h('p', { class: 'ctc-text-muted' }, perfil.gestorGeral ? 'Nenhuma obra cadastrada.' : 'Nenhuma obra liberada para você. Fale com o gestor da obra.'),
  }).elemento;
  // Quem nao e gestor ve so a lista de obras.
  if (!souGestor()) return [faixa, painelObras];

  return [
    faixa,
    h('div', { class: 'ctc-grid ctc-grid--3' },
      criarKpi({ rotulo: 'Obras com acesso', valor: obras.length, formato: 'numero', tamanho: 'lg' }).elemento,
      criarKpi({ rotulo: 'Obras ativas', valor: ativas, formato: 'numero', variante: 'success' }).elemento,
      criarKpi({ rotulo: 'Seu perfil', valor: perfil.gestorGeral ? 'Gestor geral' : (obras.some((o) => o.membro.gestor) ? 'Gestor de obra' : 'Usuário'), variante: 'accent' }).elemento),
    obras.length || !perfil.gestorGeral ? null : criarAlerta({
      tipo: 'info',
      titulo: 'Nenhuma obra cadastrada',
      mensagem: 'Crie a primeira obra em Gestão geral > Obras.',
      acoes: perfil.gestorGeral ? [{ texto: 'Ir para Obras', onClick: () => app.navegar('obras') }] : [],
    }),
    painelObras,
  ];
}


/* =============================================================================
   04. PAGINA: CONTROLES DA OBRA
   ========================================================================== */

function abrirControle(obra, controle) {
  const url = new URL(controle.url);
  url.searchParams.set('obra', obra.id);
  window.open(url.toString(), '_blank', 'noopener');
}

function paginaControles() {
  if (!obraAtual) return [criarAlerta({ tipo: 'info', mensagem: 'Escolha uma obra em "Minhas obras".' })];
  const obra = obraAtual;
  const liberados = listaControles(obra).filter((c) => papelNoControle(obra.membro, c.id));

  // Cada controle e um "aplicativo": icone colorido + nome; um clique abre o controle.
  const cartoes = liberados.map((c, i) => {
    const papel = papelNoControle(obra.membro, c.id);
    const chave = chaveApp(c);
    const cor = COR_APP[chave] || (i % 8) + 1;
    return h('button', { type: 'button', class: `kz-app kz-cor-${cor}`, onClick: () => abrirControle(obra, c), title: `Abrir ${c.nome}` },
      c.basico ? null : h('span', { class: 'kz-app__marca' }, 'Da obra'),
      iconeApp(chave, cor),
      h('span', { class: 'kz-app__nome' }, c.nome),
      h('span', { class: 'kz-app__papel' }, PAPEIS[papel] || papel));
  });

  return [
    faixaBoasVindas(obra.nome, liberados.length ? 'Clique em um aplicativo para abrir.' : 'Nenhum aplicativo liberado para você nesta obra.'),
    criarAlerta({
      tipo: 'warning',
      titulo: 'Adaptação em andamento',
      mensagem: 'Os controles estão sendo adaptados, um por vez, para gravar os dados separados por obra. Enquanto isso, alguns ainda abrem no modelo antigo.',
      fechavel: true,
    }),
    criarPainel({
      titulo: 'Meus aplicativos', icone: 'painel', tag: obra.sigla,
      conteudo: liberados.length
        ? h('div', { class: 'kz-apps' }, cartoes)
        : h('p', { class: 'ctc-text-muted' }, 'Nenhum controle liberado para você nesta obra. Fale com o gestor da obra.'),
    }).elemento,
  ];
}


/* =============================================================================
   05. PAGINA: EQUIPE DA OBRA (gestor)
   ========================================================================== */

/**
 * Abre o editor de acesso de uma pessoa encontrada pelo e-mail ou pela lista de contas.
 * Se ela ja for da obra, carrega os acessos atuais (e avisa), para nao apaga-los ao salvar.
 */
async function abrirEditorPessoa(obra, pessoa, aoSalvar, senhaProvisoria = '') {
  let existente = null;
  try {
    existente = (await listarMembros(obra.id)).find((m) => m.uid === pessoa.uid) || null;
  } catch (erro) {
    toast.erro('Não foi possível conferir a equipe da obra', erro.message);
    return;
  }
  if (!existente) {
    abrirEditorMembro(obra, { uid: pessoa.uid, nome: pessoa.nome, email: pessoa.email, papeis: {} }, aoSalvar, senhaProvisoria);
    return;
  }
  if (existente.gestor && !perfil.gestorGeral) {
    toast.aviso(`${existente.nome || pessoa.nome} já é gestor desta obra`, 'Só o gestor geral altera o acesso de um gestor.');
    return;
  }
  abrirEditorMembro(obra, { ...existente, nome: existente.nome || pessoa.nome, email: existente.email || pessoa.email },
    aoSalvar, senhaProvisoria, true);
}

/** Editor de acesso de uma pessoa na obra. membro: existente ou { uid, nome, email } novo. */
function abrirEditorMembro(obra, membro, aoSalvar, senhaProvisoria = '', avisarJaMembro = false) {
  const papeis = membro.papeis || {};
  const opcoesPadrao = [
    { valor: '', texto: 'Sem acesso' },
    ...Object.entries(PAPEIS).map(([valor, texto]) => ({ valor, texto })),
  ];
  const opcoesControle = [
    { valor: '', texto: 'Igual ao padrão' },
    { valor: 'nenhum', texto: 'Sem acesso' },
    ...Object.entries(PAPEIS).map(([valor, texto]) => ({ valor, texto })),
  ];
  const controles = listaControles(obra);

  const campos = [
    perfil.gestorGeral ? {
      nome: 'gestor', tipo: 'checkbox', larguraTotal: true, valor: Boolean(membro.gestor),
      rotulo: 'Gestor desta obra (libera pessoas e controles da obra; acessa todos os controles)',
    } : null,
    {
      nome: 'padrao', rotulo: 'Padrão para todos os controles da obra', tipo: 'select', larguraTotal: true,
      opcoes: opcoesPadrao, valor: papeis['*'] || '',
      dica: 'Leitor: só vê · Editor: vê e salva · Admin: vê, salva e exclui',
    },
    ...controles.map((c) => ({ nome: `c_${c.id}`, rotulo: c.nome, tipo: 'select', opcoes: opcoesControle, valor: papeis[c.id] || '' })),
  ].filter(Boolean);

  const formulario = criarFormulario({
    colunas: 2,
    semBotoes: true,
    campos,
    onEnviar: async (v) => {
      const novos = {};
      if (v.padrao) novos['*'] = v.padrao;
      controles.forEach((c) => { if (v[`c_${c.id}`]) novos[c.id] = v[`c_${c.id}`]; });
      try {
        await salvarMembro(obra.id, {
          uid: membro.uid, nome: membro.nome, email: membro.email,
          gestor: perfil.gestorGeral ? Boolean(v.gestor) : false,
          papeis: novos,
        }, perfil.email);
        modal.fechar();
        toast.sucesso('Acesso salvo', `${membro.nome} — ${obra.sigla}`);
        aoSalvar();
        abrirLinksAcesso(obra, { ...membro, gestor: perfil.gestorGeral ? Boolean(v.gestor) : false, papeis: novos }, senhaProvisoria);
      } catch (erro) {
        toast.erro('Acesso não salvo', erro.message);
      }
    },
  });

  const modal = criarModal({
    titulo: `Acesso de ${membro.nome} — ${obra.sigla}`,
    tamanho: 'lg',
    destruirAoFechar: true,
    conteudo: [
      avisarJaMembro ? criarAlerta({
        tipo: 'info',
        titulo: `${membro.nome} já faz parte desta obra.`,
        mensagem: 'Os acessos atuais foram carregados abaixo; altere só o que precisar.',
      }) : null,
      h('p', { class: 'ctc-text-muted ctc-text-sm' }, membro.email),
      formulario.elemento,
    ],
    acoes: [
      membro.email ? {
        texto: 'Reenviar e-mail de senha', variante: 'ghost', fechar: false,
        onClick: () => reenviarEmailDeSenha(membro),
      } : null,
      { texto: 'Cancelar', variante: 'outline' },
      { texto: 'Salvar acesso', variante: 'primary', fechar: false, onClick: () => formulario.enviar() },
    ].filter(Boolean),
  });
  modal.abrir();
}

/** Reenvia o e-mail para a pessoa criar (ou trocar) a senha. */
async function reenviarEmailDeSenha(membro) {
  const ok = await confirmar({
    titulo: 'Reenviar e-mail de senha?',
    mensagem: `Vamos enviar para ${membro.email} um e-mail para ${membro.nome || 'a pessoa'} criar uma senha nova. A senha atual deixa de valer quando a nova for criada.`,
    textoConfirmar: 'Reenviar',
  });
  if (!ok) return;
  try {
    await enviarEmailDeSenha(membro.email);
    notificar({
      tipo: 'success', duracao: 0,
      titulo: 'E-mail reenviado',
      mensagem: `Enviado para ${membro.email}. Se não chegar em alguns minutos, peça para olhar o spam e a quarentena (remetente noreply@kz-planejamento-e-custos.firebaseapp.com).`,
    });
  } catch (erro) {
    toast.erro('E-mail não enviado', erro.message);
  }
}

/** Link direto de um controle numa obra (sem passar pelo Portal). */
function linkControle(obra, controle) {
  const url = new URL(controle.url);
  url.searchParams.set('obra', obra.id);
  return url.toString();
}

async function copiar(texto, rotulo = 'Copiado') {
  try { await navigator.clipboard.writeText(texto); toast.sucesso(rotulo); }
  catch { toast.aviso('Não foi possível copiar', 'Selecione o texto e copie com Ctrl+C.'); }
}

/**
 * Mostra os links dos controles liberados para a pessoa nesta obra, prontos para enviar.
 * senhaProvisoria (opcional) entra so na mensagem copiada; nao e guardada.
 */
function abrirLinksAcesso(obra, membro, senhaProvisoria = '') {
  const liberados = listaControles(obra)
    .map((c) => ({ ...c, papel: papelNoControle(membro, c.id) }))
    .filter((c) => c.papel);
  const linhas = liberados.map((c) => `• ${c.nome} (${PAPEIS[c.papel]}): ${linkControle(obra, c)}`);
  const mensagem = [
    `Olá, ${String(membro.nome || '').split(' ')[0]}! Seu acesso na obra ${obra.nome} (${obra.sigla}):`,
    '',
    ...linhas,
    '',
    `Login: ${membro.email}`,
    senhaProvisoria ? `Senha provisória: ${senhaProvisoria}` : 'Senha: a que você criou (ou use "Esqueci a senha" na tela de login).',
  ].join('\n');

  criarModal({
    titulo: `Links de acesso — ${membro.nome}`,
    tamanho: 'lg',
    destruirAoFechar: true,
    conteudo: liberados.length ? [
      criarAlerta({ tipo: 'info', mensagem: 'Envie para a pessoa só estes links (por e-mail ou WhatsApp). Ela entra direto no controle, com o login dela, sem ver este painel.' }),
      criarTabela({
        dados: liberados, altura: 'auto', compacta: true,
        colunas: [
          { campo: 'nome', titulo: 'Controle' },
          { campo: 'papel', titulo: 'Perfil', render: (v) => badgePapel(v) },
          { campo: 'url', titulo: 'Link', ordenavel: false, classe: 'ctc-mono', formatar: (_, c) => linkControle(obra, c) },
          {
            campo: 'acoes', titulo: '', ordenavel: false, classe: 'ctc-col--actions',
            render: (_, c) => criarBotao({ texto: 'Copiar', variante: 'ghost', tamanho: 'sm', onClick: () => copiar(linkControle(obra, c), 'Link copiado') }),
          },
        ],
      }).elemento,
      h('p', { class: 'ctc-text-sm ctc-text-muted' }, 'Mensagem pronta (com todos os links e o login):'),
      h('pre', { class: 'ctc-mono ctc-text-sm' }, mensagem),
    ] : [criarAlerta({ tipo: 'warning', mensagem: 'Esta pessoa ainda não tem nenhum controle liberado nesta obra.' })],
    acoes: [
      { texto: 'Fechar', variante: 'outline' },
      liberados.length ? { texto: 'Copiar mensagem', icone: 'documento', variante: 'primary', fechar: false, onClick: () => copiar(mensagem, 'Mensagem copiada') } : null,
    ].filter(Boolean),
  }).abrir();
}

/**
 * O e-mail ja tem login no Firebase, mas a pessoa nunca entrou no Portal (sem cadastro).
 * O Portal nao consegue ver esse login; a saida e mandar o e-mail de acesso: no primeiro
 * login o cadastro e criado e a pessoa aparece em Usuarios / "Adicionar pessoa".
 */
function abrirContaSemCadastro(email, nome) {
  criarModal({
    titulo: 'Este e-mail já tem login',
    destruirAoFechar: true,
    conteudo: [
      h('p', {}, `${email} já tem um login antigo no Firebase, sem cadastro na KZ (provavelmente de uma tentativa anterior). O painel não consegue reaproveitar esse login.`),
      criarAlerta({
        tipo: 'info',
        titulo: 'Como resolver (1 minuto)',
        mensagem: 'No console do Firebase: Authentication > Usuários > procure este e-mail > ⋮ > Excluir conta. Depois volte aqui e use "Cadastrar pessoa nova" de novo.',
      }),
    ],
    acoes: [
      { texto: 'Entendi', variante: 'primary' },
    ],
  }).abrir();
}

/**
 * Cadastra uma pessoa nova pelo Portal (sem ela precisar clicar em "Criar conta")
 * e em seguida abre o acesso dela na obra.
 */
function abrirCadastroPessoa(obra, aoSalvar, emailInicial = '') {
  const formulario = criarFormulario({
    colunas: 1,
    semBotoes: true,
    valores: { email: emailInicial, modo: 'provisoria' },
    campos: [
      { nome: 'nome', rotulo: 'Nome completo', obrigatorio: true, regras: { minCaracteres: 3, maxCaracteres: 80 } },
      { nome: 'email', rotulo: 'E-mail', tipo: 'email', obrigatorio: true },
      {
        nome: 'modo', rotulo: 'Senha', tipo: 'radio', obrigatorio: true,
        opcoes: [
          { valor: 'provisoria', texto: 'Definir uma senha provisória (vai junto com os links)' },
          { valor: 'email', texto: 'Enviar e-mail para a pessoa criar a própria senha' },
        ],
      },
      {
        nome: 'senha', rotulo: 'Senha provisória (se escolheu essa opção)', tipo: 'senha',
        dica: 'Mínimo 8 caracteres. Ela pode trocar depois em "Esqueci a senha" na tela de login do controle.',
        regras: { validar: (v, valores) => (valores.modo !== 'provisoria' || String(v || '').length >= 8 ? true : 'Informe ao menos 8 caracteres.') },
        atributos: { autocomplete: 'new-password' },
      },
    ],
    onEnviar: async (v) => {
      let pessoa;
      try {
        pessoa = await cadastrarPessoa({ nome: v.nome, email: v.email, senha: v.modo === 'provisoria' ? v.senha : null });
      } catch (erro) {
        if (erro.code === 'conta-sem-cadastro') {
          modal.fechar();
          abrirContaSemCadastro(v.email, v.nome);
          return;
        }
        if (erro.code === 'auth/admin-restricted-operation') {
          formulario.definirErro('email', 'O Firebase está com a criação de contas desligada. Um gestor geral precisa ligar em Firebase > Authentication > Configurações > Ações do usuário > "Ativar criação (inscrição)". Depois, clique em Cadastrar de novo.');
          return;
        }
        formulario.definirErro('email', erro.message);
        return;
      }
      modal.fechar();
      if (pessoa.jaExistia) {
        toast.info('Esta pessoa já tem conta', `${pessoa.nome} — defina o acesso dela na ${obra.sigla}.`);
      } else if (v.modo === 'email') {
        try {
          await enviarEmailDeSenha(pessoa.email);
          notificar({
            tipo: 'success', duracao: 0,
            titulo: `Conta criada: ${pessoa.nome}`,
            mensagem: `Enviamos para ${pessoa.email} um e-mail para criar a senha (veja também o spam). Em seguida, defina o acesso e envie os links dos controles.`,
          });
        } catch (erro) {
          toast.aviso('Conta criada, mas o e-mail não foi enviado', `${erro.message} Use "Esqueci a senha" no login ou defina uma senha provisória.`);
        }
      } else {
        toast.sucesso(`Conta criada: ${pessoa.nome}`, 'Agora defina o acesso; em seguida aparecem os links para enviar.');
      }
      await abrirEditorPessoa(obra, pessoa, aoSalvar,
        !pessoa.jaExistia && v.modo === 'provisoria' ? v.senha : '');
    },
  });
  const modal = criarModal({
    titulo: `Cadastrar pessoa nova — ${obra.sigla}`,
    destruirAoFechar: true,
    conteudo: [
      criarAlerta({ tipo: 'info', mensagem: 'A conta é criada agora; em seguida você define o acesso nesta obra e recebe os links diretos dos controles para enviar à pessoa. Ela não precisa acessar este painel. Você continua logado com a sua conta.' }),
      formulario.elemento,
    ],
    acoes: [
      { texto: 'Cancelar', variante: 'outline' },
      { texto: 'Cadastrar', variante: 'primary', fechar: false, onClick: () => formulario.enviar() },
    ],
  });
  modal.abrir();
}

async function adicionarPessoa(obra, aoSalvar, emailInicial = '') {
  const email = await solicitarValor({ titulo: 'Adicionar pessoa à obra', rotulo: 'E-mail da pessoa', tipo: 'email', valor: emailInicial, obrigatorio: true, textoConfirmar: 'Procurar' });
  if (!email) return;
  try {
    const encontrado = await buscarUsuarioPorEmail(email);
    if (!encontrado) {
      criarModal({
        titulo: 'Conta não encontrada',
        tamanho: 'sm',
        destruirAoFechar: true,
        conteudo: h('p', {}, `Não há conta para ${email}. Você pode cadastrar a pessoa agora.`),
        acoes: [
          { texto: 'Cancelar', variante: 'outline' },
          { texto: 'Cadastrar agora', variante: 'primary', onClick: () => abrirCadastroPessoa(obra, aoSalvar, email) },
        ],
      }).abrir();
      return;
    }
    await abrirEditorPessoa(obra, encontrado, aoSalvar);
  } catch (erro) {
    toast.erro('Não foi possível procurar', erro.message);
  }
}

function paginaEquipe() {
  const obra = obraAtual;
  if (!obra || !ehGestorDaObra(obra)) return [criarAlerta({ tipo: 'warning', mensagem: 'Somente o gestor da obra acessa esta página.' })];
  const atualizar = () => app.navegar('equipe');

  const painel = painelAssincrono({ titulo: `Equipe — ${obra.nome}`, icone: 'usuario', tag: obra.sigla, semEspaco: true }, async () => {
    const membros = ordenar(await listarMembros(obra.id), 'nome');
    return criarTabela({
      dados: membros,
      altura: 'auto',
      compacta: true,
      vazio: { titulo: 'Ninguém nesta obra ainda', mensagem: 'Use "Adicionar pessoa".' },
      colunas: [
        { campo: 'nome', titulo: 'Nome' },
        { campo: 'email', titulo: 'E-mail' },
        { campo: 'gestor', titulo: 'Perfil', render: (v) => (v ? criarBadge({ texto: 'Gestor', variante: 'solid' }) : criarBadge({ texto: 'Membro', variante: 'neutral' })) },
        { campo: 'papeis', titulo: 'Acesso', ordenavel: false, formatar: (_, linha) => resumoAcesso(linha, obra) },
        {
          campo: 'acoes', titulo: '', ordenavel: false, classe: 'ctc-col--actions',
          render: (_, linha) => {
            const podeMexer = perfil.gestorGeral || !linha.gestor;
            return h('div', { class: 'ctc-btn-group' },
              criarBotao({ texto: 'Links', variante: 'ghost', tamanho: 'sm', titulo: `Links de acesso de ${linha.nome}`, onClick: () => abrirLinksAcesso(obra, linha) }),
              criarBotao({ icone: 'editar', variante: 'ghost', tamanho: 'sm', titulo: `Editar acesso de ${linha.nome}`, desabilitado: !podeMexer, onClick: () => abrirEditorMembro(obra, linha, atualizar) }),
              criarBotao({
                icone: 'lixeira', variante: 'ghost', tamanho: 'sm', titulo: `Remover ${linha.nome} da obra`, desabilitado: !podeMexer || linha.uid === perfil.uid,
                onClick: async () => {
                  const ok = await confirmar({ titulo: `Remover ${linha.nome}?`, mensagem: `A pessoa perde o acesso a todos os controles da ${obra.sigla}. Os dados não são apagados.`, textoConfirmar: 'Remover', perigo: true });
                  if (!ok) return;
                  try { await removerMembro(obra.id, linha.uid); toast.sucesso('Acesso removido', linha.nome); atualizar(); }
                  catch (erro) { toast.erro('Não removido', erro.message); }
                },
              }));
          },
        },
      ],
    }).elemento;
  });

  return [
    criarAlerta({
      tipo: 'info',
      mensagem: perfil.gestorGeral
        ? 'Como gestor geral, você também pode nomear o gestor desta obra (caixa "Gestor desta obra" ao editar).'
        : 'Você libera pessoas e controles somente nesta obra. Gestores da obra são nomeados pelos gestores gerais.',
    }),
    painel.elemento,
  ];
}


/* =============================================================================
   06. PAGINA: CONFIGURAR CONTROLES DA OBRA (gestor)
   ========================================================================== */

async function gravarControles(obra, controles, mensagem) {
  try {
    await atualizarObra(obra.id, { controles }, perfil.email);
    toast.sucesso(mensagem, obra.sigla);
    await recarregar('config-controles');
  } catch (erro) {
    toast.erro('Não foi possível salvar', erro.message);
  }
}

function abrirAtivarBasicos(obra) {
  const faltando = Object.entries(CONTROLES_BASICOS).filter(([id]) => !(obra.controles || {})[id]);
  if (!faltando.length) { toast.info('Todos os controles básicos já estão ativos'); return; }
  const formulario = criarFormulario({
    colunas: 2,
    semBotoes: true,
    campos: faltando.map(([id, c]) => ({ nome: id, rotulo: c.nome, tipo: 'checkbox', valor: true })),
    onEnviar: async (v) => {
      const controles = { ...(obra.controles || {}) };
      faltando.forEach(([id, c]) => { if (v[id]) controles[id] = { ...c, basico: true }; });
      modal.fechar();
      await gravarControles(obra, controles, 'Controles ativados');
    },
  });
  const modal = criarModal({
    titulo: 'Ativar controles básicos',
    destruirAoFechar: true,
    conteudo: formulario.elemento,
    acoes: [
      { texto: 'Cancelar', variante: 'outline' },
      { texto: 'Ativar marcados', variante: 'primary', fechar: false, onClick: () => formulario.enviar() },
    ],
  });
  modal.abrir();
}

function abrirControleProprio(obra, existente = null) {
  const formulario = criarFormulario({
    colunas: 1,
    semBotoes: true,
    valores: existente ? { nome: existente.nome, url: existente.url } : {},
    campos: [
      { nome: 'nome', rotulo: 'Nome do controle', obrigatorio: true, regras: { minCaracteres: 3, maxCaracteres: 60 } },
      { nome: 'url', rotulo: 'Link do aplicativo', obrigatorio: true, placeholder: 'https://kzplanejamentoecustos-boop.github.io/...', regras: { validar: validarLink } },
    ],
    onEnviar: async ({ nome, url }) => {
      const id = existente ? existente.id : codigoObra(nome);
      const controles = { ...(obra.controles || {}) };
      if (!existente && (controles[id] || CONTROLES_BASICOS[id] || id === 'membros')) {
        formulario.definirErro('nome', 'Já existe um controle com esse nome nesta obra.');
        return;
      }
      controles[id] = { nome, url, basico: false };
      modal.fechar();
      await gravarControles(obra, controles, existente ? 'Controle atualizado' : 'Controle cadastrado');
    },
  });
  const modal = criarModal({
    titulo: existente ? `Editar ${existente.nome}` : 'Cadastrar controle próprio da obra',
    destruirAoFechar: true,
    conteudo: [
      criarAlerta({ tipo: 'info', mensagem: 'O controle próprio é um aplicativo feito no padrão KZ e publicado no GitHub. Aqui você só cadastra o nome e o link.' }),
      formulario.elemento,
    ],
    acoes: [
      { texto: 'Cancelar', variante: 'outline' },
      { texto: 'Salvar', variante: 'primary', fechar: false, onClick: () => formulario.enviar() },
    ],
  });
  modal.abrir();
}

function paginaConfigControles() {
  const obra = obraAtual;
  if (!obra || !ehGestorDaObra(obra)) return [criarAlerta({ tipo: 'warning', mensagem: 'Somente o gestor da obra acessa esta página.' })];

  const tabela = criarTabela({
    dados: listaControles(obra),
    altura: 'auto',
    compacta: true,
    vazio: { titulo: 'Nenhum controle ativo', mensagem: 'Use "Ativar controles básicos".' },
    colunas: [
      { campo: 'nome', titulo: 'Controle' },
      { campo: 'basico', titulo: 'Tipo', render: (v) => (v ? criarBadge({ texto: 'Básico', variante: 'info' }) : criarBadge({ texto: 'Próprio da obra', variante: 'warning' })) },
      { campo: 'id', titulo: 'Código', classe: 'ctc-mono' },
      {
        campo: 'acoes', titulo: '', ordenavel: false, classe: 'ctc-col--actions',
        render: (_, c) => h('div', { class: 'ctc-btn-group' },
          c.basico ? null : criarBotao({ icone: 'editar', variante: 'ghost', tamanho: 'sm', titulo: `Editar ${c.nome}`, onClick: () => abrirControleProprio(obra, c) }),
          criarBotao({
            icone: 'lixeira', variante: 'ghost', tamanho: 'sm', titulo: `Desativar ${c.nome}`,
            onClick: async () => {
              const ok = await confirmar({ titulo: `Desativar ${c.nome}?`, mensagem: 'O controle some do portal desta obra. Os dados gravados não são apagados e voltam se você ativar de novo.', textoConfirmar: 'Desativar', perigo: true });
              if (!ok) return;
              const controles = { ...(obra.controles || {}) };
              delete controles[c.id];
              await gravarControles(obra, controles, 'Controle desativado');
            },
          })),
      },
    ],
  });

  return [criarPainel({ titulo: `Controles da obra — ${obra.nome}`, icone: 'configuracao', tag: obra.sigla, semEspaco: true, conteudo: tabela.elemento }).elemento];
}


/* =============================================================================
   07. PAGINA: OBRAS (gestor geral)
   ========================================================================== */

function abrirNovaObra() {
  const formulario = criarFormulario({
    colunas: 2,
    semBotoes: true,
    campos: [
      { nome: 'nome', rotulo: 'Nome da obra', obrigatorio: true, larguraTotal: true, regras: { minCaracteres: 3, maxCaracteres: 100 } },
      {
        nome: 'sigla', rotulo: 'Sigla (vira o código da obra)', obrigatorio: true, placeholder: 'Ex.: WSF3',
        regras: { maxCaracteres: 12, validar: (v) => (codigoObra(v) && codigoObra(v) !== 'membros' ? true : 'Use letras e números.') },
        dica: 'O código não muda depois de criado.',
      },
      ...Object.entries(CONTROLES_BASICOS).map(([id, c]) => ({ nome: `c_${id}`, rotulo: c.nome, tipo: 'checkbox', valor: true })),
    ],
    onEnviar: async (v) => {
      const codigo = codigoObra(v.sigla);
      const controles = {};
      Object.entries(CONTROLES_BASICOS).forEach(([id, c]) => { if (v[`c_${id}`]) controles[id] = { ...c, basico: true }; });
      try {
        await criarObra({ codigo, nome: v.nome.trim(), sigla: v.sigla.trim().toUpperCase(), controles, autor: perfil.email });
        modal.fechar();
        toast.sucesso('Obra criada', `${v.nome} (código ${codigo}). Agora adicione a equipe.`);
        obraAtual = { id: codigo };
        guardarObra(codigo);
        await recarregar('equipe');
      } catch (erro) {
        formulario.definirErro('sigla', erro.message);
      }
    },
  });
  const modal = criarModal({
    titulo: 'Nova obra',
    tamanho: 'lg',
    destruirAoFechar: true,
    conteudo: [
      h('p', { class: 'ctc-text-sm ctc-text-muted' }, 'Controles básicos que a obra recebe (o gestor da obra pode mudar depois):'),
      formulario.elemento,
    ],
    acoes: [
      { texto: 'Cancelar', variante: 'outline' },
      { texto: 'Criar obra', variante: 'primary', fechar: false, onClick: () => formulario.enviar() },
    ],
  });
  modal.abrir();
}

function abrirEditarObra(obra) {
  const formulario = criarFormulario({
    colunas: 1,
    semBotoes: true,
    valores: { nome: obra.nome, situacao: obra.situacao || 'ativa' },
    campos: [
      { nome: 'nome', rotulo: 'Nome da obra', obrigatorio: true, regras: { minCaracteres: 3, maxCaracteres: 100 } },
      { nome: 'situacao', rotulo: 'Situação', tipo: 'select', opcoes: [{ valor: 'ativa', texto: 'Ativa' }, { valor: 'encerrada', texto: 'Encerrada' }] },
    ],
    onEnviar: async (v) => {
      try {
        await atualizarObra(obra.id, { nome: v.nome.trim(), situacao: v.situacao }, perfil.email);
        modal.fechar();
        toast.sucesso('Obra atualizada', obra.sigla);
        await recarregar('obras');
      } catch (erro) {
        toast.erro('Não salvo', erro.message);
      }
    },
  });
  const modal = criarModal({
    titulo: `Editar ${obra.sigla}`,
    tamanho: 'sm',
    destruirAoFechar: true,
    conteudo: formulario.elemento,
    acoes: [
      { texto: 'Cancelar', variante: 'outline' },
      { texto: 'Salvar', variante: 'primary', fechar: false, onClick: () => formulario.enviar() },
    ],
  });
  modal.abrir();
}

function paginaObras() {
  if (!perfil.gestorGeral) return [criarAlerta({ tipo: 'warning', mensagem: 'Somente gestores gerais acessam esta página.' })];
  const tabela = criarTabela({
    dados: perfil.obras.map((o) => ({ ...o, qtdControles: Object.keys(o.controles || {}).length })),
    altura: 'auto',
    vazio: { titulo: 'Nenhuma obra', mensagem: 'Use "Nova obra".' },
    colunas: [
      { campo: 'sigla', titulo: 'Sigla', fixa: true },
      { campo: 'nome', titulo: 'Obra' },
      { campo: 'id', titulo: 'Código', classe: 'ctc-mono' },
      { campo: 'situacao', titulo: 'Situação', render: (v) => (v === 'encerrada' ? criarBadge({ texto: 'Encerrada', variante: 'neutral' }) : criarBadge({ texto: 'Ativa', variante: 'success' })) },
      { campo: 'qtdControles', titulo: 'Controles', tipo: 'numero' },
      { campo: 'criadoEm', titulo: 'Criada em', formatar: (v) => (v ? formatarData(v) : '—') },
      {
        campo: 'acoes', titulo: '', ordenavel: false, classe: 'ctc-col--actions',
        render: (_, o) => h('div', { class: 'ctc-btn-group' },
          criarBotao({ texto: 'Equipe', variante: 'ghost', tamanho: 'sm', onClick: () => selecionarObra(o, 'equipe') }),
          criarBotao({ icone: 'editar', variante: 'ghost', tamanho: 'sm', titulo: `Editar ${o.sigla}`, onClick: () => abrirEditarObra(o) })),
      },
    ],
  });
  return [criarPainel({ titulo: 'Obras', icone: 'painel', semEspaco: true, conteudo: tabela.elemento }).elemento];
}


/* =============================================================================
   08. PAGINA: USUARIOS (gestor geral)
   ========================================================================== */

/** Escolhe a obra e abre o editor de acesso da pessoa nela. */
function escolherObraPara(usuario) {
  const formulario = criarFormulario({
    colunas: 1,
    semBotoes: true,
    campos: [{
      nome: 'obra', rotulo: 'Obra', tipo: 'select', obrigatorio: true, placeholder: 'Selecione',
      opcoes: perfil.obras.map((o) => ({ valor: o.id, texto: `${o.sigla} — ${o.nome}` })),
    }],
    onEnviar: ({ obra: id }) => {
      const obra = perfil.obras.find((o) => o.id === id);
      modal.fechar();
      if (obra) abrirEditorPessoa(obra, usuario, () => app.navegar('usuarios'));
    },
  });
  const modal = criarModal({
    titulo: `Adicionar ${usuario.nome} a uma obra`,
    tamanho: 'sm',
    destruirAoFechar: true,
    conteudo: formulario.elemento,
    acoes: [
      { texto: 'Cancelar', variante: 'outline' },
      { texto: 'Continuar', variante: 'primary', fechar: false, onClick: () => formulario.enviar() },
    ],
  });
  modal.abrir();
}

function paginaUsuarios() {
  if (!perfil.gestorGeral) return [criarAlerta({ tipo: 'warning', mensagem: 'Somente gestores gerais acessam esta página.' })];

  const painel = painelAssincrono({ titulo: 'Contas cadastradas', icone: 'usuario', semEspaco: true }, async () => {
    const [usuarios, membrosPorObra] = await Promise.all([
      listarUsuarios(),
      Promise.all(perfil.obras.map(async (o) => ({ obra: o, membros: await listarMembros(o.id) }))),
    ]);
    const linhas = usuarios.map((u) => {
      const obras = membrosPorObra.filter(({ membros }) => membros.some((m) => m.uid === u.uid)).map(({ obra }) => obra.sigla);
      return { ...u, obras: obras.join(', '), qtd: obras.length };
    });
    return criarTabela({
      dados: ordenar(linhas, [{ campo: 'qtd' }, { campo: 'nome' }]),
      altura: 'auto',
      compacta: true,
      vazio: { titulo: 'Nenhuma conta', mensagem: 'As contas aparecem aqui quando um gestor cadastra a pessoa em Equipe da obra > "Cadastrar pessoa nova".' },
      linhaVariante: (l) => (l.qtd ? null : 'warning'),
      colunas: [
        { campo: 'nome', titulo: 'Nome' },
        { campo: 'email', titulo: 'E-mail' },
        { campo: 'criadoEm', titulo: 'Conta criada', formatar: (v) => (v ? formatarData(v, 'data-hora') : '—') },
        { campo: 'obras', titulo: 'Obras', render: (v) => (v ? v : criarBadge({ texto: 'Aguardando liberação', variante: 'warning' })) },
        {
          campo: 'acoes', titulo: '', ordenavel: false, classe: 'ctc-col--actions',
          render: (_, l) => criarBotao({
            texto: 'Adicionar a obra', variante: 'ghost', tamanho: 'sm', desabilitado: !perfil.obras.length,
            onClick: () => escolherObraPara(l),
          }),
        },
      ],
    }).elemento;
  });

  return [
    criarAlerta({ tipo: 'info', mensagem: 'Linhas em amarelo: contas sem nenhuma obra (aguardando liberação).' }),
    painel.elemento,
  ];
}


/* =============================================================================
   08b. PAGINA: MIGRACAO DOS DADOS ANTIGOS (gestor geral)
   ========================================================================== */

function paginaMigracao() {
  if (!perfil.gestorGeral) return [criarAlerta({ tipo: 'warning', mensagem: 'Somente gestores gerais acessam esta página.' })];
  const obra = perfil.obras.find((o) => o.id === OBRA_MIGRACAO);
  if (!obra) {
    return [criarAlerta({ tipo: 'warning', titulo: `Obra "${OBRA_MIGRACAO.toUpperCase()}" não encontrada`, mensagem: 'Crie a obra com a sigla WSF3 em Gestão geral > Obras antes de migrar.' })];
  }

  const painel = painelAssincrono({ titulo: `Dados antigos → ${obra.sigla}`, icone: 'upload', semEspaco: true }, async () => {
    const linhas = await Promise.all(MIGRACOES.map(async (m) => {
      const [antigos, naObra] = await Promise.all([
        contarDocumentos([m.origem]).catch((erro) => `erro: ${erro.message}`),
        contarDocumentos(['obras', obra.id, m.controle]).catch((erro) => `erro: ${erro.message}`),
      ]);
      return { ...m, antigos, naObra };
    }));
    return criarTabela({
      dados: linhas,
      altura: 'auto',
      compacta: true,
      colunas: [
        { campo: 'nome', titulo: 'Controle' },
        { campo: 'origem', titulo: 'Coleção antiga', classe: 'ctc-mono' },
        { campo: 'antigos', titulo: 'Documentos antigos' },
        { campo: 'naObra', titulo: `Documentos na ${obra.sigla}` },
        {
          campo: 'acoes', titulo: '', ordenavel: false, classe: 'ctc-col--actions',
          render: (_, m) => {
            const botao = criarBotao({ texto: 'Migrar', icone: 'upload', variante: 'primary', tamanho: 'sm' });
            botao.addEventListener('click', async () => {
              const ok = await confirmar({
                titulo: `Migrar ${m.nome} para ${obra.sigla}?`,
                mensagem: `Copia os documentos de "${m.origem}" para a obra ${obra.sigla}. A coleção antiga não é alterada. Documentos que já foram editados na obra depois da cópia não são sobrescritos.`,
                textoConfirmar: 'Migrar',
              });
              if (!ok) return;
              botao.disabled = true;
              try {
                const r = await migrarColecao({
                  origem: m.origem, obra: obra.id, controle: m.controle, comConteudo: Boolean(m.comConteudo),
                  onProgresso: (feitos, total) => { botao.textContent = `${feitos}/${total}…`; },
                });
                toast.sucesso('Migração concluída', `${m.nome}: ${r.copiados} copiado(s), ${r.ignorados} mantido(s) (já mais novos na obra), de ${r.total}.`);
              } catch (erro) {
                toast.erro('Migração interrompida', erro.message);
              }
              app.navegar('migracao');
            });
            return botao;
          },
        },
      ],
    }).elemento;
  });

  return [
    criarAlerta({
      tipo: 'info',
      titulo: 'Como funciona',
      mensagem: 'Os dados de antes do Portal eram todos da WSF3. Aqui eles são copiados para dentro da obra, controle por controle, conforme cada aplicativo é adaptado. Pode rodar de novo sem duplicar. As coleções antigas ficam intactas como backup até você conferir.',
    }),
    painel.elemento,
  ];
}


/* =============================================================================
   09. MONTAGEM DO APLICATIVO
   ========================================================================== */

function abrirAjuda() {
  criarModal({
    titulo: 'Sobre o Portal KZ',
    destruirAoFechar: true,
    conteudo: [
      h('p', {}, 'Ponto de acesso aos controles da KZ Planejamento. Em "Minhas obras" aparecem as obras em que você tem acesso a algum controle; ao abrir a obra, você vê só os controles liberados para você. Os gestores também liberam aqui a equipe e os controles da obra.'),
      criarAlerta({
        tipo: 'info',
        titulo: 'Perfis',
        mensagem: 'Gestor geral: cria obras e nomeia gestores. Gestor da obra: libera a equipe e os controles da obra. Admin: vê, salva e exclui. Editor: vê e salva. Leitor: só vê.',
      }),
      criarAlerta({
        tipo: 'success',
        titulo: 'Segurança',
        mensagem: 'Nos controles já adaptados por obra, as permissões são conferidas pelo banco de dados (regras do Firebase), não só por esta tela. Os controles ainda no modelo antigo continuam como antes até serem adaptados.',
      }),
    ],
    acoes: [{ texto: 'Fechar', variante: 'primary' }],
  }).abrir();
}

function descricaoPerfil() {
  if (perfil.gestorGeral) return 'Gestor geral';
  if (obraAtual && obraAtual.membro.gestor) return `Gestor da obra ${obraAtual.sigla}`;
  return obraAtual ? `Obra ${obraAtual.sigla}` : '';
}

function montarPortal(paginaInicial = 'inicio') {
  limparTela();
  // a pagina pedida vence o #id antigo da URL (o menu sincroniza com o #)
  window.history.replaceState(null, '', `#${paginaInicial}`);
  const obra = obraAtual;
  const gestorObra = ehGestorDaObra(obra);

  const itensObra = obra ? [
    { id: 'controles', texto: 'Controles', icone: 'tabela' },
    gestorObra ? { id: 'equipe', texto: 'Equipe da obra', icone: 'usuario' } : null,
    gestorObra ? { id: 'config-controles', texto: 'Controles da obra', icone: 'configuracao' } : null,
  ].filter(Boolean) : [];

  const secoes = [
    { titulo: 'Início', itens: [{ id: 'inicio', texto: 'Minhas obras', icone: 'painel' }] },
    obra ? { titulo: `Obra ${obra.sigla}`, itens: itensObra } : null,
    perfil.gestorGeral ? {
      titulo: 'Gestão geral',
      itens: [
        { id: 'obras', texto: 'Obras', icone: 'configuracao' },
        { id: 'usuarios', texto: 'Usuários', icone: 'usuario' },
        { id: 'migracao', texto: 'Migração de dados', icone: 'upload' },
      ],
    } : null,
  ].filter(Boolean);

  const caminhoObra = obra ? [`Obra ${obra.sigla}`] : [];
  const paginas = {
    inicio: { titulo: 'Minhas obras', caminho: ['Início'], render: paginaInicio },
    controles: {
      titulo: 'Controles', caminho: caminhoObra, render: paginaControles,
      // sem menu, quem nao e gestor volta para as obras por este botao
      acoes: souGestor() ? [] : [{ texto: 'Minhas obras', icone: 'chevron-esquerda', variante: 'outline', onClick: () => app.navegar('inicio') }],
    },
    equipe: {
      titulo: 'Equipe da obra', caminho: caminhoObra, render: paginaEquipe,
      acoes: gestorObra ? [
        { texto: 'Adicionar pessoa (já tem conta)', icone: 'usuario', variante: 'outline', onClick: () => adicionarPessoa(obra, () => app.navegar('equipe')) },
        { texto: 'Cadastrar pessoa nova', icone: 'mais', variante: 'primary', onClick: () => abrirCadastroPessoa(obra, () => app.navegar('equipe')) },
      ] : [],
    },
    'config-controles': {
      titulo: 'Controles da obra', caminho: caminhoObra, render: paginaConfigControles,
      acoes: gestorObra ? [
        { texto: 'Ativar controles básicos', icone: 'check', variante: 'outline', onClick: () => abrirAtivarBasicos(obra) },
        { texto: 'Cadastrar controle próprio', icone: 'mais', variante: 'primary', onClick: () => abrirControleProprio(obra) },
      ] : [],
    },
    obras: {
      titulo: 'Obras', caminho: ['Gestão geral'], render: paginaObras,
      acoes: perfil.gestorGeral ? [{ texto: 'Nova obra', icone: 'mais', variante: 'primary', onClick: abrirNovaObra }] : [],
    },
    usuarios: { titulo: 'Usuários', caminho: ['Gestão geral'], render: paginaUsuarios },
    migracao: { titulo: 'Migração de dados', caminho: ['Gestão geral'], render: paginaMigracao },
  };

  // So existem as paginas do menu desta pessoa (digitar #equipe na URL nao abre nada para quem nao pode).
  Object.keys(paginas).forEach((id) => { if (!paginaPermitida(id)) delete paginas[id]; });

  const botaoSessao = criarBotao({
    texto: `${perfil.nome} · ${descricaoPerfil() || 'Usuário'}`,
    icone: 'usuario',
    variante: 'outline',
    titulo: 'Minha conta: nome, senha e sessão',
    onClick: () => abrirPainelSessao({
      perfil,
      descricao: descricaoPerfil(),
      onSair: sairDoPortal,
      onNomeAlterado: () => recarregar(app ? app.paginaAtual() : 'inicio'),
    }),
  });

  app = montarAplicativo({
    marca: { logo: MARCA.logo, titulo: MARCA.titulo, subtitulo: descricaoPerfil() },
    cabecalho: {
      titulo: MARCA.titulo,
      subtitulo: obra ? `${obra.nome} (${obra.sigla})` : '',
      acoes: [
        souGestor() ? { texto: 'Ajuda', icone: 'info', variante: 'outline', onClick: abrirAjuda } : null,
        botaoSessao,
        { texto: 'Sair', icone: 'sair', variante: 'outline', titulo: 'Sair do Portal KZ neste navegador', onClick: sairDoPortal },
      ].filter(Boolean),
    },
    menu: { secoes, rodape: 'KZ App Standard v1.7' },
    paginas,
    paginaInicial: paginas[paginaInicial] ? paginaInicial : 'inicio',
  });

  // Quem nao e gestor ve so as obras e os controles: sem o botao "Menu" e sem o painel do menu.
  if (!souGestor()) {
    const botaoMenu = app.elemento.querySelector('.ctc-header__menu-toggle');
    if (botaoMenu) botaoMenu.remove();
    const painelMenu = app.elemento.querySelector('.ctc-sidebar');
    if (painelMenu) painelMenu.remove();
  }
}

/** Gestor geral ou gestor de alguma obra (ve o menu e as paginas de gestao). */
function souGestor() {
  return Boolean(perfil && (perfil.gestorGeral || perfil.obras.some((o) => o.membro && o.membro.gestor)));
}

/* Inicio: carrega o Firebase e acompanha o login. */
(async () => {
  try {
    await iniciarFirebase(FIREBASE);
  } catch (erro) {
    telaLogin.mostrar();
    toast.erro('Firebase indisponível', erro.message);
    return;
  }
  await observarLogin((usuario) => {
    usuarioAtual = usuario;
    if (!usuario) {
      perfil = null;
      limparTela();
      telaLogin.mostrar();
      return;
    }
    recarregar();
  });
})();
