const express = require('express');
const Expense = require('../models/Expense');
const Income = require('../models/Income');
const auth = require('../middleware/auth');
const { ok, fail, wrap } = require('../utils/http');
const router = express.Router();
router.use(auth);
const dashboard = express.Router();
dashboard.use(auth);
const range = (month, year) => ({
  $gte: new Date(Date.UTC(year, month - 1, 1)),
  $lt: new Date(Date.UTC(year, month, 1)),
});
const pick = (b) => ({
  date: b.date,
  amount: b.amount,
  item: String(b.item || b.description || '').trim(),
  category: b.category || 'Other',
  subcategory: b.subcategory,
  hasSubtypes: Boolean(b.hasSubtypes),
  subtypes: Array.isArray(b.subtypes)
    ? b.subtypes.map((s) => ({
        type: String(s.type || '').trim(),
        amount: Number(s.amount),
        paymentMethod: s.paymentMethod || 'Cash',
      }))
    : [],
  description: String(b.item || b.description || '').trim(),
  paymentMethod: b.paymentMethod || 'Cash',
});

router.get(
  '/yearly',
  wrap(async (req, res) => {
    const year = +req.query.year || new Date().getUTCFullYear();
    ok(
      res,
      await Expense.aggregate([
        {
          $match: {
            userId: req.uid,
            date: { $gte: new Date(Date.UTC(year, 0, 1)), $lt: new Date(Date.UTC(year + 1, 0, 1)) },
          },
        },
        { $group: { _id: { $month: '$date' }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    );
  }),
);
router.post(
  '/bulk',
  wrap(async (req, res) => {
    const entries = req.body.expenses;
    if (!Array.isArray(entries) || entries.length < 1 || entries.length > 100)
      throw fail(400, 'Add between 1 and 100 expenses');
    const records = entries.map(pick);
    if (
      records.some(
        (e) => !e.date || !e.item || !Number.isFinite(Number(e.amount)) || Number(e.amount) <= 0,
      )
    )
      throw fail(400, 'Each expense needs an item, date, and amount greater than zero');
    ok(
      res,
      await Expense.insertMany(records.map((e) => ({ ...e, userId: req.uid }))),
      'Expenses created successfully',
      201,
    );
  }),
);
router.get(
  '/suggestions',
  wrap(async (req, res) => {
    const [items, subtypes] = await Promise.all([
      Expense.distinct('item', { userId: req.uid }),
      Expense.distinct('subtypes.type', { userId: req.uid }),
    ]);
    ok(res, { items: items.filter(Boolean), subtypes: subtypes.filter(Boolean) });
  }),
);
router.get(
  '/',
  wrap(async (req, res) => {
    const { category, paymentMethod, search, from, to, min, max, month, year } = req.query,
      q = { userId: req.uid };
    if (category) q.category = String(category);
    if (paymentMethod) q.paymentMethod = String(paymentMethod);
    if (month && year) q.date = range(+month, +year);
    else if (from || to)
      q.date = { ...(from && { $gte: new Date(from) }), ...(to && { $lte: new Date(to) }) };
    if (min || max) q.amount = { ...(min && { $gte: +min }), ...(max && { $lte: +max }) };
    if (search) {
      const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        pattern = new RegExp(escaped, 'i');
      q.$or = ['item', 'description', 'category', 'subcategory', 'subtypes.type'].map((key) => ({
        [key]: pattern,
      }));
    }
    ok(res, await Expense.find(q).sort({ date: -1, createdAt: -1 }).limit(1000));
  }),
);
router.post(
  '/',
  wrap(async (req, res) =>
    ok(
      res,
      await Expense.create({ ...pick(req.body), userId: req.uid }),
      'Expense created successfully',
      201,
    ),
  ),
);
router.get(
  '/:id',
  wrap(async (req, res) => {
    const expense = await Expense.findOne({ _id: req.params.id, userId: req.uid });
    if (!expense) throw fail(404, 'Expense not found');
    ok(res, expense);
  }),
);
router.delete(
  '/bulk',
  wrap(async (req, res) => {
    if (!Array.isArray(req.body.ids)) throw fail(400, 'Expense ids must be an array');
    const ids = [...new Set(req.body.ids || [])];
    if (
      !ids.length ||
      ids.length > 1000 ||
      ids.some((id) => typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id))
    )
      throw fail(400, 'Select between 1 and 1000 valid expenses');
    const result = await Expense.deleteMany({ userId: req.uid, _id: { $in: ids } });
    ok(res, { deletedCount: result.deletedCount }, 'Selected expenses deleted');
  }),
);
router.put(
  '/:id',
  wrap(async (req, res) => {
    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, userId: req.uid },
      pick(req.body),
      { new: true, runValidators: true },
    );
    if (!expense) throw fail(404, 'Expense not found');
    ok(res, expense, 'Expense updated successfully');
  }),
);
router.delete(
  '/:id',
  wrap(async (req, res) => {
    const expense = await Expense.findOneAndDelete({ _id: req.params.id, userId: req.uid });
    if (!expense) throw fail(404, 'Expense not found');
    ok(res, {}, 'Expense deleted successfully');
  }),
);

dashboard.get(
  '/summary',
  wrap(async (req, res) => {
    const now = new Date(),
      month = +req.query.month || now.getUTCMonth() + 1,
      year = +req.query.year || now.getUTCFullYear(),
      userId = req.uid,
      match = { userId, date: range(month, year) };
    const sum = (id) => [
      { $match: match },
      { $group: { _id: id, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ];
    const [daily, categories, items, recent, today, income] = await Promise.all([
      Expense.aggregate([
        ...sum({ $dateToString: { format: '%Y-%m-%d', date: '$date' } }),
        { $sort: { _id: 1 } },
      ]),
      Expense.aggregate([...sum('$category'), { $sort: { total: -1 } }]),
      Expense.aggregate([...sum({ $ifNull: ['$item', '$description'] }), { $sort: { total: -1 } }]),
      Expense.find(match).sort({ date: -1, createdAt: -1 }).limit(10),
      Expense.aggregate([
        {
          $match: {
            userId,
            date: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Income.aggregate([
        { $match: { userId, date: range(month, year) } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);
    const total = daily.reduce((n, day) => n + day.total, 0),
      current = month === now.getUTCMonth() + 1 && year === now.getUTCFullYear(),
      days = current ? now.getUTCDate() : new Date(Date.UTC(year, month, 0)).getUTCDate();
    ok(res, {
      month,
      year,
      totalMonthExpense: total,
      totalMonthIncome: income[0]?.total || 0,
      remainingBalance: (income[0]?.total || 0) - total,
      todayExpense: today[0]?.total || 0,
      averageDailyExpense: total / days,
      highestSpendingDay: daily.reduce(
        (best, day) => (!best || day.total > best.total ? day : best),
        null,
      ),
      categoryBreakdown: categories,
      itemBreakdown: items,
      dailyBreakdown: daily,
      recentExpenses: recent,
    });
  }),
);
module.exports = { router, dashboard };
