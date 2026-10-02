const { model, Schema } = require('mongoose');
module.exports = model(
  'User',
  new Schema(
    {
      name: String,
      email: { type: String, unique: true, lowercase: true, required: true },
      password: { type: String, required: true },
      passwordResetTokenHash: { type: String, select: false },
      passwordResetExpires: { type: Date, select: false },
    },
    { timestamps: true },
  ),
);
