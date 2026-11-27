exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: cors, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: "Use POST" };
  }

  try {
    const { phone, code } = JSON.parse(event.body || "{}");
    if (!phone || !code) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "phone and code required" }) };
    }

    const username = (process.env.AT_USERNAME || "").trim();
    const apiKey = (process.env.AT_API_KEY || "").trim();
    if (!username || !apiKey) {
      return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "AT_USERNAME or AT_API_KEY not set" }) };
    }

    const endpoint = username === "sandbox"
      ? "https://api.sandbox.africastalking.com/version1/messaging"
      : "https://api.africastalking.com/version1/messaging";

    const params = new URLSearchParams({
      username,
      to: phone,
      message: `Your BANDUCOINS password reset code is ${code}. Valid for 5 minutes. Do not share it.`
    });

    if (process.env.AT_SENDER_ID) {
      params.set("from", process.env.AT_SENDER_ID.trim());
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "apiKey": apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json"
      },
      body: params.toString()
    });

    const data = await res.json();
    const recipient = data?.SMSMessageData?.Recipients?.[0];
    if (res.ok && recipient && [100, 101, 102].includes(recipient.statusCode)) {
      return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, status: recipient.status }) };
    }

    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "SMS failed", details: data }) };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
};
