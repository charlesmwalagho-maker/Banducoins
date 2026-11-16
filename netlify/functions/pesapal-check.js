exports.handler = async (event) => {
  try {
    const trackingId = event.queryStringParameters.trackingId;
    const isSandbox = (process.env.PESAPAL_ENV || "live").toLowerCase() === "sandbox";
    const BASE = isSandbox ? "https://cyber.pesapal.com" : "https://pay.pesapal.com";
    const authRes = await fetch(BASE + "/v3/api/Auth/RequestToken", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ consumer_key: process.env.PESAPAL_CONSUMER_KEY, consumer_secret: process.env.PESAPAL_CONSUMER_SECRET }),
    });
    const auth = await authRes.json();
    if (!auth.token) return { statusCode: 500, body: JSON.stringify({ error: auth }) };
    const res = await fetch(BASE + "/v3/api/Transactions/GetTransactionStatus?orderTrackingId=" + encodeURIComponent(trackingId), {
      headers: { "Authorization": "Bearer " + auth.token, "Accept": "application/json" },
    });
    const data = await res.json();
    return { statusCode: 200, body: JSON.stringify(data) };
  } catch (e) { return { statusCode: 500, body: JSON.stringify({ error: e.message }) }; }
};
