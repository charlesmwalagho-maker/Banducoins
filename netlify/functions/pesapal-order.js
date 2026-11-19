exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS" }, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Use POST" }) };
  }
  try {
    const { amount, phone, email } = JSON.parse(event.body || "{}");
    if (!amount || !phone) return { statusCode: 400, body: JSON.stringify({ error: "amount and phone required" }) };

    const BASE = "https://pay.pesapal.com/v3/api";

    // FIXED: Hardcoded IPN ID - your Active IPN from Pesapal
    // Env var was not reaching the function, so we don't rely on it anymore
    const IPN_ID = "a94ca34d-7528-4856-8691-d9a5325a7790";

    // 1. Get Token
    const authRes = await fetch(BASE + "/Auth/RequestToken", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ consumer_key: process.env.PESAPAL_CONSUMER_KEY, consumer_secret: process.env.PESAPAL_CONSUMER_SECRET }),
    });
    const auth = await authRes.json();
    if (!auth.token) return { statusCode: 500, body: JSON.stringify({ error: "No token - check keys", details: auth }) };

    // 2. Create Order
    const orderRes = await fetch(BASE + "/Transactions/SubmitOrderRequest", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json", "Authorization": "Bearer " + auth.token },
      body: JSON.stringify({
        id: "BANDU-" + Date.now(),
        currency: "KES",
        amount: Number(amount),
        description: "BanduCoins Purchase",
        callback_url: "https://banducoinet.netlify.app/",
        notification_id: IPN_ID,
        billing_address: { email_address: email || "user@banducoinet.com", phone_number: phone, country_code: "KE", first_name: "Bandu", last_name: "User", line_1: "Eldoret" }
      }),
    });
    const order = await orderRes.json();
    return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(order) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
