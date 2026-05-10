CREATE TABLE IF NOT EXISTS line_messages (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  line_user_id VARCHAR(100),
  display_name VARCHAR(200),
  message    TEXT NOT NULL,
  used       TINYINT(1) NOT NULL DEFAULT 0,
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
