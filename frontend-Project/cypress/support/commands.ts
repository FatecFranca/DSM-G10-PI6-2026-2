import {
  randomFeatureValues,
  randomInstitution,
  randomStudentBasics,
  randomUser,
  type FeatureSpecLike,
  type Role,
} from './factories'

interface FeatureContract {
  featureCount: number
  features: FeatureSpecLike[]
}

interface ApiInstitution {
  id: string
  name: string
}

interface ApiUser {
  id: string
  name: string
  email: string
  role: Role
}

interface ApiStudent {
  id: string
  code: string
  name: string
}

declare global {
  namespace Cypress {
    interface Chainable {
      loginByApi(email?: string, password?: string): Chainable<void>
      visitAuthenticated(path?: string): Chainable<void>
      apiFeatureContract(): Chainable<FeatureContract>
      apiCreateInstitution(overrides?: Partial<ReturnType<typeof randomInstitution>>): Chainable<ApiInstitution>
      apiEnsureInstitution(): Chainable<ApiInstitution>
      apiCreateUser(role?: Role, overrides?: Partial<ReturnType<typeof randomUser>> & { institutionId?: string }): Chainable<ApiUser>
      apiCreateStudent(institutionId: string, overrides?: Record<string, unknown>): Chainable<ApiStudent>
      apiRunAnalysis(studentId: string): Chainable<unknown>
    }
  }
}

function authHeaders() {
  return { Authorization: `Bearer ${Cypress.env('authToken')}` }
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

Cypress.Commands.add('apiFeatureContract', () => {
  return cy
    .request({
      method: 'GET',
      url: `${Cypress.env('apiBaseUrl')}/students/feature-contract`,
      headers: authHeaders(),
    })
    .its('body')
})

Cypress.Commands.add('apiCreateInstitution', (overrides = {}) => {
  const payload = { ...randomInstitution(), ...overrides }
  return cy
    .request({
      method: 'POST',
      url: `${Cypress.env('apiBaseUrl')}/institutions`,
      headers: authHeaders(),
      body: payload,
    })
    .its('body')
})

Cypress.Commands.add('apiEnsureInstitution', () => {
  return cy
    .request({
      method: 'GET',
      url: `${Cypress.env('apiBaseUrl')}/institutions?limit=1&active=true`,
      headers: authHeaders(),
    })
    .then((response) => {
      const existing = response.body.data?.[0]
      if (existing) return existing
      return cy.apiCreateInstitution()
    })
})

Cypress.Commands.add('apiCreateUser', (role = 'VIEWER', overrides = {}) => {
  const needsInstitution = role !== 'ADMIN'
  const build = (institutionId?: string) => {
    const payload = {
      ...randomUser(role),
      ...(institutionId ? { institutionId } : {}),
      ...overrides,
    }
    return cy
      .request({
        method: 'POST',
        url: `${Cypress.env('apiBaseUrl')}/users`,
        headers: authHeaders(),
        body: payload,
      })
      .its('body')
  }

  if (needsInstitution && !overrides.institutionId) {
    return cy.apiEnsureInstitution().then((institution) => build(institution.id))
  }
  return build(overrides.institutionId)
})

Cypress.Commands.add('apiCreateStudent', (institutionId, overrides = {}) => {
  return cy.apiFeatureContract().then((contract) => {
    const payload = {
      ...randomStudentBasics(),
      institutionId,
      features: randomFeatureValues(contract.features),
      ...overrides,
    }
    return cy
      .request({
        method: 'POST',
        url: `${Cypress.env('apiBaseUrl')}/students`,
        headers: authHeaders(),
        body: payload,
      })
      .its('body')
  })
})

Cypress.Commands.add('apiRunAnalysis', (studentId) => {
  return cy
    .request({
      method: 'POST',
      url: `${Cypress.env('apiBaseUrl')}/analyses/student/${studentId}`,
      headers: authHeaders(),
    })
    .its('body')
})

export {}
