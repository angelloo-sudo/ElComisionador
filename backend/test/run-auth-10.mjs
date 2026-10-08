import { spawnSync } from 'node:child_process'

for (let repetition = 1; repetition <= 10; repetition += 1) {
  console.log(`\n=== Repetición ${repetition}/10 ===`)
  const result = spawnSync(process.execPath, ['--test', 'test/auth.integration.test.js'], {
    stdio: 'inherit',
    shell: false,
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}