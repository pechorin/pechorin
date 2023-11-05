const { env } = require('node:process')
const { S3Client } = require('@aws-sdk/client-s3')

let fileEnv = {}
let $env    = {}

require('dotenv').config({ processEnv: fileEnv })
$env = Object.assign(fileEnv, env)

function isTrue(string) {
  if (string === 'true' || string === 'TRUE') return true;
  if (parseInt(string) === 1) return true;

  return null
}

module.exports = {
  env:               $env,
  eleventyEnv:       $env.ELEVENTY_ENV,
  debug:             isTrue($env.DEBUG) || false,
  pathPrefix:        $env.PATH_PREFIX,
  s3Region:          $env.S3_REGION,
  s3Endpoint:        $env.S3_ENDPOINT,
  s3Bucket:          $env.S3_BUCKET,
  s3KeyId:           $env.S3_KEY_ID,
  s3AccessKey:       $env.S3_ACCESS_KEY,
  s3PostsFileName:   $env.S3_TELEGRAM_STORAGE_FILENAME || 'telegram_posts.json',
  onlyPostsWithTags: isTrue($env.ONLY_POSTS_WITH_TAGS) || false,
  loadFromS3Only:    isTrue($env.LOAD_FROM_S3_ONLY) || false, // TODO: make separate options for telegram / s3 posts loading
  bumpRevisionInDev: isTrue($env.BUMP_REVISION_IN_DEV) || false,
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
