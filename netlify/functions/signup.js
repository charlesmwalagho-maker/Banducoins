const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const { phone, password, gameName, ageGroup } = JSON.parse(event.body);
  
  let normalized = phone.replace('+','').replace(/\s/g,'');
  if (normalized.startsWith('0')) normalized = '254' + normalized.slice(1);

  const store = getStore('wallets');
  let existing = await store.get(normalized, { type: 'json' });
  if (existing) return { statusCode: 400, body: JSON.stringify({ error: 'Account already exists, please login' }) };

  const user = { coins: 0, gameName, password, ageGroup, transactions: [] };
  await store.setJSON(normalized, user);

  return { statusCode: 200, body: JSON.stringify({ success: true }) };
};
