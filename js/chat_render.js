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

function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, (m) => map[m]);
}

function renderContent(text) {
  return text.replace(
    /https?:\/\/[^\s<>"']+/gi,
    (url) => {
      if (/\.(png|jpe?g|gif|webp|avif|svg)$/i.test(url)) {
        return `<img class="chat-image" src="${url}">`;
      }

      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    }
  );
}
