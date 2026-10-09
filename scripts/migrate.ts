import './env'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

const client = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} })
const db = drizzle(client)

const started = Date.now()
await migrate(db, { migrationsFolder: './drizzle' })
console.log(`✓ migrations applied in ${Date.now() - started} ms`)
await client.end()
