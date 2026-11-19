exports.handler = async (event) => {
  try {
    const trackingId = event.queryStringParameters?.OrderTrackingId;
    const merchantRef = event.queryStringParameters?.OrderMerchantReference;
    console.log("IPN received:", merchantRef, trackingId);
    if (!trackingId || !merchantRef) return { statusCode: 200, body: "No tracking" };

    const BASE = "https://pay.pesapal.com/v3/api";
    const authRes = await fetch(BASE + "/Auth/RequestToken", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ consumer_key: process.env.PESAPAL_CONSUMER_KEY, consumer_secret: process.env.PESAPAL_CONSUMER_SECRET }),
    });
    const auth = await authRes.json();

    const statusRes = await fetch(BASE + "/Transactions/GetTransactionStatus?orderTrackingId=" + trackingId, {
      headers: { "Accept": "application/json", "Authorization": "Bearer " + auth.token },
    });
    const status = await statusRes.json();
    console.log("Payment status:", status);

    if (status.payment_status_description !== "Completed") {
      return { statusCode: 200, body: "Not completed yet: " + status.payment_status_description };
    }

    // Parse: BANDU-254712345678-200-1763590000
    // phone = whoever paid, coins = how much they bought
    const parts = String(merchantRef).split("-");
    const phone = parts[1];
    const coinsToAdd = parseInt(parts[2] || "0", 10);
    if (!phone || !coinsToAdd) return { statusCode: 200, body: "Bad merchant ref" };

    // Prevent double-credit: if we already processed this trackingId, stop
    const FB_URL = process.env.FIREBASE_DATABASE_URL; // https://banducoins-default-rtdb.firebaseio.com
    const checkRes = await fetch(`${FB_URL}/payments/${trackingId}.json`);
    const already = await checkRes.json();
    if (already) {
      console.log("Already credited, skipping:", trackingId);
      return { statusCode: 200, body: "Already credited" };
    }

    // --- ADD COINS TO THAT CUSTOMER'S ACCOUNT ---
    const getRes = await fetch(`${FB_URL}/users/${phone}/coins.json`);
    const currentCoins = (await getRes.json()) || 0;
    const newTotal = Number(currentCoins) + coinsToAdd;

    await fetch(`${FB_URL}/users/${phone}/coins.json`, {
      method: "PUT",
      body: JSON.stringify(newTotal)
    });

    await fetch(`${FB_URL}/payments/${trackingId}.json`, {
      method: "PUT",
      body: JSON.stringify({ phone, coins: coinsToAdd, amount: status.amount, merchantRef, paidAt: new Date().toISOString() })
    });

    console.log(`CREDITED ${coinsToAdd} to ${phone}. ${currentCoins} -> ${newTotal}`);
    return { statusCode: 200, body: JSON.stringify({ credited: true, phone, coinsToAdd, newTotal }) };
  } catch (e) {
    console.log("IPN error:", e.message);
    return { statusCode: 200, body: "OK" };
  }
};
