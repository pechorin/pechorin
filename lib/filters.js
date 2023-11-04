const { DateTime } = require("luxon");

module.exports = {
  withoutBlacklistedTags: (tags) => {
    return (tags || []).filter(tag => ["all", "nav", "post", "posts"].indexOf(tag) === -1)
  },
  readableDate: (dateObj) => DateTime.fromJSDate(dateObj, {zone: 'utc'}).toFormat("dd LLL yyyy"),
  // https://html.spec.whatwg.org/multipage/common-microsyntaxes.html#valid-date-string
  htmlDateString: (dateObj) => DateTime.fromJSDate(dateObj, {zone: 'utc'}).toFormat('yyyy-LL-dd'),
  min: (...numbers) => Math.min.apply(null, numbers),
  // Get the first `n` elements of a collection.
  head: (array, n) => {
    if(!Array.isArray(array) || array.length === 0) {
      return [];
    }
    if( n < 0 ) {
      return array.slice(n);
    }

    return array.slice(0, n);
  },
}
