import { randomFollowUp, type Role } from '../support/factories'

const STRESS_ENABLED = ['true', '1', true].includes(Cypress.env('stress'))
const STUDENT_COUNT = Number(Cypress.env('stressCount')) || 20
const USER_COUNT = Math.max(1, Math.round(STUDENT_COUNT / 5))
const FOLLOW_UP_COUNT = Math.max(1, Math.round(STUDENT_COUNT / 2))
const INSTITUTION_COUNT = Math.max(1, Math.round(STUDENT_COUNT / 10))

;(STRESS_ENABLED ? describe : describe.skip)('Stress: geração de dados aleatórios', () => {
  const institutionIds: string[] = []
  const studentIds: string[] = []

  before(() => {
    cy.loginByApi()
  })

  it(
    `generates ~${STUDENT_COUNT} students, ${USER_COUNT} users, ${INSTITUTION_COUNT} institutions ` +
      `and ${FOLLOW_UP_COUNT} follow-ups with random data`,
    () => {
      Cypress._.times(INSTITUTION_COUNT, () => {
        cy.apiCreateInstitution().then((institution) => institutionIds.push(institution.id))
      })

      Cypress._.times(USER_COUNT, () => {
        const role = Cypress._.sample(['ANALYST', 'VIEWER'] as Role[]) ?? 'VIEWER'
        cy.apiCreateUser(role)
      })

      Cypress._.times(STUDENT_COUNT, () => {
        cy.then(() => Cypress._.sample(institutionIds)).then((institutionId) => {
          cy.apiCreateStudent(institutionId as string).then((student) => {
            studentIds.push(student.id)
            cy.request({
              method: 'POST',
              url: `${Cypress.env('apiBaseUrl')}/analyses/student/${student.id}`,
              headers: { Authorization: `Bearer ${Cypress.env('authToken')}` },
              failOnStatusCode: false,
            })
          })
        })
      })

      Cypress._.times(FOLLOW_UP_COUNT, () => {
        cy.then(() => Cypress._.sample(studentIds)).then((studentId) => {
          if (!studentId) return
          cy.request({
            method: 'POST',
            url: `${Cypress.env('apiBaseUrl')}/follow-ups`,
            headers: { Authorization: `Bearer ${Cypress.env('authToken')}` },
            body: { studentId, ...randomFollowUp() },
          })
        })
      })

      cy.then(() => {
        cy.log(
          `Stress test concluído: ${studentIds.length} estudantes e ${institutionIds.length} instituições criadas.`,
        )
      })
    },
  )
})
