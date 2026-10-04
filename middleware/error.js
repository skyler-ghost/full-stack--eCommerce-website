exports.notFound = (req, res) => res.status(404).json({ message: `Not found: ${req.originalUrl}` });

exports.errorHandler = (err, _req, res, _next) => {
  console.error(err);
  let status = err.status || 500;
  let message = err.message || 'Server error';
  if (err.name === 'ValidationError') { status = 400; message = Object.values(err.errors).map(e => e.message).join(', '); }
  if (err.name === 'CastError') { status = 400; message = 'Invalid id'; }
  if (err.code === 11000) { status = 409; message = 'Duplicate value'; }
  if (process.env.NODE_ENV === 'production' && status === 500) message = 'Server error';
  res.status(status).json({ message });
};

// wrap async handlers
exports.wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
