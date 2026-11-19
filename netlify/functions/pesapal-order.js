exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS" }, body: "" };
  }
  if (event.httpMethod !== "POST") return { statusCode: 405, body: JSON.stringify({ error: "Use POST" }) };

  try {
    const { amount, phone, email } = JSON.parse(event.body || "{}");
    if (!amount || !phone) return { statusCode: 400, body: JSON.stringify({ error: "amount and phone required" }) };

    const BASE = "https://pay.pesapal.com/v3/api";
    const IPN_ID = "a94ca34d-7528-4856-8691-d9a5325a7799";

    // 1 KSh = 10 coins. 20 KSh = 200 coins, 45 KSh = 450 coins, etc.
    // Works for ANY customer, ANY amount
    const coins = Math.floor(Number(amount) * 10);
    const cleanPhone = String(phone).replace("+", "").replace(/\s/g, "").trim();
    // Example: BANDU-254712345678-200-1763590000
    // phone changes for every customer
    const merchantRef = `BANDU-${cleanPhone}-${coins}-${Date.now()}`;

    const authRes = await fetch(BASE + "/Auth/RequestToken", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ consumer_key: process.env.PESAPAL_CONSUMER_KEY, consumer_secret: process.env.PESAPAL_CONSUMER_SECRET }),
    });
    const auth = await authRes.json();
    if (!auth.token) return { statusCode: 500, body: JSON.stringify({ error: "No token", details: auth }) };

    const orderRes = await fetch(BASE + "/Transactions/SubmitOrderRequest", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json", "Authorization": "Bearer " + auth.token },
      body: JSON.stringify({
        id: merchantRef,
        currency: "KES",
        amount: Number(amount),
        description: "BanduCoins - " + coins + " coins",
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
