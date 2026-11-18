exports.handler = async (event) => {
  const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
  try {
    if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "{}" };
    if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed, use POST" }) };
    const { amount, phone, coins, type } = JSON.parse(event.body || "{}");
    if (!amount || !phone || !coins) return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing amount, phone or coins" }) };
    const KEY = process.env.PESAPAL_CONSUMER_KEY;
    const SECRET = process.env.PESAPAL_CONSUMER_SECRET;
    const IPN_ID = process.env.PESAPAL_IPN_ID;
    if (!KEY || !SECRET || !IPN_ID) return { statusCode: 500, headers, body: JSON.stringify({ error: "Missing Pesapal env vars in Netlify" }) };
    const authRes = await fetch("https://pay.pesapal.com/v3/api/Auth/RequestToken", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ consumer_key: KEY, consumer_secret: SECRET })
    });
    const authText = await authRes.text();
    let auth; try { auth = JSON.parse(authText); } catch { return { statusCode: 500, headers, body: JSON.stringify({ error: "Pesapal Auth failed: " + authText.slice(0,300) }) }; }
    if (!auth.token) return { statusCode: 500, headers, body: JSON.stringify({ error: "No Pesapal token: " + JSON.stringify(auth).slice(0,300) }) };
    const orderId = "BANDU-" + Date.now() + "-" + Math.floor(Math.random()*1000);
    const orderRes = await fetch("https://pay.pesapal.com/v3/api/Transactions/SubmitOrderRequest", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: "Bearer " + auth.token },
      body: JSON.stringify({
        id: orderId, currency: "KES", amount: Number(amount),
        description: "BANDU " + coins + " " + (type === "sub" ? "Subcoins" : "Coins"),
        callback_url: "https://banduconnet.netlify.app/payment-success.html?order_id=" + orderId + "&coins=" + coins + "&type=" + (type || "coin"),
        notification_id: IPN_ID,
        billing_address: { email_address: phone + "@banducoins.com", phone_number: phone, first_name: "Bandu", last_name: "User" }
      })
    });
    const orderText = await orderRes.text();
    let order; try { order = JSON.parse(orderText); } catch { return { statusCode: 500, headers, body: JSON.stringify({ error: "Pesapal Order failed: " + orderText.slice(0,300) }) }; }
    if (!order.redirect_url) return { statusCode: 500, headers, body: JSON.stringify({ error: "No redirect_url: " + JSON.stringify(order).slice(0,400) }) };
    return { statusCode: 200, headers, body: JSON.stringify({ redirect_url: order.redirect_url, order_tracking_id: order.order_tracking_id, order_id: orderId }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
