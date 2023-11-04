const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3')
const {
  debug,
  s3Bucket,
  s3PostsFileName,
  s3Client,
  revisionS3FileName,
  majorVersion
} = require('./config.js')

const { DateTime } = require("luxon")

function fetch(callbackFn) {
  const cmd = new GetObjectCommand({
    Bucket: s3Bucket,
    Key: revisionS3FileName
  })

  s3Client.send(cmd).then((result) => {
    result.Body.toArray().then((body) => {
      callbackFn(body.toString())
    })
  }).catch((error) => {
    callbackFn(0)
  })
}

function save(revision, callbackFn) {
  const cmd = new PutObjectCommand({
    Bucket: s3Bucket,
    Body: JSON.stringify(revision),
    Key: revisionS3FileName
  })

  s3Client.send(cmd).then((result) => {
    debug && console.log('saved revision: ', revision)

    callbackFn()
  }).catch((error) => {
    console.log('error while uploading revision to s3: ', error)
  })
}

function Run(resolve) {
  fetch((currentRevision) => {
    let newRevision = (parseInt(currentRevision) || 0) + 1
    let revision = majorVersion + "." + newRevision

    debug && console.log('current revision -> ', revision)

    save(newRevision, () => {
      resolve({
        current: revision,
        buildTime: DateTime.fromJSDate(new Date(), {zone: 'utc'}).toFormat('yyyy-LL-dd')
      })
    })
  })
}

module.exports = {
  Run: Run
}
