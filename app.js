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
  criarTabela, criarFormulario, criarModal, confirmar, solicitarValor, criarBotao, toast,
} from './compartilhado/componentes.js';

import { formatarData, ordenar } from './compartilhado/funcionalidades.js';

import {
  iniciarFirebase, observarLogin, sair, carregarPerfil, garantirCadastro,
  criarTelaLogin, criarTelaAguardando, abrirPainelSessao,
  PAPEIS, papelNoControle, codigoObra, criarObra, atualizarObra,
  listarMembros, salvarMembro, removerMembro, buscarUsuarioPorEmail, listarUsuarios,
  contarDocumentos, migrarColecao,
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
  subtitulo: 'Entre com seu e-mail e senha',
  rodape: RODAPE,
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
  if (!perfil.gestorGeral && !perfil.obras.length) {
    telaAguardando = criarTelaAguardando({
      logo: MARCA.logo, titulo: MARCA.titulo, perfil, rodape: RODAPE,
      onAtualizar: () => recarregar(), onSair: sairDoPortal,
    });
    telaAguardando.mostrar();
    return;
  }

  const salva = lerObraSalva();
  obraAtual = perfil.obras.find((o) => o.id === (obraAtual && obraAtual.id))
    || perfil.obras.find((o) => o.id === salva)
    || perfil.obras[0] || null;
  montarPortal(pagina || 'inicio');
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
   03. PAGINA: MINHAS OBRAS
   ========================================================================== */

function paginaInicio() {
  const obras = perfil.obras;
  const ativas = obras.filter((o) => o.situacao !== 'encerrada').length;

  const cartoes = obras.map((obra) => criarCard({
    interativo: true,
    onClick: () => selecionarObra(obra),
    conteudo: h('div', { class: 'ctc-stack' },
      h('div', { class: 'ctc-cluster' },
        criarBadge({ texto: obra.sigla || obra.id, variante: 'solid' }),
        obra.situacao === 'encerrada' ? criarBadge({ texto: 'Encerrada', variante: 'neutral' }) : criarBadge({ texto: 'Ativa', variante: 'success' }),
        obraAtual && obraAtual.id === obra.id ? criarBadge({ texto: 'Selecionada', variante: 'info' }) : null),
      h('p', { class: 'ctc-text-strong' }, obra.nome),
      h('p', { class: 'ctc-text-muted ctc-text-sm' },
        ehGestorDaObra(obra) ? 'Você é gestor desta obra' : `${listaControles(obra).filter((c) => papelNoControle(obra.membro, c.id)).length} controle(s) liberado(s)`)),
  }));

  return [
    h('div', { class: 'ctc-grid ctc-grid--3' },
      criarKpi({ rotulo: 'Obras com acesso', valor: obras.length, formato: 'numero', tamanho: 'lg' }).elemento,
      criarKpi({ rotulo: 'Obras ativas', valor: ativas, formato: 'numero', variante: 'success' }).elemento,
      criarKpi({ rotulo: 'Seu perfil', valor: perfil.gestorGeral ? 'Gestor geral' : (obras.some((o) => o.membro.gestor) ? 'Gestor de obra' : 'Usuário'), variante: 'accent' }).elemento),
    obras.length ? null : criarAlerta({
      tipo: 'info',
      titulo: 'Nenhuma obra cadastrada',
      mensagem: 'Crie a primeira obra em Gestão geral > Obras.',
      acoes: perfil.gestorGeral ? [{ texto: 'Ir para Obras', onClick: () => app.navegar('obras') }] : [],
    }),
    criarPainel({
      titulo: 'Minhas obras', icone: 'painel',
      conteudo: obras.length ? h('div', { class: 'ctc-grid ctc-grid--3' }, cartoes) : h('p', { class: 'ctc-text-muted' }, 'Nenhuma obra liberada.'),
    }).elemento,
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

  const cartoes = liberados.map((c) => {
    const papel = papelNoControle(obra.membro, c.id);
    return criarCard({
      conteudo: h('div', { class: 'ctc-stack' },
        h('div', { class: 'ctc-cluster' }, badgePapel(papel), c.basico ? null : criarBadge({ texto: 'Próprio da obra', variante: 'warning' })),
        h('p', { class: 'ctc-text-strong' }, c.nome),
        criarBotao({ texto: 'Abrir', iconeDireita: 'chevron-direita', variante: 'primary', onClick: () => abrirControle(obra, c) })),
    });
  });

  return [
    criarAlerta({
      tipo: 'warning',
      titulo: 'Adaptação em andamento',
      mensagem: 'Os controles estão sendo adaptados, um por vez, para gravar os dados separados por obra. Enquanto isso, alguns ainda abrem no modelo antigo.',
      fechavel: true,
    }),
    criarPainel({
      titulo: `Controles — ${obra.nome}`, icone: 'tabela', tag: obra.sigla,
      conteudo: liberados.length
        ? h('div', { class: 'ctc-grid ctc-grid--3' }, cartoes)
        : h('p', { class: 'ctc-text-muted' }, 'Nenhum controle liberado para você nesta obra. Fale com o gestor da obra.'),
    }).elemento,
  ];
}


/* =============================================================================
   05. PAGINA: EQUIPE DA OBRA (gestor)
   ========================================================================== */

/** Editor de acesso de uma pessoa na obra. membro: existente ou { uid, nome, email } novo. */
function abrirEditorMembro(obra, membro, aoSalvar) {
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
      h('p', { class: 'ctc-text-muted ctc-text-sm' }, membro.email),
      formulario.elemento,
    ],
    acoes: [
      { texto: 'Cancelar', variante: 'outline' },
      { texto: 'Salvar acesso', variante: 'primary', fechar: false, onClick: () => formulario.enviar() },
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
        conteudo: h('p', {}, `Não há conta para ${email}. Peça à pessoa para abrir o Portal KZ e clicar em "Criar conta"; depois adicione de novo.`),
        acoes: [{ texto: 'Entendi', variante: 'primary' }],
      }).abrir();
      return;
    }
    abrirEditorMembro(obra, { uid: encontrado.uid, nome: encontrado.nome, email: encontrado.email, papeis: {} }, aoSalvar);
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
      if (obra) abrirEditorMembro(obra, { uid: usuario.uid, nome: usuario.nome, email: usuario.email, papeis: {} }, () => app.navegar('usuarios'));
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
      vazio: { titulo: 'Nenhuma conta', mensagem: 'As contas aparecem quando as pessoas usam "Criar conta".' },
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
      h('p', {}, 'Ponto único de acesso aos controles da KZ Planejamento. Cada pessoa vê apenas as obras e os controles liberados para ela.'),
      criarAlerta({
        tipo: 'info',
        titulo: 'Perfis',
        mensagem: 'Gestor geral: cria obras e nomeia gestores. Gestor da obra: libera a equipe e os controles da obra. Admin: vê, salva e exclui. Editor: vê e salva. Leitor: só vê.',
      }),
      criarAlerta({
        tipo: 'success',
        titulo: 'Segurança',
        mensagem: 'As permissões são conferidas pelo banco de dados (regras do Firebase), não só por esta tela.',
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
    controles: { titulo: 'Controles', caminho: caminhoObra, render: paginaControles },
    equipe: {
      titulo: 'Equipe da obra', caminho: caminhoObra, render: paginaEquipe,
      acoes: gestorObra ? [{ texto: 'Adicionar pessoa', icone: 'mais', variante: 'primary', onClick: () => adicionarPessoa(obra, () => app.navegar('equipe')) }] : [],
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
        { texto: 'Ajuda', icone: 'info', variante: 'outline', onClick: abrirAjuda },
        botaoSessao,
        { texto: 'Sair', icone: 'sair', variante: 'outline', titulo: 'Sair do Portal KZ neste navegador', onClick: sairDoPortal },
      ],
    },
    menu: { secoes, rodape: 'KZ App Standard v1.7' },
    paginas,
    paginaInicial: paginas[paginaInicial] ? paginaInicial : 'inicio',
  });
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
