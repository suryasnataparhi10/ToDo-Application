require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const { router: expenseRoutes, dashboard: dashboardRoutes } = require('./routes/expenses');
const incomeRoutes = require('./routes/income');
const budgetRoutes = require('./routes/budgets');
const reminderRoutes = require('./routes/reminders');
const reportRoutes = require('./routes/reports');
const scheduledMessageRoutes = require('./routes/messages');
const { startMessageScheduler } = require('./services/messageScheduler');

const app = express();
const allowedClientOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || !allowedClientOrigins.length || allowedClientOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Origin is not allowed by CORS'));
      }
    },
  }),
  express.json(),
);
app.get('/healthz', (req, res) => res.status(200).json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/income', incomeRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/messages', scheduledMessageRoutes);
app.use((error, req, res, next) => {
  const status =
    error.status || (['ValidationError', 'CastError'].includes(error.name) ? 400 : 500);
  if (status === 500) console.error(error);
  res
    .status(status)
    .json({ success: false, message: status === 500 ? 'Server error' : error.message });
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    startMessageScheduler();
    app.listen(process.env.PORT || 5000, () => console.log('SpendWise API running'));
  })
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
