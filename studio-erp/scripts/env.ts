/** Loads .env for scripts run with tsx (Next.js loads it itself for the app). */
import { existsSync } from 'node:fs'

if (existsSync('.env')) process.loadEnvFile('.env')
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set — copy .env.example to .env')
  process.exit(1)
}
