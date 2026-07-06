import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'flyai-super-secret-key-2026';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Formato: Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Acesso negado. Faça login para continuar.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Sessão expirada ou inválida.' });
    }
    req.user = user; // Salva os dados decodificados (id, username)
    next();
  });
}

export function generateToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
}
