const { getStore, connectLambda } = require("@netlify/blobs");

exports.handler = async (event) => {
  try {
    const orderTrackingId = event.queryStringParameters?.orderTrackingId;
    if (!orderTrackingId) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing orderTrackingId" }) };
    }

    const BASE = "https://pay.pesapal.com/v3/api";

    const authRes = await fetch(BASE + "/Auth/RequestToken", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        consumer_key: process.env.PESAPAL_CONSUMER_KEY,
        consumer_secret: process.env.PESAPAL_CONSUMER_SECRET
      })
    });
    const auth = await authRes.json();
    if (!auth.token) {
      return { statusCode: 500, body: JSON.stringify({ error: "No token", details: auth }) };
    }

    const statusRes = await fetch(
      BASE + "/Transactions/GetTransactionStatus?orderTrackingId=" + encodeURIComponent(orderTrackingId),
      {
        method: "GET",
        headers: { "Accept": "application/json", "Authorization": "Bearer " + auth.token }
      }
    );
    const data = await statusRes.json();

    const parts = String(data.merchant_reference || "").split("-");
    const buyType = parts[1] === "SUB" ? "sub" : "coin";
    const phone = parts[2] || "";
    const credits = Number(parts[3] || 0);
    const isCompleted = String(data.payment_status_description || "").toLowerCase() === "completed" || data.status_code === 1;

    if (isCompleted && phone && credits > 0) {
      try {
        connectLambda(event);
        const orders = getStore("orders");
        const already = await orders.get(orderTrackingId, { type: "json" });
        if (!already) {
          const wallets = getStore("wallets");
          const wallet = (await wallets.get(phone, { type: "json" })) || { coins: 100, subcoins: 0 };
          if (buyType === "sub") wallet.subcoins = (wallet.subcoins || 0) + credits;
          else wallet.coins = (wallet.coins || 0) + credits;
          await wallets.setJSON(phone, wallet);
          await orders.setJSON(orderTrackingId, { credited: true, phone, buyType, credits, at: Date.now() });
        }
      } catch (blobErr) {}
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ...data, buyType, credits, phone })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
