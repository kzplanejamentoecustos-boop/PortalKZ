/* =============================================================================
   KZ App Standard — compartilhado/acesso-kz.js
   Versao: 1.7.0  (modulo novo da v1.7: login real no Firebase)

   Substitui, nos aplicativos KZ, a senha mestre e os perfis gravados no JSON
   por LOGIN DO FIREBASE (e-mail e senha) e PERMISSOES POR OBRA E CONTROLE,
   garantidas pelas regras do Firestore (ver firestore.rules do Portal KZ).

   Estrutura no Firestore:
     gestores_gerais/{uid}                         gestores gerais (console)
     usuarios/{uid}          { nome, email }       criado pela propria pessoa
     usuarios_email/{email}  { uid, nome }         busca por e-mail
     obras/{obra}            { nome, sigla, situacao, controles: { id: { nome, url, basico } } }
     obras/{obra}/membros/{uid}  { uid, nome, email, gestor, papeis: { '*'|controle: 'leitor'|'editor'|'admin' } }
     obras/{obra}/{controle}/... dados de cada controle

   ESTRUTURA
   01. Firebase (carregado sob demanda do gstatic)
   02. Login, conta e senha
   03. Perfil do usuario: gestor geral, obras e papeis
   04. Gestao: obras, membros e usuarios
   05. Telas: login, aguardando liberacao, painel da sessao
   ========================================================================== */

import {
  h, criarBotao, criarFormulario, criarModal, criarAlerta, criarAbas, conteudoLogo,
  solicitarValor, comCarregamento, toast,
} from './componentes.js';
import { VERSAO_SDK_FIREBASE } from './funcionalidades.js';


/* =============================================================================
   01. FIREBASE
   ========================================================================== */

let pronto = null;
let configFirebase = null;

/**
 * Inicia o Firebase (app padrao: o login fica compartilhado entre todos os
 * aplicativos KZ abertos no mesmo endereco). Retorna { auth, db, fa, fs }.
 */
export function iniciarFirebase(config) {
  if (!pronto) {
    configFirebase = config;
    pronto = (async () => {
      const endereco = `https://www.gstatic.com/firebasejs/${VERSAO_SDK_FIREBASE}`;
      const [moduloApp, fa, fs] = await Promise.all([
        import(`${endereco}/firebase-app.js`),
        import(`${endereco}/firebase-auth.js`),
        import(`${endereco}/firebase-firestore.js`),
      ]);
      const app = moduloApp.getApps().length ? moduloApp.getApp() : moduloApp.initializeApp(config);
      return { auth: fa.getAuth(app), db: fs.getFirestore(app), fa, fs };
    })().catch((erro) => { pronto = null; throw new Error(traduzirErroAcesso(erro)); });
  }
  return pronto;
}

async function sdk() {
  if (!pronto) throw new Error('Firebase não iniciado: chame iniciarFirebase(config) antes.');
  return pronto;
}

/** Mensagens em portugues para os erros do Firebase. */
export function traduzirErroAcesso(erro) {
  const codigo = (erro && (erro.code || erro.message)) || String(erro);
  const mapa = {
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/wrong-password': 'Senha atual incorreta.',
    'auth/invalid-email': 'E-mail inválido.',
    'auth/user-disabled': 'Usuário desativado. Fale com o gestor.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos ou redefina a senha.',
    'auth/network-request-failed': 'Sem conexão com a internet.',
    'auth/email-already-in-use': 'Já existe uma conta com este e-mail. Use "Entrar" ou "Esqueci a senha".',
    'auth/weak-password': 'Senha fraca: use pelo menos 8 caracteres.',
    'auth/admin-restricted-operation': 'O cadastro de novas contas está desativado. Peça ao gestor para criar o seu acesso.',
    'auth/operation-not-allowed': 'Login por e-mail e senha não está ativado no Firebase.',
    'auth/requires-recent-login': 'Por segurança, saia e entre de novo antes de trocar a senha.',
    'permission-denied': 'Você não tem permissão para esta ação.',
    unavailable: 'O Firebase não respondeu. Verifique a internet.',
  };
  if (mapa[codigo]) return mapa[codigo];
  if (/permission/i.test(codigo)) return mapa['permission-denied'];
  if (/importing|dynamically imported module|Failed to load module/i.test(codigo)) return 'Não foi possível carregar o Firebase. Verifique a internet ou se o acesso a gstatic.com está liberado.';
  return codigo;
}

