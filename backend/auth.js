import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.trim() !== JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('Configure JWT_SECRET com pelo menos 32 caracteres aleatórios, sem espaços nas extremidades.');
}

function validIdentity(user) {
  return user && typeof user === 'object' && Number.isSafeInteger(user.id) && user.id > 0;
}

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = typeof authHeader === 'string' && /^Bearer ([^\s]+)$/i.exec(authHeader)?.[1];

  if (!token) {
    return res.status(401).json({ error: 'Acesso negado. Faça login para continuar.' });
  }

  jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }, (err, user) => {
    if (err || !validIdentity(user) || !Number.isSafeInteger(user.exp) || user.exp <= Date.now() / 1000) {
      return res.status(403).json({ error: 'Sessão expirada ou inválida.' });
    }
    req.user = user; // Salva os dados decodificados (id, username)
    next();
  });
}

export function generateToken(user) {
  if (!validIdentity(user)) throw new Error('Identidade inválida para criar sessão.');
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '7d' });
}
