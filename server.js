// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./database');

// إذا كنت تستخدم Node < 18، أضف السطر التالي:
// const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/**
 * دالة الترميز الجغرافي العكسي
 * تستخدم OpenStreetMap Nominatim (مجانية مع قيود استخدام)
 * تعيد اسم المكان أو null في حال الفشل
 */
async function reverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        // مطلوب تعريف تطبيقك (يمكن تغييره لاسم مشروعك)
        'User-Agent': 'MyGeolocationApp/1.0 (educational project)',
        'Accept-Language': 'ar' // إظهار النتائج بالعربية إن أمكن
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    // استخراج اسم المكان: نأخذ display_name أو نكوّن من address
    return data.display_name || null;
  } catch (error) {
    console.error('Reverse geocoding failed:', error.message);
    return null;
  }
}

// نقطة API لحفظ الموقع
app.post('/api/location', async (req, res) => {
  const { latitude, longitude, accuracy } = req.body;

  // التحقق من صحة البيانات
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return res.status(400).json({ error: 'latitude و longitude يجب أن يكونا أرقاماً' });
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return res.status(400).json({ error: 'إحداثيات خارج النطاق المسموح' });
  }

  // الحصول على اسم الموقع (قد يستغرق وقتاً)
  const locationName = await reverseGeocode(latitude, longitude);

  // الحصول على عنوان IP
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip;

  const stmt = db.prepare(`
    INSERT INTO locations (latitude, longitude, accuracy, location_name, ip_address)
    VALUES (?, ?, ?, ?, ?)
  `);

  try {
    const info = stmt.run(latitude, longitude, accuracy || null, locationName, ip);
    res.status(201).json({
      message: 'تم حفظ الموقع بنجاح',
      id: info.lastInsertRowid,
      locationName: locationName // نعيده للواجهة الأمامية (اختياري)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'خطأ في الخادم أثناء الحفظ' });
  }
});

// نقطة API لجلب المواقع (محمية)
app.get('/api/locations', (req, res) => {
  if (req.query.password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'غير مصرح' });
  }
  const rows = db.prepare('SELECT * FROM locations ORDER BY timestamp DESC').all();
  res.json(rows);
});

// صفحة الإدارة
app.get('/admin', (req, res) => {
  if (req.query.password !== ADMIN_PASSWORD) {
    return res.status(401).send('غير مصرح. أضف ?password=كلمة_المرور');
  }
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
  console.log(`الخادم يعمل على http://localhost:${PORT}`);
});