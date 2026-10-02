import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import CalendarInput from '../components/CalendarInput';
import TimePicker from '../components/TimePicker';
import {
  createScheduledMessage,
  deleteScheduledMessage,
  fetchMessageDeliveryStatus,
  fetchScheduledMessages,
  setScheduledMessageActive,
  updateScheduledMessage,
} from '../state/store';

const templates = {
  love: 'Just wanted to send you a little love, {name}. Thinking of you! 💚',
  greeting: 'Hello {name}, wishing you a lovely day!',
  celebration: 'Congratulations, {name}! Wishing you lots of happiness and success!',
  custom: '',
};
const tomorrow = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const localDate = (dateValue) => {
  const date = new Date(dateValue);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const localTime = (dateValue) => {
  const date = new Date(dateValue);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};
const initialForm = () => ({
  contactName: '',
  email: '',
  phone: '+91',
  channel: 'email',
  messageType: 'greeting',
  message: templates.greeting,
  frequency: 'once',
  intervalDays: '2',
  date: tomorrow(),
  time: '09:00',
  endDate: '',
  recipientConsented: false,
});
const frequencyLabel = (message) => {
  if (message.frequency === 'custom') return `Every ${message.intervalDays} days`;
  return { once: 'One time', daily: 'Every day', weekly: 'Every week', monthly: 'Every month' }[
    message.frequency
  ];
};

export default function ScheduledMessages() {
  const dispatch = useDispatch();
  const { data: messages, loading } = useSelector((state) => state.messages);
  const [deliveryStatus, setDeliveryStatus] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const formPanel = useRef(null);

  const load = () => dispatch(fetchScheduledMessages());
  useEffect(() => {
    load();
    dispatch(fetchMessageDeliveryStatus())
      .unwrap()
      .then(setDeliveryStatus)
      .catch(() => {});
  }, []);

  const channelReady = deliveryStatus?.[
    { email: 'emailConfigured', sms: 'smsConfigured', whatsapp: 'whatsappConfigured' }[form.channel]
  ];
  const grouped = useMemo(() => messages || [], [messages]);
  const changeMessageType = (messageType) =>
    setForm((current) => ({
      ...current,
      messageType,
      message:
        current.message === templates[current.messageType]
          ? templates[messageType]
          : current.message,
    }));

  const cancelEdit = () => {
    setEditingId(null);
    setForm(initialForm());
    setError('');
  };
  const beginEdit = (message) => {
    const proposedTime = new Date(message.nextSendAt || message.scheduledAt);
    const defaultTime =
      proposedTime > new Date() ? proposedTime : new Date(`${tomorrow()}T09:00:00`);
    setEditingId(message._id);
    setError('');
    setForm({
      contactName: message.contactName,
      email: message.email || '',
      phone: message.phone,
      channel: message.channel,
      messageType: message.messageType,
      message: message.message,
      frequency: message.frequency,
      intervalDays: String(message.intervalDays || 2),
      date: localDate(defaultTime),
      time: localTime(defaultTime),
      endDate: message.endAt ? localDate(message.endAt) : '',
      recipientConsented: true,
    });
    formPanel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        contactName: form.contactName,
        email: form.email,
        phone: form.phone,
        channel: form.channel,
        messageType: form.messageType,
        message: form.message,
        frequency: form.frequency,
        intervalDays: Number(form.intervalDays),
        scheduledAt: new Date(`${form.date}T${form.time}:00`).toISOString(),
        endAt: form.endDate ? new Date(`${form.endDate}T23:59:59`).toISOString() : undefined,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
        recipientConsented: form.recipientConsented,
      };
      if (editingId) {
        await dispatch(updateScheduledMessage({ id: editingId, message: payload })).unwrap();
      } else {
        await dispatch(createScheduledMessage(payload)).unwrap();
      }
      setEditingId(null);
      setForm(initialForm());
      load();
    } catch (reason) {
      setError(String(reason));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (message) => {
    setBusyId(message._id);
    try {
      await dispatch(
        setScheduledMessageActive({ id: message._id, active: !message.active }),
      ).unwrap();
      load();
    } finally {
      setBusyId(null);
    }
  };
  const remove = async (message) => {
    if (!window.confirm(`Delete the scheduled message for ${message.contactName}?`)) return;
    setBusyId(message._id);
    try {
      await dispatch(deleteScheduledMessage(message._id)).unwrap();
      load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">THOUGHTFUL NOTES, ON TIME</span>
          <h1>Scheduled messages</h1>
          <p className="muted">Schedule a greeting or personal note for someone you care about.</p>
        </div>
      </div>
      {deliveryStatus && !deliveryStatus.emailConfigured && !deliveryStatus.smsConfigured && !deliveryStatus.whatsappConfigured && (
        <div className="message-provider-notice">
          <i className="bi bi-info-circle" />
          <span>
            Schedules are saved, but delivery is not connected yet. Configure SMTP for email or
            Twilio for SMS and WhatsApp in the server environment.
          </span>
        </div>
      )}
      <div className="message-layout">
        <section className="panel message-form-panel" ref={formPanel}>
          <div className="panel-heading">
            <div>
              <span className="eyebrow">{editingId ? 'EDIT SCHEDULE' : 'NEW SCHEDULE'}</span>
              <h4>{editingId ? 'Update this message' : 'Write a message'}</h4>
            </div>
          </div>
          <form className="finance-form" onSubmit={submit}>
            <div className="message-form-grid">
              <label className="form-label">
                Contact name
                <input
                  className="form-control"
                  placeholder="Who is it for?"
                  value={form.contactName}
                  onChange={(event) => setForm({ ...form, contactName: event.target.value })}
                  required
                />
              </label>
              {form.channel === 'email' ? (
                <label className="form-label">
                  Email address
                  <input className="form-control" type="email" placeholder="name@example.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
                </label>
              ) : (
                <label className="form-label">
                  Phone number
                  <input className="form-control" type="tel" inputMode="tel" placeholder="+91 98765 43210" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} pattern="\+[1-9][0-9]{7,14}" title="Enter the full number with its country code, for example +919876543210" required />
                  <small className="muted">India country code +91 is prefilled. Keep the full number in international format.</small>
                </label>
              )}
              <label className="form-label">
                Send with
                <select
                  className="form-select"
                  value={form.channel}
                  onChange={(event) => setForm({ ...form, channel: event.target.value })}
                >
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </label>
              <label className="form-label">
                Message style
                <select
                  className="form-select"
                  value={form.messageType}
                  onChange={(event) => changeMessageType(event.target.value)}
                >
                  <option value="greeting">Greetings</option>
                  <option value="love">Love and care</option>
                  <option value="celebration">Celebration</option>
                  <option value="custom">Custom message</option>
                </select>
              </label>
            </div>
            <label className="form-label">
              Message
              <textarea
                className="form-control scheduled-message-text"
                rows="4"
                maxLength="1500"
                placeholder="Write your message. Use {name} to personalize it."
                value={form.message}
                onChange={(event) => setForm({ ...form, message: event.target.value })}
                required
              />
              <small className="muted">
                Use <code>{'{name}'}</code> to insert the contact’s name. {form.message.length}/1500
              </small>
            </label>
            <div className="message-schedule-fields">
              <label className="form-label">
                Repeat
                <select
                  className="form-select"
                  value={form.frequency}
                  onChange={(event) => setForm({ ...form, frequency: event.target.value })}
                >
                  <option value="once">One time</option>
                  <option value="daily">Every day</option>
                  <option value="weekly">Every week</option>
                  <option value="monthly">Every month</option>
                  <option value="custom">Custom interval</option>
                </select>
              </label>
              {form.frequency === 'custom' && (
                <label className="form-label">
                  Repeat every (days)
                  <input
                    type="number"
                    min="1"
                    max="365"
                    className="form-control"
                    value={form.intervalDays}
                    onChange={(event) => setForm({ ...form, intervalDays: event.target.value })}
                    required
                  />
                </label>
              )}
              <label className="form-label">
                First send date
                <CalendarInput
                  type="date"
                  value={form.date}
                  min={tomorrow()}
                  onChange={(event) => setForm({ ...form, date: event.target.value })}
                  required
                />
              </label>
              <label className="form-label">
                Send time
                <TimePicker value={form.time} onChange={(time) => setForm({ ...form, time })} />
              </label>
              {form.frequency !== 'once' && (
                <label className="form-label">
                  Stop after (optional)
                  <CalendarInput
                    type="date"
                    value={form.endDate}
                    min={form.date}
                    onChange={(event) => setForm({ ...form, endDate: event.target.value })}
                  />
                </label>
              )}
            </div>
            <label className="message-consent">
              <input
                type="checkbox"
                checked={form.recipientConsented}
                onChange={(event) => setForm({ ...form, recipientConsented: event.target.checked })}
                required
              />{' '}
              I have permission to send messages to this person.
            </label>
            {error && <div className="alert alert-danger py-2">{error}</div>}
            {!channelReady && deliveryStatus && (
              <p className="message-setup-hint">
                {form.channel === 'email' ? 'Email' : form.channel === 'sms' ? 'SMS' : 'WhatsApp'} delivery is not configured. You can save
                this schedule now and connect delivery later.
              </p>
            )}
            <button className="btn btn-primary" disabled={saving}>
              <i className="bi bi-send me-2" />
              {saving ? 'Saving schedule...' : editingId ? 'Save changes' : 'Schedule message'}
            </button>
            {editingId && (
              <button type="button" className="btn btn-light ms-2" onClick={cancelEdit}>
                Cancel edit
              </button>
            )}
          </form>
        </section>

        <section className="panel message-list-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">YOUR QUEUE</span>
              <h4>Upcoming messages</h4>
            </div>
            <span className="message-count">{grouped.length}</span>
          </div>
          {loading && !messages ? (
            <div className="text-center py-5">
              <div className="spinner-border" />
            </div>
          ) : !grouped.length ? (
            <div className="finance-empty">
              <i className="bi bi-send" />
              <p>No messages scheduled yet.</p>
            </div>
          ) : (
            <div className="scheduled-message-list">
              {grouped.map((message) => {
                const sentOnce = message.frequency === 'once' && message.lastSentAt;
                const configured = deliveryStatus?.[
                  { email: 'emailConfigured', sms: 'smsConfigured', whatsapp: 'whatsappConfigured' }[
                    message.channel
                  ]
                ];
                const statusLabel = sentOnce
                  ? 'Sent'
                  : !message.active
                    ? 'Paused'
                    : deliveryStatus && !configured
                      ? 'Setup needed'
                      : 'Active';
                return (
                  <article className="scheduled-message-card" key={message._id}>
                    <div className="scheduled-message-card-top">
                      <span className="message-contact-icon">
                        <i className="bi bi-person-heart" />
                      </span>
                      <div className="scheduled-message-contact">
                        <b>{message.contactName}</b>
                        <small>
                          {message.email || message.phone} · {message.channel === 'email' ? 'Email' : message.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                        </small>
                      </div>
                      <span
                        className={`message-status ${sentOnce ? 'sent' : !message.active ? 'paused' : deliveryStatus && !configured ? 'setup-needed' : 'active'}`}
                      >
                        {statusLabel}
                      </span>
                    </div>
                    <p className="scheduled-message-preview">
                      {message.message.replace(/\{name\}/gi, message.contactName)}
                    </p>
                    <div className="scheduled-message-meta">
                      <span>
                        <i className="bi bi-arrow-repeat" /> {frequencyLabel(message)}
                      </span>
                      <span>
                        <i className="bi bi-clock" />{' '}
                        {sentOnce
                          ? new Date(message.lastSentAt).toLocaleString()
                          : new Date(message.nextSendAt).toLocaleString()}
                      </span>
                    </div>
                    {message.lastError && (
                      <p className="scheduled-message-error">
                        <i className="bi bi-exclamation-circle" /> Last attempt failed:{' '}
                        {message.lastError}
                      </p>
                    )}
                    <div className="scheduled-message-actions">
                      {!sentOnce && (
                        <button
                          className="btn btn-light"
                          disabled={busyId === message._id}
                          onClick={() => beginEdit(message)}
                        >
                          <i className="bi bi-pencil me-1" /> Edit
                        </button>
                      )}
                      {!sentOnce && (
                        <button
                          className="btn btn-light"
                          disabled={busyId === message._id}
                          onClick={() => toggleActive(message)}
                        >
                          {message.active ? 'Pause' : 'Resume'}
                        </button>
                      )}
                      <button
                        className="icon-button danger"
                        title="Delete schedule"
                        aria-label={`Delete schedule for ${message.contactName}`}
                        disabled={busyId === message._id}
                        onClick={() => remove(message)}
                      >
                        <i className="bi bi-trash3" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
