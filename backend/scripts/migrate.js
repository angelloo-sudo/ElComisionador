import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { runner } from 'node-pg-migrate'

const backendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const migrationsDir = resolve(backendDir, 'migrations')
dotenv.config({ path: resolve(backendDir, '.env') })

const [command = 'up', ...args] = process.argv.slice(2)

if (command === 'create') {
  const cliPath = resolve(backendDir, 'node_modules/node-pg-migrate/bin/node-pg-migrate.js')
  const result = spawnSync(process.execPath, [
    cliPath,
    'create',
    ...args,
    '--migrations-dir',
    migrationsDir,
    '--migration-file-language',
    'js',
  ], { cwd: backendDir, stdio: 'inherit' })

  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
} else {
  const direction = command === 'down' ? 'down' : 'up'
  const fake = command === 'baseline'
  const dryRun = args.includes('--dry-run')
  const requiredVariables = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']
  const missingVariables = requiredVariables.filter((name) => !process.env[name])

  if (missingVariables.length > 0) {
    throw new Error(`Faltan variables en backend/.env: ${missingVariables.join(', ')}`)
  }
  if (!['up', 'down', 'baseline'].includes(command)) {
    throw new Error('Uso: npm run migrate[:up|:down|:baseline|:create]')
  }

  if (fake) {
    console.warn('Baseline: no se ejecutará SQL; node-pg-migrate marcará las migraciones pendientes como aplicadas.')
  }

  await runner({
    databaseUrl: {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    },
    dir: migrationsDir,
    direction,
    migrationsTable: 'pgmigrations',
    count: direction === 'down' ? 1 : undefined,
    fake,
    dryRun,
    checkOrder: true,
    verbose: false,
  })
}