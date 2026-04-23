# HEMIS OTM API — To'liq Dokumentatsiya

> **Swagger UI:** `https://student.bstu.uz/rest/docs#/`  
> **OpenAPI Spec:** `https://student.bstu.uz/rest/docs.json`  
> **API Versiyasi:** 1.3 (OpenAPI 3.0.0)  
> **Jami endpointlar:** 74+ ta (5 guruhda)

---

## API Guruhlari

| Guruh | Auth turi | Maqsad |
|---|---|---|
| **Backend API** | Bearer token (admin panel) | Ma'lumotlarni olish, sinxronizatsiya |
| **Student API** | JWT (login yoki OAuth) | Talaba shaxsiy kabineti |
| **Tutor API** | JWT (tutor login) | O'qituvchi portali |
| **Public API** | Yo'q (ochiq) | Ommaviy ma'lumotlar |
| **Fast API** | Token (query param) | Agregatlangan statistika |

---

## Umumiy ma'lumotlar

### Autentifikatsiya

**Backend API — Bearer Token:**
```http
Authorization: Bearer ZhEeBd2HW8xTBzi0PUoBV8vcyZEjlO1z
Accept: application/json
```

**Student/Tutor API — JWT:**
```http
Authorization: Bearer <jwt_token>
Accept: application/json
```

**Fast API — Query param:**
```
GET /student-gpa-summary?token=<token>
```

### Rate Limiting
- **Backend API:** 10 req/s per IP
- **Student login:** 10 xato/10 daqiqa per IP; 10 xato/60 daqiqa per login
- **AI Chat:** Kuniga 15 ta keshlanmagan so'rov

### Tillar
`l` parametri orqali til tanlash: `uz` (standart), `ru`, `en`, `oz` (lotin)

### Pagination (barcha list endpointlarda)
| Param | Default | Max |
|---|---|---|
| `page` | 1 | — |
| `limit` | 20 | 200 |

### Umumiy javob formati
```json
{
  "data": {
    "items": [...],
    "pagination": {
      "totalCount": 3500,
      "pageCount": 18,
      "currentPage": 1,
      "perPage": 200
    }
  }
}
```

### Sana formati
Barcha sana va vaqt qiymatlari **Unix timestamp (UTC)** formatida.

---

---

# BACKEND API

> **Auth:** `Authorization: Bearer <admin_token>`  
> **Base:** `https://student.bstu.uz/rest`

---

## 1. Talabalar ro'yxati
- **URL:** `GET /v1/data/student-list`
- **Tavsif:** Barcha talabalar ro'yxati — keng filtr imkoniyatlari bilan.

**Query Params:**
| Param | Type | Tavsif |
|---|---|---|
| `page` | int | Sahifa raqami |
| `limit` | int | Sahifadagi elementlar (max 200) |
| `_education_form` | int | Ta'lim shakli ID |
| `_education_type` | int | Ta'lim turi ID |
| `_payment_form` | int | To'lov shakli ID |
| `_department` | int | Fakultet ID |
| `_group` | int | Guruh ID |
| `_specialty` | int | Mutaxassislik ID |
| `_curriculum` | int | O'quv reja ID |
| `_level` | int | Kurs raqami |
| `_semester` | int | Semestr ID |
| `_province` | int | Viloyat ID |
| `_district` | int | Tuman ID |
| `_gender` | string | Jins (`male`/`female`) |
| `_citizenship` | int | Fuqarolik ID |
| `_student_status` | int | Talaba holati ID |
| `search` | string | Ismi bo'yicha qidiruv |
| `passport_pin` | string | JSHSHIR raqami |
| `passport_number` | string | Passport seriya va raqami |
| `tutor_pin` | string | Tutor JSHSHIR |
| `updated_at_from` | int | Yangilangan vaqt (dan) Unix timestamp |
| `updated_at_to` | int | Yangilangan vaqt (gacha) Unix timestamp |

**Misol so'rov:**
```http
GET /v1/data/student-list?page=1&limit=200&_department=5&_level=3
Authorization: Bearer <token>
```