async function executar(operacao) {
  try { return await operacao(await sdk()); }
  catch (erro) { throw new Error(traduzirErroAcesso(erro)); }
}


/* =============================================================================
   02. LOGIN, CONTA E SENHA
   ========================================================================== */

/** Chama onMudar(usuario | null) a cada entrada/saida. Ignora sessoes anonimas antigas. */
export async function observarLogin(onMudar) {
  const { auth, fa } = await sdk();
  return fa.onAuthStateChanged(auth, (usuario) => {
    if (usuario && usuario.isAnonymous) { fa.signOut(auth); return; }
    onMudar(usuario || null);
  });
}

export const entrar = (email, senha) => executar(({ auth, fa }) =>
  fa.signInWithEmailAndPassword(auth, String(email).trim(), senha));

export const sair = () => executar(({ auth, fa }) => fa.signOut(auth));

/** Envia o e-mail de redefinicao. Nao revela se o e-mail existe. */
export async function redefinirSenha(email) {
  try { await executar(({ auth, fa }) => fa.sendPasswordResetEmail(auth, String(email).trim())); }
  catch (erro) { if (/inválido|internet/i.test(erro.message)) throw erro; }
}

/** Cria a conta e o cadastro (usuarios + usuarios_email). A pessoa fica aguardando liberacao. */
export function criarConta({ nome, email, senha }) {
  return executar(async ({ auth, db, fa, fs }) => {
    const cred = await fa.createUserWithEmailAndPassword(auth, String(email).trim(), senha);
    const u = cred.user;
    const nomeLimpo = String(nome).trim();
    await fa.updateProfile(u, { displayName: nomeLimpo });
    await fs.setDoc(fs.doc(db, 'usuarios', u.uid), { nome: nomeLimpo, email: u.email, criadoEm: new Date().toISOString() });
    await fs.setDoc(fs.doc(db, 'usuarios_email', u.email), { uid: u.uid, nome: nomeLimpo });
    return u;
  });
}

/** Senha aleatoria forte (usada quando a pessoa vai criar a propria senha pelo e-mail). */
function senhaAleatoria() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => letras[b % letras.length]).join('');
}

/**
 * Cadastra OUTRA pessoa pelo Portal, sem trocar o login de quem esta cadastrando.
 * Usa uma segunda instancia do Firebase so em memoria: a conta nova grava o proprio
 * cadastro (como as regras exigem) e a sessao temporaria e encerrada em seguida.
 *   cadastrarPessoa({ nome, email, senha })  // sem senha: gera uma aleatoria
 * Retorna { uid, nome, email, jaExistia }.
 */
export function cadastrarPessoa({ nome, email, senha }) {
  return executar(async ({ db, fs }) => {
    const nomeLimpo = String(nome).trim();
    const emailLimpo = String(email).trim().toLowerCase();
    const existente = await fs.getDoc(fs.doc(db, 'usuarios_email', emailLimpo));
    if (existente.exists()) return { ...existente.data(), email: emailLimpo, jaExistia: true };

    const endereco = `https://www.gstatic.com/firebasejs/${VERSAO_SDK_FIREBASE}`;
    const [moduloApp, fa2, fs2] = await Promise.all([
      import(`${endereco}/firebase-app.js`),
      import(`${endereco}/firebase-auth.js`),
      import(`${endereco}/firebase-firestore.js`),
    ]);
    const nomeApp = `kz-cadastro-${Date.now()}`;
    const app2 = moduloApp.initializeApp(configFirebase, nomeApp);
    try {
      const auth2 = fa2.initializeAuth(app2, { persistence: fa2.inMemoryPersistence });
      const cred = await fa2.createUserWithEmailAndPassword(auth2, emailLimpo, senha || senhaAleatoria());
      await fa2.updateProfile(cred.user, { displayName: nomeLimpo });
      const db2 = fs2.getFirestore(app2);
      await fs2.setDoc(fs2.doc(db2, 'usuarios', cred.user.uid), { nome: nomeLimpo, email: cred.user.email, criadoEm: new Date().toISOString() });
      await fs2.setDoc(fs2.doc(db2, 'usuarios_email', cred.user.email), { uid: cred.user.uid, nome: nomeLimpo });
      await fa2.signOut(auth2);
      return { uid: cred.user.uid, nome: nomeLimpo, email: cred.user.email, jaExistia: false };
    } finally {
      moduloApp.deleteApp(app2).catch(() => {});
    }
  });
}

