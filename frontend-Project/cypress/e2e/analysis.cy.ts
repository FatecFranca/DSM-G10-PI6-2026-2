describe('Simulação de análise', () => {
  beforeEach(() => {
    cy.loginByApi()
    cy.visitAuthenticated('/analysis')
  })

  it('runs a simulated classification after filling with mean values', () => {
    cy.contains('button', 'Preencher vazios com a média do treino').click()
    cy.contains('button', 'Executar classificação').should('not.be.disabled').click()
    cy.contains(/Evasão|Matriculado|Concluinte/, { timeout: 15000 }).should('be.visible')
    cy.get('.disclaimer').should('exist')
  })

  it('shows probabilities for all three classes after a run', () => {
    cy.contains('button', 'Preencher vazios com a média do treino').click()
    cy.contains('button', 'Executar classificação').click()
    cy.contains(/Evasão|Matriculado|Concluinte/, { timeout: 15000 }).should('be.visible')
    cy.get('.bars__row').should('have.length', 3)
  })
})
