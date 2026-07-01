// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const { Location, connectDB } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// دالة الترميز العكسي (نفسها)
async function reverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MyGeolocationApp/1.0 (educational project)',
        'Accept-Language': 'ar'
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.display_name || null;
  } catch (error) {
    console.error('Reverse geocoding failed:', error.message);
    return null;
  }
}

// API حفظ الموقع
app.post('/api/location', async (req, res) => {
  const { latitude, longitude, accuracy } = req.body;

  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return res.status(400).json({ error: 'latitude و longitude يجب أن يكونا أرقاماً' });
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return res.status(400).json({ error: 'إحداثيات خارج النطاق المسموح' });
  }

  const locationName = await reverseGeocode(latitude, longitude);
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip;

  try {
    const newLocation = new Location({
      latitude,
      longitude,
      accuracy: accuracy || null,
      location_name: locationName,
      ip_address: ip
    });
    await newLocation.save();
    res.status(201).json({
      message: 'تم حفظ الموقع بنجاح',
      id: newLocation._id,
      locationName: locationName
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'خطأ في الخادم أثناء الحفظ' });
  }
});

// API عرض المواقع (لوحة الإدارة)
app.get('/api/locations', async (req, res) => {
  if (req.query.password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'غير مصرح' });
  }
  try {
    const locations = await Location.find().sort({ timestamp: -1 }).lean();
    res.json(locations);
  } catch (error) {
    res.status(500).json({ error: 'خطأ في جلب البيانات' });
  }
});

// صفحة الإدارة
app.get('/admin', (req, res) => {
  if (req.query.password !== ADMIN_PASSWORD) {
    return res.status(401).send('غير مصرح. أضف ?password=كلمة_المرور');
  }
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// تشغيل السيرفر لو كنا محليين
if (process.env.NODE_ENV !== 'production') {
  connectDB().then(() => {
    app.listen(PORT, () => {
      console.log(`الخادم يعمل محلياً على http://localhost:${PORT}`);
    });
  });
}

// تصدير التطبيق لـ Vercel
module.exports = app;