**Misol javob:**
```json
{
  "data": {
    "items": [
      {
        "student_id_number": "STU20231001",
        "full_name": "Aliyev Abdulloh Akbarovich",
        "gender": "male",
        "birth_date": 946684800,
        "avg_gpa": 3.75,
        "education_form": {"name": "Kunduzgi"},
        "education_type": {"name": "Bakalavr"},
        "payment_form": {"name": "Davlat granti"},
        "student_status": {"name": "O'qimoqda"},
        "department": {"id": 5, "name": "Axborot texnologiyalari"},
        "specialty": {"id": 55, "name": "Dasturiy injiniring"},
        "group": {"id": 301, "name": "DI-21-01"},
        "level": {"name": "3-kurs"},
        "semester": {"name": "5-semestr"},
        "educationYear": {"name": "2023-2024"}
      }
    ],
    "pagination": {"totalCount": 3500, "pageCount": 18, "currentPage": 1, "perPage": 200}
  }
}
```

---

## 2. Talaba batafsil ma'lumoti
- **URL:** `GET /v1/data/student-info`
- **Tavsif:** Bitta talabaning ma'muriy va akademik ma'lumotlari + transkript.

**Query Params:**
| Param | Type | Tavsif |
|---|---|---|
| `student_id_number` | string | Talabaning ochiq ID (masalan `STU20231001`) |
| `student_id` | string | Talabaning ichki ID |

**Misol javob:**
```json
{
  "data": {
    "student_id_number": "STU20231001",
    "full_name": "Aliyev Abdulloh",
    "subjects": [
      {
        "name": "Matematika",
        "credit": 3,
        "grade": 4,
        "total_point": 78.5,
        "semester": {"name": "1-semestr"}
      }
    ]
  }
}
```

---

## 3. Talaba tarixi (meta log)
- **URL:** `GET /v1/data/student-meta-log-list`
- **Tavsif:** Talabaning holat o'zgarishlari tarixi (guruh, status, o'quv reja o'zgarishlari).

**Query Params:** `page`, `limit`, `student_id_number`, `_student`, `_education_form`, `_education_type`, `_education_year`, `_payment_form`, `_grant_type`, `_department`, `_group`, `_specialty`, `_curriculum`, `_level`, `_semester`, `_student_status`, `updated_at_from`, `updated_at_to`, `created_at_from`, `created_at_to`

---

## 4. Akademik yozuvlar (baholar)
- **URL:** `GET /v1/data/academic-record-list`
- **Tavsif:** Akkreditatsiya baholari ro'yxati. Qarzdorlik va o'zlashtirish tahlili uchun.

**Query Params:**
| Param | Type | Tavsif |
|---|---|---|
| `page` | int | Sahifa |
| `limit` | int | Limit (max 200) |
| `_semester` | int | Semestr ID |
| `_education_year` | string | O'quv yili (masalan `2023-2024`) |
| `_subject` | int | Fan ID |
| `_curriculum` | int | O'quv reja ID |
| `_employee` | int | O'qituvchi ID |
| `_student` | int | Talaba ichki ID |
| `updated_at_from` | int | O'zgargan vaqt (dan) |
| `updated_at_to` | int | O'zgargan vaqt (gacha) |

> **Delta sync uchun:** `updated_at_from` parametri yordamida faqat o'zgargan yozuvlarni olish mumkin.

---

## 5. Kunlik baholar
- **URL:** `GET /v1/data/student-grade-list`
- **Tavsif:** Kunlik (joriy) baholar ro'yxati.

**Query Params:** `page`, `limit`, `_faculty`, `_group`, `_semester`, `_education_year`, `_subject`, `_employee`, `_student`, `_lesson_pair`, `_training_type`, `lesson_date_from`, `lesson_date_to`

---

## 6. Davomat ro'yxati
- **URL:** `GET /v1/data/attendance-list`
- **Tavsif:** Kunlik davomat yozuvlari. Har bir yozuv — bitta dars uchun bitta talabaning holati.

