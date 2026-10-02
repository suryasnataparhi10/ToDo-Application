const { model, Schema } = require('mongoose');

module.exports = model(
  'Income',
  new Schema(
    {
      userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      date: { type: Date, required: true },
      amount: { type: Number, required: true, min: 0.01 },
      source: { type: String, required: true, trim: true },
    },
    { timestamps: true },
  ).index({ userId: 1, date: -1 }),
);
