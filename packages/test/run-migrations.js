import { runMigrations } from '@r-delfino/mux-sync-engine'
import dotenv from 'dotenv'

// Load environment variables from .env file
dotenv.config()

// Load secrets from environment variables
const databaseUrl = process.env.DATABASE_URL

;(async () => {
  await runMigrations({    
    databaseUrl,
    schema: 'mux',
    logger: console
  })
})()