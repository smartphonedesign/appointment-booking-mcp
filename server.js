import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

dotenv.config();
const app = express();
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/.well-known', express.static(path.join(__dirname, 'public/.well-known')));
app.use('/', express.static(path.join(__dirname, 'public')));

const CALCOM_API_KEY = process.env.CALCOM_API_KEY;
const EVENT_TYPE_ID = '2576576';
const EVENT_TYPE_SLUG = 'bland-painworth-law-initial-consultation';
const DEFAULT_TIMEZONE = 'America/Edmonton';

const calcom = axios.create({
  baseURL: 'https://api.cal.com/v2',
  headers: { Authorization: `Bearer ${CALCOM_API_KEY}` }
});

app.post('/invoke', async (req, res) => {
  const input = req.body.toolInput || {};
  const { name, email, phone, preferredDate, preferredTime, incidentSummary } = input;

  console.log('📥 Booking Request:', input);

  if (!name || !email || !phone || !preferredDate || !preferredTime || !incidentSummary) {
    return res.status(400).json({
      output: 'Missing required fields: name, email, phone, preferredDate, preferredTime, and incidentSummary are required.'
    });
  }

  try {
    const startTime = `${preferredDate}T00:00:00.000Z`;
    const endTime = `${preferredDate}T23:59:59.999Z`;

    const response = await calcom.get('/slots/available', {
      params: {
        startTime,
        endTime,
        eventTypeId: EVENT_TYPE_ID,
        eventTypeSlug: EVENT_TYPE_SLUG
      }
    });

    const slots = response.data?.data?.slots?.[preferredDate] || [];
    const matchingSlots = slots.filter(slot => {
      const hour = dayjs(slot.time).tz(DEFAULT_TIMEZONE).hour();
      return preferredTime === 'morning'
        ? hour >= 9 && hour < 12
        : hour >= 13 && hour < 17;
    });

    if (matchingSlots.length === 0) {
      return res.json({
        output: `Sorry, there are no available ${preferredTime} slots on ${preferredDate}.`
      });
    }

    const chosenSlot = matchingSlots[0];
    const result = await calcom.post('/bookings', {
      eventTypeId: EVENT_TYPE_ID,
      eventTypeSlug: EVENT_TYPE_SLUG,
      start: chosenSlot.time,
      email,
      name,
      timezone: DEFAULT_TIMEZONE,
      metadata: {
        phone,
        incidentSummary
      }
    });

    return res.json({
      output: `Appointment booked for ${name} on ${dayjs(chosenSlot.time).tz(DEFAULT_TIMEZONE).format('dddd, MMMM D [at] h:mm A')} (Edmonton time).`
    });
  } catch (error) {
    console.error('Booking error:', error?.response?.data || error.message);
    return res.status(500).json({
      output: 'An error occurred while booking the appointment.'
    });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`📞 Booking MCP tool running on port ${port}`));
