exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: ""
    };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Use POST" }) };
  }

  try {
    const { amount, phone, email, type } = JSON.parse(event.body || "{}");
    if (!amount || !phone) {
      return { statusCode: 400, body: JSON.stringify({ error: "amount and phone required" }) };
    }

    const BASE = "https://pay.pesapal.com/v3/api";
    const IPN_ID = process.env.PESAPAL_IPN_ID;
    if (!IPN_ID) {
      return { statusCode: 500, body: JSON.stringify({ error: "PESAPAL_IPN_ID not set in Netlify" }) };
    }

    const amt = Number(amount);

    let buyType = (type || "").toLowerCase();
    if (buyType.includes("sub")) buyType = "SUB";
    else if (buyType.includes("coin")) buyType = "COINS";
    else {
      if ([200, 500, 1000].includes(amt)) buyType = "SUB";
      else buyType = "COINS";
    }

    let credits = 0;
    if (buyType === "COINS") {
      if (amt === 20) credits = 450;
      else if (amt === 30) credits = 600;
      else if (amt === 50) credits = 1000;
      else if (amt === 100) credits = 2500;
      else credits = Math.floor(amt * 22.5);
    } else {
      if (amt === 200) credits = 200;
      else if (amt === 500) credits = 500;
      else if (amt === 1000) credits = 1000;
      else credits = amt;
    }

    let cleanPhone = String(phone).replace("+", "").replace(/\s/g, "").trim();
    if (cleanPhone.startsWith("0")) cleanPhone = "254" + cleanPhone.slice(1);
    const merchantRef = `BANDU-${buyType}-${cleanPhone}-${credits}-${Date.now()}`;

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

    const siteUrl = process.env.URL || ((event.headers["x-forwarded-proto"] || "https") + "://" + event.headers.host);

    const orderRes = await fetch(BASE + "/Transactions/SubmitOrderRequest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": "Bearer " + auth.token
      },
      body: JSON.stringify({
        id: merchantRef,
        currency: "KES",
        amount: amt,
        description: `Bandu ${buyType === "COINS" ? "Coins" : "Subcoins"} - ${credits} ${buyType === "COINS" ? "coins" : "subcoins"}`,
        callback_url: siteUrl + "/",
        notification_id: IPN_ID,
        billing_address: {
          email_address: email || "user@banducoinet.com",
          phone_number: cleanPhone,
          country_code: "KE",
          first_name: "Bandu",
          last_name: "User",
          line_1: "Eldoret"
        }
      })
    });
    const order = await orderRes.json();
    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(order)
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
