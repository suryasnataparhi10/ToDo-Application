const { model, Schema } = require('mongoose');

module.exports = model(
  'Budget',
  new Schema(
    {
      userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      month: { type: Number, min: 1, max: 12, required: true },
      year: { type: Number, required: true },
      limit: { type: Number, min: 0.01, required: true },
    },
    { timestamps: true },
  ).index({ userId: 1, year: 1, month: 1 }, { unique: true }),
);
