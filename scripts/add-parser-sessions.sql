CREATE TABLE IF NOT EXISTS parser_sessions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  label       VARCHAR(100),
  rows_data   JSON NOT NULL,
  sum_bet     DECIMAL(15,2) DEFAULT 0,
  sum_result  DECIMAL(15,2) DEFAULT 0,
  profit      DECIMAL(15,2) DEFAULT 0,
  saved_by    INT,
  saved_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
