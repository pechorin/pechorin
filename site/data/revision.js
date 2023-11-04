const revision = require('../../lib/revision.js')

module.exports = function() {
  return new Promise((resolve) => {
    revision.Run(resolve)
  })
}
