const jwt = require("jsonwebtoken"); // used to verify the JWT token
const User = require("../models/User"); // used to fetch the user from the database

// Middleware to protect routes and ensure the user is authenticated
exports.protect = async (req, res, next) => {
  try { // Check for the Authorization header and extract the token
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Not authenticated" });// Verify the token and fetch the user from the database
    const { id } = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(id);
    if (!user)    // If the user is not found, return an error
      return res.status(401).json({ message: "User no longer exists" });
    req.user = user;
    next();
  } catch {// If the token is invalid or expired, return an error
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

// Middleware to restrict access to admin users only
exports.adminOnly = (req, res, next) =>
  req.user && req.user.role === "admin"
    ? next()
    : res.status(403).json({ message: "Admins only" });
