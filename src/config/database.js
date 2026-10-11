const mysql = require('mysql2/promise');
const config = require('./config');

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: config.DB_HOST,
      port: config.DB_PORT,
      user: config.DB_USER,
      password: config.DB_PASSWORD,
      database: config.DB_NAME,
      waitForConnections: true,
      connectionLimit: 15,
      queueLimit: 0,
      multipleStatements: true,
      decimalNumbers: true
    });
  }
  return pool;
}

const db = {
  getRawPool() {
    return getPool();
  },

  async query(sql, params = []) {
    const [rows] = await getPool().query(sql, params);
    return rows;
  },

  async getOne(sql, params = []) {
    const [rows] = await getPool().query(sql, params);
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  },

  async run(sql, params = []) {
    const [result] = await getPool().query(sql, params);
    return {
      insertId: result.insertId,
      lastInsertRowid: result.insertId,
      affectedRows: result.affectedRows,
      changedRows: result.changedRows
    };
  },

  async exec(sql) {
    return getPool().query(sql);
  },

  async transaction(callback) {
    const connection = await getPool().getConnection();
    await connection.beginTransaction();

    const tx = {
      async query(sql, params = []) {
        const [rows] = await connection.query(sql, params);
        return rows;
      },

      async getOne(sql, params = []) {
        const [rows] = await connection.query(sql, params);
        return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
      },

      async run(sql, params = []) {
        const [result] = await connection.query(sql, params);
        return {
          insertId: result.insertId,
          lastInsertRowid: result.insertId,
          affectedRows: result.affectedRows,
          changedRows: result.changedRows
        };
      }
    };

    try {
      const result = await callback(tx);
      await connection.commit();
      return result;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }
};

module.exports = db;
