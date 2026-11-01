import { parse, type DefaultTreeAdapterMap } from 'parse5';
import { websiteUrl } from './website-http';
type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
const omit = new Set(['script', 'style', 'nav', 'header', 'footer', 'noscript', 'template', 'svg', 'canvas', 'iframe', 'form']);
const block = new Set(['p', 'div', 'section', 'article', 'main', 'h1', 'h2', 'h3', 'h4', 'li', 'dt', 'dd', 'tr', 'details', 'summary', 'br']);
const children = (node: Node): Node[] => 'childNodes' in node ? node.childNodes : [];
function attr(node: Element, name: string) { return node.attrs.find(a => a.name === name)?.value || ''; }
export function plainHtml(html: string) {
  const root = parse(html);
  function read(node: Node): string {
    if (node.nodeName === '#text') return 'value' in node ? String(node.value) : '';
    if ('tagName' in node) {
      if (omit.has(node.tagName) || node.attrs.some(a => a.name === 'hidden') || attr(node, 'aria-hidden') === 'true') return '';
      if (/cookie|consent-banner/i.test(`${attr(node, 'id')} ${attr(node, 'class')}`)) return '';
    }
    const content = children(node).map(read).join(' ');
    return 'tagName' in node && block.has(node.tagName) ? `\n${content}\n` : content;
  }
  return read(root).replace(/[\t \r]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
function walk(node: Node, visit: (node: Element) => void) {
  if ('tagName' in node) visit(node);
  children(node).forEach(child => walk(child, visit));
}
const excludedPath = /(?:^|\/)(?:api|admin|account|login|logout|register|checkout|cart|basket|search|reset-password|verify-email|wp-admin|wp-json|\.well-known)(?:\/|$)|\.(?:pdf|zip|jpe?g|png|svg|gif|webp|mp4|css|js|json|exe|env)$/i;
export function publicPageLink(value: string, origin: URL) {
  try {
    const url = websiteUrl(new URL(value, origin).href);
    if (url.origin !== origin.origin || excludedPath.test(decodeURIComponent(url.pathname)) || url.pathname.split('/').some(p => p.startsWith('.'))) return null;
    url.hash = '';
    return url.href;
  } catch { return null; }
}
export function websiteDocument(html: string, url: URL) {
  const root = parse(html), links: string[] = [], structured: string[] = [];
  let main: Element | undefined, body: Element | undefined, title = '', noindex = false;
  walk(root, node => {
    if (node.tagName === 'title') title = children(node).map(n => 'value' in n ? n.value : '').join('');
    if (node.tagName === 'main' && !main) main = node;
    if (node.tagName === 'body') body = node;
    if (node.tagName === 'meta' && /^(?:robots|businessassistantimporter)$/i.test(attr(node, 'name')) && /noindex|none/i.test(attr(node, 'content'))) noindex = true;
    if (node.tagName === 'a') { const link = publicPageLink(attr(node, 'href'), url); if (link) links.push(link); }
    if (node.tagName === 'script' && attr(node, 'type') === 'application/ld+json') {
      try {
        const input = JSON.parse(children(node).map(n => 'value' in n ? n.value : '').join(''));
        function extract(value: unknown, depth = 0) {
          if (depth > 8 || !value || typeof value !== 'object') return;
          if (Array.isArray(value)) { value.slice(0, 100).forEach(v => extract(v, depth + 1)); return; }
          const item = value as Record<string, unknown>, kind = item['@type'];
          if (kind === 'Question' && typeof item.name === 'string') {
            const answer = item.acceptedAnswer as Record<string, unknown> | undefined;
            if (typeof answer?.text === 'string') structured.push(`Q: ${plainHtml(item.name)}\nA: ${plainHtml(answer.text)}`);
          }
          if (kind === 'Product' && typeof item.name === 'string') {
            structured.push(`Product: ${plainHtml(item.name)}${typeof item.description === 'string' ? `\n${plainHtml(item.description)}` : ''}`);
            const offers = Array.isArray(item.offers) ? item.offers : [item.offers];
            for (const offer of offers.slice(0, 30)) if (offer && typeof offer === 'object') {
              const o = offer as Record<string, unknown>;
              if ((typeof o.price === 'number' || typeof o.price === 'string') && typeof o.priceCurrency === 'string') structured.push(`Listed price: ${o.priceCurrency} ${o.price}`);
            }
          }
          for (const key of ['@graph', 'mainEntity', 'itemListElement', 'item']) if (item[key]) extract(item[key], depth + 1);
        }
        extract(input);
      } catch { /* Malformed public structured data is skipped. */ }
    }
  });
  // Reuse the parsed tree to avoid reparsing a selected <main> subtree.
  function visible(node: Node): string {
    if (node.nodeName === '#text') return 'value' in node ? String(node.value) : '';
    if ('tagName' in node && (omit.has(node.tagName) || node.attrs.some(a => a.name === 'hidden') || attr(node, 'aria-hidden') === 'true' || /cookie|consent-banner/i.test(`${attr(node, 'id')} ${attr(node, 'class')}`))) return '';
    const text = children(node).map(visible).join(' ');
    return 'tagName' in node && block.has(node.tagName) ? `\n${text}\n` : text;
  }
  const text = [...new Set([visible(main || body || root), ...structured])].join('\n').replace(/[\t \r]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return { title: title.trim() || url.pathname, text, links: [...new Set(links)], noindex };
}
export function websiteLinkPriority(value: string) {
  const path = new URL(value).pathname;
  if (/faq|frequently|shipping|delivery|return|refund|terms|polic|contact|help|about/i.test(path)) return 0;
  if (/\/products\/|\/services\//i.test(path)) return 1;
  if (/shop|collection|product|service|pricing|menu/i.test(path)) return 2;
  return 3;
}
// CMS content is structured JSON. Read only customer-facing copy keys, never
// arbitrary strings such as integration settings, internal IDs or asset keys.
export function publishedCopy(value: unknown, depth = 0): string[] {
  if (depth > 12 || !value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(v => publishedCopy(v, depth + 1));
  const item = value as Record<string, unknown>;
  if (item.visible === false || item.enabled === false) return [];
  const text: string[] = [];
  for (const [key, child] of Object.entries(item)) {
    if (['heroHeadline', 'heroDescription', 'headline', 'heading', 'title', 'subheading', 'description', 'copy', 'body', 'text', 'question', 'answer', 'supportingText', 'bulletPoints', 'bullets', 'label'].includes(key) && typeof child === 'string') text.push(plainHtml(child));
    else if (child && typeof child === 'object' && ['items', 'blocks', 'textBlocks', 'sections', 'paragraphs', 'bulletPoints', 'bullets', 'features', 'specifications', 'dimensions', 'materials', 'care'].includes(key)) {
      if (Array.isArray(child) && ['bulletPoints', 'bullets'].includes(key)) text.push(...child.filter((v): v is string => typeof v === 'string').map(plainHtml));
      else text.push(...publishedCopy(child, depth + 1));
    }
  }
  return text.filter(Boolean);
}
