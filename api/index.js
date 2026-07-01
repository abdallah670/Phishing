// api/index.js
const app = require('../server');
const { connectDB } = require('../database');

let isConnected = false;

module.exports = async (req, res) => {
  if (!isConnected) {
    await connectDB();
    isConnected = true;
  }
  // تسليم الطلب لتطبيق Express
  return app(req, res);
};