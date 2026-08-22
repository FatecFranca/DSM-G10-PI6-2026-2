describe('Login', () => {
  beforeEach(() => {
    cy.visit('/login', {
      onBeforeLoad(win) {
        win.localStorage.setItem('pi6.locale', 'pt-BR')
      },
    })
  })

  it('shows the login form', () => {
    cy.get('#email').should('be.visible')
    cy.get('#password').should('be.visible')
    cy.get('button[type=submit]').should('be.visible')
  })

  it('rejects invalid credentials', () => {
    cy.get('#email').type('admin@pi6.local')
    cy.get('#password').type('senha-errada')
    cy.get('button[type=submit]').click()
    cy.get('[role=alert]').should('be.visible')
    cy.location('pathname').should('eq', '/login')
  })

  it('logs in with valid credentials and reaches the dashboard', () => {
    cy.get('#email').type('admin@pi6.local')
    cy.get('#password').type('Admin@123456')
    cy.get('button[type=submit]').click()
    cy.location('pathname', { timeout: 10000 }).should('eq', '/')
    cy.window().its('localStorage').invoke('getItem', 'pi6.auth.token').should('exist')
  })

  it('toggles the password field between hidden and visible', () => {
    cy.get('#password').type('qualquer-coisa')
    cy.get('#password').should('have.attr', 'type', 'password')
    cy.get('.input-icon-btn').click()
    cy.get('#password').should('have.attr', 'type', 'text')
  })

  it('switches between dark and light theme and remembers the choice', () => {
    cy.get('html')
      .invoke('attr', 'data-theme')
      .then((initial) => {
        cy.get('.theme-toggle').first().click()
        cy.get('html').invoke('attr', 'data-theme').should('not.eq', initial)
        cy.reload()
        cy.get('html').invoke('attr', 'data-theme').should('not.eq', initial)
      })
  })
})
