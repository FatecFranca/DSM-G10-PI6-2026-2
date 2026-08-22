declare global {
  namespace Cypress {
    interface Chainable {
      loginByApi(email?: string, password?: string): Chainable<void>
      visitAuthenticated(path?: string): Chainable<void>
    }
  }
}

Cypress.Commands.add('loginByApi', (email = 'admin@pi6.local', password = 'Admin@123456') => {
  cy.request('POST', `${Cypress.env('apiBaseUrl')}/auth/login`, { email, password }).then((response) => {
    Cypress.env('authToken', response.body.token)
  })
})

Cypress.Commands.add('visitAuthenticated', (path = '/') => {
  const token = Cypress.env('authToken')
  if (!token) {
    throw new Error('visitAuthenticated: chame cy.loginByApi() antes.')
  }
  cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.setItem('pi6.auth.token', token)
      win.localStorage.setItem('pi6.locale', 'pt-BR')
    },
  })
})

export {}
