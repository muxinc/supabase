import { MuxSync } from '@r-delfino/mux-sync-engine'
import http from 'http'
import dotenv from 'dotenv'

// Load environment variables from .env file
dotenv.config()

// Load secrets from environment variables
const databaseUrl = process.env.DATABASE_URL
const muxWebhookSecret = process.env.MUX_WEBHOOK_SECRET || 'your-mux-webhook-secret'
const muxTokenId = process.env.MUX_TOKEN_ID || 'your-mux-token-id'
const muxTokenSecret = process.env.MUX_TOKEN_SECRET || 'your-mux-token-secret'

// Initialize MuxSync
const muxSync = new MuxSync({
  databaseUrl,
  muxWebhookSecret,
  muxTokenId,
  muxTokenSecret,
  backfillRelatedEntities: false,
  revalidateEntityViaMuxApi: false,
  maxPostgresConnections: 5,
  logger: console
})

// Create HTTP server
const server = http.createServer(async (req, res) => {
  // Only handle POST requests
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  try {
    // Collect the raw body
    let body = ''
    req.on('data', chunk => {
      body += chunk.toString()
    })

    req.on('end', async () => {
      try {        
        // console.log('Received webhook:', {
        //   method: req.method,
        //   url: req.url,
        //   headers: req.headers,
        //   bodyLength: body.length
        // })

        // Process the webhook
        await muxSync.processWebhook(body, req.headers)

        // Return success response
        res.writeHead(202, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ status: 'success' }))
      } catch (error) {
        console.error('Error processing webhook:', error)
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: error.message }))
      }
    })
  } catch (error) {
    console.error('Server error:', error)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Internal server error' }))
  }
})

const PORT = process.env.PORT || 3000

server.listen(PORT, () => {
  console.log(`Webhook server running on port ${PORT}`)
  console.log(`Webhook endpoint: http://localhost:${PORT}/webhook`)
  console.log('You can use ngrok or similar to expose this locally for testing with real Mux webhooks')
})

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully')
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
}) 