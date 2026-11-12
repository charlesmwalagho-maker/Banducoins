const { getStore } = require('@netlify/blobs');
exports.handler = async (event) => {
  const phone = event.queryStringParameters.phone || "";
  let normalized = phone.replace('+','').replace(/\s/g,'');
  if (normalized.startsWith('0')) normalized = '254' + normalized.slice(1);
  const store = getStore('wallets');
  const user = await store.get(normalized, { type: 'json' }) || { coins: 0, gameName: '', transactions: [] };
  return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(user) };
};
