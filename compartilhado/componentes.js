/* =============================================================================
   CTC App Standard — componentes.js
   Versao: 1.6.0 (1.1.0: menu em cascata, logo no menu, tela de entrada com perfis,
                  painel do controlador; 1.2.0: menu em botao, padrao;
                  1.3.0: logo por imagem, editor de cabecalho, salvar em versoes
                  com nova confirmacao de login, senha visivel para o administrador;
                  1.4.0: logo maior com Menu embaixo, nuvem Firebase configuravel;
                  1.4.1: login do controlador escolhido numa lista;
                  1.4.2: lista de login sempre comeca vazia na entrada;
                  1.4.3: "Trocar perfil / Sair" movido para a aba Sessao;
                  1.5.0: montarAplicativo().destruir() e volta a tela inicial sem perder a base;
                  1.6.0: botao "Iniciar controle" (base em branco com senha do administrador))
   Modulo ES. Requer: design-system.css (estilos) e funcionalidades.js (logica).

   CONVENCAO DE RETORNO
   - Componentes apenas visuais retornam o HTMLElement pronto:
       criarIcone, criarBotao, criarBadge, criarProgresso, criarAlerta, criarCard,
       criarBarras, criarCabecalhoPagina, criarCampo
   - Componentes com comportamento retornam um objeto { elemento, ...metodos }:
       criarCabecalho, criarMenuLateral, montarAplicativo, criarPainel, criarKpi,
       criarTabela, criarBarraFiltros, criarSelecaoMultipla, criarChips,
       criarSegmentado, criarAbas, criarFormulario, criarModal, criarTelaEntrada
   - Acoes: abrirPainelControlador, confirmar, solicitarValor, solicitarCredenciais, solicitarSenhaAdministrador,
            abrirListaVersoes, abrirEditorCabecalho

   Valores de variante seguem os modificadores do CSS:
     botao:    primary | secondary | outline | ghost | success | danger | warning | danger-soft
     estados:  success | danger | warning | info
     tamanhos: sm | lg      temas: 1 a 5 (cores categoricas)

   Seguranca: textos sao inseridos com textContent (nunca innerHTML),
   exceto os icones SVG internos deste arquivo.
   ========================================================================== */

import {
  gerarId, debounce, obterValor, paraNumero,
  formatarNumero, formatarMoeda, formatarPercentual, formatarData,
  aplicarConsulta, somar, validarValor, obterValoresFormulario,
  preencherFormulario, validarFormulario, limparErros, definirErroCampo,
  notificar, toast,
  normalizarLogin, criarCredencial, verificarSenha, lerArquivoJSON, baixarJSON,
  criarBaseVazia, validarBase, prepararBaseParaSalvar, nomeArquivoBase,
  decifrarTexto, criptografiaDisponivel, lerImagemComoDataURL, interpretarConfigFirebase,
} from './funcionalidades.js';

/* Notificacoes ficam em funcionalidades.js; reexportadas aqui por conveniencia. */
export { notificar, toast };


/* =============================================================================
   01. BASE: criacao de elementos e icones
   ========================================================================== */

/** Junta classes ignorando valores vazios. */
export function classes(...lista) {
  return lista.flat().filter(Boolean).join(' ');
}

function anexarFilhos(elemento, filhos) {
  filhos.flat(Infinity).forEach((filho) => {
    if (filho == null || filho === false) return;
    elemento.append(filho instanceof Node ? filho : document.createTextNode(String(filho)));
  });
}

const PROPRIEDADES_DIRETAS = new Set(['value', 'checked', 'disabled', 'selected', 'multiple', 'readOnly', 'required', 'open']);

/**
 * Cria um elemento: h('div', { class: 'x', onClick: fn, dataset: {id: 1} }, 'texto', outroNo)
 * Atributos null/false sao ignorados. Eventos: chaves iniciadas por "on".
 */
export function h(tag, atributos = {}, ...filhos) {
  const el = document.createElement(tag);
  Object.entries(atributos || {}).forEach(([chave, valor]) => {
    if (valor == null || valor === false) return;
    if (chave === 'class') el.className = Array.isArray(valor) ? classes(valor) : valor;
    else if (chave === 'style' && typeof valor === 'object') Object.assign(el.style, valor);
    else if (chave === 'dataset') Object.assign(el.dataset, valor);
    else if (chave.startsWith('on') && typeof valor === 'function') el.addEventListener(chave.slice(2).toLowerCase(), valor);
    else if (PROPRIEDADES_DIRETAS.has(chave)) el[chave] = valor;
    else el.setAttribute(chave, valor === true ? '' : String(valor));
  });
  anexarFilhos(el, filhos);
  return el;
}

/** Conjunto de icones SVG (traco 2px, 24x24). */
export const ICONES = {
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  'chevron-direita': '<path d="M9 6l6 6-6 6"/>',
  'chevron-esquerda': '<path d="M15 6l-6 6 6 6"/>',
  'chevron-baixo': '<path d="M6 9l6 6 6-6"/>',
  fechar: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12l5 5 9-11"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  alerta: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 18v.5"/>',
  erro: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  sucesso: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
  busca: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  ordenar: '<path d="M8 4v16M4 8l4-4 4 4M16 20V4M12 16l4 4 4-4"/>',
  'seta-cima': '<path d="M12 19V5M5 12l7-7 7 7"/>',
  'seta-baixo': '<path d="M12 5v14M5 12l7 7 7-7"/>',
  painel: '<path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z"/>',
  tabela: '<path d="M3 4h18v16H3zM3 10h18M9 4v16"/>',
  documento: '<path d="M6 2h9l5 5v15H6zM14 2v6h6"/>',
  grafico: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
  moeda: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c0-1.2-1.3-2-3-2s-3 .8-3 2 1.3 1.8 3 2 3 .9 3 2.2-1.3 2-3 2-3-.8-3-2M12 6v12"/>',
  calendario: '<path d="M3 5h18v16H3zM3 10h18M8 3v4M16 3v4"/>',
  configuracao: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  usuario: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  sair: '<path d="M15 3h4v18h-4M10 17l5-5-5-5M15 12H3"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  lixeira: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  editar: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  upload: '<path d="M12 21V9M7 14l5-5 5 5M4 3h16"/>',
  filtro: '<path d="M3 5h18l-7 8v6l-4 2v-8L3 5z"/>',
  olho: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  salvar: '<path d="M5 3h11l3 3v15H5zM8 3v6h7V3M8 21v-7h8v7"/>',
};

/** Cria um icone SVG do conjunto ICONES. Aceita tambem um Node pronto (devolve o proprio). */
export function criarIcone(nome, tamanho = 16) {
  if (nome instanceof Node) return nome;
  const conteudo = ICONES[nome];
  if (!conteudo) {
    console.warn(`[CTC] Icone "${nome}" nao existe em ICONES.`);
    return document.createTextNode('');
  }
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', tamanho);
  svg.setAttribute('height', tamanho);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = conteudo;
  return svg;
}

/**
 * Conteudo de uma logo: imagem (data URL, http, caminho de arquivo de imagem),
 * Node pronto ou texto curto (ex.: 'CTC').
 */
export function conteudoLogo(logo) {
  if (logo == null || logo === '') return '';
  if (logo instanceof Node) return logo;
  const texto = String(logo);
  if (/^(data:image\/|https?:\/\/|\.{0,2}\/)|\.(png|jpe?g|gif|svg|webp)$/i.test(texto)) return h('img', { src: texto, alt: '' });
  return document.createTextNode(texto);
}

const VARIANTES_BOTAO = ['primary', 'secondary', 'outline', 'ghost', 'success', 'danger', 'warning', 'danger-soft'];
const VARIANTES_ESTADO = ['success', 'danger', 'warning', 'info'];
const ICONE_ESTADO = { success: 'sucesso', danger: 'erro', warning: 'alerta', info: 'info' };

function avisarVariante(componente, valor, permitidos) {
  if (valor && !permitidos.includes(valor)) {
    console.warn(`[CTC] ${componente}: variante "${valor}" invalida. Use: ${permitidos.join(', ')}.`);
  }
}

function formatarPorTipo(valor, tipo, casas) {
  switch (tipo) {
    case 'moeda': return formatarMoeda(valor, { casas: casas ?? 2 });
    case 'numero': return formatarNumero(valor, casas);
    case 'percentual': return formatarPercentual(valor, { casas: casas ?? 1 });
    case 'data': return formatarData(valor);
    default: return valor == null || valor === '' ? '—' : String(valor);
  }
}


/* =============================================================================
   02. BOTOES
   ========================================================================== */

/**
 * criarBotao({ texto, variante, tamanho, icone, iconeDireita, contador, titulo,
 *              desabilitado, bloco, tipo, apenasEdicao, classe, onClick })
 * - Sem texto e com icone: vira botao quadrado (.ctc-btn--icon); informe "titulo".
 * - apenasEdicao: oculto quando o app esta em modo somente leitura.
 */
export function criarBotao({
  texto = '', variante, tamanho, icone, iconeDireita, contador, titulo,
  desabilitado = false, bloco = false, tipo = 'button', apenasEdicao = false, classe, onClick,
} = {}) {
  avisarVariante('criarBotao', variante, VARIANTES_BOTAO);
  const somenteIcone = !texto && Boolean(icone);
  const botao = h('button', {
    type: tipo,
    class: classes(
      'ctc-btn',
      variante && `ctc-btn--${variante}`,
      tamanho && `ctc-btn--${tamanho}`,
      bloco && 'ctc-btn--block',
      somenteIcone && 'ctc-btn--icon',
      apenasEdicao && 'ctc-edit-only',
      classe,
    ),
    title: titulo,
    'aria-label': somenteIcone ? (titulo || icone) : null,
    disabled: desabilitado,
    onClick,
  });
  if (icone) botao.append(criarIcone(icone));
  if (texto) botao.append(h('span', {}, texto));
  if (iconeDireita) botao.append(criarIcone(iconeDireita));
  if (contador != null) botao.append(h('span', { class: 'ctc-btn__count' }, String(contador)));
  return botao;
}

/** Liga/desliga o estado de carregamento de um botao. */
export function definirCarregando(botao, ativo) {
  botao.classList.toggle('is-loading', Boolean(ativo));
  botao.setAttribute('aria-busy', ativo ? 'true' : 'false');
}

/** Executa uma funcao assincrona mostrando o carregamento no botao. */
export async function comCarregamento(botao, funcao) {
  definirCarregando(botao, true);
  try {
    return await funcao();
  } finally {
    definirCarregando(botao, false);
  }
}

function resolverAcoes(acoes = [], padrao = {}) {
  return acoes.map((a) => (a instanceof Node ? a : criarBotao({ ...padrao, ...a })));
}


/* =============================================================================
   03. CABECALHO, MENU LATERAL E ESTRUTURA DO APLICATIVO
   ========================================================================== */

/**
 * criarCabecalho({ titulo, subtitulo, logo (url ou Node), usuario, acoes: [config de botao | Node], onMenu })
 * Retorna { elemento, botaoMenu, definirTitulo, definirSubtitulo }.
 */
export function criarCabecalho({
  titulo = '', subtitulo = '', logo, usuario, acoes = [], onMenu,
} = {}) {
  const botaoMenu = h('button', {
    type: 'button',
    class: 'ctc-header__menu-btn',
    'aria-label': 'Abrir menu',
    'aria-expanded': 'false',
    onClick: onMenu,
  }, criarIcone('menu', 20));

  const elTitulo = h('div', { class: 'ctc-header__title' }, titulo);
  const elSubtitulo = h('div', { class: 'ctc-header__subtitle' }, subtitulo);
  let elLogo = logo ? h('div', { class: 'ctc-header__logo' }, conteudoLogo(logo)) : null;

  const elemento = h('header', { class: 'ctc-header' },
    h('div', { class: 'ctc-header__brand' },
      botaoMenu,
      elLogo,
      h('div', { class: 'ctc-header__titles' }, elTitulo, subtitulo ? elSubtitulo : null)),
    h('div', { class: 'ctc-header__actions' },
      usuario ? h('span', { class: 'ctc-header__user' }, criarIcone('usuario', 14), usuario) : null,
      resolverAcoes(acoes, { tamanho: 'sm', variante: 'outline' })));

  return {
    elemento,
    botaoMenu,
    definirTitulo: (texto) => { elTitulo.textContent = texto; },
    definirSubtitulo: (texto) => {
      elSubtitulo.textContent = texto;
      if (!elSubtitulo.isConnected && texto) elTitulo.after(elSubtitulo);
    },
    /** Troca a logo (imagem, Node ou texto). Vazio remove. */
    definirLogo: (novaLogo) => {
      if (!novaLogo) { if (elLogo) elLogo.remove(); elLogo = null; return; }
      if (!elLogo) {
        elLogo = h('div', { class: 'ctc-header__logo' });
        const pilha = elemento.querySelector('.ctc-header__brand-stack');
        if (pilha) pilha.prepend(elLogo); else botaoMenu.after(elLogo);
      }
      elLogo.replaceChildren(conteudoLogo(novaLogo));
    },
  };
}

/**
 * criarMenuLateral({
 *   secoes: [{ titulo, itens: [{ id, texto, icone, href, itens: [...subitens], aberto }] }],
 *   ativo, rodape, onNavegar(id, item),
 *   cascata: false,                         // submenus flutuantes a direita (abrem ao passar o mouse)
 *   marca: { logo (url ou Node), titulo, subtitulo }   // logo no topo do menu
 *   sinal: AbortSignal                      // opcional: remove os ouvintes globais ao destruir
 * })
 * Subitens usam <details>/<summary>: abrem por clique, toque ou teclado.
 * No modo cascata tambem abrem ao passar o mouse (somente em telas acima de 1024px;
 * no celular abrem para baixo, por toque).
 * Retorna { elemento, definirAtivo, obterAtivo, obterItem, fecharSubmenus }.
 */
