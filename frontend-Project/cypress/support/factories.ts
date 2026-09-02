import { fakerPT_BR as faker } from '@faker-js/faker'

export interface FeatureSpecLike {
  name: string
  kind: 'numeric' | 'binary' | 'categorical'
  dtype: 'int' | 'float'
  hardMin: number
  hardMax: number
}

const COURSES = [
  'Análise e Desenvolvimento de Sistemas',
  'Gestão Empresarial',
  'Enfermagem',
  'Engenharia de Produção',
  'Design Gráfico',
  'Comércio Exterior',
  'Logística',
]

const INSTITUTION_TYPES = ['Pública', 'Privada', 'ONG', 'Entidade social']

const FOLLOW_UP_TITLES = [
  'Agendar conversa com o estudante',
  'Verificar situação financeira',
  'Encaminhar para o núcleo de apoio pedagógico',
  'Confirmar frequência nas últimas semanas',
  'Contatar responsável',
]

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${faker.string.alphanumeric({ length: 4, casing: 'upper' })}`
}

export function randomStudentBasics(overrides: Partial<{ course: string }> = {}) {
  const firstName = faker.person.firstName()
  const lastName = faker.person.lastName()
  return {
    code: `E2E-${uniqueSuffix()}`,
    name: `${firstName} ${lastName}`,
    email: faker.internet.email({ firstName, lastName, provider: 'e2e.pi6.test' }).toLowerCase(),
    course: overrides.course ?? faker.helpers.arrayElement(COURSES),
    enrollmentYear: faker.number.int({ min: 2018, max: new Date().getFullYear() }),
  }
}

export function randomFeatureValues(features: FeatureSpecLike[]): Record<string, number> {
  const values: Record<string, number> = {}
  for (const feature of features) {
    if (feature.kind === 'binary') {
      values[feature.name] = faker.number.int({ min: 0, max: 1 })
      continue
    }
    if (feature.dtype === 'int') {
      values[feature.name] = faker.number.int({
        min: Math.ceil(feature.hardMin),
        max: Math.floor(feature.hardMax),
      })
      continue
    }
    values[feature.name] = faker.number.float({
      min: feature.hardMin,
      max: feature.hardMax,
      fractionDigits: 2,
    })
  }
  return values
}

export type Role = 'ADMIN' | 'ANALYST' | 'VIEWER'

export function randomUser(role: Role = 'VIEWER') {
  const firstName = faker.person.firstName()
  const lastName = faker.person.lastName()
  return {
    name: `${firstName} ${lastName}`,
    email: faker.internet.email({ firstName, lastName, provider: 'e2e.pi6.test' }).toLowerCase(),
    password: `Teste@${faker.number.int({ min: 1000, max: 9999 })}`,
    role,
  }
}

export function randomInstitution() {
  return {
    name: `${faker.company.name()} — ${faker.location.city()} (${uniqueSuffix()})`,
    city: faker.location.city(),
    state: faker.location.state(),
    type: faker.helpers.arrayElement(INSTITUTION_TYPES),
    email: faker.internet.email().toLowerCase(),
    phone: faker.phone.number(),
  }
}

export function randomFollowUp() {
  const dueDate = faker.date.soon({ days: 21 })
  return {
    title: faker.helpers.arrayElement(FOLLOW_UP_TITLES),
    notes: faker.lorem.sentence(),
    priority: faker.helpers.arrayElement(['LOW', 'MEDIUM', 'HIGH'] as const),
    dueDate: dueDate.toISOString().slice(0, 10),
  }
}
