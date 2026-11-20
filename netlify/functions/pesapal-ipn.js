exports.handler = async (event) => {
  try {
    const trackingId = event.queryStringParameters?.OrderTrackingId;
    const merchantRef = event.queryStringParameters?.OrderMerchantReference;
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
    if (status.payment_status_description !== "Completed") return { statusCode: 200, body: "Not completed: " + status.payment_status_description };

    // Parse: BANDU-COINS-254...-450-... OR BANDU-SUB-254...-500-...
    // Old format BANDU-254...-400-... = COINS for your old payments
    const parts = String(merchantRef).split("-");
    let buyType = "COINS";
    let phone, creditsToAdd;
    if (parts[1] === "COINS" || parts[1] === "SUB") {
      buyType = parts[1] === "SUB" ? "SUB" : "COINS";
      phone = parts[2];
      creditsToAdd = parseInt(parts[3] || "0", 10);
    } else {
      phone = parts[1];
      creditsToAdd = parseInt(parts[2] || "0", 10);
    }
    if (!phone || !creditsToAdd) return { statusCode: 200, body: "Bad merchant ref" };

    const FB_URL = process.env.FIREBASE_DATABASE_URL;
    const checkRes = await fetch(`${FB_URL}/payments/${trackingId}.json`);
    if (await checkRes.json()) return { statusCode: 200, body: "Already credited" };

    // *** DIFFERENTIATE HERE - MOST IMPORTANT ***
    // COINS -> users/{phone}/coins
    // SUBCOINS -> users/{phone}/subcoins
    // Never mix them
    const field = buyType === "SUB" ? "subcoins" : "coins";
    const getRes = await fetch(`${FB_URL}/users/${phone}/${field}.json`);
    const current = (await getRes.json()) || 0;
    const newTotal = Number(current) + creditsToAdd;

    await fetch(`${FB_URL}/users/${phone}/${field}.json`, { method: "PUT", body: JSON.stringify(newTotal) });
    await fetch(`${FB_URL}/payments/${trackingId}.json`, { method: "PUT", body: JSON.stringify({ phone, type: buyType, [field]: creditsToAdd, amount: status.amount, merchantRef, paidAt: new Date().toISOString() }) });

    console.log(`CREDITED ${creditsToAdd} ${field} to ${phone}. ${current} -> ${newTotal}`);
    return { statusCode: 200, body: JSON.stringify({ credited: true, phone, type: buyType, field, creditsToAdd, newTotal }) };
  } catch (e) {
    console.log("IPN error:", e.message);
    return { statusCode: 200, body: "OK" };
  }
};