export function criarMenuLateral({
  secoes = [], ativo = null, rodape, onNavegar, cascata = false, marca, sinal,
} = {}) {
  const nav = h('nav', {
    class: classes('ctc-sidebar', cascata && 'ctc-sidebar--cascata'),
    id: gerarId('ctc-menu'),
    'aria-label': 'Menu principal',
  });
  const mapa = new Map();
  const grupos = [];
  const consultaMobile = window.matchMedia('(max-width: 1024px)');
  const flutuante = () => cascata && !consultaMobile.matches;
  let atual = null;

  const iconeItem = (item, nivel) => {
    if (nivel > 0) return null;
    const conteudo = item.icone ? criarIcone(item.icone, 18) : (item.texto || '?').trim().charAt(0).toUpperCase();
    return h('span', { class: 'ctc-sidebar__icon', 'aria-hidden': 'true' }, conteudo);
  };

  /* ---- Submenus flutuantes (modo cascata) ---- */
  function posicionar(grupo) {
    const sub = grupo.lastElementChild;
    const resumo = grupo.firstElementChild;
    const container = grupo.parentElement.closest('.ctc-sidebar__sub') || nav;
    const topoItem = resumo.getBoundingClientRect().top;
    sub.style.left = `${Math.round(container.getBoundingClientRect().right + 4)}px`;
    sub.style.top = `${Math.round(topoItem)}px`;
    const altura = sub.getBoundingClientRect().height;
    const limite = window.innerHeight - 8;
    if (topoItem + altura > limite) sub.style.top = `${Math.max(8, Math.round(limite - altura))}px`;
  }

  function fecharSubmenus(exceto = []) {
    if (!cascata) return;
    grupos.forEach((g) => { if (!exceto.includes(g)) g.open = false; });
  }

  function ancestrais(grupo) {
    const lista = [];
    let atualGrupo = grupo;
    while (atualGrupo) {
      lista.push(atualGrupo);
      atualGrupo = atualGrupo.parentElement.closest('.ctc-sidebar__group');
    }
    return lista;
  }

  function ativarFlutuante(grupo) {
    let timer = null;
    grupo.addEventListener('mouseenter', () => {
      if (!flutuante()) return;
      clearTimeout(timer);
      fecharSubmenus(ancestrais(grupo));
      grupo.open = true;
      posicionar(grupo);
    });
    grupo.addEventListener('mouseleave', () => {
      if (!flutuante()) return;
      clearTimeout(timer);
      timer = setTimeout(() => { grupo.open = false; }, 220);
    });
    grupo.addEventListener('toggle', () => {
      if (!grupo.open || !flutuante()) return;
      fecharSubmenus(ancestrais(grupo));
      posicionar(grupo);
    });
  }

  if (cascata) {
    const opcoes = { signal: sinal };
    document.addEventListener('click', (e) => { if (flutuante() && !nav.contains(e.target)) fecharSubmenus(); }, opcoes);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && flutuante()) fecharSubmenus(); }, opcoes);
    window.addEventListener('resize', () => fecharSubmenus(), opcoes);
    nav.addEventListener('scroll', () => { if (flutuante()) fecharSubmenus(); });
  }

  function definirAtivo(id) {
    atual = id;
    grupos.forEach((g) => g.firstElementChild.classList.remove('is-active'));
    mapa.forEach((registro, chave) => {
      const ligado = chave === id;
      registro.el.classList.toggle('is-active', ligado);
      if (!ligado) { registro.el.removeAttribute('aria-current'); return; }
      registro.el.setAttribute('aria-current', 'page');
      if (cascata) {
        // no modo cascata o grupo de 1o nivel fica destacado em vez de aberto
        const raiz = registro.grupos[0];
        if (raiz) raiz.firstElementChild.classList.add('is-active');
      } else {
        registro.grupos.forEach((g) => { g.open = true; });
      }
    });
  }

  function criarItem(item, gruposPais, nivel) {
    if (Array.isArray(item.itens) && item.itens.length) {
      const grupo = h('details', { class: 'ctc-sidebar__group', open: !cascata && Boolean(item.aberto) });
      const resumo = h('summary', { class: 'ctc-sidebar__item', title: item.texto, 'aria-haspopup': cascata ? 'true' : null },
        iconeItem(item, nivel),
        h('span', { class: 'ctc-sidebar__text' }, item.texto),
        h('span', { class: 'ctc-sidebar__chevron' }, criarIcone('chevron-direita', 14)));
      const sub = h('div', { class: 'ctc-sidebar__sub' });
      item.itens.forEach((filho) => sub.append(criarItem(filho, [...gruposPais, grupo], nivel + 1)));
      grupo.append(resumo, sub);
      grupos.push(grupo);
      if (cascata) ativarFlutuante(grupo);
      return grupo;
    }
    const tag = item.href ? 'a' : 'button';
    const el = h(tag, {
      class: 'ctc-sidebar__item',
      type: tag === 'button' ? 'button' : null,
      href: item.href || null,
      title: item.texto,
      dataset: { id: item.id },
      onClick: (evento) => {
        if (tag === 'a' && !item.href) evento.preventDefault();
        definirAtivo(item.id);
        fecharSubmenus();
        if (typeof onNavegar === 'function') onNavegar(item.id, item);
      },
    }, iconeItem(item, nivel), h('span', { class: 'ctc-sidebar__text' }, item.texto));
    mapa.set(item.id, { el, grupos: gruposPais, item });
    return el;
  }

  if (marca) {
    const logo = marca.logo == null ? null
      : h('div', { class: 'ctc-sidebar__logo' }, conteudoLogo(marca.logo));
    nav.append(h('div', { class: 'ctc-sidebar__brand' },
      logo,
      h('div', { class: 'ctc-sidebar__brand-text' },
        marca.titulo ? h('div', { class: 'ctc-sidebar__brand-title' }, marca.titulo) : null,
        marca.subtitulo ? h('div', { class: 'ctc-sidebar__brand-subtitle' }, marca.subtitulo) : null)));
  }

  secoes.forEach((secao) => {
    const el = h('div', { class: 'ctc-sidebar__section' },
      secao.titulo ? h('div', { class: 'ctc-sidebar__label' }, secao.titulo) : null);
    (secao.itens || []).forEach((item) => el.append(criarItem(item, [], 0)));
    nav.append(el);
  });
  if (rodape) nav.append(h('div', { class: 'ctc-sidebar__footer' }, rodape));
  if (ativo != null) definirAtivo(ativo);

  return {
    elemento: nav,
    definirAtivo,
    obterAtivo: () => atual,
    obterItem: (id) => mapa.get(id)?.item,
    fecharSubmenus: () => fecharSubmenus(),
  };
}

/**
 * criarCabecalhoPagina({ titulo, caminho: ['Cadastros', 'Itens'], acoes: [config de botao | Node] })
 */
export function criarCabecalhoPagina({ titulo = '', caminho = [], acoes = [] } = {}) {
  return h('div', { class: 'ctc-page-header' },
    h('div', { class: 'ctc-page-header__titles' },
      caminho.length ? h('nav', { class: 'ctc-page-header__breadcrumb', 'aria-label': 'Caminho' }, caminho.join(' / ')) : null,
      h('h1', { class: 'ctc-title-page' }, titulo)),
    acoes.length ? h('div', { class: 'ctc-page-header__actions' }, resolverAcoes(acoes, { tamanho: 'sm' })) : null);
}

/**
 * Monta a estrutura completa (cabecalho + menu lateral + area principal).
 *   montarAplicativo({
 *     alvo: document.body,
 *     marca: { logo, titulo, subtitulo },   // logo e nome no topo do menu (modo cascata)
 *     cabecalho: { titulo, subtitulo, logo, usuario, acoes },
 *     menu: { secoes, rodape },
 *     paginas: { idDaPagina: { titulo, caminho, acoes, render: (app) => Node | Node[] } },
 *     paginaInicial: 'idDaPagina',
 *     tipoMenu: 'botao',     // 'botao' (padrao v1.2): botao "Menu" no cabecalho abre a cascata
 *                            // 'lateral' (v1.1): faixa lateral fixa com a logo no topo
 *                            // 'classico' (v1.0): faixa lateral com submenus abrindo para baixo
 *     usarHash: true,        // sincroniza com #id na URL
 *     somenteLeitura: false, recolhido: false,
 *   })
 * Retorna { elemento, cabecalho, menu, main, navegar, mostrarPagina, alternarMenu,
 *           recolher, definirSomenteLeitura, paginaAtual, destruir }.
 */
export function montarAplicativo({
  alvo = document.body, marca, cabecalho = {}, menu = {}, paginas = {}, paginaInicial,
  tipoMenu = 'botao', menuCascata, usarHash = true, somenteLeitura = false, recolhido = false,
} = {}) {
  const consultaMobile = window.matchMedia('(max-width: 1024px)');
  let paginaAtual = null;
  let api = null;
  // compatibilidade com a v1.1 (menuCascata: false = modo classico)
  const modo = menuCascata === false ? 'classico' : tipoMenu;
  const emBotao = modo === 'botao';
  /* todos os ouvintes globais usam este sinal: destruir() remove tudo de uma vez */
  const controle = new AbortController();
  const ouvir = { signal: controle.signal };

  const marcaFinal = marca || (cabecalho.logo || cabecalho.titulo
    ? { logo: cabecalho.logo, titulo: cabecalho.titulo } : null);
  const logoCabecalho = modo !== 'classico' && marcaFinal && marcaFinal.logo
    ? (typeof marcaFinal.logo === 'string' ? marcaFinal.logo : marcaFinal.logo.cloneNode(true))
    : cabecalho.logo;

  const cab = criarCabecalho({ ...cabecalho, logo: logoCabecalho, onMenu: () => api.alternarMenu() });
  const men = criarMenuLateral({
    ...menu,
    cascata: modo !== 'classico',
    marca: modo === 'lateral' ? marcaFinal : null,
    sinal: controle.signal,
    onNavegar: (id, item) => {
      if (paginas[id]) api.navegar(id);
      if (typeof menu.onNavegar === 'function') menu.onNavegar(id, item);
    },
  });
  const main = h('main', { class: 'ctc-main', id: 'ctc-conteudo', tabindex: '-1' });
  const fundo = h('div', { class: 'ctc-backdrop', onClick: () => api.alternarMenu(false) });
  const app = h('div', {
    class: classes(
      'ctc-app',
      modo === 'lateral' && 'ctc-app--cascata',
      emBotao && 'ctc-app--menu-botao',
      recolhido && 'ctc-app--collapsed',
      somenteLeitura && 'ctc-app--readonly',
    ),
  }, cab.elemento, men.elemento, main, fundo);

  /* ---- Modo botao: o botao "Menu" abre/fecha o painel em cascata ---- */
  let botaoMenu = null;
  function alternarPainel(abrir) {
    const deveAbrir = abrir ?? !app.classList.contains('ctc-app--menu-aberto');
    app.classList.toggle('ctc-app--menu-aberto', deveAbrir);
    botaoMenu.setAttribute('aria-expanded', String(deveAbrir));
    if (deveAbrir) {
      men.elemento.style.left = consultaMobile.matches ? '' : `${Math.round(botaoMenu.getBoundingClientRect().left)}px`;
      const primeiro = men.elemento.querySelector('.ctc-sidebar__item');
      if (primeiro) primeiro.focus({ preventScroll: true });
    } else {
      men.fecharSubmenus();
    }
  }
  if (emBotao) {
    botaoMenu = criarBotao({
      texto: 'Menu', icone: 'menu', variante: 'outline', classe: 'ctc-header__menu-toggle',
      onClick: (e) => { e.stopPropagation(); alternarPainel(); },
    });
    botaoMenu.setAttribute('aria-haspopup', 'true');
    botaoMenu.setAttribute('aria-expanded', 'false');
    botaoMenu.setAttribute('aria-controls', men.elemento.id);
    // logo em cima, botao "Menu" embaixo (v1.4)
    const pilha = h('div', { class: 'ctc-header__brand-stack' });
    const logoAtual = cab.elemento.querySelector('.ctc-header__logo');
    if (logoAtual) pilha.append(logoAtual);
    pilha.append(botaoMenu);
    cab.elemento.querySelector('.ctc-header__titles').before(pilha);
    document.addEventListener('click', (e) => {
      if (app.classList.contains('ctc-app--menu-aberto') && !men.elemento.contains(e.target) && !botaoMenu.contains(e.target)) {
        alternarPainel(false);
      }
    }, ouvir);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && app.classList.contains('ctc-app--menu-aberto')) { alternarPainel(false); botaoMenu.focus(); }
    }, ouvir);
    window.addEventListener('resize', () => alternarPainel(false), ouvir);
  }

  function alternarMenu(abrir) {
    if (emBotao) { alternarPainel(abrir); return; }
    const deveAbrir = abrir ?? !app.classList.contains('ctc-app--nav-open');
    app.classList.toggle('ctc-app--nav-open', deveAbrir && consultaMobile.matches);
    cab.botaoMenu.setAttribute('aria-expanded', String(deveAbrir && consultaMobile.matches));
    cab.botaoMenu.setAttribute('aria-label', deveAbrir ? 'Fechar menu' : 'Abrir menu');
  }

  function recolher(valor) {
    const deveRecolher = valor ?? !app.classList.contains('ctc-app--collapsed');
    app.classList.toggle('ctc-app--collapsed', deveRecolher);
    men.fecharSubmenus();
  }

  function mostrarPagina({ titulo, caminho, acoes } = {}, conteudo = []) {
    const nos = (Array.isArray(conteudo) ? conteudo : [conteudo]).filter(Boolean);
    main.replaceChildren(
      titulo ? criarCabecalhoPagina({ titulo, caminho, acoes }) : '',
      h('div', { class: 'ctc-page' }, nos),
    );
    main.scrollTop = 0;
  }

  function navegar(id) {
    const pagina = paginas[id];
    if (!pagina) {
      console.warn(`[CTC] Pagina "${id}" nao registrada.`);
      return;
    }
    paginaAtual = id;
    men.definirAtivo(id);
    men.fecharSubmenus();
    mostrarPagina(pagina, typeof pagina.render === 'function' ? pagina.render(api) : []);
    if (usarHash && window.location.hash.slice(1) !== id) {
      window.history.replaceState(null, '', `#${id}`);
    }
    if (emBotao) alternarPainel(false);
    else if (consultaMobile.matches) alternarMenu(false);
    main.focus({ preventScroll: true });
  }

  // Fechar gaveta: tecla Esc e mudanca de tamanho da tela
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && app.classList.contains('ctc-app--nav-open')) alternarMenu(false);
  }, ouvir);
  consultaMobile.addEventListener('change', () => alternarMenu(false), ouvir);

  // Menu recolhido (modo classico): clicar num grupo expande o menu para mostrar os subitens
  men.elemento.addEventListener('click', (e) => {
    if (modo === 'classico' && e.target.closest('summary') && app.classList.contains('ctc-app--collapsed') && !consultaMobile.matches) {
      recolher(false);
    }
  });

  api = {
    elemento: app,
    cabecalho: cab,
    menu: men,
    main,
    navegar,
    mostrarPagina,
    alternarMenu,
    recolher,
    definirSomenteLeitura: (valor) => app.classList.toggle('ctc-app--readonly', Boolean(valor)),
    paginaAtual: () => paginaAtual,
    /** Remove o aplicativo da pagina e todos os seus ouvintes (ex.: voltar a tela inicial). */
    destruir: () => {
      men.fecharSubmenus();
      controle.abort();
      app.remove();
    },
  };

  alvo.append(app);
  const doHash = usarHash ? window.location.hash.slice(1) : '';
  const inicial = paginas[doHash] ? doHash : paginaInicial;
  if (inicial && paginas[inicial]) navegar(inicial);
  if (usarHash) {
    window.addEventListener('hashchange', () => {
      const id = window.location.hash.slice(1);
      if (paginas[id] && id !== paginaAtual) navegar(id);
    }, ouvir);
  }
  return api;
}


