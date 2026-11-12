const { getStore } = require('@netlify/blobs');
exports.handler = async (event) => {
  const { phone, amount } = JSON.parse(event.body);
  let normalized = phone.replace('+','').replace(/\s/g,'');
  if (normalized.startsWith('0')) normalized = '254' + normalized.slice(1);
  const store = getStore('wallets');
  const user = await store.get(normalized, { type: 'json' });
  if (!user) return { statusCode: 404, body: JSON.stringify({ error: 'Account not found' }) };
  const cost = Number(amount);
  if (user.coins < cost) return { statusCode: 400, body: JSON.stringify({ error: 'Not enough coins. Buy more!' }) };
  user.coins -= cost;
  await store.setJSON(normalized, user);
  return { statusCode: 200, body: JSON.stringify({ success: true, newBalance: user.coins }) };
};
