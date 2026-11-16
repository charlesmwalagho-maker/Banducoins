exports.handler = async () => {
  try {
    const isSandbox = (process.env.PESAPAL_ENV || "live").toLowerCase() === "sandbox";
    const BASE = isSandbox ? "https://cyber.pesapal.com" : "https://pay.pesapal.com";
    const authRes = await fetch(BASE + "/v3/api/Auth/RequestToken", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ consumer_key: process.env.PESAPAL_CONSUMER_KEY, consumer_secret: process.env.PESAPAL_CONSUMER_SECRET }),
    });
    const auth = await authRes.json();
    if (!auth.token) return { statusCode: 500, body: JSON.stringify({ error: "No token - check keys", details: auth }) };
    const siteUrl = process.env.URL || "https://banduconnet.netlify.app";
    const res = await fetch(BASE + "/v3/api/URLSetup/RegisterIPN", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json", "Authorization": "Bearer " + auth.token },
      body: JSON.stringify({ url: siteUrl + "/.netlify/functions/pesapal-ipn", ipn_notification_type: "GET" }),
    });
    const data = await res.json();
    return { statusCode: 200, body: JSON.stringify(data) };
  } catch (e) { return { statusCode: 500, body: JSON.stringify({ error: e.message }) }; }
};