/**
 * E-mail para a pessoa criar (ou trocar) a senha. Depois de criar, o link leva ao Portal.
 * Se o dominio do Portal ainda nao estiver autorizado no Firebase, envia sem o link de retorno.
 */
export async function enviarEmailDeSenha(email, urlRetorno) {
  const { auth, fa } = await sdk();
  const destino = String(email).trim();
  try {
    await fa.sendPasswordResetEmail(auth, destino, urlRetorno ? { url: urlRetorno } : undefined);
    return { comRetorno: Boolean(urlRetorno) };
  } catch (erro) {
    if (urlRetorno && /unauthorized-continue-uri|invalid-continue-uri|domain/i.test(erro.code || erro.message)) {
      await fa.sendPasswordResetEmail(auth, destino);
      return { comRetorno: false };
    }
    throw new Error(traduzirErroAcesso(erro));
  }
}

/** Troca a senha de quem esta logado (confirma a senha atual antes). */
export function trocarSenha(senhaAtual, novaSenha) {
  return executar(async ({ auth, fa }) => {
    const u = auth.currentUser;
    await fa.reauthenticateWithCredential(u, fa.EmailAuthProvider.credential(u.email, senhaAtual));
    await fa.updatePassword(u, novaSenha);
  });
}


/** Altera o nome de quem esta logado (cadastro e perfil do Firebase). */
export function alterarMeuNome(nome) {
  return executar(async ({ auth, db, fa, fs }) => {
    const u = auth.currentUser;
    const nomeLimpo = String(nome || '').trim();
    await fs.updateDoc(fs.doc(db, 'usuarios', u.uid), { nome: nomeLimpo });
    await fa.updateProfile(u, { displayName: nomeLimpo });
  });
}


/* =============================================================================
   03. PERFIL DO USUARIO
   ========================================================================== */

export const PAPEIS = { leitor: 'Leitor', editor: 'Editor', admin: 'Admin' };
const NIVEL = { '': 0, leitor: 1, editor: 2, admin: 3 };

/**
 * Papel efetivo de um membro em um controle ('' = sem acesso). Gestor = admin de tudo.
 * papeis[controle] = 'nenhum' bloqueia um controle mesmo quando '*' libera os demais.
 */
export function papelNoControle(membro, controle) {
  if (!membro) return '';
  if (membro.gestor) return 'admin';
  const papeis = membro.papeis || {};
  const papel = papeis[controle] || papeis['*'] || '';
  return PAPEIS[papel] ? papel : '';
}
export const podeEditarPapel = (papel) => NIVEL[papel] >= NIVEL.editor;

/**
 * Carrega quem e o usuario e o que ele acessa:
 * { uid, email, nome, gestorGeral, obras: [{ id, nome, sigla, situacao, controles, membro }] }
 * Para o gestor geral, todas as obras aparecem como gestor.
 */
export function carregarPerfil(usuario) {
  return executar(async ({ db, fs }) => {
    const [gg, cadastro, obrasSnap] = await Promise.all([
      fs.getDoc(fs.doc(db, 'gestores_gerais', usuario.uid)),
      fs.getDoc(fs.doc(db, 'usuarios', usuario.uid)),
      fs.getDocs(fs.collection(db, 'obras')),
    ]);
    const gestorGeral = gg.exists();
    const obras = [];
    await Promise.all(obrasSnap.docs.map(async (d) => {
      let membro = null;
      if (gestorGeral) membro = { gestor: true, papeis: { '*': 'admin' } };
      else {
        const m = await fs.getDoc(fs.doc(db, 'obras', d.id, 'membros', usuario.uid));
        if (m.exists()) membro = m.data();
      }
      if (membro) obras.push({ id: d.id, ...d.data(), membro });
    }));
    obras.sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    return {
      uid: usuario.uid,
      email: usuario.email,
      nome: (cadastro.exists() && cadastro.data().nome) || usuario.displayName || usuario.email,
      temCadastro: cadastro.exists(),
      gestorGeral,
      obras,
    };
  });
}

