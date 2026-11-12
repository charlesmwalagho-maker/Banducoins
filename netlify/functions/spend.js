const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const { phone, action, videoId, toPhone } = JSON.parse(event.body);
  
  // FINAL BANDUCOINS RULES
  const costs = {
    upload: 5,     // Upload Video = 5 coins
    watch: 1,      // Watch Video = 1 coin per video
    send_sms: 1,   // Send Inbox SMS = 1 coin
    share: 1       // Share Video = 1 coin
    // receive_sms = FREE - we don't charge it
  };

  const cost = costs[action];
  if (cost === undefined) return { statusCode: 400, body: JSON.stringify({ error: 'Invalid action' }) };

  let normalized = phone.replace('+','').replace(/\s/g,'');
  if (normalized.startsWith('0')) normalized = '254' + normalized.slice(1);

  const store = getStore('wallets');
  const user = await store.get(normalized, { type: 'json' });
  if (!user) return { statusCode: 400, body: JSON.stringify({ error: 'No wallet found' }) };

  if (user.coins < cost) {
    return { statusCode: 400, body: JSON.stringify({ error: `Not enough coins. You have ${user.coins}, need ${cost}.`, balance: user.coins, needBuy: true }) };
  }

  user.coins -= cost;
  user.transactions.push({ action, cost, videoId, toPhone, date: new Date().toISOString() });
  await store.setJSON(normalized, user);

  return { statusCode: 200, body: JSON.stringify({ success: true, balance: user.coins, spent: cost }) };
};
