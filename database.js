// database.js
const mongoose = require('mongoose');

// تعريف Schema للموقع
const locationSchema = new mongoose.Schema({
  latitude: {
    type: Number,
    required: true,
  },
  longitude: {
    type: Number,
    required: true,
  },
  accuracy: Number,
  location_name: String,
  ip_address: String,
}, {
  timestamps: { createdAt: 'timestamp', updatedAt: false }
});

const Location = mongoose.model('Location', locationSchema);

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI غير معرف في متغيرات البيئة');
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log('تم الاتصال بقاعدة البيانات MongoDB Atlas');
}

module.exports = { Location, connectDB };