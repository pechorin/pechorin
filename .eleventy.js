const fs = require("fs")

const pluginRss = require("@11ty/eleventy-plugin-rss")
const pluginNavigation = require("@11ty/eleventy-navigation")
const pluginIcons = require('eleventy-plugin-icons')

const markdownLibrary = require("./lib/markdown_config")
const filters = require('./lib/filters')

module.exports = function(eleventyConfig) {
  eleventyConfig.addPlugin(pluginRss)
  eleventyConfig.addPlugin(pluginNavigation)
  eleventyConfig.setLibrary("md", markdownLibrary(eleventyConfig))

  eleventyConfig.addPlugin(pluginIcons, {
    sources: [{ name: 'custom', path: 'node_modules/simple-icons/icons' }],
  })

  eleventyConfig.setDataDeepMerge(true) // https://www.11ty.dev/docs/data-deep-merge/

  eleventyConfig.addLayoutAlias("post", "post.njk")
  eleventyConfig.addLayoutAlias("application", "application.njk")

  eleventyConfig.addCollection("posts", function(collectionApi) {
    return collectionApi.getFilteredByGlob("site/posts/*.md")
  })

  eleventyConfig.addWatchTarget('./assets/')

  // eleventyConfig.addPassthroughCopy("img")
  // eleventyConfig.addPassthroughCopy("assets")

  eleventyConfig.addFilter("readableDate", filters.readableDate)
  eleventyConfig.addFilter('htmlDateString', filters.htmlDateString)
  eleventyConfig.addFilter("min", filters.min)
  eleventyConfig.addFilter("head", filters.head)
  eleventyConfig.addFilter("withoutBlacklistedTags", filters.withoutBlacklistedTags)

  // Create an array of all tags
  eleventyConfig.addCollection("tags", function(collection) {
    let tagSet = new Set()
    collection.getAll().forEach(item => (item.data.tags || []).forEach(tag => tagSet.add(tag)))

    return filters.withoutBlacklistedTags([...tagSet])
  })

  // Override Browsersync defaults (used only with --serve)
  eleventyConfig.setBrowserSyncConfig({
    callbacks: {
      ready: function(err, browserSync) {
        const content_404 = fs.readFileSync('build/404.html')

        browserSync.addMiddleware("*", (req, res) => {
          // Provides the 404 content without redirect.
          res.writeHead(404, {"Content-Type": "text/html charset=UTF-8"})
          res.write(content_404)
          res.end()
        })
      },
    },
    ui: false,
    ghostMode: false
  })

  return {
    templateFormats: [
      "md",
      "njk",
      "html",
    ],

    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    dataTemplateEngine: false,

    // passthroughFileCopy: true,

    dir: {
      input: "./site/",
      output: "./build/",
      includes: "includes",
      layouts: "layouts",
      data: "data",
    }
  }
}
