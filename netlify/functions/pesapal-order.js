exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const amount = Number(body.amount || 20);
    const phone = (body.phone || "").replace(/^0/, "254");
    const coins = body.coins || 450;
    const type = body.type || "coin";

    // 1. Get token
    const authRes = await fetch("https://pay.pesapal.com/v3/api/Auth/RequestToken", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        consumer_key: process.env.PESAPAL_CONSUMER_KEY,
        consumer_secret: process.env.PESAPAL_CONSUMER_SECRET,
      }),
    });
    const auth = await authRes.json();
    if (!auth.token) return { statusCode: 500, body: JSON.stringify({ error: auth }) };

    const siteUrl = process.env.URL || "https://banduconnet.netlify.app";
    const ipnId = process.env.PESAPAL_IPN_ID;

    // 2. Submit order - Pesapal v3 needs notification_id, NOT ipn_id
    const orderRes = await fetch("https://pay.pesapal.com/v3/api/Transactions/SubmitOrderRequest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": "Bearer " + auth.token,
      },
      body: JSON.stringify({
        id: "BANDU-" + Date.now(),
        currency: "KES",
        amount: amount,
        description: coins + (type === "sub" ? " Subcoins" : " Coins") + " - BANDUCOINS",
        callback_url: siteUrl + "/?paid=1",
        notification_id: ipnId,
        billing_address: {
          email_address: "banducoins@gmail.com",
          phone_number: phone,
          country_code: "KE",
          first_name: "BANDU",
          last_name: "USER",
          line_1: "Nairobi",
          city: "Nairobi",
          state: "Nairobi",
          postal_code: "00100",
          zip_code: "00100",
        },
      }),
    });
    const order = await orderRes.json();
    return { statusCode: 200, body: JSON.stringify(order) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
