describe('Acompanhamentos', () => {
  let studentId = ''

  before(() => {
    cy.loginByApi()
    cy.apiEnsureInstitution().then((institution) => {
      cy.apiCreateStudent(institution.id).then((student) => {
        studentId = student.id
      })
    })
  })

  beforeEach(() => {
    cy.loginByApi()
    cy.visitAuthenticated(`/students/${studentId}`)
  })

  it('creates a new follow-up through the UI with randomized data', () => {
    const suffix = `${Date.now()}`.slice(-8)
    const title = `Acompanhamento teste ${suffix}`

    cy.contains('button', 'Novo acompanhamento').click()

    cy.get('.modal').within(() => {
      cy.contains('.field', 'Título').find('input').type(title)
      cy.contains('.field', 'Observações')
        .find('textarea')
        .type('Gerado automaticamente pelo teste E2E.')
      cy.contains('button', 'Salvar').click()
    })

    cy.contains('.toast', 'Acompanhamento criado.').should('be.visible')
    cy.contains('.table__strong', title).should('be.visible')
  })
})
