const jwt = require('jsonwebtoken');
const { Types } = require('mongoose');
const { fail } = require('../utils/http');
module.exports = (req, res, next) => {
  try {
    req.uid = new Types.ObjectId(
      jwt.verify((req.headers.authorization || '').slice(7), process.env.JWT_SECRET).id,
    );
    next();
  } catch {
    next(fail(401, 'Not authorized'));
  }
};
