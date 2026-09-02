describe('Instituições (Administração)', () => {
  beforeEach(() => {
    cy.loginByApi()
    cy.visitAuthenticated('/admin/institutions')
  })

  it('creates a new institution through the UI with randomized data', () => {
    const suffix = `${Date.now()}`.slice(-8)
    const name = `Instituicao Teste ${suffix}`
    const email = `contato.${suffix}@e2e.pi6.test`

    cy.contains('button', 'Nova instituição').click()

    cy.get('.modal').within(() => {
      cy.contains('.field', 'Nome').find('input').type(name)
      cy.contains('.field', 'Cidade').find('input').type('Franca')
      cy.contains('.field', 'Estado').find('input').type('SP')
      cy.contains('.field', 'Natureza').find('input').type('Pública')
      cy.contains('.field', 'E-mail').find('input').type(email)
      cy.contains('.field', 'Telefone').find('input').type('16999998888')
      cy.contains('button', 'Salvar').click()
    })

    cy.contains('.toast', 'Instituição cadastrada.').should('be.visible')
    cy.get('#institution-search').type(name)
    cy.contains('table.table td', name).should('be.visible')
  })
})