**Query Params:**
| Param | Type | Tavsif |
|---|---|---|
| `page` | int | Sahifa |
| `limit` | int | Limit |
| `_subject_schedule` | int | Dars jadvali ID |
| `_education_year` | string | O'quv yili |
| `_semester` | int | Semestr ID |
| `_subject` | int | Fan ID |
| `_training_type` | int | Mashg'ulot turi ID |
| `_lesson_pair` | int | Juft (para) ID |
| `_employee` | int | O'qituvchi ID |
| `_student` | int | Talaba ichki (raqamli) ID |
| `_group` | int | Guruh ID |
| `lesson_date_from` | string/int | Sana (dan) — YYYY-MM-DD yoki timestamp |
| `lesson_date_to` | string/int | Sana (gacha) |
| `student_pnfl` | string | Talaba JSHSHIR |
| `attendance_type` | int | Davomat turi ID |

**Misol javob:**
```json
{
  "data": {
    "items": [
      {
        "id": 100001,
        "student": {"id": "STU20231001", "name": "Aliyev Abdulloh"},
        "employee": {"id": 5, "name": "Karimov Sardor"},
        "subject": {"id": 20, "name": "Matematika", "code": "MAT101"},
        "educationYear": {"name": "2023-2024"},
        "semester": {"name": "1-semestr"},
        "group": {"id": 301, "name": "DI-21-01"},
        "lessonPair": {"name": "1-juft"},
        "lesson_date": 1706745600,
        "absent_on": 1,
        "absent_off": 0
      }
    ],
    "pagination": {"totalCount": 12500, "pageCount": 63, "currentPage": 1}
  }
}
```

| Maydon | Tavsif |
|---|---|
| `absent_on` | Sababli qoldirilgan (`1` = ha) |
| `absent_off` | Sababsiz qoldirilgan (`1` = ha) |

---

## 7. Davomat jurnali
- **URL:** `GET /v1/data/attendance-control-list`
- **Tavsif:** O'qituvchi tomonidan to'ldirilgan davomat jurnali.

**Query Params:** `page`, `limit`, `_subject_schedule`, `_education_year`, `_semester`, `_subject`, `_training_type`, `_lesson_pair`, `_employee`, `_group`, `lesson_date_from`, `lesson_date_to`

---

## 8. Davomat statistikasi
- **URL:** `GET /v1/data/attendance-stat`
- **Tavsif:** Guruh yoki fakultet bo'yicha davomat statistikasi (agregatlangan).

**Query Params:**
| Param | Type | Tavsif |
|---|---|---|
| `page` | int | Sahifa |
| `limit` | int | Limit |
| `group_by` | string | Guruhlash usuli |
| `_group` | int | Guruh ID |
| `_department` | int | Fakultet ID |
| `_education_type` | int | Ta'lim turi |
| `_education_form` | int | Ta'lim shakli |
| `date_from` | string | Sana (dan) |
| `date_to` | string | Sana (gacha) |

---

## 9. Talaba qoldirilgan darslar soni
- **URL:** `GET /v1/data/student-absence-count`
- **Tavsif:** Bitta talabaning joriy semestr bo'yicha qoldirilgan darslar soni.

**Query Params:**
| Param | Type | Required | Tavsif |
|---|---|---|---|
| `pnfl` | string | **Ha** | Talaba JSHSHIR |
| `semester` | string | Yo'q | Semestr nomi |

---

## 10. Talabalar qoldirilgan darslar statistikasi (ro'yxat)
- **URL:** `GET /v1/data/student-absence-count-list`
- **Tavsif:** Bir nechta talabalar bo'yicha qoldirilgan darslar statistikasi.

**Query Params:** `education_year`, `date_from`, `date_to`, `faculty_id`, `group_id`, `pnfl`, `student_id_number`, `page`, `limit`

---

## 11. Dars jadvali
- **URL:** `GET /v1/data/schedule-list`
- **Tavsif:** Guruh yoki o'qituvchi bo'yicha dars jadvali.

**Query Params:**
| Param | Type | Tavsif |
|---|---|---|
| `_faculty` | int | Fakultet ID |
| `_group` | int | Guruh ID |
| `_week` | int | Hafta raqami |
| `_semester` | int | Semestr ID |
| `_education_year` | string | O'quv yili |
| `_subject` | int | Fan ID |
| `_employee` | int | O'qituvchi ID |
| `_auditorium` | int | Auditoriya ID |
| `_lesson_pair` | int | Para ID |
| `lesson_date_from` | string | Sana (dan) |
| `lesson_date_to` | string | Sana (gacha) |
| `updated_at_from` | int | Yangilangan (dan) |
| `updated_at_to` | int | Yangilangan (gacha) |

