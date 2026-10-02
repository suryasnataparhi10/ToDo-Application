const express = require('express');
const Reminder = require('../models/Reminder');
const auth = require('../middleware/auth');
const { ok, fail, wrap } = require('../utils/http');

const router = express.Router();
router.use(auth);

router.get(
  '/',
  wrap(async (req, res) => {
    ok(res, await Reminder.find({ userId: req.uid }).sort({ completed: 1, dueDate: 1 }));
  }),
);

router.post(
  '/',
  wrap(async (req, res) => {
    const title = String(req.body.title || '').trim();
    if (!title || !req.body.dueDate) throw fail(400, 'Title and due date are required');
    const amount =
      req.body.amount === '' || req.body.amount == null ? undefined : Number(req.body.amount);
    if (amount !== undefined && (!Number.isFinite(amount) || amount < 0))
      throw fail(400, 'Amount must be zero or more');
    ok(
      res,
      await Reminder.create({ userId: req.uid, title, dueDate: req.body.dueDate, amount }),
      'Reminder created',
      201,
    );
  }),
);

router.patch(
  '/:id',
  wrap(async (req, res) => {
    const reminder = await Reminder.findOneAndUpdate(
      { _id: req.params.id, userId: req.uid },
      { $set: { completed: Boolean(req.body.completed) } },
      { new: true, runValidators: true },
    );
    if (!reminder) throw fail(404, 'Reminder not found');
    ok(res, reminder, 'Reminder updated');
  }),
);

router.delete(
  '/bulk',
  wrap(async (req, res) => {
    if (!Array.isArray(req.body.ids)) throw fail(400, 'Reminder ids must be an array');
    const ids = [...new Set(req.body.ids || [])];
    if (
      !ids.length ||
      ids.length > 1000 ||
      ids.some((id) => typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id))
    )
      throw fail(400, 'Select between 1 and 1000 valid reminders');
    const result = await Reminder.deleteMany({ userId: req.uid, _id: { $in: ids } });
    ok(res, { deletedCount: result.deletedCount }, 'Selected reminders deleted');
  }),
);
router.delete(
  '/:id',
  wrap(async (req, res) => {
    const reminder = await Reminder.findOneAndDelete({ _id: req.params.id, userId: req.uid });
    if (!reminder) throw fail(404, 'Reminder not found');
    ok(res, {}, 'Reminder deleted');
  }),
);

module.exports = router;
