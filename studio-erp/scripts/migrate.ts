import './env'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

const client = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} })
try {
  await migrate(drizzle(client), { migrationsFolder: './drizzle' })
  console.log('✓ database is up to date')
} finally {
  await client.end()
}
