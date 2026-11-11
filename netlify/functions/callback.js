exports.handler = async (event) => {
  console.log("CALLBACK RECEIVED:", event.body);

  try {
    const data = JSON.parse(event.body);
    const stkCallback = data.Body?.stkCallback;

    if (!stkCallback) {
      return { statusCode: 200, body: JSON.stringify({ message: "No stkCallback" }) };
    }

    const resultCode = stkCallback.ResultCode;
    const resultDesc = stkCallback.ResultDesc;
    const checkoutRequestID = stkCallback.CheckoutRequestID;

    console.log(`Payment ${checkoutRequestID}: Code=${resultCode}, Desc=${resultDesc}`);

    if (resultCode === 0) {
      // Payment SUCCESS
      // Find amount + phone from CallbackMetadata
      const metadata = stkCallback.CallbackMetadata?.Item || [];
      const getValue = (name) => {
        const item = metadata.find(i => i.Name === name);
        return item ? item.Value : null;
      };

      const amount = getValue("Amount");
      const mpesaReceipt = getValue("MpesaReceiptNumber");
      const phone = getValue("PhoneNumber");

      console.log(`SUCCESS: ${phone} paid ${amount} KES, Receipt: ${mpesaReceipt}`);
      // TODO: Here you would give the user their coins in your database
    } else {
      console.log(`FAILED / CANCELLED: ${resultDesc}`);
    }

    // MUST return 200 or Safaricom will retry
    return {
      statusCode: 200,
      body: JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" })
    };

  } catch (err) {
    console.error("Callback error:", err);
    return {
      statusCode: 200,
      body: JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" })
    };
  }
};
