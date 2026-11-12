const { getStore } = require('@netlify/blobs');
exports.handler = async (event) => {
  const body = JSON.parse(event.body);
  const phone = body.phone;
  const coins = Number(body.coins || body.amount || 0);
  let normalized = phone.replace('+','').replace(/\s/g,'');
  if (normalized.startsWith('0')) normalized = '254' + normalized.slice(1);
  const store = getStore('wallets');
  const user = await store.get(normalized, { type: 'json' });
  if (!user) return { statusCode: 404, body: JSON.stringify({ error: 'User not found. Ask them to Sign Up first' }) };
  user.coins = (user.coins || 0) + coins;
  await store.setJSON(normalized, user);
  return { statusCode: 200, body: JSON.stringify({ success: true, newBalance: user.coins }) };
};
