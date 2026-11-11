javascript
exports.handler = async (event) => {
 if (event.httpMethod !== 'POST') {
 return { statusCode: 405, body: JSON.stringify({ success: false, message: 'Only POST allowed' }) };
 }
 try {
 const { phone, amount } = JSON.parse(event.body || '{}');
 if (!phone || !amount) return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Phone and amount required' }) };
 let cleanPhone = phone.toString().trim().replace(/\s/g, '');
 if (cleanPhone.startsWith('0')) cleanPhone = '254' + cleanPhone.slice(1);
 if (cleanPhone.startsWith('+')) cleanPhone = cleanPhone.slice(1);
 const consumerKey = process.env.DARAJA_CONSUMER_KEY;
 const consumerSecret = process.env.DARAJA_CONSUMER_SECRET;
 const passkey = process.env.DARAJA_PASSKEY;
 const shortcode = '174379';
 const baseUrl = 'https://sandbox.safaricom.co.ke';
 const auth = Buffer.from(consumerKey + ':' + consumerSecret).toString('base64');
 const tokenRes = await fetch(baseUrl + '/oauth/v1/generate?grant_type=client_credentials', { headers: { Authorization: 'Basic ' + auth } });
 const tokenData = await tokenRes.json();
 const token = tokenData.access_token;
 const now = new Date();
 const timestamp = now.getFullYear().toString() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0') + String(now.getSeconds()).padStart(2, '0');
 const password = Buffer.from(shortcode + passkey + timestamp).toString('base64');
 const stkRes = await fetch(baseUrl + '/mpesa/stkpush/v1/processrequest', {
 method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
 body: JSON.stringify({ BusinessShortCode: shortcode, Password: password, Timestamp: timestamp, TransactionType: 'CustomerPayBillOnline', Amount: amount, PartyA: cleanPhone, PartyB: shortcode, PhoneNumber: cleanPhone, CallBackURL: 'https://banducoinsnet.netlify.app/.netlify/functions/callback', AccountReference: 'BanduCoins', TransactionDesc: 'Buy BanduCoins' })
 });
 const stkData = await stkRes.json();
 if (stkData.ResponseCode === '0') {
 return { statusCode: 200, body: JSON.stringify({ success: true, message: 'STK Sent! Check your phone' }) };
 } else {
 return { statusCode: 400, body: JSON.stringify({ success: false, message: stkData.ResponseDescription }) };
 }
 } catch (err) {
 return { statusCode: 500, body: JSON.stringify({ success: false, message: err.message }) };
 }
};