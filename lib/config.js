const { env } = require('node:process')

let fileEnv = {}
require('dotenv').config({ processEnv: fileEnv, debug: true  })

let $env = {}
$env = Object.assign(fileEnv, env)

const { S3Client } = require('@aws-sdk/client-s3')

function isTrueLiteral(string) {
  if (string === 'true' || string === 'TRUE') return true;
  if (parseInt(string) === 1) return true;

  return false
}

module.exports = {
  debug:             isTrueLiteral($env.DEBUG),
  pathPrefix:        $env.PATH_PREFIX,
  s3Region:          $env.S3_REGION,
  s3Endpoint:        $env.S3_ENDPOINT,
  s3Bucket:          $env.S3_BUCKET,
  s3KeyId:           $env.S3_KEY_ID,
  s3AccessKey:       $env.S3_ACCESS_KEY,
  s3PostsFileName:   $env.S3_TELEGRAM_STORAGE_FILENAME || 'telegram_posts.json',
  onlyPostsWithTags: isTrueLiteral($env.ONLY_POSTS_WITH_TAGS),
  loadFromS3Only:    isTrueLiteral($env.LOAD_FROM_S3_ONLY),
  botToken:          $env.TELEGRAM_BOT_TOKEN,
  channelId:         parseInt($env.TELEGRAM_CHANNEL_ID),
  channelUrl:        $env.TELEGRAM_CHANNEL_URL,
  s3Client:          new S3Client({
    region: $env.S3_REGION,
    endpoint: $env.S3_ENDPOINT,
    credentials: {
      accessKeyId: $env.S3_KEY_ID,
      secretAccessKey: $env.S3_ACCESS_KEY
    }
  }),
  revisionS3FileName: $env.REVISION_S3_FILENAME || '.revision',
  majorVersion:       $env.MAJOR_VERSION || '0',
}
