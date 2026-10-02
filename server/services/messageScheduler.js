const ScheduledMessage = require('../models/ScheduledMessage');

const ready = (channel) => channel === 'email'
  ? Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
  : Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && (channel === 'whatsapp' ? process.env.TWILIO_WHATSAPP_FROM : process.env.TWILIO_SMS_FROM));

async function send(message) {
  if (message.channel === 'email') {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || 'false') === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: message.email,
      subject: `A message for ${message.contactName}`,
      text: message.message,
    });
    return;
  }
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from =
    message.channel === 'whatsapp' ? process.env.TWILIO_WHATSAPP_FROM : process.env.TWILIO_SMS_FROM;
  if (!from) throw new Error(`Twilio ${message.channel} sender is not configured`);
  const to = message.channel === 'whatsapp' ? `whatsapp:${message.phone}` : message.phone;
  const body =
    message.channel === 'whatsapp' && !from.startsWith('whatsapp:') ? `whatsapp:${from}` : from;
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: body, Body: message.message }),
    },
  );
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Twilio could not deliver the message');
}

function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map(({ type, value }) => [type, Number(value)]),
  );
}

function fromZonedParts(parts, timeZone) {
  const target = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  let estimate = target;
  for (let attempt = 0; attempt < 4; attempt++) {
    const actual = zonedParts(new Date(estimate), timeZone);
    const represented = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
    );
    const correction = target - represented;
    estimate += correction;
    if (!correction) break;
  }
  return new Date(estimate);
}

function nextOccurrence(message, from) {
  if (message.frequency === 'once') return null;
  const timeZone = message.timeZone || 'Asia/Kolkata';
  const local = zonedParts(from, timeZone);
  const scheduledLocal = zonedParts(new Date(message.scheduledAt), timeZone);
  const calendarDate = new Date(Date.UTC(local.year, local.month - 1, local.day));
  if (message.frequency === 'daily') calendarDate.setUTCDate(calendarDate.getUTCDate() + 1);
  else if (message.frequency === 'weekly') calendarDate.setUTCDate(calendarDate.getUTCDate() + 7);
  else if (message.frequency === 'custom')
    calendarDate.setUTCDate(calendarDate.getUTCDate() + message.intervalDays);
  else if (message.frequency === 'monthly') {
    const preferredDay = scheduledLocal.day;
    calendarDate.setUTCDate(1);
    calendarDate.setUTCMonth(calendarDate.getUTCMonth() + 1);
    const lastDay = new Date(
      Date.UTC(calendarDate.getUTCFullYear(), calendarDate.getUTCMonth() + 1, 0),
    ).getUTCDate();
    calendarDate.setUTCDate(Math.min(preferredDay, lastDay));
  } else return null;
  return fromZonedParts(
    {
      year: calendarDate.getUTCFullYear(),
      month: calendarDate.getUTCMonth() + 1,
      day: calendarDate.getUTCDate(),
      hour: scheduledLocal.hour,
      minute: scheduledLocal.minute,
    },
    timeZone,
  );
}

async function sendDueMessages() {
  for (let count = 0; count < 25; count++) {
    const now = new Date();
    const configuredChannels = ['email', 'sms', 'whatsapp'].filter(ready);
    if (!configuredChannels.length) return;
    const message = await ScheduledMessage.findOneAndUpdate(
      {
        active: true,
        channel: { $in: configuredChannels },
        nextSendAt: { $lte: now },
        $or: [{ lockedAt: null }, { lockedAt: { $lt: new Date(now.getTime() - 10 * 60 * 1000) } }],
      },
      { $set: { lockedAt: now } },
      { sort: { nextSendAt: 1 }, new: true },
    );
    if (!message) return;
    try {
      const personalized = message.message.replace(/\{name\}/gi, message.contactName);
      await send({ ...message.toObject(), message: personalized });
      const next = nextOccurrence(message, now);
      const stopAfterSend = !next || (message.endAt && next > message.endAt);
      await ScheduledMessage.updateOne(
        { _id: message._id },
        {
          $set: {
            active: !stopAfterSend,
            lastSentAt: now,
            lastError: '',
            lockedAt: null,
            ...(next && !stopAfterSend ? { nextSendAt: next } : {}),
          },
        },
      );
    } catch (error) {
      await ScheduledMessage.updateOne(
        { _id: message._id },
        {
          $set: {
            lastError: String(error.message || error).slice(0, 500),
            lockedAt: null,
            nextSendAt: new Date(now.getTime() + 5 * 60 * 1000),
          },
        },
      );
    }
  }
}

function startMessageScheduler() {
  const poll = () =>
    sendDueMessages().catch((error) => console.error('Message scheduler failed:', error));
  poll();
  const timer = setInterval(poll, 30 * 1000);
  timer.unref?.();
}

module.exports = { startMessageScheduler };
