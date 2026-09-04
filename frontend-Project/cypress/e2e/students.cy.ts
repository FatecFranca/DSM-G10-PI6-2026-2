describe('Students', () => {
  beforeEach(() => {
    cy.loginByApi()
    cy.visitAuthenticated('/students')
  })

  it('creates a new student through the UI with randomized data', () => {
    cy.apiEnsureInstitution().then((institution) => {
      cy.contains('button', 'Novo estudante').click()
      cy.location('pathname').should('eq', '/students/new')

      const suffix = `${Date.now()}`.slice(-8)

      cy.contains('.card', 'Dados do estudante').within(() => {
        cy.contains('.field', 'Código / Matrícula').find('input').type(`E2E-${suffix}`)
        cy.contains('.field', 'Nome').find('input').type(`Estudante Teste ${suffix}`)
        cy.contains('.field', 'E-mail').find('input').type(`estudante.${suffix}@e2e.pi6.test`)
        cy.contains('.field', 'Curso').find('input').type('Análise e Desenvolvimento de Sistemas')
        cy.contains('.field', 'Ano de ingresso').find('input').clear().type('2024')
        cy.contains('.field', 'Instituição').find('select').select(institution.name)
      })

      cy.contains('button', 'Preencher vazios com a média do treino').click()
      cy.contains('button', 'Salvar').click()

      cy.contains('.toast', 'Estudante cadastrado.').should('be.visible')
      cy.location('pathname', { timeout: 10000 }).should('match', /^\/students\/[a-f0-9]{24}$/)
      cy.contains('.page-header__title', `Estudante Teste ${suffix}`).should('be.visible')
    })
  })

  it('lists students or shows the empty state', () => {
    cy.get('table.table, .state').should('exist')
  })

  it('filters the list by a search term with no matches', () => {
    cy.get('#student-search').type('zzz-sem-correspondencia-zzz')
    cy.contains('Nenhum registro encontrado').should('be.visible')
  })

  it('opens a student detail page from the list', () => {
    cy.get('body').then(($body) => {
      if ($body.find('table.table tbody tr').length === 0) {
        cy.log('Sem estudantes semeados — rode npm run seed:students no backend-Project.')
        return
      }
      cy.get('table.table tbody tr').first().find('a').first().click()
      cy.location('pathname').should('match', /^\/students\/[a-f0-9]{24}$/)
      cy.contains('.page-header__title', /./).should('be.visible')
    })
  })
})
