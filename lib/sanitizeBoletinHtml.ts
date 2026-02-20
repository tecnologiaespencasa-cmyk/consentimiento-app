const DANGEROUS_BLOCK_TAGS = [
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "link",
  "meta",
  "base",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "option",
  "svg",
  "math",
]

const ALLOWED_TAGS = new Set([
  "a",
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "span",
  "div",
  "hr",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
])

const VOID_TAGS = new Set(["br", "hr"])

const GLOBAL_ALLOWED_ATTRS = new Set(["title", "class"])

const TAG_ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel", "title", "class"]),
  table: new Set(["class"]),
  td: new Set(["colspan", "rowspan", "align", "class"]),
  th: new Set(["colspan", "rowspan", "align", "class"]),
}

function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function decodeBasicHtmlEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, d) => {
      const code = Number(d)
      return Number.isFinite(code) ? String.fromCharCode(code) : ""
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      const code = parseInt(h, 16)
      return Number.isFinite(code) ? String.fromCharCode(code) : ""
    })
    .replace(/&colon;/gi, ":")
    .replace(/&tab;/gi, "\t")
    .replace(/&newline;/gi, "\n")
    .replace(/&amp;/gi, "&")
}

function sanitizeUrl(input: string): string | null {
  const raw = String(input || "").trim()
  if (!raw) return null

  const decoded = decodeBasicHtmlEntities(raw)
    .replace(/[\u0000-\u001f\u007f\s]+/g, "")
    .toLowerCase()

  if (
    decoded.startsWith("javascript:") ||
    decoded.startsWith("vbscript:") ||
    decoded.startsWith("data:")
  ) {
    return null
  }

  if (raw.startsWith("/") || raw.startsWith("#") || raw.startsWith("./") || raw.startsWith("../")) {
    return raw
  }

  try {
    const parsed = new URL(raw)
    if (["http:", "https:", "mailto:", "tel:"].includes(parsed.protocol)) {
      return raw
    }
  } catch {
    return null
  }

  return null
}

function sanitizeClassName(value: string): string | null {
  const clean = value.replace(/[^\w\- ]+/g, " ").replace(/\s+/g, " ").trim()
  return clean || null
}

function sanitizeRelValue(value: string): string | null {
  const allowed = new Set(["noopener", "noreferrer", "nofollow"])
  const tokens = value
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => allowed.has(token))
  if (!tokens.length) return null
  return Array.from(new Set(tokens)).join(" ")
}

function sanitizeSpanValue(value: string): string | null {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1 || n > 100) return null
  return String(n)
}

function sanitizeAttributes(tag: string, rawAttrs: string): string {
  const allowedForTag = TAG_ALLOWED_ATTRS[tag] ?? new Set<string>()
  const attrs = new Map<string, string>()
  const attrRegex = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g

  for (const match of rawAttrs.matchAll(attrRegex)) {
    const name = (match[1] || "").toLowerCase()
    if (!name || name.startsWith("on") || name === "style") continue

    const isAllowed = allowedForTag.has(name) || GLOBAL_ALLOWED_ATTRS.has(name)
    if (!isAllowed) continue

    const originalValue = (match[2] ?? match[3] ?? match[4] ?? "").trim()
    if (!originalValue && name !== "target") continue

    if (name === "href") {
      const safeHref = sanitizeUrl(originalValue)
      if (!safeHref) continue
      attrs.set(name, safeHref)
      continue
    }

    if (name === "class") {
      const safeClass = sanitizeClassName(originalValue)
      if (!safeClass) continue
      attrs.set(name, safeClass)
      continue
    }

    if (name === "target") {
      if (!["_blank", "_self", "_parent", "_top"].includes(originalValue)) continue
      attrs.set(name, originalValue)
      continue
    }

    if (name === "rel") {
      const safeRel = sanitizeRelValue(originalValue)
      if (!safeRel) continue
      attrs.set(name, safeRel)
      continue
    }

    if (name === "rowspan" || name === "colspan") {
      const safeSpan = sanitizeSpanValue(originalValue)
      if (!safeSpan) continue
      attrs.set(name, safeSpan)
      continue
    }

    if (name === "align") {
      if (!["left", "center", "right", "justify"].includes(originalValue.toLowerCase())) continue
      attrs.set(name, originalValue.toLowerCase())
      continue
    }

    attrs.set(name, originalValue)
  }

  if (tag === "a" && attrs.get("target") === "_blank") {
    const rel = sanitizeRelValue(attrs.get("rel") || "")
    const relTokens = new Set((rel || "").split(/\s+/).filter(Boolean))
    relTokens.add("noopener")
    relTokens.add("noreferrer")
    attrs.set("rel", Array.from(relTokens).join(" "))
  }

  let serialized = ""
  for (const [key, value] of attrs.entries()) {
    serialized += ` ${key}="${escapeHtmlAttribute(value)}"`
  }
  return serialized
}

export function sanitizeBoletinHtml(input: string): string {
  let clean = String(input ?? "")

  clean = clean.replace(/<!--[\s\S]*?-->/g, "")

  for (const tag of DANGEROUS_BLOCK_TAGS) {
    const blockRegex = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, "gi")
    const selfClosingRegex = new RegExp(`<${tag}\\b[^>]*\\/?>`, "gi")
    clean = clean.replace(blockRegex, "")
    clean = clean.replace(selfClosingRegex, "")
  }

  clean = clean.replace(/<\/?([a-zA-Z0-9:-]+)([^>]*)>/g, (fullTag, rawName, rawAttrs) => {
    const tag = String(rawName || "").toLowerCase()
    if (!ALLOWED_TAGS.has(tag)) return ""

    const isClosing = fullTag.startsWith("</")
    if (isClosing) {
      return VOID_TAGS.has(tag) ? "" : `</${tag}>`
    }

    const attrs = sanitizeAttributes(tag, String(rawAttrs || ""))
    return `<${tag}${attrs}>`
  })

  return clean.trim()
}
