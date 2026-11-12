const { getStore } = require('@netlify/blobs');
exports.handler = async (event) => {
  const { phone, password, gameName } = JSON.parse(event.body);
  let normalized = phone.replace('+','').replace(/\s/g,'');
  if (normalized.startsWith('0')) normalized = '254' + normalized.slice(1);
  const store = getStore('wallets');
  const exists = await store.get(normalized, { type: 'json' });
  if (exists) return { statusCode: 400, body: JSON.stringify({ error: 'Account exists, please login' }) };
  const user = { phone: normalized, password, gameName: gameName || 'Player', coins: 0 };
  await store.setJSON(normalized, user);
  return { statusCode: 200, body: JSON.stringify({ success: true, gameName: user.gameName, coins: 0 }) };
};