---

## 12. Imtihon natijalari (batafsil o'zlashtirish)
- **URL:** `GET /v1/data/student-performance-list`
- **Tavsif:** Talabalar imtihon natijalari — fan, o'qituvchi, sana bo'yicha filtr.

**Query Params:**
| Param | Type | Tavsif |
|---|---|---|
| `_student` | int | Talaba ichki ID (raqamli) |
| `_education_year` | string | O'quv yili |
| `_semester` | int | Semestr kodi (11=1-sem, 12=2-sem, ...) |
| `_employee` | int | O'qituvchi ID |
| `exam_date_from` | string | Imtihon sanasi (dan) |
| `exam_date_to` | string | Imtihon sanasi (gacha) |
| `updated_at_from` | int | Yangilangan (dan) |
| `updated_at_to` | int | Yangilangan (gacha) |

> **Semestr kodlari:** `11 = 1-semestr`, `12 = 2-sem`, `13 = 3-sem` ... (formula: `10 + N`)

---

## 13. Talaba GPA ro'yxati
- **URL:** `GET /v1/data/student-gpa-list`
- **Tavsif:** Talabalarning GPA (o'rtacha ball) ro'yxati.

**Query Params:** `page`, `limit`, `_department`, `_group`, `_education_year`, `_level`, `_student`

---

## 14. Transkript
- **URL:** `GET /v1/data/transcript`
- **Tavsif:** Talabaning to'liq akademik transkriptini olish.

**Query Params:**
| Param | Type | Tavsif |
|---|---|---|
| `student_id_number` | string | Talaba ochiq ID |
| `passport_pin` | string | JSHSHIR |

---

## 15. Diplom ro'yxati
- **URL:** `GET /v1/data/diploma-list`
- **Tavsif:** Bitiruvchilarning diplom ma'lumotlari.

**Query Params:** `page`, `limit`, `_education_year`, `_department`, `_group`, `_education_type`, `_education_form`, `updated_at_from`, `updated_at_to`

---

## 16. Talaba hujjatlarini yuklab olish
- **URL:** `GET /v1/data/student-info-download`
- **Tavsif:** Talabaga tegishli hujjatni yuklab olish.

**Query Params:**
| Param | Type | Required |
|---|---|---|
| `student_id_number` | string | **Ha** |
| `id` | string | **Ha** (hujjat ID) |
| `type` | string | **Ha** (hujjat turi) |

---

## 17. Talaba fan qarzlari
- **URL:** `GET /v1/data/student-subject-debts`
- **Tavsif:** Bitta talabaning fan bo'yicha qarzlari.

**Query Params:**
| Param | Type | Required |
|---|---|---|
| `pinfl` | string | **Ha** (JSHSHIR) |

---

## 18. Qarzdor talabalar soni
- **URL:** `GET /v1/data/student-debtor-count`
- **Tavsif:** Karimdor talabalar soni — fakultet/guruh bo'yicha.

**Query Params:** `education_year`, `faculty_id`, `group_id`

---

## 19. Talabalar vazifalar ro'yxati
- **URL:** `GET /v1/data/subject-task-student-list`
- **Tavsif:** Talabalar uchun berilgan topshiriqlar (vazifalar).

**Query Params:** `page`, `limit`, `_group`, `_semester`, `_education_year`, `_subject`, `_curriculum`, `_employee`, `_student`, `_final_exam_type`, `_training_type`, `_task_type`, `_task_status`, `deadline_from`, `deadline_to`

---

## 20. Talabalar sertifikatlari
- **URL:** `GET /v1/data/student-certificate-list`
- **Tavsif:** Talabalarning xalqaro sertifikatlari (IELTS, TOEFL va boshqalar).

**Query Params:** `page`, `limit`, `_group`, `_department`, `_student`, `_certificate_type`, `_certificate_name`, `_certificate_grade`, `_certificate_subject`, `date_of_issue_from`, `date_of_issue_to`

---

## 21. O'qituvchilar va hodimlar
- **URL:** `GET /v1/data/employee-list`
- **Tavsif:** O'qituvchilar va xodimlar ro'yxati.

**Query Params:**
| Param | Type | Required | Tavsif |
|---|---|---|---|
| `type` | string | **Ha** | `teacher` / `employee` / `all` |
| `page` | int | Yo'q | |
| `limit` | int | Yo'q | |
| `_department` | int | Yo'q | Fakultet |
| `_gender` | string | Yo'q | Jins |
| `_staff_position` | int | Yo'q | Lavozim |
| `_employee_status` | int | Yo'q | Holat |
| `_employment_form` | int | Yo'q | Ish shakli |
| `_employment_staff` | int | Yo'q | Ish o'rni |
| `_employee_type` | int | Yo'q | Tur |
| `_academic_rank` | int | Yo'q | Unvon |
| `_academic_degree` | int | Yo'q | Daraja |
| `passport_pin` | string | Yo'q | JSHSHIR |
| `search` | string | Yo'q | Qidiruv |

---

## 22. O'qituvchi fanlar ro'yxati
- **URL:** `GET /v1/data/employee-subject-list`
- **Tavsif:** O'qituvchiga biriktirilgan fanlar ro'yxati.

**Query Params:** `page`, `limit`, `_semester`, `_group`, `_training_type`, `_education_year`, `_subject`, `_employee`, `lesson_date_from`, `lesson_date_to`

---

## 23. O'quv rejalari
- **URL:** `GET /v1/data/curriculum-list`
- **Tavsif:** Barcha o'quv rejalari ro'yxati.

**Query Params:** `page`, `limit`, `_department`, `_education_year`, `_education_type`, `_education_form`

**Misol javob:**
```json
{
  "data": {
    "items": [
      {
        "id": 5,
        "name": "Dasturiy injiniring - 2021",
        "specialty": {"code": "5330200", "name": "Dasturiy injiniring"},
        "department": {"name": "Axborot texnologiyalari"},
        "educationYear": {"name": "2021-2022"},
        "educationType": {"name": "Bakalavr"},
        "educationForm": {"name": "Kunduzgi"},
        "semester_count": 8
      }
    ]
  }
}
```

---

## 24. O'quv reja fanlari
- **URL:** `GET /v1/data/curriculum-subject-list`
- **Tavsif:** O'quv rejadagi fanlar + har bir mashg'ulot turi bo'yicha soat.

**Query Params:** `page`, `limit`, `_curriculum`, `_subject_type`, `_exam_finish`, `_rating_grade`, `_semester`, `_department`

---

## 25. O'quv reja fanlari mavzulari
- **URL:** `GET /v1/data/curriculum-subject-topic-list`
- **Tavsif:** Har bir fan bo'yicha mavzular ro'yxati.

**Query Params:** `page`, `limit`, `_curriculum`, `_subject`, `_department`, `_semester`, `_training_type`

---

## 26. Fan-o'qituvchi-guruh bog'liqligi
- **URL:** `GET /v1/data/curriculum-subject-teacher-list`
- **Tavsif:** Qaysi fan qaysi o'qituvchi tomonidan qaysi guruhga o'qitilishi.

**Query Params:** `page`, `limit`, `_curriculum`, `_subject`, `_employee`, `_department`, `_group`, `_semester`, `_training_type`, `_education_year`

---

## 27. Talabalar fanlari ro'yxati
- **URL:** `GET /v1/data/student-subject-list`
- **Tavsif:** Talabalarga biriktirilgan fanlar ro'yxati.

**Query Params:** `page`, `limit`, `_curriculum`, `_subject`, `_education_year`, `_semester`, `_student`, `_group`

---

## 28. Fanlar katalogi
- **URL:** `GET /v1/data/subject-meta-list`
- **Tavsif:** Tizimda mavjud barcha fanlar ro'yxati.

**Query Params:** `page`, `limit`, `_subject_group`, `_education_type`

---

## 29. O'quv materiallari (fayllar)
- **URL:** `GET /v1/data/subject-file-resource-list`
- **Tavsif:** O'qituvchilar yuklagan ta'lim materiallari va fayllar.

**Query Params:** `page`, `limit`, `_curriculum`, `_semester`, `_subject`, `_employee`, `_training_type`, `_language`, `updated_at_from`, `updated_at_to`

---

## 30. Fan imtihonlari
- **URL:** `GET /v1/data/subject-exam-list`
- **Tavsif:** Fan bo'yicha imtihonlar ro'yxati.

**Query Params:** `page`, `limit`, `id`, `_faculty`, `_group`, `_semester`, `_exam_type`, `final_exam_type`, `_education_year`, `_subject`, `_employee`, `_auditorium`

---

## 31. Umumiy imtihonlar ro'yxati
- **URL:** `GET /v1/data/exam-list`
- **Tavsif:** Barcha imtihonlar ro'yxati (filtrlash bilan).

**Query Params:** `page`, `limit`, `search`, `_semester`, `_exam_type`, `_education_year`, `_subject`, `_employee`, `_group`

---

## 32. Guruhlar ro'yxati
- **URL:** `GET /v1/data/group-list`
- **Tavsif:** Barcha talaba guruhlari.

**Query Params:** `page`, `limit`, `id`, `_department`, `_curriculum`, `_specialty`, `_education_type`, `_education_form`

---

## 33. Fakultetlar ro'yxati
- **URL:** `GET /v1/data/department-list`
- **Tavsif:** Barcha fakultetlar va bo'limlar.

**Query Params:** `page`, `limit`, `active`, `_structure_type`, `parent`

---

## 34. Mutaxassisliklar ro'yxati
- **URL:** `GET /v1/data/specialty-list`
- **Tavsif:** Barcha mutaxassisliklar ro'yxati.

**Query Params:** `page`, `limit`, `_department`, `_locality_type`, `_education_type`

---

## 35. Shartnomalar ro'yxati
- **URL:** `GET /v1/data/contract-list`
- **Tavsif:** Talabalar shartnoma ma'lumotlari.

**Query Params:** `page`, `limit`, `_education_year`, `_student`, `search`, `_contract_type`

---

## 36. Telefon raqamini tekshirish
- **URL:** `GET /v1/data/validate-phone`
- **Tavsif:** Telefon raqami tizimda mavjudligini tekshirish.

**Query Params:**
| Param | Required |
|---|---|
| `phone` | **Ha** |

---

## 37. Semestrlar ro'yxati
- **URL:** `GET /v1/data/semester-list`
- **Tavsif:** Semestrlar va o'quv haftalari ro'yxati.

**Query Params:** `page`, `limit`, `_curriculum`, `_level`, `_education_year`

---

## 38. Dars juftlari (para)
- **URL:** `GET /v1/data/lesson-pair-list`
- **Tavsif:** Dars vaqt oraliqlarining ro'yxati (1-juft, 2-juft...).

**Query Params:** `page`, `limit`

---

## 39. Auditoriyalar ro'yxati
- **URL:** `GET /v1/data/auditorium-list`
- **Tavsif:** Dars xonalari va auditoriyalar ro'yxati.

**Query Params:** `page`, `limit`, `_building`, `_auditorium_type`

---

## 40. Baholash tizimi
- **URL:** `GET /v1/data/marking-system-list`
- **Tavsif:** Baholash tizimi qoidalari (100 ballik tizim va boshqalar).

**Query Params:** `page`, `limit`

---

## 41. Baho turlari (rating-grade)
- **URL:** `GET /v1/data/rating-grade-list`
- **Tavsif:** Baho turlari ro'yxati (A'lo, Yaxshi, Qoniqarli va boshqalar).

