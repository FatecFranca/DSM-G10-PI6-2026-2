describe('Usuários (Administração)', () => {
  beforeEach(() => {
    cy.loginByApi()
    cy.visitAuthenticated('/admin/users')
  })

  it('creates a new VIEWER user through the UI with randomized data', () => {
    cy.apiEnsureInstitution().then((institution) => {
      const suffix = `${Date.now()}`.slice(-8)
      const name = `Usuario Teste ${suffix}`
      const email = `usuario.${suffix}@e2e.pi6.test`
      const password = `Teste@${suffix.slice(-4)}`

      cy.contains('button', 'Novo usuário').click()

      cy.get('.modal').within(() => {
        cy.contains('.field', 'Nome').find('input').type(name)
        cy.contains('.field', 'E-mail').find('input').type(email)
        cy.contains('.field', 'Senha').find('input').type(password)
        cy.contains('.field', 'Perfil').find('select').select('VIEWER')
        cy.contains('.field', 'Instituição').find('select').select(institution.name)
        cy.contains('button', 'Salvar').click()
      })

      cy.contains('.toast', 'Usuário criado.').should('be.visible')
      cy.get('#user-search').type(email)
      cy.contains('table.table td', email).should('be.visible')
    })
  })
})
