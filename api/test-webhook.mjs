/**
 * Script de test des webhooks Stripe en local.
 * Usage: node test-webhook.mjs [event_type]
 * Exemples:
 *   node test-webhook.mjs checkout_pack
 *   node test-webhook.mjs checkout_subscription
 *   node test-webhook.mjs invoice_paid
 *   node test-webhook.mjs subscription_deleted
 */

import Stripe from 'stripe';
import http from 'http';

const WEBHOOK_SECRET = 'whsec_VoHou2iT4GLaS83J4ZC5NVxGS56tHbOvcushd7WzrGg';
const WEBHOOK_URL = 'http://localhost:3000/payments/webhook';

// Keycloak ID d'un utilisateur de test — doit exister en DB
const TEST_KEYCLOAK_ID = 'test-user-keycloak-id';
const TEST_STRIPE_CUSTOMER = 'cus_test_fake';
const TEST_SUBSCRIPTION_ID = 'sub_test_fake';

const stripe = new Stripe('sk_test_51T4NedKHWmzMfvBR5kBgmddI7Us3SlWRwYD4fn4aVTH9t16pXcI4GcQkf1SRGqdnIIRKXDWAEg6kR5sD1H9gwApr00QgYyAra2', {
  apiVersion: '2026-01-28.clover',
});

const eventType = process.argv[2] || 'checkout_pack';

const events = {
  checkout_pack: {
    id: 'evt_test_pack',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_pack',
        object: 'checkout.session',
        mode: 'payment',
        customer: TEST_STRIPE_CUSTOMER,
        metadata: { keycloakId: TEST_KEYCLOAK_ID, type: 'pack' },
        subscription: null,
        payment_status: 'paid',
      }
    }
  },
  checkout_subscription: {
    id: 'evt_test_sub',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_sub',
        object: 'checkout.session',
        mode: 'subscription',
        customer: TEST_STRIPE_CUSTOMER,
        metadata: { keycloakId: TEST_KEYCLOAK_ID, type: 'subscription' },
        subscription: TEST_SUBSCRIPTION_ID,
        payment_status: 'paid',
      }
    }
  },
  invoice_paid: {
    id: 'evt_test_invoice',
    type: 'invoice.paid',
    data: {
      object: {
        id: 'in_test',
        object: 'invoice',
        customer: TEST_STRIPE_CUSTOMER,
        subscription: TEST_SUBSCRIPTION_ID,
        billing_reason: 'subscription_cycle',
        status: 'paid',
      }
    }
  },
  subscription_deleted: {
    id: 'evt_test_sub_del',
    type: 'customer.subscription.deleted',
    data: {
      object: {
        id: TEST_SUBSCRIPTION_ID,
        object: 'subscription',
        customer: TEST_STRIPE_CUSTOMER,
        status: 'canceled',
      }
    }
  }
};

const eventPayload = events[eventType];
if (!eventPayload) {
  console.error(`❌ Événement inconnu: ${eventType}`);
  console.error(`Événements disponibles: ${Object.keys(events).join(', ')}`);
  process.exit(1);
}

const payload = JSON.stringify(eventPayload);
const header = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });

console.log(`\n🔔 Test webhook: ${eventPayload.type}`);
console.log(`📦 Payload: ${payload.substring(0, 100)}...`);
console.log(`📡 Envoi vers ${WEBHOOK_URL}\n`);

const url = new URL(WEBHOOK_URL);
const options = {
  hostname: url.hostname,
  port: url.port || 80,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'stripe-signature': header,
  },
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log(`✅ Succès (${res.statusCode}): ${body}`);
    } else {
      console.log(`❌ Erreur (${res.statusCode}): ${body}`);
    }
  });
});

req.on('error', (err) => {
  console.error(`❌ Connexion échouée: ${err.message}`);
  console.error(`   → Assurez-vous que l'API tourne sur le port 3000 (just start)`);
});

req.write(payload);
req.end();