/* =============================================================================
   04. CARDS, PAINEIS E INDICADORES
   ========================================================================== */

/**
 * criarPainel({ titulo, icone, tag, acoes, conteudo, rodape, tema (1-5), escuro, semEspaco })
 * Retorna { elemento, corpo, definirConteudo }.
 */
export function criarPainel({
  titulo, icone, tag, acoes = [], conteudo, rodape, tema, escuro = false, semEspaco = false,
} = {}) {
  const corpo = h('div', { class: classes('ctc-panel__body', semEspaco && 'ctc-panel__body--flush') }, conteudo);
  const temCabecalho = titulo || acoes.length || tag;
  const elemento = h('section', {
    class: classes('ctc-panel', escuro && 'ctc-panel--dark', tema && `ctc-panel--theme ctc-theme-${tema}`),
  },
  temCabecalho ? h('div', { class: 'ctc-panel__header' },
    h('h2', { class: 'ctc-panel__title' },
      icone ? h('span', { class: 'ctc-panel__icon' }, criarIcone(icone)) : null,
      titulo),
    (acoes.length || tag) ? h('div', { class: 'ctc-panel__actions' },
      tag ? h('span', { class: 'ctc-panel__tag' }, tag) : null,
      resolverAcoes(acoes, { tamanho: 'sm', variante: 'outline' })) : null) : null,
  corpo,
  rodape ? h('div', { class: 'ctc-panel__footer' }, rodape) : null);

  return {
    elemento,
    corpo,
    definirConteudo: (...nos) => { corpo.replaceChildren(); anexarFilhos(corpo, nos); },
  };
}

/** criarCard({ conteudo, interativo, onClick }) — card simples com borda. */
export function criarCard({ conteudo, interativo = false, onClick } = {}) {
  const clicavel = interativo || typeof onClick === 'function';
  return h(clicavel ? 'button' : 'div', {
    class: classes('ctc-card', clicavel && 'ctc-card--interactive'),
    type: clicavel ? 'button' : null,
    style: clicavel ? { textAlign: 'left', width: '100%', font: 'inherit' } : null,
    onClick,
  }, conteudo);
}

/** criarBadge({ texto, variante: neutral|success|danger|warning|info|solid }) */
export function criarBadge({ texto = '', variante } = {}) {
  avisarVariante('criarBadge', variante, ['neutral', 'solid', ...VARIANTES_ESTADO]);
  return h('span', { class: classes('ctc-badge', variante && `ctc-badge--${variante}`) }, texto);
}

/** criarProgresso({ percentual, variante: success|danger, tamanho: sm|lg, rotulo }) */
export function criarProgresso({ percentual = 0, variante, tamanho, rotulo = 'Progresso' } = {}) {
  const valor = Math.max(0, Math.min(100, paraNumero(percentual) ?? 0));
  const barra = h('span', { class: 'ctc-progress__bar', style: { width: `${valor}%` } });
  return h('div', {
    class: classes('ctc-progress', variante && `ctc-progress--${variante}`, tamanho && `ctc-progress--${tamanho}`),
    role: 'progressbar',
    'aria-label': rotulo,
    'aria-valuemin': '0',
    'aria-valuemax': '100',
    'aria-valuenow': String(Math.round(valor)),
  }, barra);
}

function atualizarProgresso(elemento, percentual) {
  const valor = Math.max(0, Math.min(100, paraNumero(percentual) ?? 0));
  elemento.querySelector('.ctc-progress__bar').style.width = `${valor}%`;
  elemento.setAttribute('aria-valuenow', String(Math.round(valor)));
}

/**
 * criarKpi({
 *   rotulo, valor, formato: moeda|numero|percentual (opcional), casas, sub,
 *   variante: success|danger|warning|accent, tamanho: 'lg',
 *   destaque: positive|negative|neutral, solido: true, icone, tema (1-5),
 *   progresso: { percentual, variante }
 * })
 * Retorna { elemento, atualizar({ valor, sub, rotulo, destaque, progresso }) }.
 */
export function criarKpi({
  rotulo = '', valor, formato, casas, sub, variante, tamanho, destaque, solido = false,
  icone, tema, progresso,
} = {}) {
  avisarVariante('criarKpi', variante, ['success', 'danger', 'warning', 'accent']);
  const texto = (v) => (formato ? formatarPorTipo(v, formato, casas) : (v ?? '—'));
  const elRotulo = h('div', { class: 'ctc-kpi__label' }, rotulo);
  const elValor = h('div', { class: 'ctc-kpi__value' }, texto(valor));
  const elSub = h('div', { class: 'ctc-kpi__sub' }, sub ?? '');
  const elProgresso = progresso ? criarProgresso({ ...progresso, tamanho: 'sm', rotulo }) : null;
  if (elProgresso) elProgresso.style.marginTop = 'var(--ctc-sp-2)';

  const classeDestaque = (d) => (d === 'positive' || d === 'negative' ? `ctc-kpi--${d}` : null);
  const textos = h('div', { style: { minWidth: '0' } }, elRotulo, elValor, sub != null ? elSub : null, elProgresso);

  const elemento = h('div', {
    class: classes(
      'ctc-kpi',
      variante && `ctc-kpi--${variante}`,
      tamanho && `ctc-kpi--${tamanho}`,
      destaque && 'ctc-kpi--highlight',
      classeDestaque(destaque),
      solido && 'ctc-kpi--solid',
      tema && `ctc-theme-${tema}`,
    ),
  },
  icone ? h('div', { class: 'ctc-kpi__icon' }, criarIcone(icone, 22)) : null,
  icone ? textos : [elRotulo, elValor, sub != null ? elSub : null, elProgresso]);

  return {
    elemento,
    atualizar({ valor: novoValor, sub: novoSub, rotulo: novoRotulo, destaque: novoDestaque, progresso: novoProgresso } = {}) {
      if (novoValor !== undefined) elValor.textContent = texto(novoValor);
      if (novoRotulo !== undefined) elRotulo.textContent = novoRotulo;
      if (novoSub !== undefined) {
        elSub.textContent = novoSub;
        if (!elSub.isConnected) elValor.after(elSub);
      }
      if (novoDestaque !== undefined) {
        elemento.classList.remove('ctc-kpi--positive', 'ctc-kpi--negative');
        const c = classeDestaque(novoDestaque);
        if (c) elemento.classList.add(c);
      }
      if (novoProgresso !== undefined && elProgresso) atualizarProgresso(elProgresso, novoProgresso);
    },
  };
}

/**
 * criarBarras({ itens: [{ rotulo, valor }], formato, casas, maximo, variante, tema })
 * Lista de barras horizontais proporcionais (comparativo simples, sem biblioteca).
 */
export function criarBarras({ itens = [], formato = 'numero', casas, maximo, variante, tema } = {}) {
  const maior = maximo ?? Math.max(0, ...itens.map((i) => Math.abs(paraNumero(i.valor) ?? 0)));
  return h('div', { class: classes(tema && `ctc-theme-${tema}`) },
    itens.map((item) => {
      const v = paraNumero(item.valor) ?? 0;
      const pct = maior > 0 ? (Math.abs(v) / maior) * 100 : 0;
      return h('div', { class: 'ctc-bar-row' },
        h('span', { class: 'ctc-bar-row__label', title: item.rotulo }, item.rotulo),
        criarProgresso({ percentual: pct, variante: item.variante || variante, rotulo: item.rotulo }),
        h('span', { class: 'ctc-bar-row__value' }, formatarPorTipo(item.valor, formato, casas)));
    }));
}

/**
 * criarAlerta({ tipo: info|success|warning|danger, titulo, mensagem, acoes, fechavel })
 */
export function criarAlerta({
  tipo = 'info', titulo, mensagem, acoes = [], fechavel = false,
} = {}) {
  avisarVariante('criarAlerta', tipo, VARIANTES_ESTADO);
  const alerta = h('div', {
    class: classes('ctc-alert', `ctc-alert--${tipo}`),
    role: tipo === 'danger' || tipo === 'warning' ? 'alert' : 'status',
  },
  h('span', { class: 'ctc-alert__icon' }, criarIcone(ICONE_ESTADO[tipo] || 'info', 18)),
  h('div', { class: 'ctc-alert__content' },
    titulo ? h('div', { class: 'ctc-alert__title' }, titulo) : null,
    mensagem ? h('div', { class: 'ctc-alert__body' }, mensagem) : null,
    acoes.length ? h('div', { class: 'ctc-alert__actions' }, resolverAcoes(acoes, { tamanho: 'sm', variante: 'outline' })) : null),
  fechavel ? criarBotao({ icone: 'fechar', variante: 'ghost', tamanho: 'sm', titulo: 'Fechar aviso', onClick: () => alerta.remove() }) : null);
  return alerta;
}


/* =============================================================================
   05. TABELA
   ========================================================================== */

/**
 * criarTabela({
 *   colunas: [{
 *     campo, titulo, tipo: texto|numero|moeda|percentual|data, casas,
 *     formatar: (valor, linha) => texto,     // substitui a formatacao por tipo
 *     render: (valor, linha) => Node|texto,  // conteudo livre da celula
 *     ordenavel (padrao true), fixa (1a coluna presa a esquerda), largura,
 *     total: 'soma' | 'contagem' | (linhasFiltradas) => valor
 *   }],
 *   dados, porPagina (0 = sem paginacao), camposBusca (padrao: campos das colunas),
 *   ordenacao: { campo, direcao }, linhaVariante: (linha) => success|danger|warning|info|level-1|level-2|level-3|subtotal,
 *   rotuloTotal: 'Total', vazio: { titulo, mensagem, acao: config de botao },
 *   compacta, listrada, grade, cabecalhoClaro, altura: padrao|full|auto,
 *   onLinhaClick(linha), onAtualizar({ total, filtrados, pagina })
 * })
 * Retorna { elemento, definirDados, atualizarConsulta, ordenarPor, irParaPagina,
 *           obterFiltrados, obterVisiveis, recarregar }.
 */
