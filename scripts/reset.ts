import './env'
import postgres from 'postgres'

if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
  console.error('Refusing to reset a production database (pass --force if you really mean it).')
  process.exit(1)
}
const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} })
await sql.unsafe('DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;')
console.log('✓ database reset')
await sql.end()
