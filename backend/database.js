const mysql = require("mysql2/promise");

// DATETIME values, CURRENT_TIMESTAMP defaults, NOW(), and the JS driver must
// agree with the UTC_TIMESTAMP comparisons used by the dispatcher and tokens.
// The driver's timezone option alone does not change the MySQL session zone.
function createUtcPool(config) {
  const pool = mysql.createPool({ ...config, timezone: "Z" });
  pool.on("connection", connection => {
    // mysql2 emits this before handing out the connection. Its command queue
    // runs this statement before any query submitted by the application.
    connection.query("SET SESSION time_zone = '+00:00'", error => {
      if (error) {
        console.error("[DB_TIMEZONE_INIT_FAILED]", { code: error.code });
        connection.destroy();
      }
    });
  });
  return pool;
}

module.exports = { createUtcPool };
