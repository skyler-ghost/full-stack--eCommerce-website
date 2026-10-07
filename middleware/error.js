exports.notFound = (req, res) => 
  res.status(404).json({ message: `Not found: ${req.originalUrl}` });
// Middleware to handle errors and send appropriate responses

exports.errorHandler = (err, _req, res, _next) => { // Log the error for debugging purposes
  console.error(err);
  let status = err.status || 500;
  let message = err.message || "Server error";
  // Handle specific error types and set appropriate status codes and messages
  if (err.name === "ValidationError") {
    status = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
  }
  // Handle invalid MongoDB ObjectId errors
  if (err.name === "CastError") {
    status = 400;
    message = "Invalid id";
  }
  // Handle duplicate key errors (e.g., unique violations)
  if (err.code === 11000) {
    status = 409;
    message = "Duplicate value";
  }// In production, avoid exposing internal server errors to the client
  if (process.env.NODE_ENV === "production" && status === 500)
    message = "Server error";
  res.status(status).json({ message });
};

// wrap async handlers
// This function wraps async route handlers to catch errors and pass them to the error handler
exports.wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
