const mongoose = require('mongoose'); // used to connect to the MongoDB database

module.exports = async function connectDB() {// Function to connect to the MongoDB database using Mongoose
  try { // Attempt to connect to the database using the connection string from environment variables
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');
  } catch (err) { // If the connection fails, log the error and exit the process
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }
};