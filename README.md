# Portal KZ Planejamento

Ponto de acesso aos controles da KZ Planejamento (KZ App Standard v1.7).

- Login pelo Firebase (e-mail e senha), com "Esqueci a senha". Não há "Criar conta":
  o gestor cadastra a pessoa em Equipe da obra > "Cadastrar pessoa nova".
- Todos com login entram. Quem não é gestor vê só "Minhas obras" (obras em que tem acesso
  a algum controle) e, ao abrir a obra, só os controles liberados para ele.
- Gestores (gestor geral e gestor da obra) também veem Equipe, Controles da obra e,
  no caso do gestor geral, Obras, Usuários e Migração.
- Perfis: gestor geral, gestor da obra e, por controle, admin / editor / leitor.
- Nos controles já adaptados por obra, as permissões são garantidas pelas regras do
  Firestore (`firestore.rules`), não só pela tela.

Estrutura: `index.html` + `app.js` (portal) e `compartilhado/` (biblioteca do padrão;
`acesso-kz.js` é o módulo novo da v1.7 com login e permissões por obra).