---

## 42. Baho turlari (grade-type)
- **URL:** `GET /v1/data/grade-type-list`
- **Tavsif:** Baho kategoriyalari ro'yxati.

---

## 43. Klassifikatorlar
- **URL:** `GET /v1/data/classifier-list`
- **Tavsif:** Tizim klassifikatorlari (jins, holat, viloyat, tuman va boshqalar).

**Query Params:**
| Param | Type | Tavsif |
|---|---|---|
| `classifier` | string | Klassifikator nomi |
| `page` | int | |
| `limit` | int | |

---

## 44. So'rovnomalar (Poll)
- **URL:** `GET /v1/data/poll-list`
- **Tavsif:** Talabalar so'rovnomalari ro'yxati.

**Query Params:** `student_id`, `_subject`, `_semester`, `_education_year`, `_employee`

---

## 45. Ilmiy ishlar
- **URL:** `GET /v1/data/scientific`
- **Param:** `employee_id` (int, **majburiy**)
- **Tavsif:** O'qituvchining ilmiy nashrlar ro'yxati.

---

## 46. Uslubiy ishlar
- **URL:** `GET /v1/data/methodical`
- **Param:** `employee_id` (int, **majburiy**)

---

## 47. Mulk nashrlar
- **URL:** `GET /v1/data/property`
- **Param:** `employee_id` (int, **majburiy**)

