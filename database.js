// database.js
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'locations.db'));

// إنشاء الجدول إذا لم يكن موجوداً (مع العمود الجديد)
db.exec(`
  CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    accuracy REAL,
    location_name TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    ip_address TEXT
  )
`);

// إضافة عمود location_name إذا كان الجدول قديماً ولا يحتويه (آمن للتشغيل عدة مرات)
try {
  db.exec(`ALTER TABLE locations ADD COLUMN location_name TEXT`);
} catch (e) {
  // العمود موجود مسبقاً، لا مشكلة
}

module.exports = db;