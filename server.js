// server.js

import express from 'express';
import bodyParser from 'body-parser';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const CAL_API_KEY = process.env.CAL_API_KEY;
const EVENT_TYPE_ID = process.env.EVENT_TYPE_ID || '2576576';
const TIMEZONE = 'America/Edmonton';

app.use(bodyParser.json());

// Serve metadata for MCP
app.use('/.well-known', express.static(path.join(__dirname, 'public/.well-known')));
app.use('/openapi.json', express.static(path.join(__dirname, 'public/openapi.json')));

// Endpoint for booking
app.post('/invoke', async (req, res) => {
  console.log('📥 Received input:', JSON.stringify(req.body, null, 2));
  const { name, email, phone, time, summary } = req.body;

  const bookingPayload = {
    start: time,
    eventTypeId: Number(EVENT_TYPE_ID),
    attendee: {
      name,
      email,
      phoneNumber: phone,
      timeZone: TIMEZONE
    },
    bookingFieldsResponses: {
      summary
    }
  };

  console.log('📤 Sending booking payload to Cal.com:', JSON.stringify(bookingPayload, null, 2));

  try {
    const response = await axios.post('https://api.cal.com/v2/bookings', bookingPayload, {
      headers: {
        Authorization: `Bearer ${CAL_API_KEY}`,
        'cal-api-version': '2024-08-13',
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Booking successful:', response.data);
    res.json({ success: true, data: response.data });

  } catch (error) {
    const errData = error.response?.data || {};
    console.error('❌ Booking error:');
    console.error('Status:', error.response?.status);
    console.error('Message:', errData.message || errData.error?.message);
    console.error('Timestamp:', errData.timestamp);
    console.error('Path:', errData.path);
    console.error('Errors:', errData.error?.details || errData.errors);

    res.status(500).json({ success: false, error: errData });
  }
});

app.listen(PORT, () => {
  console.log(`📞 Booking MCP tool running on http://localhost:${PORT}`);
});
