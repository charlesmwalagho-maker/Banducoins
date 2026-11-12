const { getStore } = require('@netlify/blobs');
exports.handler = async (event) => {
  const { phone, password } = JSON.parse(event.body);
  let normalized = phone.replace('+','').replace(/\s/g,'');
  if (normalized.startsWith('0')) normalized = '254' + normalized.slice(1);
  const store = getStore('wallets');
  const user = await store.get(normalized, { type: 'json' });
  if (!user) return { statusCode: 404, body: JSON.stringify({ error: 'Account not found. Please Sign Up first' }) };
  if (user.password !== password) return { statusCode: 401, body: JSON.stringify({ error: 'Wrong password' }) };
  return { statusCode: 200, body: JSON.stringify({ success: true, coins: user.coins, gameName: user.gameName }) };
};
