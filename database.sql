-- Asil Kafe sipariş tabloları
-- Örnek: mysql -u root -p < database.sql
-- (Sunucu açılışta tabloları kendisi de oluşturur/yükseltir.)

CREATE DATABASE IF NOT EXISTS asil_kafe;
USE asil_kafe;

-- Sipariş başlığı (her sipariş için 1 satır)
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tableNo INT NOT NULL DEFAULT 0,
  paymentMethod VARCHAR(20) NOT NULL DEFAULT 'nakit', -- nakit | kart
  totalAmount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'yeni', -- yeni | hazirlaniyor | hazir | teslim_edildi
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sipariş kalemleri (her ürün için 1 satır)
CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  orderId INT NOT NULL,
  itemName VARCHAR(100) NOT NULL,
  quantity INT NOT NULL,
  totalPrice DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE
);
