require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const CORS_ORIGIN = process.env.CORS_ORIGIN || ''; // boşsa sadece aynı origin

const STATUSES = ['yeni', 'hazirlaniyor', 'hazir', 'teslim_edildi'];
const PAYMENT_METHODS = ['nakit', 'kart'];
const MAX_TABLE = 999;
const MAX_QTY = 50;
const MAX_LINES = 30;

// ---------- Menü (fiyatların tek doğru kaynağı) ----------
const menuCategories = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'data', 'menu.json'), 'utf8')
);
const menuById = new Map();
for (const cat of menuCategories) {
    for (const item of cat.items) menuById.set(item.id, item);
}

// ---------- Ağ yardımcıları ----------
function isVirtualAdapter(name, address) {
    const nameLower = (name || '').toLowerCase();
    if (/virtual|vethernet|vmware|vbox|wsl|loopback/.test(nameLower)) return true;
    if (/^192\.168\.56\.|^192\.168\.59\.|^10\.0\.2\./.test(address)) return true;
    return false;
}

function getAllLocalIPs() {
    const list = [];
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
        for (const iface of ifaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                list.push({ name, address: iface.address });
            }
        }
    }
    return list;
}

function getLocalIP() {
    const list = getAllLocalIPs();
    const real = list.filter(({ name, address }) => !isVirtualAdapter(name, address));
    const pick = real.length > 0 ? real : list;
    return pick.length > 0 ? pick[0].address : 'localhost';
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
}

// ---------- Depolama: MySQL (varsa) veya bellek ----------
const store = { mode: 'memory' };

const memory = { seq: 0, orders: [] };

function memoryStore() {
    return {
        mode: 'memory',
        async createOrder({ tableNo, paymentMethod, totalAmount, lines }) {
            const id = ++memory.seq;
            memory.orders.unshift({
                id, tableNo, paymentMethod, totalAmount, status: 'yeni',
                createdAt: new Date().toISOString(),
                items: lines.map((l) => ({ ...l })),
            });
            if (memory.orders.length > 200) memory.orders.pop();
            return id;
        },
        async listOrders(limit) {
            return memory.orders.slice(0, limit);
        },
        async setStatus(id, status) {
            const o = memory.orders.find((x) => x.id === id);
            if (!o) return false;
            o.status = status;
            return true;
        },
    };
}

async function ensureSchema(pool) {
    await pool.query(`CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tableNo INT NOT NULL DEFAULT 0,
        paymentMethod VARCHAR(20) NOT NULL DEFAULT 'nakit',
        totalAmount DECIMAL(10,2) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'yeni',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        orderId INT NOT NULL,
        itemName VARCHAR(100) NOT NULL,
        quantity INT NOT NULL,
        totalPrice DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE
    )`);
    // Eski şemadan yükseltme: eksik sütunları ekle
    const [cols] = await pool.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'`
    );
    const have = new Set(cols.map((c) => c.COLUMN_NAME));
    if (!have.has('tableNo')) await pool.query('ALTER TABLE orders ADD COLUMN tableNo INT NOT NULL DEFAULT 0');
    if (!have.has('paymentMethod')) await pool.query("ALTER TABLE orders ADD COLUMN paymentMethod VARCHAR(20) NOT NULL DEFAULT 'nakit'");
    if (!have.has('status')) await pool.query("ALTER TABLE orders ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'yeni'");
}

function mysqlStore(pool) {
    return {
        mode: 'mysql',
        async createOrder({ tableNo, paymentMethod, totalAmount, lines }) {
            const conn = await pool.getConnection();
            try {
                await conn.beginTransaction();
                const [r] = await conn.query(
                    'INSERT INTO orders (tableNo, paymentMethod, totalAmount) VALUES (?, ?, ?)',
                    [tableNo, paymentMethod, totalAmount]
                );
                const rows = lines.map((l) => [r.insertId, l.itemName, l.quantity, l.totalPrice]);
                await conn.query(
                    'INSERT INTO order_items (orderId, itemName, quantity, totalPrice) VALUES ?',
                    [rows]
                );
                await conn.commit();
                return r.insertId;
            } catch (err) {
                try { await conn.rollback(); } catch (_) { /* yoksay */ }
                throw err;
            } finally {
                conn.release();
            }
        },
        async listOrders(limit) {
            const [orders] = await pool.query(
                'SELECT id, tableNo, paymentMethod, totalAmount, status, createdAt FROM orders ORDER BY id DESC LIMIT ?',
                [limit]
            );
            if (orders.length === 0) return [];
            const [items] = await pool.query(
                'SELECT orderId, itemName, quantity, totalPrice FROM order_items WHERE orderId IN (?)',
                [orders.map((o) => o.id)]
            );
            const byOrder = new Map();
            for (const it of items) {
                if (!byOrder.has(it.orderId)) byOrder.set(it.orderId, []);
                byOrder.get(it.orderId).push({
                    itemName: it.itemName,
                    quantity: it.quantity,
                    totalPrice: Number(it.totalPrice),
                });
            }
            return orders.map((o) => ({
                ...o,
                totalAmount: Number(o.totalAmount),
                items: byOrder.get(o.id) || [],
            }));
        },
        async setStatus(id, status) {
            const [r] = await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
            return r.affectedRows > 0;
        },
    };
}

