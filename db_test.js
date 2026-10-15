const sql = require('mssql');

const config = {
  user: process.env.SQL_USER || 'reports',
  password: process.env.SQL_PASSWORD || 'reports',
  server: process.env.SQL_SERVER || '192.168.1.13',
  port: parseInt(process.env.SQL_PORT || '1433'),
  database: process.env.SQL_DATABASE || 'commercecenter',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

module.exports = { sql, config };
