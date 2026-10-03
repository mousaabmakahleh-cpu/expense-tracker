# Expense Tracker: Backend (Phase 1)

بهاد المجلد بنيت الـ API الكامل لمشروع Expense Tracker بـ Node.js و Express، وربطته بقاعدة بيانات PostgreSQL. الـ API بيدير المصاريف (إضافة، عرض، تعديل، حذف)، وبيفحص البيانات قبل ما يخزنها، وجربت كل endpoint بـ Thunder Client قبل ما أبدأ بالـ frontend.

## الأدوات اللي استخدمتها
- Node.js و Express
- مكتبة `pg` للاتصال بـ PostgreSQL
- مكتبة `cors` عشان الـ frontend يقدر يحكي مع السيرفر
- مكتبة `dotenv` لقراءة الإعدادات من ملف `.env`
- Thunder Client لاختبار الـ API

## الـ Endpoints

| Method | Path | الوظيفة | نجاح | أخطاء |
|---|---|---|---|---|
| GET | `/api/expenses` | كل المصاريف | 200 | — |
| GET | `/api/expenses/:id` | مصروف واحد | 200 | 404 |
| POST | `/api/expenses` | إضافة مصروف | 201 | 400 |
| PUT | `/api/expenses/:id` | تعديل مصروف | 200 | 400, 404 |
| DELETE | `/api/expenses/:id` | حذف مصروف | 200 | 404 |

شكل المصروف اللي بيرجعه الـ API:

```json
{
  "id": 1,
  "title": "Lunch",
  "amount": 4.5,
  "category": "Food",
  "date": "2026-01-15"
}
```

## قواعد الـ Validation

قبل أي `POST` أو `PUT`، السيرفر بيفحص البيانات، وإذا في مشكلة بيرجع **400** مع `message` بتشرحها:
- `title`: مطلوب، مش فاضي، وما بيزيد عن 100 حرف.
- `amount`: رقم أكبر من صفر.
- `category`: وحدة من: `Food` و `Transport` و `Bills` و `Entertainment` و `Other`.
- `date`: تاريخ حقيقي بصيغة `YYYY-MM-DD` (مثلاً `2026-02-30` بيترفض).

وقبل أي استعلام فيه `id`، السيرفر بيتأكد إنه رقم صحيح موجب. إذا مش هيك (مثل `abc`) بيرجع **404** فوراً بدون ما يوصل للـ database.

وأي رابط مش موجود بيرجع 404 كـ JSON، وأي body مش JSON صحيح بيرجع 400 كـ JSON.

## ملاحظات على الكود
- كل الاستعلامات بـ parameters (`$1` و `$2`...)، وما في ولا قيمة من المستخدم مدموجة بنص الـ SQL، عشان الحماية من SQL Injection.
- الـ database هي اللي بتولّد الـ `id`، وبستخدم `RETURNING` عشان أرجّع الصف الجديد أو المعدّل.
- مكتبة `pg` بترجع عمود `NUMERIC` كنص، وعمود `DATE` كـ JavaScript Date (وهاد ممكن يزحزح اليوم بسبب فرق التوقيت). عشان هيك بالـ SELECT بحوّل `amount::float8` لرقم، و `to_char(date, 'YYYY-MM-DD')` لنص ثابت.

---

## طريقة التشغيل

1. إنشاء database فاضية اسمها `expense_tracker` من pgAdmin.
2. تشغيل ملف `schema.sql` عليها من Query Tool. هو بيعمل جدول `expenses` وبيضيف 8 مصاريف تجريبية.
3. نسخ ملف `.env.example` لملف جديد اسمه `.env`، وكتابة كلمة سر PostgreSQL مكان `your_password_here`.
4. بـ terminal جوا مجلد `backend`:

   ```
   npm install
   node server.js
   ```

5. السيرفر بيشتغل على `http://localhost:3000`.

ما سلّمت مجلد `node_modules` لأنه بيرجع بـ `npm install`، وما سلّمت ملف `.env` لأنه فيه كلمة سر الـ database.

---

## صور الاختبار

كل صور اختبار الـ endpoints بـ Thunder Client موجودة بمجلد `api-tests`:

| الصورة | الطلب | النتيجة |
|---|---|---|
| `01-get-all-200` | `GET /api/expenses` | 200 |
| `02-get-one-200` | `GET /api/expenses/1` | 200 |
| `03-get-one-404` | `GET /api/expenses/99` | 404 |
| `04-post-201` | `POST /api/expenses` ببيانات صح | 201 |
| `05-post-400` | `POST /api/expenses` بعنوان فاضي ومبلغ صفر | 400 |
| `06-put-200` | `PUT /api/expenses/10` ببيانات صح | 200 |
| `07-put-400` | `PUT /api/expenses/10` بتصنيف غلط | 400 |
| `08-put-404` | `PUT /api/expenses/99` | 404 |
| `09-delete-200` | `DELETE /api/expenses/10` | 200 |
| `10-delete-404` | `DELETE /api/expenses/99` | 404 |
| `11-post-invalid-json-400` | `POST /api/expenses` بـ JSON مكسور | 400 |