async function initStore() {
    if (process.env.USE_MEMORY_STORE === '1') {
        Object.assign(store, memoryStore());
        console.log('Bellek modu: siparişler sunucu yeniden başlayınca silinir.');
        return;
    }
    try {
        const pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '3306', 10),
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'asil_kafe',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            connectTimeout: 5000,
        });
        await ensureSchema(pool);
        Object.assign(store, mysqlStore(pool));
        console.log('MySQL bağlantısı hazır.');
    } catch (err) {
        console.warn('MySQL kullanılamıyor (' + (err.message || err.code || 'bağlantı kurulamadı') + ').');
        console.warn('Bellek modu: siparişler sunucu yeniden başlayınca silinir.');
        Object.assign(store, memoryStore());
    }
}

// ---------- Middleware ----------
app.disable('x-powered-by');
app.use(express.json({ limit: '20kb' }));

// CORS: varsayılan olarak yalnızca aynı origin. Gerekirse CORS_ORIGIN ayarlayın.
app.use((req, res, next) => {
    if (CORS_ORIGIN) {
        res.header('Access-Control-Allow-Origin', CORS_ORIGIN);
        res.header('Vary', 'Origin');
        res.header('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
        if (req.method === 'OPTIONS') return res.sendStatus(204);
    }
    next();
});

function safeEqual(a, b) {
    const ha = crypto.createHash('sha256').update(String(a)).digest();
    const hb = crypto.createHash('sha256').update(String(b)).digest();
    return crypto.timingSafeEqual(ha, hb);
}

// Personel yetkisi: ADMIN_TOKEN ayarlıysa token şart; değilse yalnızca bu bilgisayardan.
function requireAdmin(req, res, next) {
    if (ADMIN_TOKEN) {
        if (safeEqual(req.get('X-Admin-Token') || '', ADMIN_TOKEN)) return next();
        return res.status(401).json({ error: 'Yetkisiz' });
    }
    const ip = req.socket.remoteAddress || '';
    if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return next();
    return res.status(403).json({ error: 'Personel paneli için .env içinde ADMIN_TOKEN ayarlayın.' });
}

// Basit IP başına hız sınırı (sipariş spam'ine karşı)
const hits = new Map();
function rateLimit(max, windowMs) {
    return (req, res, next) => {
        const now = Date.now();
        const key = req.ip;
        const rec = hits.get(key) || { count: 0, reset: now + windowMs };
        if (now > rec.reset) { rec.count = 0; rec.reset = now + windowMs; }
        rec.count += 1;
        hits.set(key, rec);
        if (rec.count > max) {
            return res.status(429).json({ error: 'Çok fazla istek, lütfen biraz bekleyin.' });
        }
        next();
    };
}
setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
}, 60 * 1000).unref();

// ---------- Statik dosyalar ----------
const clientBuild = path.join(__dirname, 'client', 'dist');
const hasBuild = () => fs.existsSync(path.join(clientBuild, 'index.html'));
app.use(express.static(clientBuild));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- API ----------
app.get('/api/menu', (req, res) => res.json(menuCategories));

// Sipariş doğrulama: fiyat daima sunucudaki menüden hesaplanır.
function parseOrder(body) {
    const { tableNo, items, paymentMethod } = body || {};
    const table = Number(tableNo);
    if (!Number.isInteger(table) || table < 1 || table > MAX_TABLE) {
        return { error: `Geçerli bir masa numarası girin (1-${MAX_TABLE}).` };
    }
    if (!PAYMENT_METHODS.includes(paymentMethod)) {
        return { error: 'Lütfen bir ödeme yöntemi seçin.' };
    }
    if (!Array.isArray(items) || items.length === 0 || items.length > MAX_LINES) {
        return { error: 'Sipariş boş veya çok uzun.' };
    }
    const merged = new Map();
    for (const it of items) {
        const qty = Number(it && it.quantity);
        const menuItem = menuById.get(it && it.id);
        if (!menuItem) return { error: 'Menüde olmayan ürün.' };
        if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
            return { error: `Adet 1 ile ${MAX_QTY} arasında olmalı.` };
        }
        merged.set(menuItem.id, (merged.get(menuItem.id) || 0) + qty);
    }
    const lines = [];
    let totalAmount = 0;
    for (const [id, quantity] of merged) {
        if (quantity > MAX_QTY) return { error: `Adet 1 ile ${MAX_QTY} arasında olmalı.` };
        const m = menuById.get(id);
        const totalPrice = m.price * quantity;
        totalAmount += totalPrice;
        lines.push({ itemName: m.name, quantity, totalPrice });
    }
    return { tableNo: table, paymentMethod, totalAmount, lines };
}

