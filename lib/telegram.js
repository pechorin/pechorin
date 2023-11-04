const TelegramBot = require('node-telegram-bot-api')
const { DateTime } = require("luxon")

const {
  GetObjectCommand,
  PutObjectCommand
} = require('@aws-sdk/client-s3')

const {
  debug,
  s3Bucket,
  s3PostsFileName,
  s3Client,
  onlyPostsWithTags,
  loadFromS3Only,
  botToken,
  channelId,
  channelUrl
} = require('./config.js')

const bot = new TelegramBot(botToken, { polling: false })

function fetchNewTelegramPosts(callbackFn) {
  bot.getUpdates().then((updates) => {
    if (updates !== undefined) {
      debug && console.log('fetched posts -> ', updates)

      callbackFn(processTelegramPosts(updates))
    } else {
      callbackFn({})
    }
  })
}

function processTelegramPosts(updates) {
  let posts = {}

  updates.forEach((update) => {
    let post = update.channel_post || update.edited_channel_post

    if (post === undefined) return;
    if (post.sender_chat.id !== channelId) return;
    if (!post.text.startsWith('#')) return;

    posts[post.message_id] = {
      date:     post.date,
      text:     post.text,
      entities: post.entities
    }
  })

  return posts
}

function fetchPostsFromS3(callbackFn) {
  const cmd = new GetObjectCommand({
    Bucket: s3Bucket,
    Key: s3PostsFileName
  })

  s3Client.send(cmd).then((result) => {
    result.Body.toArray().then((body) => {
      callbackFn(JSON.parse(body.toString()))
    })
  }).catch((error) => {
    callbackFn({})
  })
}

function savePostsToS3(posts, callbackFn) {
  const cmd = new PutObjectCommand({
    Bucket: s3Bucket,
    Body: JSON.stringify(posts),
    Key: s3PostsFileName
  })

  s3Client.send(cmd).then((result) => {
    debug && console.log('saved to s3 bytes: ', (new Blob([posts])).size)

    callbackFn()
  }).catch((error) => {
    console.log('error while uploading to s3: ', error)
  })
}

function loadNewPosts(callbackFn) {
  if (loadFromS3Only) return callbackFn({})

  return fetchNewTelegramPosts(callbackFn)
}

// TODO: entities
//
// "entities":[{"offset":0,"length":4,"type":"hashtag"},{"offset":5,"length":8,"type":"hashtag"},{"offset":14,"length":5,"type":"hashtag"},{"offset":20,"length":16,"type":"hashtag"},{"offset":488,"length":34,"type":"bold"},{"offset":610,"length":17,"type":"italic"},{"offset":674,"length":9,"type":"url"},{"offset":686,"length":10,"type":"url"},{"offset":1101,"length":25,"type":"italic"},{"offset":1540,"length":28,"type":"italic"},{"offset":1822,"length":30,"type":"bold"},{"offset":1970,"length":65,"type":"url"}]
function formatPosts(posts) {
  let result = []

  posts.map((post) => {
    let formatted = {}
    Object.assign(formatted, post)

    // replace \n with <br/>
    formatted.text = formatted.text.replaceAll("\n", "<br/>")

    // convert unix timestamp to Date
    formatted.date = new Date(formatted.date * 1000)
    formatted.date = DateTime.fromJSDate(formatted.date, {zone: 'utc'}).toFormat('yyyy-LL-dd')

    result.push(formatted)
  })

  return result
}

function Run(resolve) {
  fetchPostsFromS3((currentPosts) => {
    loadNewPosts((newPosts) => {
      let posts = Object.assign(currentPosts, newPosts)

      let orderedPosts = Object.keys(posts).reverse().map((i) => {
        let post = posts[i]
        post.id = i

        return post
      })

      let formattedPosts = formatPosts(orderedPosts)

      debug && console.log('posts count -> ', orderedPosts.length)
      // debug && console.log('formatted posts -> ', JSON.stringify(formattedPosts))

      savePostsToS3(posts, () => {
        resolve({
          posts: formattedPosts,
          channelUrl: channelUrl
        })
      })
    })
  })
}

module.exports = {
  'Run': Run
}
