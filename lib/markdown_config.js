// Customize Markdown settings:

const { execSync } = require("child_process")

const markdownIt = require("markdown-it");
const markdownItAnchor = require("markdown-it-anchor");
const markdownItAttrs = require("markdown-it-attrs");
const markdownItFootnotes = require('markdown-it-footnote');
const markdownItPlantuml = require('markdown-it-plantuml');

module.exports = function(eleventyConfig) {
  return markdownIt({
    html: true,
    breaks: false,
    linkify: true,
    highlight: function(str, lang, extra) {
      // var result = "empty";

      // var cmd = `chroma -f html -l ${lang} \
      //   --style="autumn" \
      //   --html-only \
      //   --html-prevent-surrounding-pre \
      //   --html-highlight=${extra}
      // `;

      // result = execSync(cmd, { input: str }).toString();

      // remove \n at start and end of code blocks
      // result = result.replace("\n<table class=\"lntable\">", '<table class="lntable">')
      // result = result.replace("<table class=\"lntable\"><tr><td class=\"lntd\">\n(\s)*", "<table class=\"lntable\"><tr><td class=\"lntd\">")
      // result = result.replace("</td></tr></table>\n", "</td></tr></table>")

      return str;
    },
  }).use(markdownItAnchor, {
    permalink: markdownItAnchor.permalink.ariaHidden({
      placement: "after",
      class: "direct-link",
      symbol: "#",
      level: [1,2,3,4,5],
    }),
    slugify: eleventyConfig.getFilter("slug")
  }).use(markdownItAttrs, {
  }).use(markdownItFootnotes, {
  }).use(markdownItPlantuml, {
    openMarker: '```plantuml',
    closeMarker: '```',
    render: function(tokens, idx) {
      var imageUrl = tokens[idx].attrGet('src')
      return `<div class="uml-wrapper"><img class="uml" src="${imageUrl}"></img></div>`
    }
  })
}