export function criarTabela({
  colunas = [], dados = [], porPagina = 0, camposBusca, ordenacao = null,
  linhaVariante, rotuloTotal = 'Total', vazio = {}, compacta = false, listrada = false,
  grade = false, cabecalhoClaro = false, altura, onLinhaClick, onAtualizar,
} = {}) {
  const estado = {
    dados: dados.slice(),
    busca: '',
    filtros: {},
    ordenacao: ordenacao ? { ...ordenacao } : null,
    pagina: 1,
    resultado: null,
  };
  const busca = camposBusca || colunas.map((c) => c.campo).filter((c) => typeof c === 'string');
  const ehNumerica = (col) => ['numero', 'moeda', 'percentual'].includes(col.tipo);
  const temTotal = colunas.some((c) => c.total);

  const tabela = h('table', {
    class: classes(
      'ctc-table',
      compacta && 'ctc-table--compact',
      listrada && 'ctc-table--striped',
      grade && 'ctc-table--grid',
      cabecalhoClaro && 'ctc-table--head-light',
    ),
  });
  const thead = h('thead');
  const tbody = h('tbody');
  const tfoot = h('tfoot');
  tabela.append(thead, tbody);
  if (temTotal) tabela.append(tfoot);

  const envoltorio = h('div', {
    class: classes('ctc-table-wrap', altura === 'full' && 'ctc-table-wrap--full', altura === 'auto' && 'ctc-table-wrap--auto'),
  }, tabela);
  const paginacao = h('div', { class: 'ctc-pagination' });
  const elemento = h('div', {}, envoltorio, porPagina > 0 ? paginacao : null);

  const classeColuna = (col, i) => classes(
    ehNumerica(col) && 'ctc-col--num',
    col.alinhamento === 'centro' && 'ctc-col--center',
    col.fixa && i === 0 && 'ctc-col--sticky',
    col.classe,
  );

  // Cabecalho com botao de ordenacao acessivel
  const botoesOrdem = new Map();
  const linhaCab = h('tr');
  colunas.forEach((col, i) => {
    const th = h('th', { class: classeColuna(col, i), scope: 'col', style: col.largura ? { width: col.largura } : null });
    if (col.ordenavel !== false && col.campo) {
      const botao = h('button', {
        type: 'button',
        class: 'ctc-th-filter__btn',
        'aria-label': `Ordenar por ${col.titulo}`,
        onClick: () => {
          const atual = estado.ordenacao;
          const direcao = atual && atual.campo === col.campo && atual.direcao === 'asc' ? 'desc' : 'asc';
          ordenarPor(col.campo, direcao);
        },
      }, criarIcone('ordenar', 12));
      botoesOrdem.set(col.campo, { botao, th });
      th.append(h('div', { class: 'ctc-th-filter' }, h('span', {}, col.titulo), botao));
    } else {
      th.append(col.titulo ?? '');
    }
    linhaCab.append(th);
  });
  thead.append(linhaCab);

  function atualizarIndicadores() {
    botoesOrdem.forEach(({ botao, th }, campo) => {
      const ativa = estado.ordenacao && estado.ordenacao.campo === campo;
      botao.classList.toggle('is-active', Boolean(ativa));
      botao.replaceChildren(criarIcone(ativa ? (estado.ordenacao.direcao === 'desc' ? 'seta-baixo' : 'seta-cima') : 'ordenar', 12));
      if (ativa) th.setAttribute('aria-sort', estado.ordenacao.direcao === 'desc' ? 'descending' : 'ascending');
      else th.removeAttribute('aria-sort');
    });
  }

  function celula(col, linha, i) {
    const valor = obterValor(linha, col.campo);
    let conteudo;
    if (typeof col.render === 'function') conteudo = col.render(valor, linha);
    else if (typeof col.formatar === 'function') conteudo = col.formatar(valor, linha);
    else conteudo = formatarPorTipo(valor, col.tipo, col.casas);
    return h('td', { class: classeColuna(col, i) }, conteudo);
  }

  function renderizarCorpo(itens) {
    tbody.replaceChildren();
    if (!itens.length) {
      const temFiltro = Boolean(estado.busca) || Object.values(estado.filtros)
        .some((v) => (Array.isArray(v) ? v.length > 0 : v != null && v !== ''));
      tbody.append(h('tr', {},
        h('td', { colspan: String(colunas.length) },
          h('div', { class: 'ctc-empty' },
            h('div', { class: 'ctc-empty__title' }, vazio.titulo || (temFiltro ? 'Nenhum resultado para os filtros aplicados' : 'Nenhum registro')),
            vazio.mensagem ? h('div', {}, vazio.mensagem) : null,
            vazio.acao ? criarBotao({ tamanho: 'sm', variante: 'primary', ...vazio.acao }) : null))));
      return;
    }
    itens.forEach((linha) => {
      const variante = typeof linhaVariante === 'function' ? linhaVariante(linha) : null;
      const tr = h('tr', {
        class: variante ? `ctc-row--${variante}` : null,
        tabindex: onLinhaClick ? '0' : null,
        style: onLinhaClick ? { cursor: 'pointer' } : null,
        onClick: onLinhaClick ? () => onLinhaClick(linha) : null,
        onKeydown: onLinhaClick ? (e) => { if (e.key === 'Enter') onLinhaClick(linha); } : null,
      });
      colunas.forEach((col, i) => tr.append(celula(col, linha, i)));
      tbody.append(tr);
    });
  }

  function renderizarTotais(filtrados) {
    if (!temTotal) return;
    const tr = h('tr');
    colunas.forEach((col, i) => {
      let conteudo = '';
      if (i === 0 && !col.total) conteudo = rotuloTotal;
      if (col.total === 'soma') conteudo = formatarPorTipo(somar(filtrados, col.campo), col.tipo || 'numero', col.casas);
      else if (col.total === 'contagem') conteudo = formatarNumero(filtrados.length, 0);
      else if (typeof col.total === 'function') conteudo = col.total(filtrados);
      tr.append(h('td', { class: classeColuna(col, i) }, conteudo));
    });
    tfoot.replaceChildren(tr);
  }

  function renderizarPaginacao(info) {
    if (!(porPagina > 0)) return;
    const botao = (texto, pagina, rotulo, ativo = false, desabilitado = false) => h('button', {
      type: 'button',
      class: classes('ctc-pagination__btn', ativo && 'is-active'),
      'aria-label': rotulo,
      'aria-current': ativo ? 'page' : null,
      disabled: desabilitado,
      onClick: () => irParaPagina(pagina),
    }, texto);

    const paginas = h('div', { class: 'ctc-pagination__pages' });
    const { pagina, totalPaginas } = info;
    paginas.append(botao('‹', pagina - 1, 'Página anterior', false, pagina <= 1));
    const inicio = Math.max(1, Math.min(pagina - 2, totalPaginas - 4));
    const fim = Math.min(totalPaginas, inicio + 4);
    for (let p = inicio; p <= fim; p += 1) paginas.append(botao(String(p), p, `Página ${p}`, p === pagina));
    paginas.append(botao('›', pagina + 1, 'Próxima página', false, pagina >= totalPaginas));

    paginacao.replaceChildren(
      h('span', {}, info.total ? `${formatarNumero(info.inicio, 0)}–${formatarNumero(info.fim, 0)} de ${formatarNumero(info.total, 0)}` : '0 registros'),
      paginas,
    );
  }

  function recarregar(avisar = true) {
    const coluna = estado.ordenacao && colunas.find((c) => c.campo === estado.ordenacao.campo);
    const resultado = aplicarConsulta(estado.dados, {
      busca: estado.busca,
      camposBusca: busca,
      filtros: estado.filtros,
      ordenacao: estado.ordenacao ? { ...estado.ordenacao, tipo: coluna?.tipo || 'auto' } : null,
      pagina: estado.pagina,
      porPagina,
    });
    estado.pagina = resultado.paginacao.pagina;
    estado.resultado = resultado;
    renderizarCorpo(resultado.itens);
    renderizarTotais(resultado.filtrados);
    renderizarPaginacao(resultado.paginacao);
    atualizarIndicadores();
    if (avisar) emitirAtualizacao();
  }

  function emitirAtualizacao() {
    if (typeof onAtualizar !== 'function' || !estado.resultado) return;
    const r = estado.resultado;
    onAtualizar({ total: r.totalGeral, filtrados: r.filtrados.length, pagina: r.paginacao.pagina });
  }

  function definirDados(novos) { estado.dados = novos.slice(); estado.pagina = 1; recarregar(); }
  function atualizarConsulta({ busca: termo, filtros } = {}) {
    if (termo !== undefined) estado.busca = termo;
    if (filtros !== undefined) estado.filtros = { ...filtros };
    estado.pagina = 1;
    recarregar();
  }
  function ordenarPor(campo, direcao = 'asc') { estado.ordenacao = campo ? { campo, direcao } : null; recarregar(); }
  function irParaPagina(pagina) { estado.pagina = pagina; recarregar(); }

  // 1a renderizacao: onAtualizar e adiado para depois do retorno, permitindo
  // que o callback use variaveis declaradas depois de criarTabela().
  recarregar(false);
  queueMicrotask(emitirAtualizacao);

  return {
    elemento,
    definirDados,
    atualizarConsulta,
    ordenarPor,
    irParaPagina,
    recarregar: () => recarregar(),
    obterFiltrados: () => estado.resultado.filtrados.slice(),
    obterVisiveis: () => estado.resultado.itens.slice(),
  };
}


/* =============================================================================
   06. FILTROS: chips, segmentado, selecao multipla, barra de filtros, abas
   ========================================================================== */

const normalizarOpcoes = (opcoes = []) => opcoes.map((o) => (typeof o === 'object' ? o : { valor: o, texto: String(o) }));

