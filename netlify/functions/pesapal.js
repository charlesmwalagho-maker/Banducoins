// netlify/functions/pesapal.js
// Fixed - uses only Netlify Env Variables, no hardcoded values, always LIVE

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const amount = body.amount;
    const description = body.description;
    const email = body.email;
    const phone = body.phone;
    const firstName = body.firstName;
    const lastName = body.lastName;

    if (!amount) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Amount is required" }) };
    }

    const CONSUMER_KEY = process.env.PESAPAL_CONSUMER_KEY;
    const CONSUMER_SECRET = process.env.PESAPAL_CONSUMER_SECRET;
    const IPN_ID = process.env.PESAPAL_IPN_ID || "";

    if (!CONSUMER_KEY || !CONSUMER_SECRET) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Pesapal keys missing in Netlify" }) };
    }

    const isLive = true;
    const BASE_URL = isLive
      ? "https://pay.pesapal.com/pesapalv3"
      : "https://cybqa.pesapal.com/pesapalv3";

    const authRes = await fetch(`${BASE_URL}/api/Auth/RequestToken`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        consumer_key: CONSUMER_KEY,
        consumer_secret: CONSUMER_SECRET,
      }),
    });

    const authData = await authRes.json();
    if (!authData.token) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Failed to get Pesapal token", details: authData }) };
    }
    const token = authData.token;

    const orderId = "ORDER-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
    const siteUrl = process.env.URL || "https://banducoinnet.netlify.app";

    const orderRes = await fetch(`${BASE_URL}/api/Transactions/SubmitOrderRequest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        id: orderId,
        currency: "KES",
        amount: Number(amount),
        description: description || "Payment",
        callback_url: `${siteUrl}/payment-success.html?order_id=${orderId}`,
        notification_id: IPN_ID,
        billing_address: {
          email_address: email || "test@test.com",
          phone_number: phone || "",
          country_code: "KE",
          first_name: firstName || "Test",
          last_name: lastName || "User",
          line_1: "",
          line_2: "",
          city: "",
          state: "",
          postal_code: "",
          zip_code: "",
        },
      }),
    });

    const orderData = await orderRes.json();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        order_id: orderId,
        redirect_url: orderData.redirect_url,
        raw: orderData,
      }),
    };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
