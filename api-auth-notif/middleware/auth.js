import jwt from 'jsonwebtoken';
import 'dotenv/config';

export function wajibLogin(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ pesan: 'token diperlukan' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'pemrograman-mobile-api',
      audience: 'mobile-app',
      algorithms: ['HS256'],
    });
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({
      pesan: e.name === 'TokenExpiredError' ? 'token kedaluwarsa' : 'token tidak valid',
    });
  }
}