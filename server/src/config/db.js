const mysql = require('mysql2/promise');
require('dotenv').config();

let pool = null;
let isConnected = false;

async function initDb() {
  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'pet_care_system',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 2000
    });

    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    isConnected = true;
    console.log('✅ Connected to MySQL database:', process.env.DB_NAME || 'pet_care_system');
  } catch (err) {
    isConnected = false;
    console.warn('⚠️  MySQL connection not available (' + err.message + ').');
    console.warn('   Operating with resilient memory fallback matching pet_care.sql schema.');
  }
}

// Initialise DB pool asynchronously
initDb();

module.exports = {
  getPool: () => pool,
  isDbConnected: () => isConnected,
  query: async (sql, params) => {
    if (!pool || !isConnected) {
      throw new Error('Database is not connected');
    }
    return pool.execute(sql, params);
  }
};
