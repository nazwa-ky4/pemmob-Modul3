import 'dotenv/config';
import app from './app.js';
import { cekKoneksiDatabase } from './db.js';

const PORT = Number(process.env.PORT || 3000);
try {
  await cekKoneksiDatabase();
  app.listen(PORT, '0.0.0.0', () => console.log(`Server jalan di port ${PORT}`));
} catch (e) {
  console.error('Gagal mulai:', e.message);
}