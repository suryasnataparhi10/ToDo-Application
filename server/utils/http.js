exports.ok = (res, data, message = 'OK', status = 200) =>
  res.status(status).json({ success: true, message, data });
exports.fail = (status, message) => Object.assign(new Error(message), { status });
exports.wrap = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);
