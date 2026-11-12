const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const { phone, password } = JSON.parse(event.body);
  
  let normalized = phone.replace('+','').replace(/\s/g,'');
  if (normalized.startsWith('0')) normalized = '254' + normalized.slice(1);

  const store = getStore('wallets');
  const user = await store.get(normalized, { type: 'json' });
  
  if (!user || user.password !== password) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Wrong phone or password' }) };
  }

  return { statusCode: 200, body: JSON.stringify({ success: true, gameName: user.gameName, coins: user.coins, ageGroup: user.ageGroup }) };
};
