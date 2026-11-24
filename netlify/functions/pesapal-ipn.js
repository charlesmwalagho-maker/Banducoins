const { getStore, connectLambda } = require("@netlify/blobs");

exports.handler = async (event) => {
  try {
    const q = event.queryStringParameters || {};
    let b = {};
    try { b = JSON.parse(event.body || "{}"); } catch (e) {}

    const OrderTrackingId = q.OrderTrackingId || q.orderTrackingId || b.OrderTrackingId || b.orderTrackingId;
    const OrderMerchantReference = q.OrderMerchantReference || q.orderMerchantReference || b.OrderMerchantReference || b.orderMerchantReference;
    const OrderNotificationType = q.OrderNotificationType || b.OrderNotificationType || "IPNCHANGE";

    if (!OrderTrackingId) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing OrderTrackingId" }) };
    }

    const BASE = "https://pay.pesapal.com/v3/api";

    // 1. Get Pesapal Token
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
      return { statusCode: 500, body: JSON.stringify({ error: "Pesapal auth failed", details: auth }) };
    }

    // 2. Verify real payment status with Pesapal
    const statusRes = await fetch(
      BASE + "/Transactions/GetTransactionStatus?orderTrackingId=" + encodeURIComponent(OrderTrackingId),
      {
        method: "GET",
        headers: { "Accept": "application/json", "Authorization": "Bearer " + auth.token }
      }
    );
    const data = await statusRes.json();

    const ref = data.merchant_reference || OrderMerchantReference || "";
    const parts = String(ref).split("-");
    const buyType = parts[1] === "SUB" ? "sub" : "coin";
    const phone = parts[2] || "";
    const credits = parseInt(parts[3], 10) || 0;
    const isCompleted = String(data.payment_status_description || "").toLowerCase() === "completed" || data.status_code === 1;

    // 3. Credit wallet once if Completed
    if (isCompleted && phone && credits > 0) {
      connectLambda(event);
      const orders = getStore("orders");
      const already = await orders.get(OrderTrackingId, { type: "json" });

      if (!already) {
        const wallets = getStore("wallets");
        const wallet = (await wallets.get(phone, { type: "json" })) || { coins: 100, subcoins: 0 };
        if (buyType === "sub") wallet.subcoins = (wallet.subcoins || 0) + credits;
        else wallet.coins = (wallet.coins || 0) + credits;

        await wallets.setJSON(phone, wallet);
        await orders.setJSON(OrderTrackingId, {
          credited: true,
          phone,
          buyType,
          credits,
          merchantRef: ref,
          paidAt: new Date().toISOString()
        });
      }
    }

    // 4. Reply in Pesapal v3 IPN format
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderNotificationType: OrderNotificationType,
        orderTrackingId: OrderTrackingId,
        orderMerchantReference: ref,
        status: 200
      })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
