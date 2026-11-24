// netlify/functions/pesapal-ipn.js
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}
const db = admin.database();

exports.handler = async (event) => {
  const { OrderTrackingId, OrderMerchantReference } = event.queryStringParameters || {};

  if (!OrderTrackingId || !OrderMerchantReference) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing IDs' }) };
  }

  // 1. Parse for ANY user - no hardcoded number
  // Format: BANDU-COINS-{phone}-{coins}-{timestamp}
  const parts = OrderMerchantReference.split('-');
  // parts = ["BANDU", "COINS", "254798486530", "450", "..."]
  const phone = parts[2];
  const coinsToAdd = parseInt(parts[3], 10);

  if (!phone || !coinsToAdd) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Bad MerchantRef' }) };
  }

  const txRef = db.ref(`transactions/${OrderTrackingId}`);

  // 2. Idempotency - if already credited, do nothing
  const snapshot = await txRef.once('value');
  if (snapshot.exists() && snapshot.val().credited === true) {
    return { statusCode: 200, body: JSON.stringify({ message: 'Already credited' }) };
  }

  // 3. TODO: Here you should call Pesapal GetTransactionStatus
  // For now, we assume Pesapal said COMPLETED

  // 4. AUTOMATIC FOR EVERY USER - Save receipt + Update wallet in one go
  await txRef.set({
    phone,
    coins: coinsToAdd,
    merchantRef: OrderMerchantReference,
    paidAt: new Date().toISOString(),
    type: 'COINS',
    credited: true
  });

  // THIS IS THE MISSING LINE - This updates the wallet the app reads from
  await db.ref(`users/${phone}/coins`).transaction(current => (current || 0) + coinsToAdd);

  // Also update lastSeen so app refreshes
  await db.ref(`users/${phone}/lastPaymentAt`).set(new Date().toISOString());

  return {
    statusCode: 200,
    body: JSON.stringify({ credited: true, phone, coinsAdded: coinsToAdd })
  };
};
