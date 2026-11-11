# Social Monitor

لوحة ويب عربية لإدارة مجموعات مراقبة المحتوى والكلمات المفتاحية والنتائج.

## المتطلبات
- Node.js 20 أو أحدث
- حساب Firebase ومشروع مفعّل فيه Authentication (Email/Password) وCloud Firestore
- GitHub repository باسم `social-monitor`

## التشغيل المحلي
```bash
npm install
cp .env.example .env
```
ضع بيانات مشروع Firebase في `.env` ثم:
```bash
npm run dev
```

## إعداد Firebase
1. أنشئ مشروعاً في Firebase Console.
2. فعّل Authentication ثم Email/Password.
3. أنشئ Cloud Firestore في وضع الإنتاج.
4. انسخ إعدادات Web App إلى `.env`.
5. انشر قواعد الأمان:
```bash
firebase deploy --only firestore:rules,firestore:indexes
```

## البناء
```bash
npm run build
```

## النشر على GitHub Pages
- ارفع الملفات إلى مستودع اسمه `social-monitor`.
- تأكد أن `base` في `vite.config.ts` يطابق اسم المستودع.
- من إعدادات المستودع: Settings > Pages > Deploy from a branch أو استخدم GitHub Actions.
- بعد تثبيت الحزم محلياً:
```bash
npm run deploy
```

## ما الذي يعمل في هذه النسخة؟
- تسجيل دخول بالبريد وكلمة المرور.
- لوحة رئيسية.
- إضافة مجموعات يدوياً وإدارتها.
- صفحة مستقلة لكل مجموعة.
- إضافة الكلمات المفتاحية وتفعيلها وتعطيلها وحذفها.
- عرض النتائج التي أُدخلت إلى قاعدة البيانات من مصدر مصرح.

## ما الذي لم يُفعّل بعد؟
لا يوجد موصل Facebook في هذه النسخة. لا تقوم الواجهة بتسجيل الدخول إلى Facebook أو استخراج جلسات المتصفح أو جمع بيانات المجموعات. يجب تطوير `source adapter` منفصل بعد التحقق من وجود وسيلة وصول مصرح بها، ثم ربطه بوظائف خلفية آمنة. بيانات النتائج لا تصبح حقيقية إلا إذا أدخلها مصدر حقيقي موثوق.

## الأمان
- لا تضع مفاتيح Admin SDK أو أسراراً خاصة في متغيرات `VITE_`.
- إعدادات Firebase Web ظاهرة للمتصفح بطبيعتها؛ الحماية الفعلية تعتمد على Firestore Security Rules وقيود Authentication.
- لا تفتح قواعد Firestore للجميع.
- راجع تكاليف الخدمات الخلفية قبل تفعيلها.
