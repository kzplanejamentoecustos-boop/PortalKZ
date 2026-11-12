# Portal KZ Planejamento

Ponto único de acesso aos controles da KZ Planejamento (KZ App Standard v1.7).

- Login pelo Firebase (e-mail e senha), com "Criar conta" e "Esqueci a senha".
- Cada pessoa vê só as obras e os controles liberados para ela.
- Perfis: gestor geral, gestor da obra e, por controle, admin / editor / leitor.
- As permissões são garantidas pelas regras do Firestore (`firestore.rules`), não só pela tela.

Estrutura: `index.html` + `app.js` (portal) e `compartilhado/` (biblioteca do padrão;
`acesso-kz.js` é o módulo novo da v1.7 com login e permissões por obra).
