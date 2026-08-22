describe('Dashboard', () => {
  beforeEach(() => {
    cy.loginByApi()
    cy.visitAuthenticated('/')
  })

  it('renders the dashboard page header', () => {
    cy.contains('h1', 'Painel').should('be.visible')
  })

  it('highlights exactly one active sidebar link', () => {
    cy.get('a.sidebar__link--active').should('have.length', 1)
  })

  it('navigates to Students through the sidebar', () => {
    cy.contains('.sidebar__link', 'Estudantes').click()
    cy.location('pathname').should('eq', '/students')
  })

  it('signs the user out back to the login screen', () => {
    cy.contains('button', 'Sair').click()
    cy.location('pathname').should('eq', '/login')
    cy.window().its('localStorage').invoke('getItem', 'pi6.auth.token').should('be.null')
  })
})
