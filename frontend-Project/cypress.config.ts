import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    defaultCommandTimeout: 8000,
  },
  // Cypress.env() expõe valores a qualquer código do navegador e será removido
  // numa major futura. Desligado aqui para que um uso remanescente falhe alto.
  allowCypressEnv: false,
  expose: {
    apiBaseUrl: 'http://localhost:3004/api',
  },
})