---

## 48. Ilmiy faoliyat
- **URL:** `GET /v1/data/scientific-activity`
- **Param:** `employee_id` (int, **majburiy**)

---

## 49. Tizim loglari
- **URL:** `GET /v1/data/system-log-list`
- **Tavsif:** Admin paneldagi barcha amallar logi.

**Query Params:** `page`, `limit`, `action`, `_admin`, `ip`, `created_at_from`, `created_at_to`

---

## 50. Tizim versiyasi
- **URL:** `GET /v1/data/version-info`
- **Tavsif:** HEMIS tizim versiyasi va konfiguratsiya ma'lumotlari.

---

---

# STUDENT API

> **Auth:** JWT token — avval `/v1/auth/login` orqali olinadi  
> **Token muddati:** 2 kun

---

## 51. Talaba tizimga kirishi
- **URL:** `POST /v1/auth/login`
- **Tavsif:** Talabaning login/parol bilan tizimga kirishi va JWT token olishi.

**Request Body:**
```json
{
  "login": "STU20231001",
  "password": "secret"
}
```

**Response:**
```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "token_type": "Bearer"
  }
}
```
> **Muhim:** Refresh token `refresh-token` cookie sifatida qaytariladi.

---

## 52. JWT tokenni yangilash
- **URL:** `POST /v1/auth/refresh-token`
- **Tavsif:** Muddati o'tgan tokenni yangilash.

