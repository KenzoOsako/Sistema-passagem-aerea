import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao conectar com banco SQLite:', err.message);
  } else {
    console.log('✅ Conectado ao banco de dados SQLite.');
    db.run("PRAGMA journal_mode = WAL;");
    db.run("PRAGMA foreign_keys = ON;");
  }
});

// Inicialização da Tabela
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    date TEXT NOT NULL,
    target_price REAL NOT NULL
  )`);
  
  // Migração: Adicionar coluna end_date se não existir
  db.run(`ALTER TABLE alerts ADD COLUMN end_date TEXT`, (err) => {
    // Ignorar erro se a coluna já existir (SQLITE_ERROR: duplicate column name)
  });
  
  // Migração: Adicionar coluna user_id na tabela alerts
  db.run(`ALTER TABLE alerts ADD COLUMN user_id INTEGER`, (err) => {});

  // Criação da tabela de Usuários (Autenticação)
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Criação da tabela de Cache de Voos
  db.run(`CREATE TABLE IF NOT EXISTS flight_cache (
    cache_key TEXT PRIMARY KEY,
    result_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Wrappers com Promise para usar async/await
export const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

export const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export default db;