/**
 * Obra dos aplicativos: vem do Portal (?obra=wsf3) ou da ultima obra escolhida no Portal.
 * Retorna '' quando o aplicativo foi aberto sem obra.
 */
export function obraDaUrl() {
  let o = new URLSearchParams(window.location.search).get('obra');
  if (!o) { try { o = localStorage.getItem('kz-portal-obra'); } catch { o = null; } }
  return String(o || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
}

/**
 * Perfil de quem esta logado em um controle de uma obra.
 * Retorna { papel: ''|'leitor'|'editor'|'admin', obra: { id, nome, sigla, ... } | null, nome }.
 */
export function papelNaObra(obra, controle) {
  return executar(async ({ auth, db, fs }) => {
    const u = auth.currentUser;
    const [gg, m, o, cadastro] = await Promise.all([
      fs.getDoc(fs.doc(db, 'gestores_gerais', u.uid)),
      fs.getDoc(fs.doc(db, 'obras', obra, 'membros', u.uid)),
      fs.getDoc(fs.doc(db, 'obras', obra)),
      fs.getDoc(fs.doc(db, 'usuarios', u.uid)),
    ]);
    const nome = (cadastro.exists() && cadastro.data().nome) || u.displayName || u.email;
    if (!o.exists()) return { papel: '', obra: null, nome };
    const papel = gg.exists() ? 'admin' : (m.exists() ? papelNoControle(m.data(), controle) : '');
    return { papel, obra: { id: obra, ...o.data() }, nome };
  });
}

/**
 * Versoes salvas de um controle DENTRO da obra, usando o login do Firebase.
 * Mesmos metodos e formato do armazenamento de versoes do padrao:
 *   obras/{obra}/{controle}/{id}            -> { nome, salvoEm, autor, tamanho }
 *   obras/{obra}/{controle}_conteudo/{id}   -> { conteudo: "<base JSON em texto>" }
 */
export function criarArmazenamentoObra({ obra, controle, limite = 900000 }) {
  const colecao = ['obras', obra, controle];
  const colecaoConteudo = ['obras', obra, `${controle}_conteudo`];
  const serializar = (base) => {
    const conteudo = JSON.stringify(base);
    if (conteudo.length > limite) throw new Error(`A base tem ${Math.round(conteudo.length / 1024)} KB e passa do limite de cerca de 900 KB por salvamento. Reduza a logo ou fale com o suporte.`);
    return conteudo;
  };
  return {
    descricao: `Nuvem KZ — obra ${obra.toUpperCase()}`,
    usandoFirebase: () => true,
    obterConfig: () => null,
    configurar: async () => { throw new Error('A nuvem é configurada pelo Portal KZ.'); },
    removerConfig: () => {},
    listar: () => executar(async ({ db, fs }) => {
      const r = await fs.getDocs(fs.query(fs.collection(db, ...colecao), fs.orderBy('salvoEm', 'desc')));
      return r.docs.map((d) => ({ id: d.id, ...d.data() }));
    }),
    salvar: ({ nome, base, autor }) => executar(async ({ db, fs }) => {
      const conteudo = serializar(base);
      const ref = fs.doc(fs.collection(db, ...colecao));
      const meta = { nome: String(nome).trim(), salvoEm: new Date().toISOString(), autor: autor || '', tamanho: conteudo.length };
      const lote = fs.writeBatch(db);
      lote.set(ref, meta);
      lote.set(fs.doc(db, ...colecaoConteudo, ref.id), { conteudo });
      await lote.commit();
      return { id: ref.id, ...meta };
    }),
    substituir: (id, { base, autor }) => executar(async ({ db, fs }) => {
      const conteudo = serializar(base);
      const refMeta = fs.doc(db, ...colecao, id);
      const atual = await fs.getDoc(refMeta);
      if (!atual.exists()) throw new Error('Versão não encontrada na nuvem.');
      const meta = { ...atual.data(), salvoEm: new Date().toISOString(), autor: autor || atual.data().autor || '', tamanho: conteudo.length };
      const lote = fs.writeBatch(db);
      lote.set(refMeta, meta);
      lote.set(fs.doc(db, ...colecaoConteudo, id), { conteudo });
      await lote.commit();
      return { id, ...meta };
    }),
    abrir: (id) => executar(async ({ db, fs }) => {
      const [meta, dados] = await Promise.all([fs.getDoc(fs.doc(db, ...colecao, id)), fs.getDoc(fs.doc(db, ...colecaoConteudo, id))]);
      if (!meta.exists() || !dados.exists()) throw new Error('Versão não encontrada na nuvem.');
      return { id, ...meta.data(), base: JSON.parse(dados.data().conteudo) };
    }),
    remover: (id) => executar(async ({ db, fs }) => {
      const lote = fs.writeBatch(db);
      lote.delete(fs.doc(db, ...colecao, id));
      lote.delete(fs.doc(db, ...colecaoConteudo, id));
      await lote.commit();
    }),
  };
}

/** Garante o cadastro de quem foi criado pelo console (sem passar por "Criar conta"). */
export function garantirCadastro(usuario, nome) {
  return executar(async ({ db, fs }) => {
    const nomeLimpo = String(nome || usuario.displayName || usuario.email.split('@')[0]).trim();
    await fs.setDoc(fs.doc(db, 'usuarios', usuario.uid), { nome: nomeLimpo, email: usuario.email, criadoEm: new Date().toISOString() });
    const ref = fs.doc(db, 'usuarios_email', usuario.email);
    if (!(await fs.getDoc(ref)).exists()) await fs.setDoc(ref, { uid: usuario.uid, nome: nomeLimpo });
  });
}


/* =============================================================================
   04. GESTAO: OBRAS, MEMBROS E USUARIOS
   ========================================================================== */

/** Codigo da obra a partir da sigla: "WSF3" -> "wsf3", "Obra Nova 1" -> "obra-nova-1". */
export function codigoObra(texto) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

/** Cria uma obra (gestor geral). Falha se o codigo ja existir. */
export function criarObra({ codigo, nome, sigla, controles, autor }) {
  return executar(async ({ db, fs }) => {
    const ref = fs.doc(db, 'obras', codigo);
    if ((await fs.getDoc(ref)).exists()) throw new Error(`Já existe uma obra com o código "${codigo}".`);
    const agora = new Date().toISOString();
    await fs.setDoc(ref, { nome, sigla, situacao: 'ativa', controles, criadoEm: agora, criadoPor: autor, atualizadoEm: agora, atualizadoPor: autor });
  });
}

/** Atualiza campos da obra (gestor geral: tudo; gestor da obra: so "controles"). */
export const atualizarObra = (codigo, campos, autor) => executar(({ db, fs }) =>
  fs.updateDoc(fs.doc(db, 'obras', codigo), { ...campos, atualizadoEm: new Date().toISOString(), atualizadoPor: autor }));

export const listarMembros = (obra) => executar(async ({ db, fs }) =>
  (await fs.getDocs(fs.collection(db, 'obras', obra, 'membros'))).docs.map((d) => d.data()));

export const salvarMembro = (obra, membro, autor) => executar(({ db, fs }) =>
  fs.setDoc(fs.doc(db, 'obras', obra, 'membros', membro.uid), {
    uid: membro.uid, nome: membro.nome || '', email: membro.email || '',
    gestor: Boolean(membro.gestor), papeis: membro.papeis || {},
    atualizadoEm: new Date().toISOString(), atualizadoPor: autor,
  }));

export const removerMembro = (obra, uid) => executar(({ db, fs }) =>
  fs.deleteDoc(fs.doc(db, 'obras', obra, 'membros', uid)));

/** Procura uma conta pelo e-mail exato. Retorna { uid, nome, email } ou null. */
export const buscarUsuarioPorEmail = (email) => executar(async ({ db, fs }) => {
  const limpo = String(email || '').trim().toLowerCase();
  const d = await fs.getDoc(fs.doc(db, 'usuarios_email', limpo));
  return d.exists() ? { ...d.data(), email: limpo } : null;
});

/** Quantos documentos ha numa colecao (caminho em partes: ['obras', 'wsf3', 'efetivo']). */
export const contarDocumentos = (partes) => executar(async ({ db, fs }) =>
  (await fs.getCountFromServer(fs.collection(db, ...partes))).data().count);

/**
 * Copia uma colecao antiga (formato de antes do Portal) para obras/{obra}/{controle}.
 * - A colecao antiga NAO e alterada (fica como backup).
 * - Documento que ja existe no destino e foi atualizado DEPOIS da origem nao e sobrescrito.
 * - comConteudo: versoes do padrao (lista em "origem" + conteudo em "origem_conteudo"):
 *   o conteudo de cada versao e copiado JUNTO com a lista, com a mesma decisao.
 * Retorna { total, copiados, ignorados }.
 */
export function migrarColecao({ origem, obra, controle, comConteudo = false, onProgresso }) {
  return executar(async ({ db, fs }) => {
    const snap = await fs.getDocs(fs.collection(db, origem));
    const dataDe = (d) => String(d.updatedAt || d.atualizadoEm || d.salvoEmISO || d.salvoEm || d.createdAt || '');
    let copiados = 0;
    let ignorados = 0;
    for (const doc of snap.docs) {
      const destino = fs.doc(db, 'obras', obra, controle, doc.id);
      const dados = doc.data();
      const atual = await fs.getDoc(destino);
      if (atual.exists() && dataDe(atual.data()) > dataDe(dados)) {
        ignorados += 1;
      } else {
        const marca = { _migradoDe: origem, _migradoEm: new Date().toISOString() };
        if (comConteudo) {
          const conteudo = await fs.getDoc(fs.doc(db, `${origem}_conteudo`, doc.id));
          const lote = fs.writeBatch(db);
          lote.set(destino, { ...dados, ...marca });
          if (conteudo.exists()) lote.set(fs.doc(db, 'obras', obra, `${controle}_conteudo`, doc.id), conteudo.data());
          await lote.commit();
        } else {
          await fs.setDoc(destino, { ...dados, ...marca });
        }
        copiados += 1;
      }
      if (typeof onProgresso === 'function') onProgresso(copiados + ignorados, snap.size);
    }
    return { total: snap.size, copiados, ignorados };
  });
}

/** Todos os cadastros (somente gestor geral). */
export const listarUsuarios = () => executar(async ({ db, fs }) =>
  (await fs.getDocs(fs.collection(db, 'usuarios'))).docs.map((d) => ({ uid: d.id, ...d.data() })));


/* =============================================================================
   05. TELAS
   ========================================================================== */

function cartaoEntrada({ logo, titulo, subtitulo, rodape }, ...secoes) {
  return h('div', { class: 'ctc-landing' },
    h('div', { class: 'ctc-landing__card' },
      h('div', { class: 'ctc-landing__brand' },
        logo ? h('div', { class: 'ctc-landing__logo' }, conteudoLogo(logo)) : null,
        h('h1', { class: 'ctc-landing__title' }, titulo),
        subtitulo ? h('p', { class: 'ctc-landing__subtitle' }, subtitulo) : null),
      ...secoes,
      rodape ? h('div', { class: 'ctc-landing__footer' }, rodape) : null));
}

function abrirCriarConta() {
  const formulario = criarFormulario({
    colunas: 1,
    semBotoes: true,
    campos: [
      { nome: 'nome', rotulo: 'Nome completo', obrigatorio: true, regras: { minCaracteres: 3, maxCaracteres: 80 } },
      { nome: 'email', rotulo: 'E-mail', tipo: 'email', obrigatorio: true, atributos: { autocomplete: 'username' } },
      { nome: 'senha', rotulo: 'Senha (mínimo 8 caracteres)', tipo: 'senha', obrigatorio: true, regras: { minCaracteres: 8 }, atributos: { autocomplete: 'new-password' } },
      {
        nome: 'senha2', rotulo: 'Repita a senha', tipo: 'senha', obrigatorio: true, atributos: { autocomplete: 'new-password' },
        regras: { validar: (v, valores) => (v === valores.senha ? true : 'As senhas não conferem.') },
      },
    ],
    onEnviar: async (v) => {
      try {
        await criarConta(v);
        modal.fechar();
        toast.sucesso('Conta criada', 'Aguarde um gestor liberar o seu acesso às obras.');
      } catch (erro) {
        formulario.definirErro(/e-mail/i.test(erro.message) ? 'email' : 'senha', erro.message);
      }
    },
  });
  const modal = criarModal({
    titulo: 'Criar conta',
    tamanho: 'sm',
    destruirAoFechar: true,
    conteudo: [
      criarAlerta({ tipo: 'info', mensagem: 'Depois de criar a conta, um gestor precisa liberar as obras e os controles que você vai acessar.' }),
      formulario.elemento,
    ],
    acoes: [
      { texto: 'Cancelar', variante: 'outline' },
      { texto: 'Criar conta', variante: 'primary', fechar: false, onClick: () => formulario.enviar() },
    ],
  });
  modal.abrir();
}

async function abrirEsqueciSenha(emailInicial = '') {
  const email = await solicitarValor({
    titulo: 'Redefinir senha',
    rotulo: 'Seu e-mail',
    tipo: 'email',
    valor: emailInicial,
    obrigatorio: true,
    textoConfirmar: 'Enviar link',
  });
  if (!email) return;
  try {
    await redefinirSenha(email);
    toast.sucesso('Verifique seu e-mail', 'Se o e-mail estiver cadastrado, chegará um link para criar nova senha (veja também o spam).');
  } catch (erro) {
    toast.erro('Não foi possível enviar', erro.message);
  }
}

/**
 * Tela de login (substitui a tela de entrada com senha mestre da v1.6).
 *   criarTelaLogin({ logo, titulo, subtitulo, rodape, permitirCriarConta })
 * O que acontece depois do login e decidido por observarLogin no aplicativo.
 */
export function criarTelaLogin({ logo, titulo = 'Aplicativo KZ', subtitulo = 'Entre com seu e-mail e senha', rodape, permitirCriarConta = true } = {}) {
  const formulario = criarFormulario({
    colunas: 1,
    textoEnviar: 'Entrar',
    campos: [
      { nome: 'email', rotulo: 'E-mail', tipo: 'email', obrigatorio: true, atributos: { autocomplete: 'username' } },
      { nome: 'senha', rotulo: 'Senha', tipo: 'senha', obrigatorio: true, atributos: { autocomplete: 'current-password' } },
    ],
    onEnviar: async ({ email, senha }) => {
      try { await entrar(email, senha); }
      catch (erro) { formulario.definirErro('senha', erro.message); }
    },
  });

  const elemento = cartaoEntrada({ logo, titulo, subtitulo, rodape },
    h('section', { class: 'ctc-landing__section' },
      h('div', { class: 'ctc-landing__section-title' }, 'Acesso'),
      formulario.elemento,
      criarBotao({ texto: 'Esqueci a senha', variante: 'ghost', bloco: true, onClick: () => abrirEsqueciSenha(formulario.obterValores().email) })),
    permitirCriarConta ? h('section', { class: 'ctc-landing__section' },
      h('div', { class: 'ctc-landing__section-title' }, 'Primeiro acesso'),
      criarBotao({ texto: 'Criar conta', icone: 'usuario', variante: 'outline', bloco: true, onClick: abrirCriarConta })) : null);

  return {
    elemento,
    mostrar: (alvo = document.body) => { formulario.limparErros(); alvo.append(elemento); },
    remover: () => elemento.remove(),
  };
}

/** Tela de quem entrou mas ainda nao tem nenhuma obra liberada. */
export function criarTelaAguardando({ logo, titulo, perfil, rodape, onAtualizar, onSair }) {
  const botaoAtualizar = criarBotao({ texto: 'Verificar de novo', icone: 'check', variante: 'primary', bloco: true });
  botaoAtualizar.addEventListener('click', () => comCarregamento(botaoAtualizar, onAtualizar));
  const elemento = cartaoEntrada({ logo, titulo, subtitulo: `Olá, ${perfil.nome}`, rodape },
    h('section', { class: 'ctc-landing__section' },
      criarAlerta({
        tipo: 'info',
        titulo: 'Aguardando liberação',
        mensagem: `Sua conta (${perfil.email}) foi criada, mas ainda não tem nenhuma obra liberada. Peça ao gestor da sua obra para adicionar você.`,
      }),
      botaoAtualizar,
      criarBotao({ texto: 'Sair', icone: 'sair', variante: 'outline', bloco: true, onClick: onSair })));
  return { elemento, mostrar: (alvo = document.body) => alvo.append(elemento), remover: () => elemento.remove() };
}

function abrirTrocarSenha() {
  const formulario = criarFormulario({
    colunas: 1,
    semBotoes: true,
    campos: [
      { nome: 'atual', rotulo: 'Senha atual', tipo: 'senha', obrigatorio: true, atributos: { autocomplete: 'current-password' } },
      { nome: 'nova', rotulo: 'Nova senha (mínimo 8 caracteres)', tipo: 'senha', obrigatorio: true, regras: { minCaracteres: 8 }, atributos: { autocomplete: 'new-password' } },
      {
        nome: 'nova2', rotulo: 'Repita a nova senha', tipo: 'senha', obrigatorio: true, atributos: { autocomplete: 'new-password' },
        regras: { validar: (v, valores) => (v === valores.nova ? true : 'As senhas não conferem.') },
      },
    ],
    onEnviar: async ({ atual, nova }) => {
      try {
        await trocarSenha(atual, nova);
        modal.fechar();
        toast.sucesso('Senha alterada', 'Use a nova senha no próximo acesso.');
      } catch (erro) {
        formulario.definirErro(/atual|incorret/i.test(erro.message) ? 'atual' : 'nova', erro.message);
      }
    },
  });
  const modal = criarModal({
    titulo: 'Trocar senha',
    tamanho: 'sm',
    destruirAoFechar: true,
    conteudo: formulario.elemento,
    acoes: [
      { texto: 'Cancelar', variante: 'outline' },
      { texto: 'Trocar senha', variante: 'primary', fechar: false, onClick: () => formulario.enviar() },
    ],
  });
  modal.abrir();
}

/**
 * Painel da sessao (botao do canto superior direito):
 *   abrirPainelSessao({ perfil, descricao, abasExtras: [{ id, texto, conteudo }], onSair, onNomeAlterado })
 */
export function abrirPainelSessao({ perfil, descricao = '', abasExtras = [], onSair, onNomeAlterado }) {
  let modal = null;
  async function alterarNome() {
    modal.fechar();
    const nome = await solicitarValor({
      titulo: 'Alterar meu nome', rotulo: 'Nome completo', valor: perfil.nome, obrigatorio: true,
      regras: { minCaracteres: 3, maxCaracteres: 80 }, textoConfirmar: 'Salvar',
    });
    if (!nome || nome.trim() === perfil.nome) return;
    try {
      await alterarMeuNome(nome);
      toast.sucesso('Nome alterado', nome.trim());
      if (typeof onNomeAlterado === 'function') onNomeAlterado(nome.trim());
    } catch (erro) {
      toast.erro('Nome não alterado', erro.message);
    }
  }
  const sessao = h('div', { class: 'ctc-stack' },
    h('p', { class: 'ctc-text-strong' }, perfil.nome),
    h('p', { class: 'ctc-text-muted ctc-text-sm' }, perfil.email),
    descricao ? h('p', { class: 'ctc-text-sm' }, descricao) : null,
    criarAlerta({ tipo: 'info', mensagem: 'Você continua conectado neste navegador até clicar em "Sair". Em computador compartilhado, sempre saia ao terminar.' }),
    h('div', { class: 'ctc-cluster' },
      criarBotao({ texto: 'Alterar meu nome', icone: 'editar', variante: 'outline', onClick: alterarNome }),
      criarBotao({ texto: 'Trocar senha', icone: 'configuracao', variante: 'outline', onClick: () => { modal.fechar(); abrirTrocarSenha(); } }),
      criarBotao({ texto: 'Sair', icone: 'sair', variante: 'danger-soft', onClick: () => { modal.fechar(); onSair(); } })));
  const abas = criarAbas({
    dentroDeModal: true,
    abas: [{ id: 'sessao', texto: 'Sessão', conteudo: sessao }, ...abasExtras],
  });
  modal = criarModal({
    titulo: 'Sessão',
    destruirAoFechar: true,
    conteudo: abas.elemento,
    acoes: [{ texto: 'Fechar', variante: 'primary' }],
  });
  modal.abrir();
}
