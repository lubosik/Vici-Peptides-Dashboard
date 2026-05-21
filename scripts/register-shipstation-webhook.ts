/**
 * Register ShipStation SHIP_NOTIFY webhook
 * Run once: npx tsx scripts/register-shipstation-webhook.ts
 *
 * Requires env vars: SHIPSTATION_API_KEY, SHIPSTATION_API_SECRET
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createShipStationClient } from '../lib/shipstation/client'

const TARGET_URL = 'https://dashboard.vicipeptides.com/api/webhooks/shipstation'

async function main() {
  console.log('ShipStation Webhook Registration')
  console.log('=================================')

  let client
  try {
    client = createShipStationClient()
    console.log('✅ ShipStation credentials loaded')
  } catch (e) {
    console.error('❌ Missing credentials:', e instanceof Error ? e.message : e)
    process.exit(1)
  }

  // List existing webhooks first
  console.log('\n📋 Checking existing webhooks...')
  try {
    const { webhooks } = await client.listWebhooks()
    if (webhooks.length === 0) {
      console.log('   No existing webhooks found')
    } else {
      for (const wh of webhooks) {
        console.log(`   [${wh.WebHookID}] ${wh.Name} → ${wh.HookURL} (${wh.ServiceAttribute})`)
        if (wh.HookURL === TARGET_URL && wh.ServiceAttribute === 'SHIP_NOTIFY') {
          console.log(`\n⚠️  Webhook already registered (ID: ${wh.WebHookID}). Nothing to do.`)
          process.exit(0)
        }
      }
    }
  } catch (e) {
    console.warn('   Could not list webhooks:', e instanceof Error ? e.message : e)
  }

  // Register new webhook
  console.log(`\n🔗 Registering SHIP_NOTIFY webhook → ${TARGET_URL}`)
  try {
    const result = await client.registerWebhook(TARGET_URL, 'Vici Dashboard – Ship Notify')
    console.log(`✅ Webhook registered! ID: ${result.id}`)
    console.log('\nNext steps:')
    console.log('  1. ShipStation will now POST to your webhook when orders ship')
    console.log('  2. Verify in ShipStation: Account Settings → Webhooks')
    console.log(`  3. Webhook ID to note for future reference: ${result.id}`)
  } catch (e) {
    console.error('❌ Failed to register webhook:', e instanceof Error ? e.message : e)
    console.log('\nYou can also register manually in ShipStation UI:')
    console.log('  Account Settings → Webhooks → Add Webhook')
    console.log(`  Event: Ship Notify | URL: ${TARGET_URL}`)
    process.exit(1)
  }
}

main()
