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
6. (Необязательно) Кнопка «Отменить подписку» прямо в приложении — без этого шага
   пользователь всё ещё может отменить автопродление через само приложение RuStore.
   RuStore Console → **API RuStore** → «Создать ключ»: область доступа — приложение
   ЛапGo, методы — только **«Получение данных подписки»** и **«Отмена подписки»**
   (не выбирайте «Все методы» — доступ должен быть минимальным).
   - Показанное значение (длинный блок — это RSA-приватный ключ, а не готовый токен) —
     в `RUSTORE_API_TOKEN`.
   - Рядом с ключом в списке «API RuStore» есть колонка **«ID ключа»** (не секрет,
     просто число) — в `RUSTORE_API_KEY_ID`.
   - Сервер сам подписывает этим ключом временную метку и обменивает на короткоживущий
     (15 минут) токен перед каждым запросом — см. `src/lib/rustoreApiAuth.ts`, ничего
     вручную обновлять не нужно.
   - Это отдельный ключ от `RUSTORE_PUSH_AUTH_TOKEN` (§4) — у него другая область
     доступа.

### 4. RuStore Push (уведомления, необязательно)

Клиент (нативный Android-модуль, см. `lib/rustorePushNotifications.ts` в корне
репозитория) получает push-токен устройства и сохраняет его через
`PATCH /auth/push-token` — этот сервер только хранит токен и умеет по нему **отправить**
пуш через `lib/rustorePushSend.ts`, ничего не отправляет автоматически (нет ни одного
триггера события, который бы это делал сейчас).

1. В [RuStore Console](https://console.rustore.ru) → приложение → Push-уведомления →
   Проекты → создать проект (или использовать существующий) — получите `project_id` и
   сервисный токен (`ss_token`).
2. Сохранить их в `RUSTORE_PUSH_PROJECT_ID` / `RUSTORE_PUSH_AUTH_TOKEN`.
3. То же самое `project_id` (не токен!) нужно прописать в `app.json` →
   `plugins` → `withRuStorePush` → `projectId`, чтобы клиент вообще мог зарегистрировать
   push-токен — см. `plugins/withRuStorePush.js` в корне репозитория.
4. Проверить: авторизованным запросом (JWT из `POST /auth/sign-in`) дёрнуть
   `POST /auth/send-test-push` — придёт тестовый пуш на устройство, где уже
   зарегистрирован токен (нужна реальная сборка с RuStore, не Expo Go/веб).

### 5. Персональный ИИ-совет (необязательно)

1. Получить ключ на [console.anthropic.com](https://console.anthropic.com).
2. Заполнить `ANTHROPIC_API_KEY`. Без него карточка «Совет от ИИ» в приложении просто не
   показывается — остальной функционал не затронут.

### 6. Восстановление пароля (необязательно)

1. Взять SMTP-доступ у любого провайдера (Timeweb Cloud даёт почтовый ящик в панели,
   либо любой внешний — Yandex 360, SendGrid и т.д.).
2. Заполнить `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.
3. Без SMTP `POST /auth/forgot-password` продолжает работать (код генерируется и
   сохраняется), просто письмо никуда не уходит — код вместо этого печатается в лог
   сервера, чтобы поток можно было проверить локально без реальной почты.

### 7. Публичная оферта и политика конфиденциальности

В приложении (`app/legal/offer.tsx`, `app/legal/privacy.tsx`) уже есть черновики этих
документов — **перед реальным запуском их обязательно должен проверить юрист**: заполнить
реальные реквизиты (наименование, ИНН, адрес, email) вместо плейсхолдеров в квадратных
скобках и подтвердить формулировки. Регистрация на сервере требует согласия
(`consent: true`), время согласия сохраняется в `users.consent_given_at`.

## Сборка Android-приложения (Codemagic)

`codemagic.yaml` в корне репозитория — то же самое устройство сборки, что уже
используется для второго приложения (Family Navigator) на этом же аккаунте: два
воркфлоу, секреты живут только в Codemagic UI (никогда в git, никогда в чате).

1. [codemagic.io](https://codemagic.io) → подключить репозиторий `DimaSavitskiy0/tamagochi-app`.
2. Codemagic UI → Environment variables → одна группа **`production`**, в ней:
   - `EXPO_PUBLIC_API_URL=https://lapgo.ru` (не секрет).
   - `KEYSTORE_BASE64` — содержимое файла `~/keystores/lapgo-release.jks.base64`
     (сгенерирован локально, см. `scripts/README.md` — тот же принцип, что
     `family-navigator-release.jks.base64` у второго приложения) — **Secret**.
   - `KEYSTORE_PASSWORD` — из `~/keystores/lapgo-release.passwords.txt` — **Secret**.
   - `KEY_ALIAS` — `lapgo`.
3. **android-test-build** — APK с debug-подписью, для проверки на своём телефоне
   (переменные keystore тоже видны этой сборке, но не используются в её скрипте).
4. **android-release-build** — `.aab` с боевой подписью (`lapgoKeystorePath`/пароль/алиас
   попадают в `android/app/build.gradle` через `plugins/withReleaseSigning.js`, читающий
   их из переменных окружения `LAPGO_KEYSTORE_*`, которые скрипт сборки экспортирует из
   группы `production`) — именно этот файл загружается в RuStore Console.
5. Оба воркфлоу сами прогоняют `expo prebuild -p android` перед сборкой — `android/` не
   хранится в git (Continuous Native Generation), поэтому руками его готовить не нужно.

## Структура

- `src/routes/auth.ts` — регистрация (с проверкой согласия на обработку ПДн)/вход/обновление токена (JWT access 15 мин + refresh 30 дней)/восстановление пароля по коду на email
- `src/lib/email.ts` — отправка кода восстановления пароля через SMTP
- `src/routes/pets.ts` — питомец владельца (вид/окрас для мультяшной аватарки), персональный ИИ-совет (`/ai-tip`)
- `src/routes/diary.ts`, `reminders.ts`, `petStatSnapshots.ts`, `petEvents.ts` — дневник/напоминания/история статов/календарь
- `src/routes/subscription.ts` — статус подписки, отмена/возобновление автопродления
- `src/routes/payments.ts` — приём и расшифровка вебхука RuStore Pay (смена статуса подписки)
- `src/lib/rustorePay.ts` — расшифровка AES-256-GCM пейлоада вебхука RuStore
- `src/lib/rustoreApiAuth.ts` — подпись приватным ключом и обмен на короткоживущий Public-Token для RuStore Public API
- `src/lib/rustoreApi.ts` — отмена подписки + получение данных подписки через RuStore Public API
- `src/lib/rustorePushSend.ts` — отправка push-уведомлений через RuStore Send API
- `src/routes/stats.ts` — трекинг активности (уровень использования)
- `src/jobs/syncRustoreSubscriptions.ts` — ежедневная сверка статуса Pro-подписок через RuStore Public API (подстраховка на случай, если вебхук `payments.ts` что-то пропустил)
- `src/lib/ai.ts` — генерация персонального совета через Anthropic API
- `src/middleware/auth.ts` — проверка JWT, аналог `auth.uid()` из Supabase RLS
- `src/lib/ownership.ts` — проверка владения питомцем, аналог RLS-политик на дочерние таблицы
- `prisma/schema.prisma` — схема БД (замена `supabase/schema.sql`)
