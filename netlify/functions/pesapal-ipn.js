exports.handler = async (event) => {
  console.log("IPN received:", event.body, event.queryStringParameters);
  // For now just say OK - Pesapal needs 200 OK
  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