app.post('/api/orders', rateLimit(20, 60 * 1000), async (req, res) => {
    const parsed = parseOrder(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    try {
        const id = await store.createOrder(parsed);
        res.status(201).json({
            id,
            totalAmount: parsed.totalAmount,
            persisted: store.mode === 'mysql',
            message: 'Siparişiniz alındı! Afiyet olsun.',
        });
    } catch (err) {
        console.error('Sipariş kaydedilemedi:', err.message);
        res.status(503).json({ error: 'Sipariş şu an kaydedilemedi, lütfen tekrar deneyin.' });
    }
});

app.get('/api/orders', requireAdmin, async (req, res) => {
    try {
        res.json(await store.listOrders(100));
    } catch (err) {
        console.error('Siparişler okunamadı:', err.message);
        res.status(503).json({ error: 'Siparişler okunamadı.' });
    }
});

app.patch('/api/orders/:id/status', requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const { status } = req.body || {};
    if (!Number.isInteger(id) || !STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Geçersiz istek.' });
    }
    try {
        const ok = await store.setStatus(id, status);
        if (!ok) return res.status(404).json({ error: 'Sipariş bulunamadı.' });
        res.json({ id, status });
    } catch (err) {
        console.error('Durum güncellenemedi:', err.message);
        res.status(503).json({ error: 'Durum güncellenemedi.' });
    }
});

app.get('/api/qr-url', (req, res) => {
    const ip = getLocalIP();
    res.json({ url: `http://${ip}:${port}`, ip, port });
});

// ---------- Sayfalar ----------
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/qr-info', (req, res) => {
    const ip = getLocalIP();
    const url = `http://${ip}:${port}`;
    const others = getAllLocalIPs()
        .filter(({ address }) => address !== ip)
        .map(({ address }) => escapeHtml(`http://${address}:${port}`))
        .join('<br>');
    const othersHtml = others ? `<p class="note">Bu açılmazsa dene:<br>${others}</p>` : '';
    res.send(`<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>QR Kod Adresi - Asil Kafe</title>
  <style>
    body { font-family: sans-serif; max-width: 600px; margin: 2rem auto; padding: 1rem; background: #1C2025; color: #F5F5F5; text-align: center; }
    h1 { color: #FFD700; }
    .url { font-size: 1.4rem; word-break: break-all; background: #282C34; padding: 1rem; border-radius: 8px; margin: 1rem 0; color: #FFD700; }
    .note { color: #aaa; font-size: 0.9rem; margin-top: 2rem; }
    a { color: #FFD700; }
  </style>
</head>
<body>
  <h1>📱 QR Kod İçin Adres</h1>
  <p>Masanıza basacağınız QR kod <strong>şu adresi</strong> göstermeli:</p>
  <p class="url">${escapeHtml(url)}</p>
  ${othersHtml}
  <p>Masa numarası için adresin sonuna <code>/?masa=5</code> ekleyin (ör. ${escapeHtml(url)}/?masa=5).</p>
  <p>Bu adresi <a href="https://www.qr-code-generator.com/" target="_blank" rel="noopener">ücretsiz QR sitelerinden</a> biriyle QR koda çevirip yazdırın.</p>
  <p class="note">⚠️ Telefon ve bu bilgisayar <strong>aynı WiFi ağında</strong> olmalı. Bilgisayarın IP'si değişirse yeni QR basmanız gerekir.</p>
</body>
</html>`);
});

app.get('/', (req, res) => {
    if (!hasBuild()) {
        return res.status(503).send('Arayüz derlenmemiş. Önce "npm run build:client" çalıştırın.');
    }
    res.sendFile(path.join(clientBuild, 'index.html'));
});

// ---------- Başlat ----------
initStore().then(() => {
    const server = app.listen(port, '0.0.0.0', () => {
        const ip = getLocalIP();
        console.log(`Sunucu http://localhost:${port} adresinde çalışıyor`);
        console.log(`QR kod / telefondan erişim: http://${ip}:${port}`);
        console.log(`Personel paneli: http://localhost:${port}/admin`);
    });
    server.on('error', (err) => {
        console.error('Sunucu başlatılamadı:', err.message);
        process.exit(1);
    });
});
