exports.handler = async () => {
  try{
    // 1. Get token
    const authRes = await fetch("https://pay.pesapal.com/v3/api/Auth/RequestToken", {
      method: "POST",
      headers: {"Content-Type":"application/json","Accept":"application/json"},
      body: JSON.stringify({ consumer_key: process.env.PESAPAL_CONSUMER_KEY, consumer_secret: process.env.PESAPAL_CONSUMER_SECRET })
    });
    const auth = await authRes.json();
    if(!auth.token) return { statusCode: 500, body: JSON.stringify({ error: "No token - check keys in Netlify", details: auth }) };

    // 2. Register IPN
    const ipnRes = await fetch("https://pay.pesapal.com/v3/api/URLSetup/RegisterIPN", {
      method: "POST",
      headers: {"Content-Type":"application/json","Accept":"application/json","Authorization":"Bearer "+auth.token},
      body: JSON.stringify({
        url: "https://banducoinnet.netlify.app/.netlify/functions/pesapal-ipn",
        ipn_notification_type: "GET"
      })
    });
    const ipn = await ipnRes.json();
    return { statusCode: 200, body: JSON.stringify(ipn) };
  }catch(e){ return { statusCode: 500, body: JSON.stringify({ error: e.message }) }; }
};
