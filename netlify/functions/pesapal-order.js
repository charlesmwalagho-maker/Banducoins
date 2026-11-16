exports.handler = async (event) => {
  try{
    const { amount, phone, coins, type } = JSON.parse(event.body || "{}");
    const cleanPhone = "254" + String(phone).replace(/^0+/, "").replace(/^254/, "");
    
    // 1. Get token
    const authRes = await fetch("https://pay.pesapal.com/v3/api/Auth/RequestToken", {
      method: "POST",
      headers: {"Content-Type":"application/json","Accept":"application/json"},
      body: JSON.stringify({ consumer_key: process.env.PESAPAL_CONSUMER_KEY, consumer_secret: process.env.PESAPAL_CONSUMER_SECRET })
    });
    const auth = await authRes.json();
    if(!auth.token) return { statusCode: 500, body: JSON.stringify({ error: "No token - check keys", details: auth }) };

    // 2. Create order
    const orderRes = await fetch("https://pay.pesapal.com/v3/api/Transactions/SubmitOrderRequest", {
      method: "POST",
      headers: {"Content-Type":"application/json","Accept":"application/json","Authorization":"Bearer "+auth.token},
      body: JSON.stringify({
        id: "BANDU-" + Date.now(),
        currency: "KES",
        amount: Number(amount),
        description: (coins||"") + " " + (type||"Coins") + " for " + cleanPhone,
        callback_url: "https://banducoinnet.netlify.app/?paid=1",
        notification_id: process.env.PESAPAL_IPN_ID,
        billing_address: { phone_number: cleanPhone, email_address: "user@banducoins.com", country_code: "KE", first_name: "Bandu", last_name: "User", line_1: "Nairobi" }
      })
    });
    const order = await orderRes.json();
    return { statusCode: 200, body: JSON.stringify(order) };
  }catch(e){ return { statusCode: 500, body: JSON.stringify({ error: e.message }) }; }
};
