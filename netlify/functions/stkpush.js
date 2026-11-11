const axios = require('axios');

exports.handler = async (event) => {
  try {
    const { phone, amount } = JSON.parse(event.body || '{}');

    if (!phone || !amount) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, message: 'Phone and amount are required' })
      };
    }

    const cleanPhone = phone.replace(/^0/, '254').replace(/[^0-9]/g, '');
    const shortcode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;
    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

    // 1. Get Access Token
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const tokenRes = await axios.get('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
      headers: { Authorization: `Basic ${auth}` }
    });
    const token = tokenRes.data.access_token;

    // 2. Create Password
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

    // 3. Send STK Push
    const stkRes = await axios.post('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Number(amount),
      PartyA: cleanPhone,
      PartyB: shortcode,
      PhoneNumber: cleanPhone,
      CallBackURL: 'https://banducoinsite.netlify.app/.netlify/functions/callback',
      AccountReference: 'BanduCoins',
      TransactionDesc: 'BanduCoins Buy'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'STK push sent! Check your phone and enter PIN.', data: stkRes.data })
    };

  } catch (error) {
    console.log(error.response?.data || error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: error.response?.data?.errorMessage || 'STK push failed. Try again.' })
    };
  }
};
