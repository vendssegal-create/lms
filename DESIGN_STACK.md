# LMS UI stack — dizayn qarori

**Holat (2026):** Loyiha **AdminLTE 2** va **Bootstrap 3** asosida qoladi; `static/css/custom.css` dagi dizayn tokenlari va `.lms-*` komponentlar orqali izchillik va qayta ishlatish ustuvor.

**Bootstrap 5 / yangi shell** keyingi bosqich sifatida ko‘rib chiqiladi: hajm katta (layout, modallar, formalarni qayta tekshirish), shuning uchun hozirgi bosqichda migratsiya **kechiktirilgan**.

**Asos:** tokenlar + partial shablonlar + asosiy sahifalarda inline stillarni klasslarga ko‘chirish — keyin A (AdminLTE+BS3) yoki B (BS5) tanlovi aniqroq bo‘ladi.
