const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002; // Changed port to avoid conflicts

// Add basic error handling
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

console.log('🔧 Starting server with Node.js version:', process.version);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Email API endpoint
app.post('/api/email-send', async (req, res) => {
  console.log('📧 Email API called');
  
  try {
    const { to, subject, html, text } = req.body || {};
    
    console.log('📧 Request data:', { to, subject, hasHtml: !!html, hasText: !!text });
    
    if (!to || !subject || (!html && !text)) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ error: "Missing to/subject/html|text" });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;

    console.log('🔑 Environment check:', { hasApiKey: !!apiKey, hasFrom: !!from });

    if (!apiKey || !from) {
      console.log('⚠️ Missing email credentials in .env');
      return res.status(500).json({ 
        error: "Missing RESEND_API_KEY or EMAIL_FROM in .env file",
        hint: "Edit .env file with your email provider credentials"
      });
    }

    console.log('📤 Sending real email via Resend API...');
    
    // Send real email via Resend API
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html, text }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ Resend API error:', data);
      return res.status(response.status).json(data);
    }

    console.log('✅ Email sent successfully! ID:', data.id);
    return res.status(200).json({ ok: true, id: data.id });

  } catch (e) {
    console.error('❌ Email send error:', e);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// SMS API endpoint (server-side Twilio proxy; avoids CORS + keeps secrets off the browser)
app.post('/api/sms-send', async (req, res) => {
  console.log('📱 SMS API called');
  try {
    const { to, body } = req.body || {};
    if (!to || !body) {
      return res.status(400).json({ error: "Missing to/body" });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const apiKeySid = process.env.TWILIO_API_KEY_SID;
    const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    const hasCreds = !!accountSid && (!!authToken || (!!apiKeySid && !!apiKeySecret));
    const hasFrom = !!messagingServiceSid || !!fromNumber;

    console.log('🔑 Twilio env check:', {
      hasAccountSid: !!accountSid,
      hasAuthToken: !!authToken,
      hasApiKey: !!apiKeySid && !!apiKeySecret,
      hasMessagingServiceSid: !!messagingServiceSid,
      hasFromNumber: !!fromNumber
    });

    if (!hasCreds || !hasFrom) {
      return res.status(500).json({
        error: "SMS API not configured",
        hint: "Set TWILIO_ACCOUNT_SID and (TWILIO_AUTH_TOKEN OR TWILIO_API_KEY_SID+TWILIO_API_KEY_SECRET) and (TWILIO_MESSAGING_SERVICE_SID OR TWILIO_FROM_NUMBER) in .env"
      });
    }

    const useApiKey = !!apiKeySid && !!apiKeySecret;
    const user = useApiKey ? apiKeySid : accountSid;
    const pass = useApiKey ? apiKeySecret : authToken;
    const basic = Buffer.from(`${user}:${pass}`).toString('base64');

    const params = new URLSearchParams();
    params.append('To', to);
    params.append('Body', body);
    if (messagingServiceSid) params.append('MessagingServiceSid', messagingServiceSid);
    else params.append('From', fromNumber);

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!response.ok) {
      console.error('❌ Twilio error:', data);
      return res.status(response.status).json(data);
    }

    console.log('✅ SMS sent successfully! SID:', data.sid);
    return res.status(200).json({ ok: true, sid: data.sid });
  } catch (e) {
    console.error('❌ SMS send error:', e);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Serve static files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 ReliaLimo server running on http://localhost:${PORT}`);
  console.log(`📧 Email API available at http://localhost:${PORT}/api/email-send`);
  console.log(`💡 Make sure to create a .env file with RESEND_API_KEY and EMAIL_FROM`);
  console.log(`🔧 Node.js version: ${process.version}`);
}).on('error', (err) => {
  console.error('❌ Server failed to start:', err.message);
  if (err.code === 'EADDRINUSE') {
    console.log(`💡 Port ${PORT} is busy. Try a different port or stop existing server.`);
  }
});