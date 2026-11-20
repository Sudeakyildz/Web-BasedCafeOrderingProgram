# Asil Kafe – Web Tabanlı Sipariş Sistemi

QR kod ile menü açıp sipariş verebileceğiniz kafe sipariş uygulaması.

## Teknolojiler

- **Backend:** Node.js, Express
- **Veritabanı:** MySQL (isteğe bağlı; yoksa siparişler bellekte tutulur ve sunucu kapanınca silinir)
- **Frontend:** React (Vite), HTML, CSS, JavaScript

## Kurulum

```bash
git clone https://github.com/Sudeakyildz/Web-BasedCafeOrderingProgram.git
cd Web-BasedCafeOrderingProgram
npm install
npm run build:client   # React frontend'i derler (ilk seferde)
npm start
```

- **Menü:** http://localhost:3000  
- **QR için adres:** http://localhost:3000/qr-info  
- **Personel paneli:** http://localhost:3000/admin (siparişleri görme ve durum güncelleme)  

## MySQL (isteğe bağlı)

Siparişleri veritabanına kaydetmek için:

1. MySQL kurun ve çalıştırın.
2. `mysql -u root -p < database.sql` ile veritabanı ve tabloları oluşturun.
3. `.env.example` dosyasını `.env` olarak kopyalayıp `DB_USER`, `DB_PASSWORD` ayarlayın.
4. Sunucuyu yeniden başlatın.

## Masa numarası ve personel paneli

- Her masanın QR kodu `http://<ip>:3000/?masa=5` gibi olmalı; masa numarası siparişe otomatik yazılır (müşteri elle de girebilir).
- `/admin` sayfasında siparişler 5 saniyede bir yenilenir; durum: yeni → hazırlanıyor → hazır → teslim edildi.
- `.env` içinde `ADMIN_TOKEN` ayarlarsanız panel bu anahtarla her cihazdan açılır; ayarlamazsanız yalnızca sunucu bilgisayarından.
- Fiyatlar sunucudaki `data/menu.json` dosyasından hesaplanır; menüyü bu dosyadan düzenleyin.

## QR Kod

Müşteriler masadaki QR kodu okutunca menü açılır. Telefon ve sunucu **aynı WiFi** ağında olmalı.  
`/qr-info` sayfasında telefondan açılacak adres gösterilir; bu adresi QR koda çevirip kullanın.

## Lisans

MIT
