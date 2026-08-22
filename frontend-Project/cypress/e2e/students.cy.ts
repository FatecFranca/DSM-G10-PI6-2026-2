describe('Students', () => {
  beforeEach(() => {
    cy.loginByApi()
    cy.visitAuthenticated('/students')
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