**Headers:**
```
X-Refresh-Token: <refresh_token>
```

---

## 53. Talaba shaxsiy ma'lumotlari
- **URL:** `GET /v1/account/me`
- **Tavsif:** Tizimga kirgan talabaning barcha shaxsiy va akademik ma'lumotlari.

---

## 54. Talaba ma'lumotlarini yangilash
- **URL:** `POST /v1/account/update`
- **Tavsif:** Talaba o'z telefoni, emaili yoki parolini o'zgartirish.

**Request Body:**
```json
{
  "phone": "+998901234567",
  "email": "student@example.com",
  "change_contacts": true,
  "password": "newpass",
  "confirmation": "newpass",
  "change_password": false
}
```

---

## 55. Ma'lumotlarni yangilash (tashqi servis)
- **URL:** `GET /v1/account/refresh`
- **Tavsif:** Talabaning ma'lumotlarini tashqi xizmatlardan (masalan, kambag'allik darajasi) yangilash.

**Query Params:**
| Param | Required | Tavsif |
|---|---|---|
| `type` | **Ha** | Yangilash turi (masalan: `poverty`) |

---

## 56. Hisoblar (to'lovlar)
- **URL:** `GET /v1/billing/all`
- **Tavsif:** Barcha shartnoma ma'lumotlari birida.

**Query Params:** `eduYear` (int, ixtiyoriy)

---

## 57. Subsidiya uy-joy hisoboti
- **URL:** `POST /v1/billing/subsidy-rent-report`
- **Request Body:** `{"eduYear": 2024}`

---

## 58. Kredit modul shartnomasi
- **URL:** `GET /v1/billing/credit-module-contract`

---

## 59. Turar joy shartnomasi
- **URL:** `GET /v1/billing/residence-contract`

---

---

# AI API (Student API ichida)

> **Auth:** JWT token  
> **Limit:** Kuniga 15 ta keshlanmagan so'rov

---

## 60. AI Chat
- **URL:** `POST /v1/ai/chat`
- **Tavsif:** AI chatbot bilan muloqot — baholar, davomat, tavsiyalar.

**Request Body:**
```json
{
  "keyword": "grades",
  "question": "Bu semestr qanday o'qidim?",
  "text": ""
}
```

