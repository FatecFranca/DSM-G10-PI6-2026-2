import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    defaultCommandTimeout: 8000,
  },
  env: {
    apiBaseUrl: 'http://localhost:3004/api',
  },
})
