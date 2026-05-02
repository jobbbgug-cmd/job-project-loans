CREATE DATABASE IF NOT EXISTS loan_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE loan_app;

-- ─── Roles ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id   INT AUTO_INCREMENT PRIMARY KEY,
  name ENUM('admin','staff','customer') NOT NULL UNIQUE,
  description VARCHAR(255)
);

INSERT IGNORE INTO roles (name, description) VALUES
  ('admin',    'System administrator with full access'),
  ('staff',    'Loan officer who manages loans and verifies payments'),
  ('customer', 'Borrower who applies for and repays loans');

-- ─── Users ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  role_id       INT NOT NULL,
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone         VARCHAR(20),
  address       TEXT,
  id_number     VARCHAR(50),
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- ─── Loans ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loans (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  loan_number      VARCHAR(20) UNIQUE NOT NULL,
  customer_id      INT NOT NULL,
  staff_id         INT,
  principal        DECIMAL(15,2) NOT NULL,
  interest_rate    DECIMAL(5,2)  NOT NULL,
  term_months      INT NOT NULL,
  monthly_payment  DECIMAL(15,2) NOT NULL,
  total_payment    DECIMAL(15,2) NOT NULL,
  total_interest   DECIMAL(15,2) NOT NULL,
  status           ENUM('pending','active','completed','defaulted','rejected') DEFAULT 'pending',
  start_date       DATE,
  end_date         DATE,
  purpose          TEXT,
  notes            TEXT,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES users(id),
  FOREIGN KEY (staff_id)    REFERENCES users(id)
);

-- ─── Payment Schedule (amortisation table) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_schedule (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  loan_id              INT NOT NULL,
  installment_no       INT NOT NULL,
  due_date             DATE NOT NULL,
  principal_component  DECIMAL(15,2) NOT NULL,
  interest_component   DECIMAL(15,2) NOT NULL,
  due_amount           DECIMAL(15,2) NOT NULL,
  outstanding_balance  DECIMAL(15,2) NOT NULL,
  status               ENUM('pending','paid','partial','overdue') DEFAULT 'pending',
  UNIQUE KEY uq_loan_installment (loan_id, installment_no),
  FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE
);

-- ─── Payments ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  loan_id          INT NOT NULL,
  schedule_id      INT,
  paid_by          INT NOT NULL,
  amount           DECIMAL(15,2) NOT NULL,
  payment_date     DATE NOT NULL,
  slip_filename    VARCHAR(255),
  slip_path        VARCHAR(500),
  status           ENUM('pending','approved','rejected') DEFAULT 'pending',
  verified_by      INT,
  verified_at      TIMESTAMP NULL,
  rejection_reason TEXT,
  notes            TEXT,
  is_late          TINYINT(1) DEFAULT 0,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (loan_id)     REFERENCES loans(id),
  FOREIGN KEY (schedule_id) REFERENCES payment_schedule(id),
  FOREIGN KEY (paid_by)     REFERENCES users(id),
  FOREIGN KEY (verified_by) REFERENCES users(id)
);

-- ─── Audit Logs ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT,
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id   INT,
  details     JSON,
  ip_address  VARCHAR(45),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ─── Default admin seed ──────────────────────────────────────────────────────
-- Password: Admin@1234  (bcrypt hash, salt rounds 12)
INSERT IGNORE INTO users (role_id, name, email, password_hash, is_active)
SELECT r.id, 'System Admin', 'admin@loanapp.com',
  '$2b$12$7BSzTxaohhQauPNqx2nybO.J.7/pcleYy7neQ5.GSS/vXX0/UOGDm', 1
FROM roles r WHERE r.name = 'admin';