**`keyword` qiymatlari:**
| Keyword | Tavsif |
|---|---|
| `summary` | Umumiy xulosa |
| `grades` | Baholar tahlili |
| `attendance` | Davomat tahlili |
| `subjects` | Fanlar bo'yicha ma'lumot |
| `timetable` | Dars jadvali |
| `contract` | Shartnoma ma'lumotlari |
| `courses` | Kurslar tavsiyasi |
| `plagiarism` | Plagiatni tekshirish |
| `diploma` | Diplom ma'lumotlari |
| `roadmap` | Maqsadga yo'l xaritasi |
| `conversation` | Erkin suhbat |

---

## 61. AI Keywords ro'yxati
- **URL:** `GET /v1/ai/keywords`
- **Tavsif:** Qo'llab-quvvatlanadigan AI kalit so'zlar ro'yxati.

---

## 62. AI Suhbat tarixi
- **URL:** `GET /v1/ai/history`
- **Tavsif:** So'nggi 50 ta chat xabarlar tarixi.

---

---

# FAST API

> **Auth:** `?token=<token>` query parametri  
> **Maqsad:** Agregatlangan statistika va AI integratsiya

---

## 63. GPA xulosasi
- **URL:** `POST /student-gpa-summary?token=<token>`

## 64. Baholar xulosasi
- **URL:** `POST /student-grade-summary?token=<token>`

## 65. Fanlar xulosasi
- **URL:** `POST /student-subjects-summary?token=<token>`

## 66. Dars jadvali xulosasi
- **URL:** `POST /student-timetable-summary?token=<token>`

## 67. Kurslar tavsiyasi
- **URL:** `POST /course-recommendation?token=<token>`

## 68. Plagiat tekshirish
- **URL:** `POST /check-plagiarism?token=<token>`

## 69. Shartnoma ma'lumoti
- **URL:** `POST /contract-info?token=<token>`

## 70. Suhbat tarixi
- **URL:** `GET /history?token=<token>&offset=0&size=25`

## 71. Suhbat tarixini o'chirish
- **URL:** `DELETE /history?token=<token>`

## 72. Ruxsat etilgan universitetlar
- **URL:** `GET /allowed-universities?token=<token>`

## 73. Ruxsatlarni qayta yuklash
- **URL:** `POST /reload_allowed_universities`

---

---

# Xato kodlari

| HTTP Status | Ma'nosi |
|---|---|
| `200 OK` | Muvaffaqiyatli |
| `401 Unauthorized` | Token yo'q yoki noto'g'ri |
| `403 Forbidden` | Ruxsat yo'q |
| `404 Not Found` | Endpoint topilmadi |
| `422 Unprocessable Entity` | Noto'g'ri parametrlar |
| `429 Too Many Requests` | Rate limit oshirildi |
| `500 Internal Server Error` | Server xatosi |
| `502/503/504` | Gateway xatosi (retry bilan kutish) |

---

# Endpointlar xulosasi

| Guruh | Soni |
|---|---|
| Backend API (`/v1/data/*`) | 50 ta |
| Student API (`/v1/auth/*`, `/v1/account/*`, `/v1/billing/*`) | 9 ta |
| AI API (`/v1/ai/*`) | 3 ta |
| Fast API (`/`, `/student-*`, `/history`) | 11 ta |
| **Jami** | **~74 ta** |

---

# Loyihadagi foydalanish

Ushbu loyiha (`stat2025`) quyidagi Backend API endpointlaridan foydalanadi:

| HEMIS Endpoint | Loyiha funksiyasi |
|---|---|
| `/v1/data/student-list` | Barcha talabalarni yuklash |
| `/v1/data/student-info` | Talaba transkripti, baholar |
| `/v1/data/academic-record-list` | Qarzdorlik tekshirish, delta sync |
| `/v1/data/attendance-list` | Davomat yuklash |
| `/v1/data/schedule-list` | Guruh dars jadvali |
| `/v1/data/group-list` | Guruhlar ro'yxati |
| `/v1/data/curriculum-list` | O'quv rejalari |
| `/v1/data/curriculum-subject-list` | Reja fanlari |
| `/v1/data/curriculum-subject-teacher-list` | Fan-o'qituvchi |
| `/v1/data/subject-file-resource-list` | O'quv materiallari |
| `/v1/data/student-performance-list` | Batafsil imtihon natijalari |
