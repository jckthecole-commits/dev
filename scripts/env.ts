/** Loads .env for standalone scripts (Next.js loads it automatically for the app). */
import { existsSync } from 'node:fs'

for (const file of ['.env.local', '.env']) {
  if (existsSync(file)) process.loadEnvFile(file)
}
