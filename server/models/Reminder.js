const { model, Schema } = require('mongoose');

module.exports = model(
  'Reminder',
  new Schema(
    {
      userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      title: { type: String, required: true, trim: true },
      dueDate: { type: Date, required: true },
      amount: { type: Number, min: 0 },
      completed: { type: Boolean, default: false },
    },
    { timestamps: true },
  ).index({ userId: 1, dueDate: 1 }),
);
