const { getStore, connectLambda } = require("@netlify/blobs");

function norm(ph) {
  let s = String(ph || "").replace("+", "").replace(/\s/g, "");
  if (s.startsWith("0")) s = "254" + s.slice(1);
  return s;
}

exports.handler = async (event) => {
  try {
    connectLambda(event);
    const store = getStore("wallets");

    if (event.httpMethod === "GET") {
      const phone = norm(event.queryStringParameters?.phone);
      if (!phone) return { statusCode: 400, body: JSON.stringify({ error: "Missing phone" }) };
      let wallet = await store.get(phone, { type: "json" });
      if (!wallet) {
        wallet = { coins: 100, subcoins: 0 };
        await store.setJSON(phone, wallet);
      }
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(wallet) };
    }

    const body = JSON.parse(event.body || "{}");
    const phone = norm(body.phone);
    if (!phone) return { statusCode: 400, body: JSON.stringify({ error: "Phone required" }) };

    if (body.sync) {
      let wallet = await store.get(phone, { type: "json" });
      if (!wallet) {
        wallet = { coins: Number(body.coins ?? 100), subcoins: Number(body.subcoins ?? 0) };
        await store.setJSON(phone, wallet);
      }
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(wallet) };
    }

    if (process.env.ADMIN_PASS && body.adminPass !== process.env.ADMIN_PASS) {
      return { statusCode: 401, body: JSON.stringify({ error: "Wrong admin password" }) };
    }

    const coins = Number(body.coins || body.amount || 0);
    if (!coins) return { statusCode: 400, body: JSON.stringify({ error: "Coins required" }) };

    const user = (await store.get(phone, { type: "json" })) || { coins: 100, subcoins: 0 };
    user.coins = (user.coins || 0) + coins;
    await store.setJSON(phone, user);

    return { statusCode: 200, body: JSON.stringify({ success: true, newBalance: user.coins }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
