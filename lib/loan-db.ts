import mysql from 'mysql2/promise';

declare global {
  var _loanMysqlPool: mysql.Pool | undefined;
}

const loanPool =
  global._loanMysqlPool ??
  mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.LOAN_DB_NAME || 'loan_app',
    socketPath: process.env.DB_SOCKET,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

if (process.env.NODE_ENV !== 'production') {
  global._loanMysqlPool = loanPool;
}

export default loanPool;
