# pechdev.ru

Сайт собирается Eleventy и Parcel на хостовом Forgejo runner `vorobey-cloud-1`
(Node.js 24). Workflow `.forgejo/workflows/deploy.yml` запускается при push
в `master` и вручную с этой ветки. Исходники должны находиться в Forgejo;
push только в GitHub не запускает этот workflow.

## Настройка

В настройках репозитория Forgejo включите Actions
и предоставьте доступ к раннеру. Обязательных Actions variables и secrets нет.
S3 и Telegram отключены по умолчанию; workflow не передаёт их настройки.
`PATH_PREFIX` для корня домена пустой.

Код интеграций сохранён. Для ручного включения S3 задайте `ENABLE_S3=true`,
`S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_KEY_ID`, `S3_ACCESS_KEY`.
Для загрузки постов также нужны `ENABLE_TELEGRAM=true`, `TELEGRAM_BOT_TOKEN`,
`TELEGRAM_CHANNEL_ID`, `TELEGRAM_CHANNEL_URL`. Telegram использует S3 для хранения.
`LOAD_FROM_S3_ONLY=true` позволяет читать сохранённые посты без токена бота.
Блок постов на главной по-прежнему закомментирован.
Дополнительные настройки интеграций сохранены в `lib/config.js`.
Без S3 ревизия равна `<MAJOR_VERSION>.0` (по умолчанию `0.0`), дата сборки — UTC.

Перед первым workflow выполните локально `make prepare-pechdev-site` из
`my-infra/vorobey-cloud-1`: команда создаст каталоги релизов на сервере.
При установке нового раннера этот шаг уже входит в `make runner_install`.
После первого успешного workflow выполните `make deploy-site` из
`my-infra/git-server`, чтобы собрать, проверить и запустить nginx и Caddy.
Это также применит домен `pechdev.ru` в Caddy и включит выпуск TLS-сертификата.
Подробности — в `my-infra/git-server/README.md`.

GitHub Pages workflow временно отключён: файл сохранён как
`.github/workflows/release.yml.disabled`. Чтобы включить его снова,
переименуйте файл обратно в `release.yml` и отправьте изменение в GitHub.
Деплой через Forgejo продолжает работать независимо.

## Скрипты

```sh
./bin/build
./bin/deploy
```

`bin/build` устанавливает зависимости из lockfile, проверяет переменные,
удаляет старый `build/`, запускает `npm run prod` и проверяет `build/index.html`.
Локально переменные можно задать в `.env` (не добавлять в git).
По умолчанию сборка не обращается к S3 и Telegram и не изменяет данные S3.
Workflow ограничен 20 минутами.

`bin/deploy` публикует уже собранный `build/` в
`/srv/pechdev.ru/releases/<commit>-<unique suffix>` и атомарно переключает
относительный симлинк `current`. Пустой index, симлинки и специальные файлы
в сборке отклоняются. Каталоги получают права 755, файлы — 644 для чтения nginx.
Повторный запуск того же коммита создаёт отдельный релиз.

Для тестирования можно указать `DEPLOY_ROOT=/absolute/test/directory`;
этот каталог и его подкаталог `releases` должны уже существовать.
Деплой не требует sudo или доступа к Docker. Параллельные публикации блокирует
`.deploy-lock`; workflow также сериализует свои запуски.

Релизы автоматически не удаляются. Откат: при отсутствии активного workflow
переключите `current` на нужный каталог через временный симлинк и атомарный rename
(команда приведена в `my-infra/git-server/README.md`). После принудительного
завершения процесса может остаться `.deploy-lock`: убедитесь, что публикация
не выполняется, затем удалите пустой каталог через `rmdir`.
