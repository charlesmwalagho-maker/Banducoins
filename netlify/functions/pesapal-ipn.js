exports.handler = async (event) => {
  try {
    console.log("IPN received:", event.queryStringParameters);

    const trackingId = event.queryStringParameters?.OrderTrackingId;
    const merchantRef = event.queryStringParameters?.OrderMerchantReference;
    if (!trackingId) return { statusCode: 200, body: "No tracking ID" };

    const BASE = "https://pay.pesapal.com/v3/api";

    // 1. Get Token
    const authRes = await fetch(BASE + "/Auth/RequestToken", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ consumer_key: process.env.PESAPAL_CONSUMER_KEY, consumer_secret: process.env.PESAPAL_CONSUMER_SECRET }),
    });
    const auth = await authRes.json();

    // 2. Ask Pesapal: Did this person REALLY pay?
    const statusRes = await fetch(BASE + "/Transactions/GetTransactionStatus?orderTrackingId=" + trackingId, {
      headers: { "Accept": "application/json", "Authorization": "Bearer " + auth.token },
    });
    const status = await statusRes.json();
    console.log("Payment status for", merchantRef, status);

    // 3. If COMPLETED, add coins here
    if (status.payment_status_description === "Completed") {
      console.log("PAYMENT COMPLETED - ADD COINS FOR:", merchantRef, "Amount:", status.amount);
      // TODO: Add coins to user in your database here
      // You need to tell me where coins are stored - see below
    }

    return { statusCode: 200, body: JSON.stringify({ received: true, status }) };
  } catch (e) {
    console.log("IPN error:", e.message);
    return { statusCode: 200, body: "OK" }; // Always return 200 so Pesapal doesn't retry forever
  }
};
