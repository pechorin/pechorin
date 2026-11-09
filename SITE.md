# Site building workflow

## Npm commands

- `npm run dev` - start dev server
- `npm run prod` - make production build

## Deploy & Release

- `bin/build` - build without S3 or Telegram credentials by default
- `bin/deploy` - publish an existing build (see DEPLOY.md)
- `bin/deploy-s3` - legacy S3 deployment, disabled unless `ENABLE_S3=true`
