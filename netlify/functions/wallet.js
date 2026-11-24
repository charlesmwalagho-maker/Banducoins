const { getStore, connectLambda } = require("@netlify/blobs");

function norm(ph) {
  let s = String(ph || "").replace("+", "").replace(/\s/g, "");
  if (s.startsWith("0")) s = "254" + s.slice(1);
  return s;
}

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    connectLambda(event);
    const store = getStore("wallets");

    if (event.httpMethod === "GET") {
      const phone = norm(event.queryStringParameters?.phone);
      if (!phone) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing phone" }) };
      }
      let wallet = await store.get(phone, { type: "json" });
      if (!wallet) {
        wallet = { coins: 100, subcoins: 0 };
        await store.setJSON(phone, wallet);
      }
      return { statusCode: 200, headers, body: JSON.stringify(wallet) };
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const phone = norm(body.phone);
      if (!phone) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing phone" }) };
      }
      const existing = (await store.get(phone, { type: "json" })) || { coins: 100, subcoins: 0 };
      if (!body.syncOnly) {
        if (typeof body.coins === "number") existing.coins = body.coins;
        if (typeof body.subcoins === "number") existing.subcoins = body.subcoins;
        await store.setJSON(phone, existing);
      } else {
        await store.setJSON(phone, existing);
      }
      return { statusCode: 200, headers, body: JSON.stringify(existing) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
