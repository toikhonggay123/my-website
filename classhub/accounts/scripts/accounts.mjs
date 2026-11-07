// AFYLLX Account operator commands. Run from the classhub folder.
//   node accounts/scripts/accounts.mjs setup                         local D1 + .dev.vars for development
//   node accounts/scripts/accounts.mjs founder <email> <name> --local   first founder on the local D1
//   node accounts/scripts/accounts.mjs founder <email> <name> --remote  first founder on the live D1
// "founder" only works while no founder exists; later founders are added in the app. It prints a one-time
// activation link (72 hours) once. Only the SHA-256 of the link code is stored. No password is ever handled here.
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { existsSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const [command, ...args] = process.argv.slice(2)
const remote = args.includes('--remote')
const config = remote ? 'accounts/cloud/wrangler.jsonc' : 'accounts/wrangler.jsonc'
const database = remote ? 'afyllx-accounts-live' : 'ACCOUNTS_DB'
const origin = remote ? 'https://account.afyllx.com' : 'http://127.0.0.1:5190'

function wrangler(...rest) {
  const child = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', ...rest, '--config', config],
    { encoding: 'utf8', env: { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false' } })
  if (child.status !== 0) {
    console.error((child.stdout + child.stderr).slice(-2000))
    process.exit(child.status ?? 1)
  }
  return child.stdout
}
function sqlJson(sql) {
  const output = wrangler('d1', 'execute', database, remote ? '--remote' : '--local', '--json', '--command', sql)
  return JSON.parse(output.slice(output.indexOf('[')))[0].results
}
const quote = value => "'" + String(value).replaceAll("'", "''") + "'"

if (command === 'setup') {
  if (remote) throw new Error('setup is for the local database only')
  if (!existsSync('accounts/.dev.vars')) {
    writeFileSync('accounts/.dev.vars', 'ACCOUNTS_ENCRYPTION_KEY=' + randomBytes(32).toString('hex') + '\n', { flag: 'wx' })
  }
  wrangler('d1', 'migrations', 'apply', database, '--local')
  console.log('AFYLLX Account local database is ready. Start with: node node_modules/vite/bin/vite.js --config accounts/vite.config.ts')
} else if (command === 'founder') {
  const [email, ...nameParts] = args.filter(arg => !arg.startsWith('--'))
  const name = nameParts.join(' ').trim()
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email ?? '') || !name || name.length > 100) {
    console.error('Usage: founder <email> <name> --local|--remote')
    process.exit(1)
  }
  if (!args.includes('--local') && !remote) {
    console.error('Choose --local or --remote.')
    process.exit(1)
  }
  if (sqlJson("SELECT COUNT(*) AS n FROM accounts WHERE platform_role='founder'")[0].n > 0) {
    console.error('A founder already exists. Add more founders from the AFYLLX Account administration page.')
    process.exit(1)
  }
  if (sqlJson('SELECT COUNT(*) AS n FROM accounts WHERE email=' + quote(email.toLowerCase()))[0].n > 0) {
    console.error('This email already has an AFYLLX account.')
    process.exit(1)
  }
  const id = randomUUID()
  const code = randomBytes(32).toString('hex')
  const now = Date.now()
  wrangler('d1', 'execute', database, remote ? '--remote' : '--local', '--command', [
    `INSERT INTO accounts(id,email,name,platform_role,created_at,updated_at) VALUES (${quote(id)},${quote(email.toLowerCase())},${quote(name)},'founder',${now},${now})`,
    `INSERT INTO action_tokens(id,account_id,kind,token_hash,created_at,expires_at) VALUES (${quote(randomUUID())},${quote(id)},'activate',${quote(createHash('sha256').update(code).digest('hex'))},${now},${now + 72 * 3_600_000})`,
    `INSERT INTO audit_events(id,actor_id,action,target_id,details,occurred_at) VALUES (${quote(randomUUID())},NULL,'account.bootstrapped',${quote(id)},'{"via":"operator"}',${now})`,
  ].join(';\n'))
  console.log('Founder created: ' + email.toLowerCase())
  console.log('One-time activation link (72 hours). Open it yourself, set a password, then enable the authenticator app:')
  console.log(origin + '/dat-mat-khau#' + code)
} else if (command === 'reset') {
  // Operator recovery for someone locked out (for example the only founder): a one-time reset link, 24 hours.
  // Earlier unused links for that account stop working. The password is set by the account holder in the browser.
  const [email] = args.filter(arg => !arg.startsWith('--'))
  if (!email || (!args.includes('--local') && !remote)) {
    console.error('Usage: reset <email> --local|--remote')
    process.exit(1)
  }
  const [account] = sqlJson("SELECT id,status FROM accounts WHERE email=" + quote(email.toLowerCase()))
  if (!account) { console.error('No AFYLLX account uses this email.'); process.exit(1) }
  if (account.status !== 'active') { console.error('This account is disabled. Re-enable it first.'); process.exit(1) }
  const code = randomBytes(32).toString('hex')
  const now = Date.now()
  wrangler('d1', 'execute', database, remote ? '--remote' : '--local', '--command', [
    `UPDATE action_tokens SET used_at=${now} WHERE account_id=${quote(account.id)} AND used_at IS NULL`,
    `INSERT INTO action_tokens(id,account_id,kind,token_hash,created_at,expires_at) VALUES (${quote(randomUUID())},${quote(account.id)},'reset',${quote(createHash('sha256').update(code).digest('hex'))},${now},${now + 24 * 3_600_000})`,
    `INSERT INTO audit_events(id,actor_id,action,target_id,details,occurred_at) VALUES (${quote(randomUUID())},NULL,'password.reset_link',${quote(account.id)},'{"via":"operator"}',${now})`,
  ].join(';\n'))
  console.log('One-time password reset link for ' + email.toLowerCase() + ' (24 hours):')
  console.log(origin + '/dat-mat-khau#' + code)
} else {
  console.error('Commands: setup | founder <email> <name> --local|--remote | reset <email> --local|--remote')
  process.exitCode = 1
}
