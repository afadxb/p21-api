const path = require('path');
const sql = require('mssql');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const config = {
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  server: process.env.SQL_SERVER,
  port: parseInt(process.env.SQL_PORT || '1433'),
  database: process.env.SQL_DATABASE,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

module.exports = { sql, config };
