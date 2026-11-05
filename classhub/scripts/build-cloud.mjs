import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'

const previewConfig = '.wrangler/deploy/config.json'
const localConfig = existsSync(previewConfig) ? readFileSync(previewConfig) : null

// The Vite plugin writes one preview pointer per project, even with separate output folders.
try {
  const build = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--mode', 'cloud'], {
    stdio: 'inherit',
  })
  if (build.error) throw build.error
  process.exitCode = build.status ?? 1
} finally {
  if (localConfig) writeFileSync(previewConfig, localConfig)
  else if (existsSync(previewConfig)) unlinkSync(previewConfig)
}