/** criarChips({ opcoes: [{valor, texto}] | [texto], valor, onMudar(valor) }) — selecao unica em pilulas. */
export function criarChips({ opcoes = [], valor = '', onMudar, rotulo = 'Filtro rápido' } = {}) {
  const lista = normalizarOpcoes(opcoes);
  let atual = valor;
  const elemento = h('div', { class: 'ctc-cluster', role: 'group', 'aria-label': rotulo });
  const botoes = lista.map((op) => h('button', {
    type: 'button',
    class: 'ctc-chip',
    'aria-pressed': 'false',
    onClick: () => { definirValor(op.valor); if (typeof onMudar === 'function') onMudar(atual); },
  }, op.texto));
  function definirValor(v) {
    atual = v;
    botoes.forEach((b, i) => {
      const on = String(lista[i].valor) === String(v);
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }
  elemento.append(...botoes);
  definirValor(valor);
  return { elemento, definirValor, obterValor: () => atual };
}

/** criarSegmentado({ opcoes, valor, onMudar }) — alternador entre poucas opcoes. */
export function criarSegmentado({ opcoes = [], valor, onMudar, rotulo = 'Alternar visão' } = {}) {
  const lista = normalizarOpcoes(opcoes);
  let atual = valor ?? lista[0]?.valor;
  const elemento = h('div', { class: 'ctc-segmented', role: 'group', 'aria-label': rotulo });
  const botoes = lista.map((op) => h('button', {
    type: 'button',
    class: 'ctc-segmented__btn',
    'aria-pressed': 'false',
    onClick: () => { definirValor(op.valor); if (typeof onMudar === 'function') onMudar(atual); },
  }, op.texto));
  function definirValor(v) {
    atual = v;
    botoes.forEach((b, i) => {
      const on = String(lista[i].valor) === String(v);
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }
  elemento.append(...botoes);
  definirValor(atual);
  return { elemento, definirValor, obterValor: () => atual };
}

/**
 * criarSelecaoMultipla({ rotulo, opcoes, selecionados: [], onMudar(array) })
 * Dropdown com caixas de selecao e acoes "Todos" / "Limpar".
 */
export function criarSelecaoMultipla({ rotulo = 'Selecionar', opcoes = [], selecionados = [], onMudar } = {}) {
  const lista = normalizarOpcoes(opcoes);
  let marcados = new Set(selecionados.map(String));
  const idPainel = gerarId('ctc-drop');

  const textoBotao = h('span', {});
  const botao = h('button', {
    type: 'button',
    class: 'ctc-btn ctc-btn--outline ctc-btn--sm',
    'aria-haspopup': 'true',
    'aria-expanded': 'false',
    'aria-controls': idPainel,
    onClick: () => alternar(),
  }, textoBotao, criarIcone('chevron-baixo', 14));

  const caixas = lista.map((op) => h('input', {
    type: 'checkbox',
    value: String(op.valor),
    checked: marcados.has(String(op.valor)),
    onChange: (e) => {
      if (e.target.checked) marcados.add(e.target.value); else marcados.delete(e.target.value);
      atualizarTexto();
      if (typeof onMudar === 'function') onMudar(obterSelecionados());
    },
  }));

  const painel = h('div', { class: 'ctc-dropdown__panel', id: idPainel },
    h('div', { class: 'ctc-check-list' },
      lista.map((op, i) => h('label', { class: 'ctc-check' }, caixas[i], op.texto))),
    h('div', { class: 'ctc-dropdown__footer' },
      h('button', { type: 'button', class: 'ctc-link', onClick: () => definirSelecionados(lista.map((o) => o.valor), true) }, 'Todos'),
      h('button', { type: 'button', class: 'ctc-link', onClick: () => definirSelecionados([], true) }, 'Limpar')));

  const elemento = h('div', { class: 'ctc-dropdown' }, botao, painel);

  function atualizarTexto() {
    const n = marcados.size;
    textoBotao.textContent = n === 0 || n === lista.length ? `${rotulo}: todos` : `${rotulo} (${n})`;
  }
  function alternar(abrir) {
    const deveAbrir = abrir ?? !painel.classList.contains('is-open');
    painel.classList.toggle('is-open', deveAbrir);
    botao.setAttribute('aria-expanded', String(deveAbrir));
  }
  function obterSelecionados() {
    return lista.filter((o) => marcados.has(String(o.valor))).map((o) => o.valor);
  }
  function definirSelecionados(valores, notificarMudanca = false) {
    marcados = new Set(valores.map(String));
    caixas.forEach((c) => { c.checked = marcados.has(c.value); });
    atualizarTexto();
    if (notificarMudanca && typeof onMudar === 'function') onMudar(obterSelecionados());
  }

  document.addEventListener('click', (e) => { if (!elemento.contains(e.target)) alternar(false); });
  elemento.addEventListener('keydown', (e) => { if (e.key === 'Escape') { alternar(false); botao.focus(); } });
  atualizarTexto();

  return { elemento, obterSelecionados, definirSelecionados, fechar: () => alternar(false) };
}

function criarSelectSimples({ opcoes = [], valor = '', todos = 'Todos', rotulo, onMudar, classe }) {
  const lista = normalizarOpcoes(opcoes);
  return h('select', {
    class: classes('ctc-select', classe),
    'aria-label': rotulo,
    onChange: (e) => { if (typeof onMudar === 'function') onMudar(e.target.value); },
  },
  todos != null ? h('option', { value: '' }, rotulo ? `${rotulo}: ${todos.toLowerCase()}` : todos) : null,
  lista.map((op) => h('option', { value: String(op.valor), selected: String(op.valor) === String(valor) }, op.texto)));
}

/**
 * criarBarraFiltros({
 *   busca: { placeholder, largura (opcional, ex.: '320px') } | false,
 *   selects:   [{ campo, rotulo, opcoes, valor }],
 *   multiplos: [{ campo, rotulo, opcoes, selecionados }],
 *   chips:     { campo, opcoes, valor },
 *   extras: [Node | config de botao],
 *   onMudar({ busca, filtros }), atraso: 250
 * })
 * O estado devolvido serve direto para tabela.atualizarConsulta(estado).
 * Retorna { elemento, obterEstado, limpar, definirMeta }.
 */
export function criarBarraFiltros({
  busca = { placeholder: 'Pesquisar...' }, selects = [], multiplos = [], chips, extras = [],
  onMudar, atraso = 250,
} = {}) {
  const estado = { busca: '', filtros: {} };
  const emitir = () => { if (typeof onMudar === 'function') onMudar(obterEstado()); };
  const emitirComAtraso = debounce(emitir, atraso);
  const limpadores = [];

  const elemento = h('div', { class: 'ctc-filterbar', role: 'search' });

  if (busca) {
    const campo = h('input', {
      type: 'search',
      class: 'ctc-input ctc-input--sm ctc-search ctc-allow-readonly',
      placeholder: busca.placeholder || 'Pesquisar...',
      'aria-label': busca.placeholder || 'Pesquisar',
      style: busca.largura ? { width: busca.largura } : null,
      onInput: (e) => { estado.busca = e.target.value; emitirComAtraso(); },
    });
    limpadores.push(() => { campo.value = ''; estado.busca = ''; });
    elemento.append(campo);
  }

  selects.forEach((cfg) => {
    if (cfg.valor) estado.filtros[cfg.campo] = cfg.valor;
    const select = criarSelectSimples({
      ...cfg,
      classe: 'ctc-select--sm ctc-allow-readonly',
      onMudar: (v) => { estado.filtros[cfg.campo] = v; emitir(); },
    });
    limpadores.push(() => { select.value = ''; estado.filtros[cfg.campo] = ''; });
    elemento.append(select);
  });

  multiplos.forEach((cfg) => {
    estado.filtros[cfg.campo] = cfg.selecionados || [];
    const multi = criarSelecaoMultipla({
      ...cfg,
      onMudar: (valores) => {
        const todos = valores.length === normalizarOpcoes(cfg.opcoes).length;
        estado.filtros[cfg.campo] = todos ? [] : valores;
        emitir();
      },
    });
    limpadores.push(() => { multi.definirSelecionados([]); estado.filtros[cfg.campo] = []; });
    elemento.append(multi.elemento);
  });

  if (chips) {
    estado.filtros[chips.campo] = chips.valor ?? '';
    const grupo = criarChips({
      ...chips,
      valor: chips.valor ?? '',
      onMudar: (v) => { estado.filtros[chips.campo] = v; emitir(); },
    });
    limpadores.push(() => { grupo.definirValor(''); estado.filtros[chips.campo] = ''; });
    elemento.append(grupo.elemento);
  }

  const meta = h('span', { class: 'ctc-filterbar__meta ctc-spacer' });
  elemento.append(meta, ...resolverAcoes(extras, { tamanho: 'sm', variante: 'outline' }));

  function obterEstado() {
    return { busca: estado.busca, filtros: { ...estado.filtros } };
  }
  function limpar() {
    limpadores.forEach((fn) => fn());
    emitir();
  }

  return {
    elemento,
    obterEstado,
    limpar,
    definirMeta: (texto) => { meta.textContent = texto; },
  };
}

/**
 * criarAbas({ abas: [{ id, texto, conteudo: Node | () => Node }], ativa, onMudar(id), dentroDeModal })
 * Retorna { elemento, lista, painel, ativar }.
 */
export function criarAbas({ abas = [], ativa, onMudar, dentroDeModal = false } = {}) {
  const lista = h('div', { class: dentroDeModal ? 'ctc-modal__tabs' : 'ctc-tabs', role: 'tablist' });
  const painel = h('div', { role: 'tabpanel', tabindex: '0', style: dentroDeModal ? null : { paddingTop: 'var(--ctc-sp-4)' } });
  const base = gerarId('ctc-aba');
  const botoes = abas.map((aba, i) => h('button', {
    type: 'button',
    class: 'ctc-tab',
    role: 'tab',
    id: `${base}-${i}`,
    'aria-selected': 'false',
    tabindex: '-1',
    onClick: () => ativar(aba.id),
    onKeydown: (e) => {
      const passo = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!passo) return;
      const proximo = abas[(i + passo + abas.length) % abas.length];
      ativar(proximo.id);
      botoes[abas.indexOf(proximo)].focus();
    },
  }, aba.texto));
  lista.append(...botoes);

  function ativar(id) {
    const indice = abas.findIndex((a) => a.id === id);
    if (indice < 0) return;
    botoes.forEach((b, i) => {
      const on = i === indice;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    painel.setAttribute('aria-labelledby', botoes[indice].id);
    const conteudo = abas[indice].conteudo;
    painel.replaceChildren();
    anexarFilhos(painel, [typeof conteudo === 'function' ? conteudo() : conteudo]);
    if (typeof onMudar === 'function') onMudar(id);
  }

  if (abas.length) ativar(ativa ?? abas[0].id);
  return { elemento: dentroDeModal ? lista : h('div', {}, lista, painel), lista, painel, ativar };
}


/* =============================================================================
   07. FORMULARIOS
   ========================================================================== */

const TIPOS_INPUT = {
  texto: 'text', email: 'email', senha: 'password', data: 'date', mes: 'month', telefone: 'tel',
};

/**
 * criarCampo({
 *   nome, rotulo, tipo: texto|numero|moeda|percentual|email|senha|data|mes|telefone|
 *                       textarea|select|checkbox|radio,
 *   valor, placeholder, dica, obrigatorio, opcoes (select/radio), prefixo, sufixo,
 *   desabilitado, somenteLeitura, larguraTotal, tamanho: 'sm', atributos: {...}
 * })
 * numero/moeda/percentual usam campo de texto com teclado numerico e aceitam virgula.
 * moeda formata ao sair do campo (1234,5 -> 1.234,50).
 */
export function criarCampo({
  nome, rotulo, tipo = 'texto', valor, placeholder, dica, obrigatorio = false, opcoes = [],
  prefixo, sufixo, desabilitado = false, somenteLeitura = false, larguraTotal = false,
  tamanho, atributos = {},
} = {}) {
  const id = atributos.id || gerarId(`campo-${nome || 'x'}`);
  const idDica = dica ? `${id}-dica` : null;
  const comuns = {
    id, name: nome, required: obrigatorio, disabled: desabilitado, 'aria-describedby': idDica, ...atributos,
  };
  const classeCampo = classes('ctc-field', larguraTotal && 'ctc-form-grid__full');
  const elDica = dica ? h('div', { class: 'ctc-field__hint', id: idDica }, dica) : null;
  const elErro = h('div', { class: 'ctc-field__error', id: `${id}-erro` });

  if (tipo === 'checkbox') {
    return h('div', { class: classeCampo },
      h('label', { class: 'ctc-check' }, h('input', { ...comuns, type: 'checkbox', checked: Boolean(valor) }), rotulo),
      elDica, elErro);
  }

  if (tipo === 'radio') {
    const grupo = h('div', { class: 'ctc-cluster', role: 'radiogroup', 'aria-labelledby': `${id}-rotulo` },
      normalizarOpcoes(opcoes).map((op, i) => h('label', { class: 'ctc-check' },
        h('input', {
          type: 'radio', name: nome, value: String(op.valor), id: i === 0 ? id : null,
          checked: String(op.valor) === String(valor ?? ''), required: obrigatorio, disabled: desabilitado,
        }),
        op.texto)));
    return h('div', { class: classeCampo },
      h('span', { class: classes('ctc-field__label', obrigatorio && 'ctc-field__label--required'), id: `${id}-rotulo` }, rotulo),
      grupo, elDica, elErro);
  }

  let controle;
  if (tipo === 'textarea') {
    controle = h('textarea', { ...comuns, class: 'ctc-textarea', placeholder, readOnly: somenteLeitura });
    controle.value = valor ?? '';
  } else if (tipo === 'select') {
    controle = h('select', { ...comuns, class: classes('ctc-select', tamanho && `ctc-select--${tamanho}`) },
      placeholder !== undefined ? h('option', { value: '' }, placeholder || 'Selecione...') : null,
      normalizarOpcoes(opcoes).map((op) => h('option', { value: String(op.valor), selected: String(op.valor) === String(valor ?? '') }, op.texto)));
  } else {
    const numerico = ['numero', 'moeda', 'percentual'].includes(tipo);
    controle = h('input', {
      ...comuns,
      type: numerico ? 'text' : (TIPOS_INPUT[tipo] || 'text'),
      inputmode: numerico ? 'decimal' : null,
      dataset: numerico ? { tipo } : null,
      class: classes('ctc-input', numerico && 'ctc-input--num', tamanho && `ctc-input--${tamanho}`),
      placeholder,
      readOnly: somenteLeitura,
      autocomplete: atributos.autocomplete || (tipo === 'senha' ? 'current-password' : null),
    });
    if (tipo === 'moeda') {
      controle.value = valor == null || valor === '' ? '' : formatarMoeda(valor, { simbolo: false });
      controle.addEventListener('blur', () => {
        const n = paraNumero(controle.value);
        if (n != null) controle.value = formatarMoeda(n, { simbolo: false });
      });
    } else if (numerico) {
      controle.value = valor == null || valor === '' ? '' : formatarNumero(valor);
    } else {
      controle.value = valor ?? '';
    }
  }

  const prefixoFinal = prefixo ?? (tipo === 'moeda' ? 'R$' : null);
  const sufixoFinal = sufixo ?? (tipo === 'percentual' ? '%' : null);
  const corpo = prefixoFinal || sufixoFinal
    ? h('div', { class: 'ctc-input-group' },
      prefixoFinal ? h('span', { class: 'ctc-input-group__addon' }, prefixoFinal) : null,
      controle,
      sufixoFinal ? h('span', { class: 'ctc-input-group__addon' }, sufixoFinal) : null)
    : controle;

  return h('div', { class: classeCampo },
    rotulo ? h('label', { class: classes('ctc-field__label', obrigatorio && 'ctc-field__label--required'), for: id }, rotulo) : null,
    corpo, elDica, elErro);
}

/**
 * criarFormulario({
 *   campos: [config de criarCampo + regras: { minimo, maximo, validar, ... }],
 *   colunas: 1|2|3, valores, textoEnviar, textoCancelar, semBotoes,
 *   onEnviar(valores, form) (pode ser async), onCancelar()
 * })
 * Valida ao enviar e, depois da 1a tentativa, a cada alteracao.
 * Retorna { elemento, enviar, validar, obterValores, preencher, limparErros, definirErro, campo(nome) }.
 */
export function criarFormulario({
  campos = [], colunas = 2, valores, textoEnviar = 'Salvar', textoCancelar,
  semBotoes = false, onEnviar, onCancelar,
} = {}) {
  const esquema = {};
  campos.forEach((c) => {
    if (!c.nome) return;
    const tipoRegra = ['numero', 'moeda', 'percentual', 'email'].includes(c.tipo)
      ? c.tipo : (c.tipo === 'data' || c.tipo === 'mes' ? 'data' : undefined);
    esquema[c.nome] = { obrigatorio: Boolean(c.obrigatorio), tipo: tipoRegra, ...(c.regras || {}) };
  });

  const grade = h('div', {
    class: classes('ctc-form-grid', colunas === 3 && 'ctc-form-grid--3'),
    style: colunas === 1 ? { gridTemplateColumns: 'minmax(0, 1fr)' } : null,
  }, campos.map((c) => criarCampo(c)));

  const botaoEnviar = criarBotao({ texto: textoEnviar, variante: 'primary', tipo: 'submit', apenasEdicao: true });
  const rodape = semBotoes ? null : h('div', { class: 'ctc-cluster', style: { marginTop: 'var(--ctc-sp-4)' } },
    h('span', { class: 'ctc-spacer' }),
    textoCancelar ? criarBotao({ texto: textoCancelar, variante: 'outline', onClick: () => onCancelar && onCancelar() }) : null,
    botaoEnviar);

  const form = h('form', { novalidate: true }, grade, rodape);
  let tentou = false;

  function validar() {
    return validarFormulario(form, esquema);
  }

  async function enviar() {
    tentou = true;
    const resultado = validar();
    if (!resultado.valido) return false;
    if (typeof onEnviar === 'function') {
      definirCarregando(botaoEnviar, true);
      try {
        await onEnviar(resultado.valores, form);
      } finally {
        definirCarregando(botaoEnviar, false);
      }
    }
    return true;
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); enviar(); });
  const revalidar = (e) => {
    const nome = e.target.name;
    if (!tentou || !nome) return;
    const todos = obterValoresFormulario(form);
    definirErroCampo(form, nome, validarValor(todos[nome], esquema[nome] || {}, todos));
  };
  form.addEventListener('input', revalidar);
  form.addEventListener('change', revalidar);

  if (valores) preencherFormulario(form, valores);

  return {
    elemento: form,
    enviar,
    validar,
    obterValores: () => obterValoresFormulario(form),
    preencher: (v) => preencherFormulario(form, v),
    limparErros: () => { tentou = false; limparErros(form); },
    definirErro: (nome, mensagem) => definirErroCampo(form, nome, mensagem),
    campo: (nome) => form.elements.namedItem(nome),
  };
}


/* =============================================================================
   08. MODAIS (substituem confirm() e prompt())
   ========================================================================== */

const pilhaModais = [];
const SELETOR_FOCAVEL = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

document.addEventListener('keydown', (e) => {
  const topo = pilhaModais[pilhaModais.length - 1];
  if (!topo) return;
  if (e.key === 'Escape' && topo.fecharComEsc) { e.preventDefault(); topo.fechar(); }
  if (e.key === 'Tab') {
    const focaveis = [...topo.dialogo.querySelectorAll(SELETOR_FOCAVEL)].filter((el) => el.offsetParent !== null);
    if (!focaveis.length) return;
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
  }
});

/**
 * criarModal({
 *   titulo, conteudo, tamanho: sm|md|lg|xl, perigo,
 *   acoes: [{ texto, variante, fechar (padrao true), onClick(modal) -> false impede fechar; pode ser async }],
 *   fecharAoClicarFora (padrao true), fecharComEsc (padrao true), destruirAoFechar, onFechar
 * })
 * Retorna { elemento, corpo, abrir, fechar, definirConteudo, definirTitulo, destruir, estaAberto }.
 */
export function criarModal({
  titulo = '', conteudo, tamanho = 'md', perigo = false, acoes = [], fecharAoClicarFora = true,
  fecharComEsc = true, destruirAoFechar = false, onFechar,
} = {}) {
  const idTitulo = gerarId('ctc-modal-titulo');
  const elTitulo = h('h3', { class: 'ctc-modal__title', id: idTitulo }, titulo);
  const corpo = h('div', { class: 'ctc-modal__body' }, conteudo);
  let focoAnterior = null;
  let api = null;

  const botoes = acoes.map((acao) => {
    const botao = criarBotao({
      texto: acao.texto,
      variante: acao.variante || 'outline',
      icone: acao.icone,
      onClick: async () => {
        let resultado;
        if (typeof acao.onClick === 'function') {
          definirCarregando(botao, true);
          try { resultado = await acao.onClick(api); } finally { definirCarregando(botao, false); }
        }
        if (acao.fechar !== false && resultado !== false) fechar();
      },
    });
    return botao;
  });

  const dialogo = h('div', { class: classes('ctc-modal__dialog', `ctc-modal__dialog--${tamanho}`) },
    h('div', { class: 'ctc-modal__header' },
      elTitulo,
      h('button', { type: 'button', class: 'ctc-modal__close', 'aria-label': 'Fechar', onClick: () => fechar() }, '×')),
    corpo,
    botoes.length ? h('div', { class: 'ctc-modal__footer' }, botoes) : null);

  const elemento = h('div', {
    class: classes('ctc-modal', perigo && 'ctc-modal--danger'),
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': idTitulo,
    onMousedown: (e) => { if (fecharAoClicarFora && e.target === elemento) fechar(); },
  }, dialogo);

  const registro = { dialogo, fecharComEsc, fechar: () => fechar() };

  function abrir() {
    if (elemento.classList.contains('is-open')) return;
    if (!elemento.isConnected) document.body.append(elemento);
    focoAnterior = document.activeElement;
    elemento.classList.add('is-open');
    pilhaModais.push(registro);
    document.body.style.overflow = 'hidden';
    const alvo = corpo.querySelector(SELETOR_FOCAVEL) || dialogo.querySelector('.ctc-modal__close');
    if (alvo) alvo.focus();
  }

  function fechar() {
    if (!elemento.classList.contains('is-open')) return;
    elemento.classList.remove('is-open');
    const i = pilhaModais.indexOf(registro);
    if (i >= 0) pilhaModais.splice(i, 1);
    if (!pilhaModais.length) document.body.style.overflow = '';
    if (focoAnterior && typeof focoAnterior.focus === 'function') focoAnterior.focus();
    if (typeof onFechar === 'function') onFechar();
    if (destruirAoFechar) elemento.remove();
  }

  api = {
    elemento,
    corpo,
    abrir,
    fechar,
    definirConteudo: (...nos) => { corpo.replaceChildren(); anexarFilhos(corpo, nos); },
    definirTitulo: (texto) => { elTitulo.textContent = texto; },
    destruir: () => { fechar(); elemento.remove(); },
    estaAberto: () => elemento.classList.contains('is-open'),
  };
  return api;
}

/**
 * Substitui confirm(). Retorna Promise<boolean>.
 *   if (await confirmar({ titulo: 'Excluir item?', mensagem: 'Esta acao nao pode ser desfeita.', perigo: true })) ...
 */
export function confirmar({
  titulo = 'Confirmar', mensagem = '', textoConfirmar = 'Confirmar', textoCancelar = 'Cancelar', perigo = false,
} = {}) {
  return new Promise((resolver) => {
    let resposta = false;
    const modal = criarModal({
      titulo,
      tamanho: 'sm',
      perigo,
      conteudo: h('p', {}, mensagem),
      destruirAoFechar: true,
      onFechar: () => resolver(resposta),
      acoes: [
        { texto: textoCancelar, variante: 'outline' },
        { texto: textoConfirmar, variante: perigo ? 'danger' : 'primary', onClick: () => { resposta = true; } },
      ],
    });
    modal.abrir();
  });
}

/**
 * Substitui prompt(). Retorna Promise<valor | null> (null = cancelado).
 *   const nome = await solicitarValor({ titulo: 'Nova versão', rotulo: 'Nome', obrigatorio: true })
 */
export function solicitarValor({
  titulo = 'Informar valor', rotulo = '', tipo = 'texto', valor = '', obrigatorio = false,
  regras = {}, textoConfirmar = 'OK', textoCancelar = 'Cancelar',
} = {}) {
  return new Promise((resolver) => {
    let resposta = null;
    const formulario = criarFormulario({
      campos: [{ nome: 'valor', rotulo, tipo, valor, obrigatorio, regras }],
      colunas: 1,
      semBotoes: true,
      onEnviar: (valores) => { resposta = valores.valor; modal.fechar(); },
    });
    const modal = criarModal({
      titulo,
      tamanho: 'sm',
      conteudo: formulario.elemento,
      destruirAoFechar: true,
      onFechar: () => resolver(resposta),
      acoes: [
        { texto: textoCancelar, variante: 'outline' },
        { texto: textoConfirmar, variante: 'primary', fechar: false, onClick: () => formulario.enviar() },
      ],
    });
    modal.abrir();
  });
}



/* =============================================================================
   09. ACESSO: TELA DE ENTRADA, ADMINISTRACAO E PAINEL DO CONTROLADOR
   Perfis: administrador (cadastra controladores), controlador (edita e salva),
   visualizador (somente leitura). Sem servidor, isto e CONTROLE DE USO, nao
   seguranca: quem abrir o codigo-fonte consegue contornar.
   ========================================================================== */

const esperar = (ms) => new Promise((resolver) => { setTimeout(resolver, ms); });

/** Campo "Controlador": lista os controladores cadastrados para escolher com um clique. */
function campoLoginControlador(controladores, valor) {
  const lista = [...controladores].sort((a, b) => String(a.nome || a.login).localeCompare(String(b.nome || b.login), 'pt-BR'));
  return {
    nome: 'login',
    rotulo: 'Controlador',
    tipo: 'select',
    obrigatorio: true,
    placeholder: 'Selecione o controlador...',
    opcoes: lista.map((c) => ({ valor: c.login, texto: c.nome ? `${c.nome} (${c.login})` : c.login })),
    valor,   // sem valor: o campo abre vazio ("Selecione o controlador...")
  };
}

/** Ao escolher o controlador, o cursor vai direto para a senha. */
function ligarLoginASenha(formulario) {
  const lista = formulario.campo('login');
  lista.addEventListener('change', () => { if (lista.value) formulario.campo('senha').focus(); });
  return () => { if (lista.value) formulario.campo('senha').focus(); };
}
const ROTULO_PERFIL = { administrador: 'Administrador', controlador: 'Controlador', visualizador: 'Visualizador' };

function descreverBase(base, nomeArquivo) {
  const n = base.controladores.length;
  const partes = [nomeArquivo ? `Base carregada: ${nomeArquivo}` : 'Base carregada'];
  if (base.salvoEm) partes.push(`salva em ${formatarData(base.salvoEm, 'data-hora')}`);
  partes.push(`${n} controlador${n === 1 ? '' : 'es'}`);
  return partes.join(' — ');
}

/**
 * criarTelaEntrada({
 *   logo, titulo, subtitulo, formato ('id-do-aplicativo'), prefixoArquivo,
 *   administrador: { sal, hash },     // resumo da senha do administrador (nunca o texto)
 *   baseInicial: null | base,         // usada quando nenhum JSON e importado (ex.: demonstracao)
 *   textoBaseInicial,                 // explica qual base sera usada sem importacao
 *   armazenamento,                    // opcional: provedor de versoes (botao "Abrir versao salva")
 *   criarBaseNova: () => base,        // opcional: estrutura da base em branco do botao "Iniciar controle"
 * "Iniciar controle" pede a senha do administrador e entra no app com perfil 'administrador' (edicao).
 *   rodape,
 *   onEntrar({ perfil, usuario, base, nomeArquivo })
 * })
 * Retorna { elemento, mostrar(alvo), remover, obterBase, definirBase(base, nomeArquivo) }.
 * A base carregada continua na tela ao voltar do aplicativo; so sai pelo link "Remover base carregada".
 */
export function criarTelaEntrada({
  logo, titulo = 'Aplicativo', subtitulo = 'Escolha como deseja acessar', formato,
  prefixoArquivo, administrador = {}, baseInicial = null,
  textoBaseInicial = 'Nenhuma base importada.', rodape, onEntrar, armazenamento, criarBaseNova,
} = {}) {
  let base = baseInicial ? validarBase(JSON.parse(JSON.stringify(baseInicial)), { formato }).base : null;
  let nomeArquivo = null;
  let importada = false;
  let pendenteExportar = false;

  const entrada = h('input', { type: 'file', accept: '.json,application/json', class: 'ctc-hidden', 'aria-hidden': 'true', tabindex: '-1' });
  const status = h('div', { class: 'ctc-landing__status', role: 'status' });
  const linkRemover = h('button', {
    type: 'button',
    class: 'ctc-link ctc-link--danger ctc-text-xs',
    onClick: async () => {
      if (pendenteExportar && !(await confirmar({ titulo: 'Remover a base?', mensagem: 'Há controladores cadastrados que ainda não foram exportados.', textoConfirmar: 'Remover', perigo: true }))) return;
      base = baseInicial ? validarBase(JSON.parse(JSON.stringify(baseInicial)), { formato }).base : null;
      nomeArquivo = null;
      importada = false;
      pendenteExportar = false;
      atualizarStatus();
    },
  }, 'Remover base carregada');

  const elLogoEntrada = h('div', { class: 'ctc-landing__logo' });
  const elTituloEntrada = h('h1', { class: 'ctc-landing__title' }, titulo);
  function atualizarMarca() {
    const identidade = base?.identidade || {};
    const logoAtual = identidade.logo || logo;
    elLogoEntrada.replaceChildren(conteudoLogo(logoAtual));
    elLogoEntrada.classList.toggle('ctc-hidden', !logoAtual);
    elTituloEntrada.textContent = identidade.titulo || titulo;
  }

  function atualizarStatus() {
    atualizarMarca();
    let texto;
    if (importada && base) texto = descreverBase(base, nomeArquivo);
    else if (base) texto = `${textoBaseInicial} ${base.controladores.length ? `(${base.controladores.length} controlador${base.controladores.length === 1 ? '' : 'es'})` : ''}`.trim();
    else texto = textoBaseInicial;
    if (pendenteExportar) texto += ' — alterações de controladores ainda não exportadas';
    status.textContent = texto;
    status.classList.toggle('is-loaded', importada);
    linkRemover.classList.toggle('ctc-hidden', !importada && !pendenteExportar);
  }

  /** Base importada que traz configuracao de nuvem: passa a usa-la neste navegador. */
  async function adotarNuvemDaBase(novaBase) {
    const recebida = novaBase && novaBase.nuvem && novaBase.nuvem.firebase;
    if (!recebida || !armazenamento || !armazenamento.configurar) return;
    const atual = armazenamento.obterConfig();
    if (atual && atual.projectId === recebida.projectId && atual.appId === recebida.appId) return;
    await armazenamento.configurar(recebida, { testar: false });
    toast.info('Nuvem configurada pela base', `Firebase — projeto ${recebida.projectId}`);
  }

  async function podeSubstituirBase() {
    if (!pendenteExportar) return true;
    return confirmar({ titulo: 'Substituir a base?', mensagem: 'Há controladores cadastrados que ainda não foram exportados.', textoConfirmar: 'Substituir', perigo: true });
  }

  function abrirVersaoSalva() {
    abrirListaVersoes({
      armazenamento,
      titulo: 'Abrir versão salva',
      textoAcao: 'Abrir',
      onEscolher: async (versao) => {
        if (!(await podeSubstituirBase())) return false;
        let registro;
        try {
          registro = await armazenamento.abrir(versao.id);
        } catch (erro) {
          toast.erro('Versão não aberta', erro.message);
          return false;
        }
        const resultado = validarBase(registro.base, { formato });
        if (!resultado.valida) {
          toast.erro('Versão não aberta', resultado.erros.join(' '));
          return false;
        }
        base = resultado.base;
        nomeArquivo = `Nuvem: ${registro.nome}`;
        importada = true;
        pendenteExportar = false;
        atualizarStatus();
        toast.sucesso('Versão aberta', registro.nome);
        return true;
      },
    });
  }

  entrada.addEventListener('change', async () => {
    const arquivo = entrada.files[0];
    entrada.value = '';
    if (!arquivo) return;
    if (!(await podeSubstituirBase())) return;
    try {
      const resultado = validarBase(await lerArquivoJSON(arquivo), { formato });
      if (!resultado.valida) {
        toast.erro('Base não importada', resultado.erros.join(' '));
        return;
      }
      base = resultado.base;
      nomeArquivo = arquivo.name;
      importada = true;
      await adotarNuvemDaBase(base);
      pendenteExportar = false;
      atualizarStatus();
      toast.sucesso('Base importada', arquivo.name);
    } catch (erro) {
      toast.erro('Base não importada', erro.message);
    }
  });

  function exigirBase() {
    if (base) return true;
    toast.aviso('Importe a base de dados', 'Use o botão "Importar base de dados (JSON)" antes de entrar.');
    return false;
  }

  function entrar(perfil, usuario = null) {
    elemento.remove();
    // o aplicativo recebe uma COPIA: o que for editado e nao salvo nao altera a base carregada aqui
    const copia = JSON.parse(JSON.stringify(base));
    if (typeof onEntrar === 'function') onEntrar({ perfil, usuario, base: copia, nomeArquivo });
  }

  /* ---- Visualizador ---- */
  function entrarVisualizador() {
    if (exigirBase()) entrar('visualizador');
  }

  /* ---- Controlador ---- */
  function entrarControlador() {
    if (!exigirBase()) return;
    if (!base.controladores.length) {
      criarModal({
        titulo: 'Nenhum controlador cadastrado',
        tamanho: 'sm',
        destruirAoFechar: true,
        conteudo: h('p', {}, 'Esta base ainda não tem controladores. O administrador precisa cadastrá-los e exportar a base.'),
        acoes: [{ texto: 'Entendi', variante: 'primary' }],
      }).abrir();
      return;
    }
    const formulario = criarFormulario({
      colunas: 1,
      semBotoes: true,
      campos: [
        campoLoginControlador(base.controladores),
        { nome: 'senha', rotulo: 'Senha', tipo: 'senha', obrigatorio: true },
      ],
      onEnviar: async ({ login, senha }) => {
        const registro = base.controladores.find((c) => c.login === normalizarLogin(login));
        if (!registro || !(await verificarSenha(senha, registro))) {
          await esperar(500);
          formulario.definirErro('senha', 'Login ou senha incorretos.');
          return;
        }
        modal.fechar();
        entrar('controlador', { login: registro.login, nome: registro.nome || registro.login });
      },
    });
    const focarSenha = ligarLoginASenha(formulario);
    const modal = criarModal({
      titulo: 'Entrar como Controlador',
      tamanho: 'sm',
      destruirAoFechar: true,
      conteudo: formulario.elemento,
      acoes: [
        { texto: 'Cancelar', variante: 'outline' },
        { texto: 'Entrar', variante: 'primary', fechar: false, onClick: () => formulario.enviar() },
      ],
    });
    modal.abrir();
    focarSenha();
  }

  /* ---- Administrador ---- */
  function abrirAdministracao(senhaMestra) {
    if (!base) base = criarBaseVazia(formato);
    let tabela = null;

    const atualizarTabela = () => tabela.definirDados(base.controladores);
    tabela = criarTabela({
      compacta: true,
      altura: 'auto',
      dados: base.controladores,
      vazio: { titulo: 'Nenhum controlador cadastrado', mensagem: 'Use o formulário abaixo para adicionar.' },
      colunas: [
        { campo: 'login', titulo: 'Login' },
        { campo: 'nome', titulo: 'Nome' },
        {
          campo: 'senha', titulo: 'Senha', ordenavel: false,
          render: (_, linha) => {
            const oculto = '••••••••';
            const botao = criarBotao({ texto: oculto, icone: 'olho', variante: 'ghost', tamanho: 'sm', titulo: 'Mostrar senha' });
            const texto = botao.querySelector('span');
            let visivel = false;
            botao.addEventListener('click', async () => {
              if (visivel) {
                texto.textContent = oculto;
                visivel = false;
                botao.title = 'Mostrar senha';
                return;
              }
              if (!linha.senhaCifrada || !criptografiaDisponivel()) {
                toast.aviso('Senha não disponível', 'Este controlador foi cadastrado antes desta versão. Remova-o e cadastre de novo para poder visualizar a senha.');
                return;
              }
              try {
                texto.textContent = await comCarregamento(botao, () => decifrarTexto(linha.senhaCifrada, senhaMestra, linha.sal));
                visivel = true;
                botao.title = 'Ocultar senha';
              } catch (erro) {
                toast.erro('Não foi possível mostrar a senha', 'A base pode ter sido alterada fora do aplicativo.');
              }
            });
            return botao;
          },
        },
        { campo: 'criadoEm', titulo: 'Cadastrado em', formatar: (v) => formatarData(v, 'data-hora') },
        {
          campo: 'acoes', titulo: '', ordenavel: false, classe: 'ctc-col--actions',
          render: (_, linha) => criarBotao({
            icone: 'lixeira', variante: 'ghost', tamanho: 'sm', titulo: `Remover ${linha.login}`,
            onClick: async () => {
              const ok = await confirmar({ titulo: `Remover ${linha.login}?`, mensagem: 'Este controlador não conseguirá mais entrar com a base exportada a partir de agora.', textoConfirmar: 'Remover', perigo: true });
              if (!ok) return;
              base.controladores = base.controladores.filter((c) => c !== linha);
              pendenteExportar = true;
              atualizarTabela();
              atualizarStatus();
              toast.aviso('Controlador removido', 'Exporte a base para gravar a alteração.');
            },
          }),
        },
      ],
    });

    const formulario = criarFormulario({
      colunas: 2,
      textoEnviar: 'Adicionar controlador',
      campos: [
        { nome: 'nome', rotulo: 'Nome', obrigatorio: true },
        {
          nome: 'login', rotulo: 'Login', obrigatorio: true, dica: 'De 3 a 30 caracteres: letras, números, ponto, hífen ou sublinhado.',
          regras: {
            validar: (v) => {
              if (!/^[a-zA-Z0-9._-]{3,30}$/.test(String(v).trim())) return 'Use de 3 a 30 letras, números, ponto, hífen ou sublinhado.';
              if (base.controladores.some((c) => c.login === normalizarLogin(v))) return 'Este login já está cadastrado.';
              return true;
            },
          },
        },
        { nome: 'senha', rotulo: 'Senha', tipo: 'senha', obrigatorio: true, regras: { minCaracteres: 6 }, atributos: { autocomplete: 'new-password' } },
        {
          nome: 'confirmacao', rotulo: 'Confirmar senha', tipo: 'senha', obrigatorio: true, atributos: { autocomplete: 'new-password' },
          regras: { validar: (v, valores) => v === valores.senha || 'As senhas não conferem.' },
        },
      ],
      onEnviar: async ({ nome, login, senha }) => {
        base.controladores.push(await criarCredencial({ login, nome, senha, senhaMestra }));
        pendenteExportar = true;
        formulario.elemento.reset();
        formulario.limparErros();
        atualizarTabela();
        atualizarStatus();
        toast.sucesso('Controlador adicionado', `${normalizarLogin(login)} — exporte a base para gravar.`);
      },
    });

    /* ---- Banco de dados na nuvem (Firebase) ---- */
    let modalAdmin = null;
    let painelNuvem = null;
    if (armazenamento && armazenamento.configurar) {
      const statusNuvem = h('div', {});
      const atualizarStatusNuvem = () => {
        const cfg = armazenamento.obterConfig();
        statusNuvem.replaceChildren(cfg
          ? criarAlerta({ tipo: 'success', titulo: `Conectado ao Firebase — projeto ${cfg.projectId}`, mensagem: 'Salvar na nuvem, Salvar na base existente e Abrir versão salva usam este banco.' })
          : criarAlerta({ tipo: 'info', titulo: 'Firebase não configurado', mensagem: 'Enquanto isso, as versões ficam guardadas somente neste navegador.' }));
      };
      const campoConfig = criarCampo({
        nome: 'firebaseConfig', rotulo: 'Configuração do Firebase (firebaseConfig)', tipo: 'textarea', larguraTotal: true,
        placeholder: 'Cole aqui o trecho do console do Firebase:\nconst firebaseConfig = {\n  apiKey: "...",\n  projectId: "...",\n  appId: "..."\n};',
        dica: 'Console do Firebase > Configurações do projeto > Seus apps > SDK setup and configuration.',
      });
      const textoConfig = campoConfig.querySelector('textarea');
      const cfgAtual = armazenamento.obterConfig();
      if (cfgAtual) textoConfig.value = `const firebaseConfig = ${JSON.stringify(cfgAtual, null, 2)};`;

      const botaoConectar = criarBotao({
        texto: 'Salvar e conectar', icone: 'upload', variante: 'primary',
        onClick: async () => {
          const leitura = interpretarConfigFirebase(textoConfig.value);
          if (!leitura.valido) { toast.erro('Configuração incompleta', leitura.erros.join(' ')); return; }
          try {
            const { versoes } = await comCarregamento(botaoConectar, () => armazenamento.configurar(leitura.config));
            base.nuvem = { ...(base.nuvem || {}), firebase: leitura.config };
            atualizarStatusNuvem();
            atualizarStatus();
            toast.sucesso('Firebase conectado', `Projeto ${leitura.config.projectId} — ${versoes.length} versão(ões) encontrada(s).`);
            // ja traz as versoes da nuvem para escolher qual abrir
            if (versoes.length) { modalAdmin.fechar(); abrirVersaoSalva(); }
          } catch (erro) {
            toast.erro('Não foi possível conectar', erro.message);
          }
        },
      });
      const botaoRemoverNuvem = criarBotao({
        texto: 'Remover configuração', icone: 'lixeira', variante: 'ghost',
        onClick: async () => {
          const ok = await confirmar({ titulo: 'Remover a configuração do Firebase?', mensagem: 'Os dados na nuvem não são apagados; este navegador apenas deixa de usá-los.', textoConfirmar: 'Remover', perigo: true });
          if (!ok) return;
          armazenamento.removerConfig();
          if (base.nuvem) delete base.nuvem.firebase;
          textoConfig.value = '';
          atualizarStatusNuvem();
          toast.info('Configuração removida', 'As versões voltam a ser guardadas neste navegador.');
        },
      });
      atualizarStatusNuvem();
      painelNuvem = criarPainel({
        titulo: 'Banco de dados na nuvem (Firebase)', icone: 'configuracao',
        conteudo: h('div', { class: 'ctc-stack' },
          statusNuvem,
          campoConfig,
          h('div', { class: 'ctc-cluster' }, botaoConectar, botaoRemoverNuvem),
          criarAlerta({
            tipo: 'warning',
            titulo: 'Regras de acesso do Firestore',
            mensagem: 'Este modelo não usa login do Firebase. As regras do banco precisam permitir leitura e escrita, e qualquer pessoa com esta configuração consegue acessar os dados. Use apenas para dados internos e revise as regras no console.',
          })),
      }).elemento;
    }

    modalAdmin = criarModal({
      titulo: 'Administração de controladores',
      tamanho: 'lg',
      destruirAoFechar: true,
      conteudo: [
        criarAlerta({
          tipo: 'info',
          titulo: 'Os controladores ficam gravados dentro do arquivo JSON',
          mensagem: 'Depois de adicionar ou remover, clique em "Exportar base (JSON)" e passe a usar o novo arquivo.',
        }),
        criarPainel({ titulo: 'Controladores cadastrados', icone: 'usuario', semEspaco: true, conteudo: tabela.elemento }).elemento,
        criarPainel({ titulo: 'Novo controlador', icone: 'mais', conteudo: formulario.elemento }).elemento,
        painelNuvem,
      ],
      acoes: [
        { texto: 'Fechar', variante: 'outline' },
        {
          texto: 'Exportar base (JSON)', icone: 'download', variante: 'primary', fechar: false,
          onClick: () => {
            const nome = nomeArquivoBase(prefixoArquivo || formato || 'base');
            base = prepararBaseParaSalvar(base);
            baixarJSON(base, nome);
            pendenteExportar = false;
            atualizarStatus();
            toast.sucesso('Base exportada', `${nome} — use este arquivo na próxima abertura.`);
          },
        },
      ],
    });
    modalAdmin.abrir();
  }

  async function entrarAdministrador() {
    const senha = await solicitarSenhaAdministrador({ administrador, titulo: 'Acesso do Administrador', textoConfirmar: 'Entrar' });
    if (senha) abrirAdministracao(senha);
  }

  /* ---- Iniciar controle: base em branco, liberada pela senha do administrador ---- */
  async function iniciarControle() {
    if (importada || pendenteExportar) {
      const ok = await confirmar({
        titulo: 'Iniciar um controle em branco?',
        mensagem: 'A base carregada sai da tela inicial (o arquivo ou a versão na nuvem não são alterados). Os dados novos só ficam gravados quando você salvar.',
        textoConfirmar: 'Iniciar em branco',
      });
      if (!ok) return;
    }
    const senha = await solicitarSenhaAdministrador({
      administrador,
      titulo: 'Iniciar controle',
      mensagem: 'Informe a senha do administrador para criar uma base em branco.',
      textoConfirmar: 'Criar base em branco',
    });
    if (!senha) return;
    const nova = typeof criarBaseNova === 'function' ? criarBaseNova() : criarBaseVazia(formato);
    base = validarBase({ ...nova, formato }, { formato }).base;
    nomeArquivo = 'Novo controle (ainda não salvo)';
    importada = true;
    pendenteExportar = false;
    atualizarStatus();
    toast.sucesso('Base em branco criada', 'Comece a atualizar e salve em Controlador > Ferramentas.');
    entrar('administrador', { login: 'administrador', nome: 'Administrador' });
  }

  const elemento = h('div', { class: 'ctc-landing' },
    h('div', { class: 'ctc-landing__card' },
      h('div', { class: 'ctc-landing__brand' },
        elLogoEntrada,
        elTituloEntrada,
        h('p', { class: 'ctc-landing__subtitle' }, subtitulo)),
      h('section', { class: 'ctc-landing__section' },
        h('div', { class: 'ctc-landing__section-title' }, '1. Base de dados'),
        criarBotao({ texto: 'Iniciar controle', icone: 'mais', variante: 'success', bloco: true, onClick: iniciarControle }),
        criarBotao({ texto: 'Importar base de dados (JSON)', icone: 'upload', variante: 'outline', bloco: true, onClick: () => entrada.click() }),
        armazenamento ? criarBotao({ texto: 'Abrir versão salva (nuvem)', icone: 'documento', variante: 'outline', bloco: true, onClick: abrirVersaoSalva }) : null,
        status,
        linkRemover,
        entrada),
      h('section', { class: 'ctc-landing__section' },
        h('div', { class: 'ctc-landing__section-title' }, '2. Como você vai acessar?'),
        criarBotao({ texto: 'Administrador', icone: 'configuracao', variante: 'outline', tamanho: 'lg', bloco: true, onClick: entrarAdministrador }),
        criarBotao({ texto: 'Controlador', icone: 'editar', variante: 'primary', tamanho: 'lg', bloco: true, onClick: entrarControlador }),
        criarBotao({ texto: 'Visualizador', icone: 'olho', variante: 'secondary', tamanho: 'lg', bloco: true, onClick: entrarVisualizador })),
      rodape ? h('div', { class: 'ctc-landing__footer' }, rodape) : null));

  atualizarStatus();

  return {
    elemento,
    mostrar: (alvo = document.body) => { atualizarStatus(); alvo.append(elemento); },
    remover: () => elemento.remove(),
    obterBase: () => base,
    /** Atualiza a base mantida na tela (ex.: a versao que acabou de ser salva no aplicativo). */
    definirBase: (novaBase, novoNome = nomeArquivo) => {
      const resultado = validarBase(JSON.parse(JSON.stringify(novaBase)), { formato });
      if (!resultado.valida) return false;
      base = resultado.base;
      nomeArquivo = novoNome;
      importada = Boolean(novoNome);
      atualizarStatus();
      return true;
    },
  };
}

/**
 * Botao do canto superior direito que mostra o perfil e o numero de alteracoes nao salvas.
 * criarBotaoSessao({ sessao, texto: 'Controlador', onClick })
 */
export function criarBotaoSessao({ sessao, texto = 'Controlador', onClick } = {}) {
  const botao = criarBotao({ texto, icone: 'usuario', variante: 'outline', contador: 0, onClick });
  const contador = botao.querySelector('.ctc-btn__count');
  const atualizar = ({ alteracoes }) => {
    contador.textContent = String(alteracoes);
    contador.classList.toggle('ctc-hidden', !alteracoes);
    botao.title = alteracoes ? `${alteracoes} alteração(ões) não salva(s)` : texto;
  };
  atualizar(sessao.obter());
  sessao.assinar(atualizar);
  return botao;
}

/**
 * Pede a senha do administrador. Retorna Promise<senha | null> (null = cancelado).
 *   const senha = await solicitarSenhaAdministrador({ administrador: { sal, hash } })
 */
export function solicitarSenhaAdministrador({
  administrador = {}, titulo = 'Senha do administrador', mensagem, textoConfirmar = 'Confirmar',
} = {}) {
  return new Promise((resolver) => {
    let resposta = null;
    const formulario = criarFormulario({
      colunas: 1,
      semBotoes: true,
      campos: [{ nome: 'senha', rotulo: 'Senha do administrador', tipo: 'senha', obrigatorio: true }],
      onEnviar: async ({ senha }) => {
        if (!(await verificarSenha(senha, administrador))) {
          await esperar(500);
          formulario.definirErro('senha', 'Senha incorreta.');
          return;
        }
        resposta = senha;
        modal.fechar();
      },
    });
    const modal = criarModal({
      titulo,
      tamanho: 'sm',
      destruirAoFechar: true,
      conteudo: [mensagem ? h('p', { class: 'ctc-text-sm ctc-text-muted' }, mensagem) : null, formulario.elemento],
      onFechar: () => resolver(resposta),
      acoes: [
        { texto: 'Cancelar', variante: 'outline' },
        { texto: textoConfirmar, variante: 'primary', fechar: false, onClick: () => formulario.enviar() },
      ],
    });
    modal.abrir();
  });
}

/**
 * Pede login e senha de um controlador novamente (confirmacao antes de acoes sensiveis).
 * Retorna Promise<{ login, nome } | null> (null = cancelado).
 *   const quem = await solicitarCredenciais({ controladores: base.controladores, titulo: 'Confirme seu acesso', loginPadrao })
 * O controlador e escolhido numa lista; loginPadrao ja deixa um selecionado.
 */
export function solicitarCredenciais({
  controladores = [], titulo = 'Confirme seu acesso', mensagem = 'Informe novamente seu login e senha de controlador.',
  textoConfirmar = 'Confirmar', loginPadrao,
} = {}) {
  return new Promise((resolver) => {
    let resposta = null;
    const formulario = criarFormulario({
      colunas: 1,
      semBotoes: true,
      campos: [
        campoLoginControlador(controladores, loginPadrao),
        { nome: 'senha', rotulo: 'Senha', tipo: 'senha', obrigatorio: true },
      ],
      onEnviar: async ({ login, senha }) => {
        const registro = controladores.find((c) => c.login === normalizarLogin(login));
        if (!registro || !(await verificarSenha(senha, registro))) {
          await esperar(500);
          formulario.definirErro('senha', 'Login ou senha incorretos.');
          return;
        }
        resposta = { login: registro.login, nome: registro.nome || registro.login };
        modal.fechar();
      },
    });
    const modal = criarModal({
      titulo,
      tamanho: 'sm',
      destruirAoFechar: true,
      conteudo: [h('p', { class: 'ctc-text-sm ctc-text-muted' }, mensagem), formulario.elemento],
      onFechar: () => resolver(resposta),
      acoes: [
        { texto: 'Cancelar', variante: 'outline' },
        { texto: textoConfirmar, variante: 'primary', fechar: false, onClick: () => formulario.enviar() },
      ],
    });
    const focarSenha = ligarLoginASenha(formulario);
    modal.abrir();
    focarSenha();
  });
}

/**
 * Lista as versoes salvas e permite escolher uma.
 *   abrirListaVersoes({ armazenamento, titulo, textoAcao: 'Abrir', varianteAcao, perigo,
 *                       onEscolher: async (versao) => true | false })   // false mantem a lista aberta
 */
export async function abrirListaVersoes({
  armazenamento, titulo = 'Versões salvas', textoAcao = 'Abrir', varianteAcao = 'primary', onEscolher,
} = {}) {
  let versoes;
  try {
    versoes = await armazenamento.listar();
  } catch (erro) {
    toast.erro('Não foi possível listar as versões', erro.message);
    return null;
  }
  let modal = null;
  const tabela = criarTabela({
    dados: versoes,
    compacta: true,
    altura: 'auto',
    ordenacao: { campo: 'salvoEm', direcao: 'desc' },
    vazio: { titulo: 'Nenhuma versão salva ainda', mensagem: 'Use "Salvar na nuvem" no painel do Controlador para criar a primeira.' },
    colunas: [
      { campo: 'nome', titulo: 'Nome' },
      { campo: 'salvoEm', titulo: 'Salvo em', tipo: 'data', formatar: (v) => formatarData(v, 'data-hora') },
      { campo: 'autor', titulo: 'Salvo por' },
      {
        campo: 'acao', titulo: '', ordenavel: false, classe: 'ctc-col--actions',
        render: (_, versao) => {
          const botao = criarBotao({ texto: textoAcao, variante: varianteAcao, tamanho: 'sm' });
          botao.addEventListener('click', async () => {
            const fechar = await comCarregamento(botao, () => onEscolher(versao));
            if (fechar !== false) modal.fechar();
          });
          return botao;
        },
      },
    ],
  });
  modal = criarModal({
    titulo,
    tamanho: 'lg',
    destruirAoFechar: true,
    conteudo: [
      armazenamento.descricao ? h('p', { class: 'ctc-text-xs ctc-text-muted' }, `Local de armazenamento: ${armazenamento.descricao}`) : null,
      tabela.elemento,
    ],
    acoes: [{ texto: 'Fechar', variante: 'outline' }],
  });
  modal.abrir();
  return modal;
}

/**
 * Editor do cabecalho: logo (imagem importada), titulo e subtitulo.
 *   abrirEditorCabecalho({ identidade: { logo, titulo, subtitulo }, onSalvar(novaIdentidade) })
 */
export function abrirEditorCabecalho({ identidade = {}, onSalvar } = {}) {
  let logo = identidade.logo || null;
  const previa = h('div', { class: 'ctc-landing__logo' });
  const atualizarPrevia = () => {
    previa.replaceChildren(conteudoLogo(logo || '—'));
    botaoRemover.disabled = !logo;
  };
  const entradaImagem = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml', class: 'ctc-hidden', tabindex: '-1', 'aria-hidden': 'true' });
  entradaImagem.addEventListener('change', async () => {
    const arquivo = entradaImagem.files[0];
    entradaImagem.value = '';
    if (!arquivo) return;
    try {
      logo = await lerImagemComoDataURL(arquivo);
      atualizarPrevia();
    } catch (erro) {
      toast.erro('Imagem não carregada', erro.message);
    }
  });
  const botaoRemover = criarBotao({ texto: 'Remover logo', icone: 'lixeira', variante: 'ghost', tamanho: 'sm', onClick: () => { logo = null; atualizarPrevia(); } });

  const formulario = criarFormulario({
    colunas: 1,
    semBotoes: true,
    valores: { titulo: identidade.titulo || '', subtitulo: identidade.subtitulo || '' },
    campos: [
      { nome: 'titulo', rotulo: 'Título do cabeçalho', obrigatorio: true, regras: { maxCaracteres: 60 } },
      { nome: 'subtitulo', rotulo: 'Subtítulo', dica: 'Ex.: nome da obra, contrato ou unidade. Opcional.', regras: { maxCaracteres: 90 } },
    ],
    onEnviar: ({ titulo, subtitulo }) => {
      if (typeof onSalvar === 'function') onSalvar({ logo, titulo, subtitulo });
      modal.fechar();
    },
  });

  const modal = criarModal({
    titulo: 'Editar cabeçalho e logo',
    tamanho: 'md',
    destruirAoFechar: true,
    conteudo: [
      h('div', { class: 'ctc-cluster' },
        previa,
        h('div', { class: 'ctc-stack' },
          criarBotao({ texto: 'Importar imagem da logo', icone: 'upload', variante: 'outline', tamanho: 'sm', onClick: () => entradaImagem.click() }),
          botaoRemover,
          h('div', { class: 'ctc-text-xs ctc-text-muted' }, 'PNG, JPG, GIF, WEBP ou SVG. A imagem é reduzida para caber na base.')),
        entradaImagem),
      formulario.elemento,
    ],
    acoes: [
      { texto: 'Cancelar', variante: 'outline' },
      { texto: 'Aplicar', variante: 'primary', fechar: false, onClick: () => formulario.enviar() },
    ],
  });
  atualizarPrevia();
  modal.abrir();
  return modal;
}

/**
 * Abre o painel do controlador.
 *   abrirPainelControlador({
 *     sessao, titulo: 'Controlador', prefixoArquivo,
 *     obterBaseParaSalvar: () => base,   // o aplicativo monta a base atual (dados + controladores)
 *     armazenamento,                     // provedor de versoes: habilita "Salvar na nuvem" e "Salvar na base existente"
 *     administrador: { sal, hash },      // confirma os salvamentos de quem entrou como administrador
 *     onEditarCabecalho: () => {},       // habilita o bloco "Cabecalho e logo"
 *     onSair: () => { ... },             // trocar perfil / voltar a tela de entrada
 *     abasExtras: [{ id, texto, conteudo }],
 *   })
 * Os dois salvamentos em versao pedem login e senha de novo antes de abrir.
 */
export function abrirPainelControlador({
  sessao, titulo = 'Controlador', prefixoArquivo = 'base', obterBaseParaSalvar, armazenamento, administrador,
  onEditarCabecalho, onSair, abasExtras = [],
} = {}) {
  let modal = null;
  let abas = null;
  const atualizarAba = () => { if (modal && modal.estaAberto()) abas.ativar('ferramentas'); };
  /* a configuracao da nuvem viaja junto com a base salva */
  const baseAtual = () => {
    const base = obterBaseParaSalvar();
    const configNuvem = armazenamento && armazenamento.obterConfig ? armazenamento.obterConfig() : null;
    return configNuvem ? { ...base, nuvem: { ...(base.nuvem || {}), firebase: configNuvem } } : base;
  };

  async function confirmarAcesso(acao) {
    // quem entrou por "Iniciar controle" (perfil administrador) confirma com a senha do administrador
    if (sessao.obter().perfil === 'administrador') {
      const senha = await solicitarSenhaAdministrador({
        administrador, titulo: 'Confirme seu acesso', mensagem: `Para ${acao}, informe novamente a senha do administrador.`,
      });
      return senha ? { login: 'administrador', nome: 'Administrador' } : null;
    }
    return solicitarCredenciais({
      controladores: obterBaseParaSalvar().controladores || [],
      titulo: 'Confirme seu acesso',
      mensagem: `Para ${acao}, confirme o controlador e informe a senha novamente.`,
      loginPadrao: sessao.obter().usuario ? sessao.obter().usuario.login : undefined,
    });
  }

  async function salvarNaNuvem() {
    const quem = await confirmarAcesso('salvar na nuvem');
    if (!quem) return;
    const nome = await solicitarValor({
      titulo: 'Salvar na nuvem',
      rotulo: 'Nome do salvamento',
      obrigatorio: true,
      regras: { minCaracteres: 3, maxCaracteres: 80 },
      valor: `${prefixoArquivo} ${formatarData(new Date(), 'data-hora')}`,
      textoConfirmar: 'Salvar',
    });
    if (nome == null) return;
    try {
      const versao = await armazenamento.salvar({ nome, base: prepararBaseParaSalvar(baseAtual()), autor: quem.nome });
      sessao.limparAlteracoes(`Nuvem: ${versao.nome}`);
      toast.sucesso('Salvo na nuvem', `${versao.nome} — por ${quem.nome}`);
      atualizarAba();
    } catch (erro) {
      toast.erro('Falha ao salvar', erro.message);
    }
  }

  async function salvarNaBaseExistente() {
    const quem = await confirmarAcesso('substituir um salvamento existente');
    if (!quem) return;
    await abrirListaVersoes({
      armazenamento,
      titulo: 'Salvar na base existente',
      textoAcao: 'Substituir',
      varianteAcao: 'warning',
      onEscolher: async (versao) => {
        const ok = await confirmar({
          titulo: `Substituir "${versao.nome}"?`,
          mensagem: `O conteúdo salvo em ${formatarData(versao.salvoEm, 'data-hora')} será trocado pelos dados atuais.`,
          textoConfirmar: 'Substituir',
          perigo: true,
        });
        if (!ok) return false;
        try {
          const nova = await armazenamento.substituir(versao.id, { base: prepararBaseParaSalvar(baseAtual()), autor: quem.nome });
          sessao.limparAlteracoes(`Nuvem: ${nova.nome}`);
          toast.sucesso('Base substituída', `${nova.nome} — por ${quem.nome}`);
          atualizarAba();
          return true;
        } catch (erro) {
          toast.erro('Falha ao substituir', erro.message);
          return false;
        }
      },
    });
  }

  function exportarArquivo() {
    const nome = nomeArquivoBase(prefixoArquivo);
    baixarJSON(prepararBaseParaSalvar(baseAtual()), nome);
    sessao.limparAlteracoes(nome);
    toast.sucesso('Arquivo exportado', nome);
    atualizarAba();
  }

  function ferramentas() {
    const estado = sessao.obter();
    const blocos = [];
    if (sessao.podeEditar()) {
      if (estado.alteracoes) {
        blocos.push(criarAlerta({ tipo: 'warning', titulo: 'Alterações não salvas', mensagem: `Há ${estado.alteracoes} alteração(ões) feitas nesta sessão que ainda não foram gravadas.` }));
      }
      blocos.push(criarPainel({
        titulo: 'Salvar', icone: 'salvar',
        conteudo: h('div', { class: 'ctc-stack' },
          armazenamento ? h('div', { class: 'ctc-cluster' },
            criarBotao({ texto: 'Salvar na nuvem', icone: 'upload', variante: 'primary', onClick: salvarNaNuvem }),
            criarBotao({ texto: 'Salvar na base existente', icone: 'salvar', variante: 'secondary', onClick: salvarNaBaseExistente })) : null,
          armazenamento && armazenamento.descricao
            ? h('p', { class: 'ctc-text-xs ctc-text-muted' }, `Local de armazenamento: ${armazenamento.descricao}. Os dois salvamentos pedem login e senha novamente.`)
            : null,
          h('div', { class: 'ctc-cluster' },
            criarBotao({ texto: 'Exportar arquivo JSON', icone: 'download', variante: 'outline', tamanho: 'sm', onClick: exportarArquivo }),
            h('span', { class: 'ctc-text-xs ctc-text-muted' }, 'Cópia em arquivo, para guardar ou enviar.'))),
      }).elemento);
      if (typeof onEditarCabecalho === 'function') {
        blocos.push(criarPainel({
          titulo: 'Cabeçalho e logo', icone: 'editar',
          conteudo: h('div', { class: 'ctc-cluster' },
            criarBotao({ texto: 'Editar cabeçalho e logo', icone: 'editar', variante: 'outline', onClick: onEditarCabecalho }),
            h('span', { class: 'ctc-text-xs ctc-text-muted' }, 'A alteração é gravada na base no próximo salvamento.')),
        }).elemento);
      }
    } else {
      blocos.push(criarAlerta({ tipo: 'info', titulo: 'Modo visualizador', mensagem: 'Salvamento e edição do cabeçalho estão disponíveis somente para controladores.' }));
    }
    return h('div', { class: 'ctc-stack' }, blocos);
  }

  function painelSaida() {
    return criarPainel({
      titulo: 'Sessão de uso', icone: 'sair',
      conteudo: h('div', { class: 'ctc-stack' },
        h('p', { class: 'ctc-text-sm ctc-text-muted' }, 'Volta à tela inicial para trocar de perfil ou abrir outra base.'),
        criarBotao({
          texto: 'Trocar perfil / Sair', icone: 'sair', variante: 'outline',
          onClick: async () => {
            const pendentes = sessao.obter().alteracoes;
            if (pendentes && sessao.podeEditar()) {
              const ok = await confirmar({ titulo: 'Sair sem salvar?', mensagem: `As ${pendentes} alteração(ões) não salvas serão perdidas.`, textoConfirmar: 'Sair sem salvar', perigo: true });
              if (!ok) return;
            }
            modal.fechar();
            if (typeof onSair === 'function') onSair();
          },
        })),
    }).elemento;
  }

  function infoSessao() {
    const e = sessao.obter();
    const linhas = [
      { item: 'Perfil', valor: ROTULO_PERFIL[e.perfil] || '—' },
      { item: 'Usuário', valor: e.usuario ? `${e.usuario.nome} (${e.usuario.login})` : '—' },
      { item: 'Base em uso', valor: e.nomeArquivo || 'Base de demonstração (não importada)' },
      { item: 'Último salvamento', valor: e.ultimoSalvamento ? formatarData(e.ultimoSalvamento, 'data-hora') : '—' },
      { item: 'Alterações não salvas', valor: String(e.alteracoes) },
    ];
    const tabela = criarTabela({
      compacta: true, altura: 'auto', cabecalhoClaro: true, dados: linhas,
      colunas: [{ campo: 'item', titulo: 'Item', ordenavel: false }, { campo: 'valor', titulo: 'Valor', ordenavel: false }],
    }).elemento;
    return h('div', { class: 'ctc-stack' }, tabela, painelSaida());
  }

  abas = criarAbas({
    abas: [
      { id: 'ferramentas', texto: 'Ferramentas', conteudo: ferramentas },
      { id: 'sessao', texto: 'Sessão', conteudo: infoSessao },
      ...abasExtras,
    ],
  });

  modal = criarModal({ titulo, tamanho: 'lg', destruirAoFechar: true, conteudo: abas.elemento });
  modal.abrir();
  return modal;
}
