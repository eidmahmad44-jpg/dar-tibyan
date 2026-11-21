# نشر التطبيق على الإنترنت (HTTPS) لتستخدمه الأسر

علامة «غير آمن» وكلمة `http` تظهر لأنك تفتح التطبيق من جهازك (`localhost`). هذا طبيعي للتجربة فقط.
لكي ترسل الرابط للناس يجب أن يعمل التطبيق على خادم دائم له عنوان `https://...`. اختر أحد الطريقين:

## الطريقة أ — للتجربة السريعة (مجانية، بجهازك)
1. شغّل `start-windows.bat` واترك نافذته مفتوحة.
2. حمّل برنامج `cloudflared` لويندوز من صفحة Cloudflare الرسمية، ثم في نافذة أوامر جديدة:
   `cloudflared tunnel --url http://localhost:3000`
3. سيعطيك رابطاً `https://xxxx.trycloudflare.com`. أرسله للأسر.
- عيوبها: يتغيّر الرابط في كل تشغيل، ويتوقف إن أغلقت الجهاز أو البرنامج. مناسبة للتجربة مع عدد قليل فقط.

## الطريقة ب — الموصى بها للاستخدام الفعلي (خادم + نطاق)
تكلفتها التقريبية: خادم VPS صغير (4–6 دولار شهرياً) + اسم نطاق (نحو 10 دولارات سنوياً).

1. **اشترِ نطاقاً** (مثل `tibyan-center.com`) و**خادم VPS** بنظام Ubuntu 22.04 أو أحدث (ذاكرة 1 جيجا تكفي).
2. من لوحة النطاق أضف سجل **A** يشير إلى عنوان IP الخادم.
3. ادخل على الخادم (SSH) ونفّذ:
```bash
sudo apt update && sudo apt install -y curl unzip caddy
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt install -y nodejs
sudo mkdir -p /opt/tibyan && cd /opt/tibyan
# ارفع الملف dar-tibyan.zip إلى الخادم (WinSCP أو scp) ثم:
sudo unzip -o dar-tibyan.zip && cd dar-tibyan
```
4. أنشئ خدمة تعمل دائماً وتعود بعد إعادة التشغيل: أنشئ الملف `/etc/systemd/system/tibyan.service`:
```ini
[Unit]
Description=Dar Tibyan
After=network.target
[Service]
WorkingDirectory=/opt/tibyan/dar-tibyan
Environment=HOST=127.0.0.1
Environment=PORT=3000
Environment=DATA_DIR=/var/lib/tibyan
Environment=SETUP_CODE=ضع-رمزاً-من-6-أرقام-هنا
ExecStart=/usr/bin/node server.js
Restart=always
User=www-data
[Install]
WantedBy=multi-user.target
```
ثم: `sudo mkdir -p /var/lib/tibyan && sudo chown www-data /var/lib/tibyan && sudo systemctl enable --now tibyan`
5. فعّل HTTPS تلقائياً بـ Caddy: ضع في `/etc/caddy/Caddyfile`:
```
tibyan-center.com {
    reverse_proxy 127.0.0.1:3000
}
```
ثم `sudo systemctl reload caddy`. (افتح المنفذين 80 و443 في جدار حماية الخادم.)
6. افتح `https://tibyan-center.com/app` وأنشئ حساب الشيخ برمز الإعداد الذي وضعته.

بعد ذلك يعمل زر «ثبّت التطبيق» على أندرويد وويندوز.

## النسخ الاحتياطي
البيانات كلها في المجلد `DATA_DIR` (`/var/lib/tibyan`). انسخه دورياً، أو نزّل نسخة من «الإعدادات ← نسخة احتياطية».

## تنبيه عن الاستضافات المجانية
منصات مثل Render وRailway في خططها المجانية تمسح الملفات عند إعادة التشغيل، فتضيع البيانات. إن استخدمتها فاشترك في خطة فيها **قرص دائم (Persistent Disk)** واضبط `DATA_DIR` عليه.

## إرسال الرابط للأسر
من «الإعدادات ← رابط التسجيل للأسر» انسخ الرابط أو شاركه على واتساب. كل ولي أمر يسجّل بنفسه، وإن فعّلت «القبول التلقائي» يوضع الطالب في المجموعة المناسبة دون تدخلك.
