# lapgo-server

Бэкенд приложения «ЛапGo»: Node.js + Express + Prisma + PostgreSQL. Заменяет Supabase
Cloud, чтобы персональные данные пользователей хранились на сервере в РФ (152-ФЗ).

## Локальная разработка

```bash
cd server
npm install
cp .env.example .env        # заполнить JWT_ACCESS_SECRET/JWT_REFRESH_SECRET (см. ниже)
docker compose up -d        # локальный Postgres в докере
npx prisma migrate dev --name init
npm run dev                 # http://localhost:3000, /health для проверки
```

Секреты JWT сгенерировать так: `openssl rand -hex 32` (по разу для каждого из двух).

RUSTORE_WEBHOOK_SECRET и ANTHROPIC_API_KEY можно оставить пустыми на этом этапе —
соответствующие роуты (`/payments/*`, `/pets/:id/ai-tip`) вернут понятную ошибку 503,
остальной API работает без них.

## Деплой на Timeweb Cloud

Есть два варианта в зависимости от того, что уже куплено в панели
[timeweb.cloud](https://timeweb.cloud): управляемый **App Platform** (PaaS, шаги ниже)
или свой **облачный сервер (VPS)**, на котором вы всё настраиваете сами.

### Если у вас уже есть облачный сервер (VPS) с другим приложением

Это ваш случай: один VPS (`62.113.44.88`), на котором через **Docker Compose** уже
крутится другое приложение (`family-navigator-backend` — API + Postgres + Caddy как
reverse-proxy, обслуживает `navigatorfamily.ru`). Бэкенд ЛапGo разворачивается
**рядом, тем же способом** — второй, полностью изолированный docker-compose проект —
и это уже сделано:

- Код лежит в `/opt/tamagochi-backend/` на сервере (историческое имя папки/контейнеров —
  скопировано туда, не в git; переименование потребовало бы отдельной осторожной
  миграции живой БД, поэтому имена ресурсов на сервере пока не менялись, только
  название продукта и код).
- `server/Dockerfile` и `server/docker-compose.prod.yml` в этом репозитории — как раз
  то, из чего собран образ на сервере (мультистейдж-сборка, `node:20-slim`, тот же
  паттерн, что у `family-navigator-backend`).
- Свой контейнер `tamagochi-backend-postgres-1` (Postgres 16, отдельная база
  `tamagochi`, отдельный docker-том `tamagochi-backend_postgres_data`) — база
  `family-navigator` не затронута.
- Свой контейнер `tamagochi-backend-api-1` — три миграции применены
  (`prisma migrate deploy` при старте), `GET /health` отвечает `{"ok":true}`.
- Секреты (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, пароль Postgres) сгенерированы
  `openssl rand -hex 32/24` и лежат только в `/opt/tamagochi-backend/.env` на сервере
  (не в репозитории, не проходили через локальную машину в виде файла).
- **Наружу (в интернет) сервис пока не открыт** — порт `3001` привязан только к
  `127.0.0.1` сервера (не `0.0.0.0`), то есть снаружи недоступен вообще, только через
  SSH-сессию на самом сервере. Это специально, пока нет домена.
- Family Navigator не тронут: свой процесс, своя база, свой docker-network — проверено
  (`docker ps` показывает все 3 его контейнера с прежним аптаймом).

**Домен `lapgo.ru` куплен и подключён** (DNS A-запись `@` → `62.113.44.88`). Caddy
(`family-navigator-backend-caddy-1`) проксирует его на API так же, как
`navigatorfamily.ru`:

```caddyfile
lapgo.ru {
    reverse_proxy tamagochi-backend-api-1:3000
}
```

Важный нюанс, в отличие от `navigatorfamily.ru` (тот проксируется на `api:3000` —
имя сервиса внутри своего же docker-compose проекта): `tamagochi-backend` — **отдельный**
docker-compose проект со своей сетью, поэтому по имени сервиса `api` Caddy его не
найдёт. Сначала нужно подключить Caddy к сети `tamagochi-backend` и указывать в
конфиге полное имя контейнера, а не имя сервиса:
```bash
docker network connect tamagochi-backend_default family-navigator-backend-caddy-1
```
После этого — правка `Caddyfile` (см. выше) и
`docker compose -f /opt/family-navigator-backend/docker-compose.prod.yml restart caddy`.
Caddy сам выпустит и продлит SSL-сертификат — отдельный Caddy не нужен, порты 80/443
уже заняты существующим контейнером.

`https://lapgo.ru` — это и есть `EXPO_PUBLIC_API_URL` для мобильного приложения.

Проверить работу можно и без домена, прямо по SSH:
```bash
ssh root@62.113.44.88 curl -s http://127.0.0.1:3001/health
```

### Если это управляемый App Platform (PaaS)

Пошагово, всё в панели [timeweb.cloud](https://timeweb.cloud):

### 1. База данных — Managed PostgreSQL

1. Timeweb Cloud → Базы данных → Создать → PostgreSQL, регион в РФ.
2. Скопировать строку подключения (`postgresql://...`) в `DATABASE_URL`.
3. Применить схему один раз с локальной машины (или из CI), указав прод-`DATABASE_URL`:
   ```bash
   DATABASE_URL="<прод-строка>" npx prisma migrate deploy
   ```

### 2. Приложение — App Platform

1. Timeweb Cloud → App Platform → создать приложение → подключить Git-репозиторий
   (GitHub/GitLab/Bitbucket или по URL).
2. Указать корневую директорию сборки: `server/`.
3. Build command: `npm run build`; Start command: `npm run start`.
4. Прописать все переменные из `.env.example` в настройках приложения (значения из
   шагов 1–2 выше + `RUSTORE_WEBHOOK_SECRET` из шага 4).
5. После первого деплоя App Platform выдаст публичный URL/домен — это и есть
   `EXPO_PUBLIC_API_URL` для мобильного приложения.

### 3. RuStore Pay (подписка Pro, 199 ₽/мес)

Оплата подписки идёт не через сервер, а нативным RuStore Pay SDK прямо в приложении —
RuStore сам ведёт весь платёжный цикл (списания, повторные попытки при неудаче,
grace/hold-периоды, отмену). Сервер только слушает вебхук со сменой статуса и
зеркалирует его в `subscriptions.plan`/`status` — никакого собственного крон-джоба
продления (как было у ЮKassa) больше нет.

1. В [RuStore Console](https://console.rustore.ru) включить монетизацию для компании
   (нужно юрлицо/ИП, см. «Монетизация для юрлиц» в документации RuStore) и создать
   продукт-подписку (Монетизация → Подписки → Создать), например `lapgo_pro_monthly`,
   199 ₽/мес — код продукта должен совпадать с тем, что зашит в клиенте
   (см. `constants/rustore.ts` в корне репозитория).
2. Монетизация → Серверные уведомления → Подключить: указать URL
   `https://<домен-приложения>/payments/rustore-webhook`, тип уведомлений — «Подписки»
   (и/или «Платежи», не используется, но не мешает). RuStore выдаст **один раз** ключ
   AES-256 (base64) — сохранить его в `RUSTORE_WEBHOOK_SECRET`.
3. Добавить IP-адреса RuStore в файрвол (см. официальную доку, «Server Notifications» →
   «Server setup» — три подсети, повторять здесь смысла нет, могут поменяться).
4. Нажать «Проверить» в консоли — сервер должен ответить `200 OK` на тестовое
   уведомление (`TEST_EVENT`), только после этого включать реальные уведомления.
5. Клиентская интеграция (нативный Android-модуль, `expo prebuild`, gradle/manifest) —
   отдельный шаг, не в этом сервере. См. `lib/rustorePay.ts` в корне репозитория.

### 4. Персональный ИИ-совет (необязательно)

1. Получить ключ на [console.anthropic.com](https://console.anthropic.com).
2. Заполнить `ANTHROPIC_API_KEY`. Без него карточка «Совет от ИИ» в приложении просто не
   показывается — остальной функционал не затронут.

### 5. Восстановление пароля (необязательно)

1. Взять SMTP-доступ у любого провайдера (Timeweb Cloud даёт почтовый ящик в панели,
   либо любой внешний — Yandex 360, SendGrid и т.д.).
2. Заполнить `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.
3. Без SMTP `POST /auth/forgot-password` продолжает работать (код генерируется и
   сохраняется), просто письмо никуда не уходит — код вместо этого печатается в лог
   сервера, чтобы поток можно было проверить локально без реальной почты.

### 6. Публичная оферта и политика конфиденциальности

В приложении (`app/legal/offer.tsx`, `app/legal/privacy.tsx`) уже есть черновики этих
документов — **перед реальным запуском их обязательно должен проверить юрист**: заполнить
реальные реквизиты (наименование, ИНН, адрес, email) вместо плейсхолдеров в квадратных
скобках и подтвердить формулировки. Регистрация на сервере требует согласия
(`consent: true`), время согласия сохраняется в `users.consent_given_at`.

## Структура

- `src/routes/auth.ts` — регистрация (с проверкой согласия на обработку ПДн)/вход/обновление токена (JWT access 15 мин + refresh 30 дней)/восстановление пароля по коду на email
- `src/lib/email.ts` — отправка кода восстановления пароля через SMTP
- `src/routes/pets.ts` — питомец владельца (вид/окрас для мультяшной аватарки), персональный ИИ-совет (`/ai-tip`)
- `src/routes/diary.ts`, `reminders.ts`, `petStatSnapshots.ts`, `petEvents.ts` — дневник/напоминания/история статов/календарь
- `src/routes/subscription.ts` — статус подписки, отмена/возобновление автопродления
- `src/routes/payments.ts` — приём и расшифровка вебхука RuStore Pay (смена статуса подписки)
- `src/lib/rustorePay.ts` — расшифровка AES-256-GCM пейлоада вебхука RuStore
- `src/routes/stats.ts` — трекинг активности (уровень использования)
- `src/jobs/renewSubscriptions.ts` — фоновая задача автопродления подписки раз в час
- `src/lib/ai.ts` — генерация персонального совета через Anthropic API
- `src/middleware/auth.ts` — проверка JWT, аналог `auth.uid()` из Supabase RLS
- `src/lib/ownership.ts` — проверка владения питомцем, аналог RLS-политик на дочерние таблицы
- `prisma/schema.prisma` — схема БД (замена `supabase/schema.sql`)
