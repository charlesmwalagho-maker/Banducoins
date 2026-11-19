exports.handler = async () => {
  try {
    const BASE = "https://pay.pesapal.com/v3/api";
    const authRes = await fetch(BASE + "/Auth/RequestToken", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ consumer_key: process.env.PESAPAL_CONSUMER_KEY, consumer_secret: process.env.PESAPAL_CONSUMER_SECRET }),
    });
    const auth = await authRes.json();
    if (!auth.token) return { statusCode: 500, body: JSON.stringify({ error: "No token - keys wrong", details: auth }) };
    const res = await fetch(BASE + "/URLSetup/GetIpnList", {
      headers: { "Accept": "application/json", "Authorization": "Bearer " + auth.token },
    });
    const data = await res.json();
    return { statusCode: 200, body: JSON.stringify({ ENV_IPN_ID: process.env.PESAPAL_IPN_ID || "EMPTY - NOT SET", IPN_LIST_FROM_PESAPAL: data }) };
  } catch (e) { return { statusCode: 500, body: JSON.stringify({ error: e.message }) }; }
};
