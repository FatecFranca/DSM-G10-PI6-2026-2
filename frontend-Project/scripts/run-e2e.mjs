import { spawn } from 'node:child_process'

import treeKill from 'tree-kill'
import waitOn from 'wait-on'

const DEV_URL = 'http://localhost:5173'
const cypressArgs = process.argv.slice(2)

function killTree(pid) {
  return new Promise((resolve) => {
    if (!pid) {
      resolve()
      return
    }
    treeKill(pid, 'SIGTERM', () => resolve())
  })
}

const devServer = spawn('npm run dev', { stdio: 'inherit', shell: true })

let exitCode = 1
try {
  await waitOn({ resources: [DEV_URL], timeout: 60000 })

  const cypressCommand = ['npx', 'cypress', 'run', ...cypressArgs].join(' ')
  const cypress = spawn(cypressCommand, { stdio: 'inherit', shell: true })

  exitCode = await new Promise((resolve) => {
    cypress.on('exit', (code) => resolve(code ?? 1))
  })
} catch (error) {
  console.error(`[run-e2e] Falha ao aguardar "${DEV_URL}" ou executar o Cypress: ${error.message}`)
} finally {
  await killTree(devServer.pid)
}

process.exit(exitCode)
