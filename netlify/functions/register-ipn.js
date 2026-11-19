exports.handler = async () => {
  try {
    const BASE = "https://pay.pesapal.com/v3/api";
    const authRes = await fetch(BASE + "/Auth/RequestToken", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ consumer_key: process.env.PESAPAL_CONSUMER_KEY, consumer_secret: process.env.PESAPAL_CONSUMER_SECRET }),
    });
    const auth = await authRes.json();
    if (!auth.token) return { statusCode: 500, body: JSON.stringify({ error: "No token - check keys", details: auth }) };
    const siteUrl = "https://banducoinet.netlify.app";
    const res = await fetch(BASE + "/URLSetup/RegisterIPN", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json", "Authorization": "Bearer " + auth.token },
      body: JSON.stringify({ url: siteUrl + "/.netlify/functions/pesapal-ipn", ipn_notification_type: "GET" }),
    });
    const data = await res.json();
    return { statusCode: 200, body: JSON.stringify(data) };
  } catch (e) { return { statusCode: 500, body: JSON.stringify({ error: e.message }) }; }
}
