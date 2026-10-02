const express = require('express');
const Income = require('../models/Income');
const auth = require('../middleware/auth');
const { ok, fail, wrap } = require('../utils/http');

const router = express.Router();
router.use(auth);

router.get(
  '/',
  wrap(async (req, res) => {
    const year = Number(req.query.year) || new Date().getUTCFullYear();
    const month = Number(req.query.month);
    const date = month
      ? { $gte: new Date(Date.UTC(year, month - 1, 1)), $lt: new Date(Date.UTC(year, month, 1)) }
      : { $gte: new Date(Date.UTC(year, 0, 1)), $lt: new Date(Date.UTC(year + 1, 0, 1)) };
    ok(res, await Income.find({ userId: req.uid, date }).sort({ date: -1, createdAt: -1 }));
  }),
);

router.post(
  '/',
  wrap(async (req, res) => {
    const source = String(req.body.source || '').trim();
    const amount = Number(req.body.amount);
    if (!source || !req.body.date || !Number.isFinite(amount) || amount <= 0)
      throw fail(400, 'Source, date, and an amount greater than zero are required');
    ok(
      res,
      await Income.create({ userId: req.uid, source, date: req.body.date, amount }),
      'Income saved',
      201,
    );
  }),
);

router.delete(
  '/bulk',
  wrap(async (req, res) => {
    if (!Array.isArray(req.body.ids)) throw fail(400, 'Income ids must be an array');
    const ids = [...new Set(req.body.ids || [])];
    if (
      !ids.length ||
      ids.length > 1000 ||
      ids.some((id) => typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id))
    )
      throw fail(400, 'Select between 1 and 1000 valid income entries');
    const result = await Income.deleteMany({ userId: req.uid, _id: { $in: ids } });
    ok(res, { deletedCount: result.deletedCount }, 'Selected income entries deleted');
  }),
);
router.delete(
  '/:id',
  wrap(async (req, res) => {
    const result = await Income.findOneAndDelete({ _id: req.params.id, userId: req.uid });
    if (!result) throw fail(404, 'Income entry not found');
    ok(res, {}, 'Income deleted');
  }),
);

module.exports = router;
