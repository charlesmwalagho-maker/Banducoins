exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const amount = Number(body.amount || 20);
    const phone = (body.phone || "").replace(/^0/, "254");
    const coins = body.coins || 450;
    const type = body.type || "coin";
    const BASE = "https://pay.pesapal.com/pesapalv3";
    const authRes = await fetch(BASE + "/api/Auth/RequestToken", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ consumer_key: process.env.PESAPAL_CONSUMER_KEY, consumer_secret: process.env.PESAPAL_CONSUMER_SECRET }),
    });
    const auth = await authRes.json();
    if (!auth.token) return { statusCode: 500, body: JSON.stringify({ error: auth }) };
    const siteUrl = process.env.URL || "https://banduconnet.netlify.app";
    const orderRes = await fetch(BASE + "/api/Transactions/SubmitOrderRequest", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json", "Authorization": "Bearer " + auth.token },
      body: JSON.stringify({
        id: "BANDU-" + Date.now(),
        currency: "KES",
        amount: amount,
        description: coins + (type === "sub" ? " Subcoins" : " Coins") + " - BANDUCOINS",
        callback_url: siteUrl + "/?paid=1",
        notification_id: (process.env.PESAPAL_IPN_ID || "").trim(),
        billing_address: { email_address: "banducoins@gmail.com", phone_number: phone, country_code: "KE", first_name: "BANDU", last_name: "USER", line_1: "Nairobi", city: "Nairobi", state: "Nairobi", postal_code: "00100", zip_code: "00100" },
      }),
    });
    const order = await orderRes.json();
    return { statusCode: 200, body: JSON.stringify(order) };
  } catch (e) { return { statusCode: 500, body: JSON.stringify({ error: e.message }) }; }
};
