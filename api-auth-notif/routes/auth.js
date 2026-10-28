import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { wajibLogin } from '../middleware/auth.js';

const router = Router();

// Register
router.post('/register', async (req, res) => {
  const { nama, email, password } = req.body;
  if (!nama || !email || !password) {
    return res.status(400).json({ pesan: 'nama, email, dan password wajib diisi' });
  }
  if (password.length < 8) {
    return res.status(400).json({ pesan: 'password minimal 8 karakter' });
  }
  const emailBersih = email.trim().toLowerCase();
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const [hasil] = await pool.query(
      `INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)`,
      [nama.trim(), emailBersih, passwordHash]
    );
    return res.status(201).json({ id: hasil.insertId, nama: nama.trim(), email: emailBersih });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ pesan: 'email sudah terdaftar' });
    }
    return res.status(500).json({ pesan: 'gagal membuat akun' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ pesan: 'email dan password wajib diisi' });
  }
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email.trim().toLowerCase()]);
    if (rows.length === 0) return res.status(401).json({ pesan: 'email atau password salah' });

    const user = rows[0];
    const cocok = await bcrypt.compare(password, user.password_hash);
    if (!cocok) return res.status(401).json({ pesan: 'email atau password salah' });

    const token = jwt.sign(
      { email: user.email, nama: user.nama },
      process.env.JWT_SECRET,
      {
        subject: String(user.id),
        expiresIn: process.env.JWT_EXPIRES_IN || '1h',
        issuer: 'pemrograman-mobile-api',
        audience: 'mobile-app',
        algorithm: 'HS256',
      }
    );
    return res.json({ token, user: { id: user.id, nama: user.nama, email: user.email } });
  } catch (e) {
    return res.status(500).json({ pesan: 'gagal login' });
  }
});

// Profil Privat (/auth/me)
router.get('/me', wajibLogin, async (req, res) => {
  const [rows] = await pool.query('SELECT id, nama, email, dibuat_pada FROM users WHERE id = ?', [req.user.sub]);
  if (rows.length === 0) return res.status(404).json({ pesan: 'pengguna tidak ditemukan' });
  res.json(rows[0]);
});


// Simpan atau Perbarui Push Token
router.post('/notifications/token', wajibLogin, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ pesan: 'Token notifikasi wajib diisi' });
    }

    const query = `
      INSERT INTO push_tokens (user_id, token) 
      VALUES (?, ?) 
      ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)
    `;

    await pool.query(query, [userId, token]);

    return res.json({ pesan: 'Push token berhasil disimpan' });
  } catch (error) {
    console.error('Gagal menyimpan push token:', error);
    return res.status(500).json({ pesan: 'Kesalahan pada server' });
  }
});

// Kirim Push Notification ke Pengguna
router.post('/notifications/send', wajibLogin, async (req, res) => {
  try {
    const userId = req.user.sub; // Atau tentukan user_id target tujuan
    const { title, body } = req.body;

    // Ambil token perangkat milik user dari database MySQL
    const [rows] = await pool.query('SELECT push_token FROM push_tokens WHERE user_id = ?', [userId]);

    if (rows.length === 0) {
      return res.status(404).json({ pesan: 'Token notifikasi untuk pengguna ini tidak ditemukan' });
    }

    // Ambil token pertama yang terdaftar
    const pushToken = rows[0].push_token;

    // Validasi format Expo Push Token
    if (!pushToken.startsWith('ExponentPushToken[') && !pushToken.startsWith('ExpoPushToken[')) {
      return res.status(400).json({ pesan: 'Format token tidak valid' });
    }

    // Kirim permintaan HTTP POST ke Expo Push Notification API
    const message = {
      to: pushToken,
      sound: 'default',
      title: title || 'Halo dari Backend!',
      body: body || 'Ini adalah uji coba push notification.',
      data: { extraData: 'Informasi tambahan' },
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'accept',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    return res.json({ pesan: 'Notifikasi berhasil dikirim', result });
  } catch (error) {
    console.error('Gagal mengirim notifikasi:', error);
    return res.status(500).json({ pesan: 'Kesalahan pada server saat mengirim notifikasi' });
  }
});

export default router;