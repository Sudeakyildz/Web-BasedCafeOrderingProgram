# ☕ Asil Kafe – Web Tabanlı Sipariş Sistemi

Müşterilerin masadaki QR kodu okutup telefondan menüyü açtığı, sipariş verdiği ve ödeme yöntemini seçtiği kafe sipariş uygulaması. Personel, siparişleri ayrı bir panelden takip eder ve durumlarını günceller.

## Özellikler

- 📱 QR kod ile açılan, mobil uyumlu menü ve sepet
- 🪑 Masa numarası (QR adresinden otomatik: `/?masa=5`)
- 💳 Ödeme yöntemi seçimi: Nakit veya Kart (ödeme masada alınır, online ödeme yoktur)
- 🧑‍🍳 Personel paneli (`/admin`): siparişler 5 saniyede bir yenilenir, durum takibi
  (yeni → hazırlanıyor → hazır → teslim edildi)
- 🔒 Fiyatlar sunucuda hesaplanır; istemciden gelen fiyata güvenilmez
- 🗄️ MySQL desteği (isteğe bağlı); yoksa siparişler bellekte tutulur

## Teknolojiler

- **Backend:** Node.js, Express
- **Veritabanı:** MySQL (isteğe bağlı)
- **Frontend:** React 19, Vite

## Kurulum

```bash
git clone https://github.com/Sudeakyildz/Web-BasedCafeOrderingProgram.git
cd Web-BasedCafeOrderingProgram
npm install
npm run build:client   # React arayüzünü derler (ilk seferde ve arayüz değişince)
cp .env.example .env   # Windows: copy .env.example .env
npm start
```

| Adres | Açıklama |
|-------|----------|
| http://localhost:3000 | Müşteri menüsü |
| http://localhost:3000/admin | Personel paneli |
| http://localhost:3000/qr-info | QR kod için telefondan erişilecek adres |

## Ortam değişkenleri (`.env`)

| Değişken | Açıklama |
|----------|----------|
| `PORT` | Sunucu portu (varsayılan `3000`) |
| `ADMIN_TOKEN` | Personel paneli ve sipariş listesi için gizli anahtar. Boşsa panel yalnızca sunucu bilgisayarından (localhost) açılır. |
| `CORS_ORIGIN` | Başka bir adresten API çağrılacaksa izin verilen origin (varsayılan: yalnızca aynı origin) |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL bağlantı bilgileri |
| `USE_MEMORY_STORE=1` | MySQL'i denemeden bellek modunda çalıştırır |

> `.env` dosyası `.gitignore`'dadır, GitHub'a gönderilmez. `.env` değişince sunucuyu yeniden başlatın.

## Personel paneli

1. `.env` dosyasına bir anahtar yazın: `ADMIN_TOKEN=kendi-gizli-sifreniz`
2. Sunucuyu yeniden başlatın.
3. `/admin` sayfasında anahtarı girip **Bağlan**'a basın.

Sadece sunucu bilgisayarından bakacaksanız `ADMIN_TOKEN` boş bırakılabilir.

## MySQL (isteğe bağlı)

1. MySQL'i kurup çalıştırın.
2. `mysql -u root -p < database.sql` ile veritabanını ve tabloları oluşturun
   (sunucu açılışta tabloları kendisi de oluşturur ve eski şemayı yükseltir).
3. `.env` içinde `DB_USER` ve `DB_PASSWORD` değerlerini ayarlayın.
4. Sunucuyu yeniden başlatın.

MySQL'e ulaşılamazsa sunucu bellek moduna geçer; bu modda siparişler sunucu kapanınca silinir.

## QR kod ve masa numarası

Müşteriler masadaki QR kodu okutunca menü açılır. Telefon ve sunucu **aynı WiFi ağında** olmalıdır.

1. `/qr-info` sayfasında telefondan açılacak adresi görün.
2. Her masa için adresin sonuna masa numarasını ekleyin, örneğin `http://192.168.1.10:3000/?masa=5`.
3. Bu adresleri bir QR kod sitesinde QR koda çevirip masalara yapıştırın.

Bilgisayarın IP adresi değişirse QR kodların yenilenmesi gerekir.

## Menüyü düzenleme

Ürünler ve fiyatlar `data/menu.json` dosyasındadır. Dosyayı düzenleyip sunucuyu yeniden başlatmanız yeterlidir. Sipariş tutarı her zaman bu dosyadaki fiyatlardan hesaplanır.

## API

| Yöntem | Adres | Açıklama |
|--------|-------|----------|
| GET | `/api/menu` | Menü |
| POST | `/api/orders` | Sipariş oluşturur: `{ tableNo, paymentMethod, items: [{ id, quantity }] }` |
| GET | `/api/orders` | Siparişleri listeler (yönetici) |
| PATCH | `/api/orders/:id/status` | Sipariş durumunu günceller (yönetici) |

Yönetici istekleri `X-Admin-Token` başlığı ister.

## Geliştirme

```bash
npm start              # sunucu (3000)
npm run dev:client     # React geliştirme sunucusu, /api isteklerini 3000'e yönlendirir
```

## Lisans

MIT
