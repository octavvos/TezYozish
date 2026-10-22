# TezYozish — tez yozish o'rgatish sayti

Backend: Django. Frontend: HTML, CSS, JavaScript (vanilla). Interfeys tillari: O'zbekcha, Русский, English.

## Imkoniyatlar

- **Ro'yxatdan o'tish / kirish** — username va parol (kamida 3 belgi), ism va familiya ixtiyoriy.
- **Yakka mashq** — til va mavzu tanlang, matnni yozing. Natija (so'z/daq, aniqlik, vaqt, xatolar) avtomatik saqlanadi.
- **Tez yozish darslari** — harflar tushib kelayotganda ularni ushlaydigan o'yin. Darajalar ketma-ket ochiladi.
- **Poyga** — lobby oching yoki kod bilan qo'shiling (2–6 kishi). Real vaqtda progress, sanoq va natijalar.
- **Natijalar** — barcha mashq va poyga natijalari, grafik va jadval.
- Matnlar: O'zbekcha, Русский, English; mavzular: oddiy hikoyalar, kompyuter, adabiyot.

## Lokal ishga tushirish

```bash
python -m venv .venv
.venv\Scripts\activate            # Windows
# source .venv/bin/activate       # Linux/macOS

pip install -r requirements.txt
python manage.py migrate
python manage.py load_texts       # matnlarni bazaga yuklash
python manage.py createsuperuser  # ixtiyoriy: admin paneli uchun
python manage.py runserver
```

Brauzerda: <http://127.0.0.1:8000/>

Testlar:

```bash
python manage.py test practice races
```

## Matnlarni tahrirlash

Matnlar `practice/data/texts.json` faylida. O'zgartirgandan keyin:

```bash
python manage.py load_texts
```

Yangi matn qo'shish uchun JSON'ga `{"lang": "uz|ru|en", "category": "story|computer|literature", "title": "...", "body": "..."}` yozuvini qo'shing.

## Serverga joylash (qisqacha)

1. Muhit o'zgaruvchilarini o'rnating:
   - `DJANGO_SECRET_KEY` — uzun tasodifiy kalit
   - `DJANGO_DEBUG=0`
   - `DJANGO_ALLOWED_HOSTS=sizning-domeningiz.uz`
2. `python manage.py collectstatic --noinput` va `python manage.py migrate`.
3. WSGI serveri bilan ishga tushiring, masalan `gunicorn config.wsgi` (`pip install gunicorn`), oldida Nginx.
4. Ma'lumotlar bazasi hozircha SQLite. Ko'p foydalanuvchi uchun PostgreSQL'ga o'tish tavsiya etiladi (`DATABASES` sozlamasi).

## Loyiha tuzilishi

```
config/          Django sozlamalari va URL'lar
accounts/        ro'yxatdan o'tish, kirish, chiqish API'lari
practice/        matnlar, mashq natijalari, darslar, asosiy sahifalar
races/           poyga modeli, lobby va poyga API'lari
templates/       HTML shablonlar
static/css/      uslublar
static/js/       i18n, umumiy API, yozish mexanizmi, sahifa skriptlari
```

Poyga holati har 0.9 soniyada serverdan so'raladi (polling). Bu WebSocket'siz ishlaydi va localhost'da ham, oddiy hostingda ham barqaror.
