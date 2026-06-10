const ALLOWED_TAGS = [
  "b", "i", "em", "strong", "u", "p", "br",
  "ul", "ol", "li",
  "span", "div",
  "a",
  "code", "pre",
  "img"
];

const ALLOWED_ATTR = [
  "href",
  "title",
  "target",
  "rel",
  "class",

  "src",
  "alt",
  "width",
  "height"
];

const config = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  ALLOW_DATA_ATTR: false
};

window.SafeHTML = {
  sanitize(html) {
    if (typeof html !== "string") return "";
    return DOMPurify.sanitize(html, config);
  }
};
