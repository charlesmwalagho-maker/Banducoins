const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 200, body: 'OK' };
  const { phone, amount, code, gameName } = JSON.parse(event.body);

  const priceMap = { 20: 450, 30: 600, 50: 1500 };
  const coins = priceMap[Number(amount)];
  if (!coins) return { statusCode: 400, body: JSON.stringify({ error: 'Invalid amount. Use 20, 30 or 50' }) };

  let normalized = phone.replace('+','').replace(/\s/g,'');
  if (normalized.startsWith('0')) normalized = '254' + normalized.slice(1);

  const store = getStore('wallets');
  const user = await store.get(normalized, { type: 'json' }) || { coins: 0, gameName: '', transactions: [] };

  // Prevent double crediting same M-PESA code
  if (user.transactions.some(t => t.code === code)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'This code already used!' }) };
  }

  user.coins += coins;
  user.gameName = gameName;
  user.transactions.push({ code, amount: Number(amount), coins, date: new Date().toISOString() });
  await store.setJSON(normalized, user);

  return { statusCode: 200, body: JSON.stringify({ success: true, balance: user.coins, gameName }) };
};
