import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const [command, address] = process.argv.slice(2)
const wrangler = (...args) => {
  const child = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', ...args, '--config', 'wrangler.jsonc'], {
    stdio: 'inherit', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  })
  if (child.status !== 0) process.exit(child.status ?? 1)
}

if (command === 'setup') {
  if (!existsSync('.dev.vars')) {
    writeFileSync('.dev.vars', 'APP_ORIGIN=http://127.0.0.1:5174\nCLASSHUB_LOCAL_ADMIN=1\nBETTER_AUTH_SECRET=' +
      randomBytes(48).toString('hex') + '\n', { flag: 'wx' })
  }
  let settings = readFileSync('.dev.vars', 'utf8')
  if (!/^\s*CLASSHUB_LOCAL_ADMIN\s*=/m.test(settings)) {
    settings += '\nCLASSHUB_LOCAL_ADMIN=1\n'
    appendFileSync('.dev.vars', '\nCLASSHUB_LOCAL_ADMIN=1\n')
  }
  wrangler('d1', 'migrations', 'apply', 'CLASSHUB_DB', '--local')
  if (/^\s*CLASSHUB_LOCAL_ADMIN\s*=\s*1[ \t]*$/m.test(settings)) {
    wrangler('d1', 'execute', 'CLASSHUB_DB', '--local', '--file', 'scripts/local-bootstrap.sql')
  }
} else if (command === 'invite' && /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(address ?? '')) {
  const code = randomBytes(32).toString('hex')
  const hash = createHash('sha256').update(code).digest('hex')
  const now = Date.now()
  wrangler('d1', 'execute', 'CLASSHUB_DB', '--local', '--command',
    `INSERT INTO invitations(id,email,role,token_hash,created_at,expires_at)
     VALUES ('${randomUUID()}','${address.toLowerCase()}','owner','${hash}',${now},${now + 86_400_000})`)
  console.log('Mã mời chủ đơn vị dùng một lần trong 24 giờ. Chuyển riêng cho người nhận.')
  console.log(code)
} else {
  console.error('Dùng pnpm setup:local hoặc pnpm invite:owner ten@example.test')
  process.exitCode = 1
}
