/** Pure, shared import/retrieval limits. No network requests, credentials or AI calls. */
export const MAX_BUSINESS_KNOWLEDGE = 200000;
export const MAX_REPLY_KNOWLEDGE = 12000;
export type KnowledgeSource = { title: string; url: string | null; text: string; truncated?: boolean; originalCharacters?: number };
export function knowledgeSources(knowledge: string): KnowledgeSource[] {
  const header = /^--- (.+) ---\r?\nSource: (https:\/\/\S+)\r?\n/gm;
  const matches = [...knowledge.matchAll(header)];
  if (!matches.length) return knowledge.trim() ? [{ title: 'Business information', url: null, text: knowledge.trim() }] : [];
  const sources: KnowledgeSource[] = [];
  // Preserve owner's notes before an imported snapshot, but not importer metadata.
  const prefix = knowledge.slice(0, matches[0].index).split(/\r?\n/).filter(line => !/^(?:Website source:|Imported:|Import coverage:|Import warning:|This is a(?:n imported)? snapshot)/.test(line)).join('\n').trim();
  if (prefix) sources.push({ title: 'Business information', url: null, text: prefix });
  matches.forEach((match, i) => {
    const raw = knowledge.slice(match.index! + match[0].length, matches[i + 1]?.index ?? knowledge.length).trim();
    const coverage = raw.match(/^Source coverage: (\d+)\/(\d+) characters; (partial|complete)\n/);
    sources.push({ title: match[1], url: match[2], text: coverage ? raw.slice(coverage[0].length).trim() : raw, truncated: coverage?.[3] === 'partial', originalCharacters: coverage ? Number(coverage[2]) : undefined });
  });
  return sources.filter(s => s.text);
}
export function knowledgeAudit(knowledge: string) {
  const sources = knowledgeSources(knowledge);
  return { characters: knowledge.length, importedAt: knowledge.match(/^Imported: (.+)$/m)?.[1] || null,
    website: knowledge.match(/^Website source: (https:\/\/\S+)/m)?.[1] || null,
    sources: sources.map(s => ({ title: s.title, url: s.url, characters: s.text.length, truncated: s.truncated, originalCharacters: s.originalCharacters })),
    legacyLimit: knowledge.startsWith('Website source:') && knowledge.length >= 29900 && knowledge.length <= 30000,
    warnings: [...knowledge.matchAll(/^Import warning: (.+)$/gm)].map(match => match[1]),
    importNotes: knowledge.match(/^Import coverage: (.+)$/m)?.[1] || null,
  };
}
function normalize(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
const stop = new Set('a an the this that it is are was were and or of to for in on at with from we our your you i me my can could would do does how what where when please thanks thank hello hi hey hola buenas buenos dias tardes noches gracias quiero quisiera saber mas acerca sobre el la los las un una unos unas de del al en y o que es son como por para con mi mis tu tus su sus se si puedo puedes puede seria tiene tienen hay esto este esta eso algo me lo'.split(' '));
function tokens(value: string) { return [...new Set((normalize(value).match(/[a-z0-9]+/g) || []).filter(t => t.length > 1 && !stop.has(t)))]; }
// Small multilingual intent dictionary; product names and unknown vocabulary still match literally.
const concepts = [
  ['pickup', 'pick up', 'collect', 'collection', 'recoger', 'recogida', 'recogerlo', 'recogida local', 'retiro', 'retirar', 'buscarlo'],
  ['shipping', 'delivery', 'postage', 'dispatch', 'envio', 'envios', 'enviar', 'entrega', 'entregas'],
  ['colour', 'colours', 'color', 'colors', 'colores'],
  ['price', 'pricing', 'cost', 'precio', 'precios', 'cuesta', 'cuanto', 'vale'],
  ['size', 'dimensions', 'width', 'height', 'tamano', 'medidas', 'dimensiones', 'ancho', 'alto'],
  ['return', 'returns', 'refund', 'refunds', 'devolucion', 'devoluciones', 'reembolso'],
  ['material', 'materials', 'materiales'],
  ['personalisation', 'personalization', 'custom', 'customisation', 'personalizado', 'personalizar', 'nombre'],
  ['location', 'address', 'located', 'based', 'ubicacion', 'direccion', 'ubicados', 'where are you'],
  ['hours', 'opening', 'horario', 'horarios'],
  ['phone', 'tablet', 'stand', 'holder', 'soporte', 'portacelular'],
  ['tray', 'bandeja'],
  ['order', 'ordering', 'purchase', 'buy', 'checkout', 'comprar', 'compra', 'pedir', 'pedido'],
];
function expanded(value: string) {
  const text = normalize(value), found = new Set(tokens(value));
  for (const group of concepts) if (group.some(term => new RegExp(`\\b${term.replace(/ /g, '\\s+')}\\b`).test(text))) group.forEach(term => tokens(term).forEach(t => found.add(t)));
  return [...found];
}
function chunks(text: string) {
  const result: string[] = [];
  // Keep each short FAQ question with its answer, splitting large sources with overlap.
  for (let start = 0; start < text.length; start += 1000) result.push(text.slice(Math.max(0, start - 250), start + 1250));
  return result;
}
export function selectKnowledge(knowledge: string, messages: { role: string; content: string }[]) {
  const sources = knowledgeSources(knowledge), user = messages.filter(m => m.role === 'user').slice(-3), latest = user.at(-1)?.content || '';
  const query = expanded(latest), prior = tokens(user.slice(0, -1).map(m => m.content).join(' '));
  const greeting = !tokens(latest).length && !/[?¿]/.test(latest);
  if (greeting) return { text: '', sources: [] as { title: string; url: string | null }[], availableSources: sources.length, selectedCharacters: 0 };
  const ranked = sources.flatMap((source, sourceIndex) => {
    const title = new Set(tokens(source.title));
    return chunks(source.text).map((text, part) => {
      const words = new Set(tokens(text));
      const score = query.reduce((n, t) => n + (words.has(t) ? 3 : 0) + (title.has(t) ? 4 : 0), 0) + prior.reduce((n, t) => n + (words.has(t) ? .25 : 0) + (title.has(t) ? 1 : 0), 0);
      return { source, sourceIndex, part, text, score };
    });
  }).sort((a, b) => b.score - a.score || a.sourceIndex - b.sourceIndex || a.part - b.part);
  // No match: include only a small overview, never dump the whole catalogue.
  const counts = new Map<number, number>();
  const relevant = ranked.filter(c => { const count = counts.get(c.sourceIndex) || 0; if (c.score <= 0 || count >= 2) return false; counts.set(c.sourceIndex, count + 1); return true; });
  const selected = relevant.length ? relevant.slice(0, 12) : sources.slice(0, 1).map(source => ({ source, text: source.text.slice(0, 1500) }));
  let text = ''; const used: { title: string; url: string | null }[] = [];
  for (const chunk of selected) {
    const heading = `\n--- ${chunk.source.title} ---${chunk.source.url ? `\nReference URL (share only when useful): ${chunk.source.url}` : ''}\n`;
    const budget = MAX_REPLY_KNOWLEDGE - text.length - heading.length;
    if (budget < 100) break;
    text += heading + chunk.text.slice(0, budget) + '\n';
    if (!used.some(s => s.url === chunk.source.url && s.title === chunk.source.title)) used.push({ title: chunk.source.title, url: chunk.source.url });
  }
  return { text: text.slice(0, MAX_REPLY_KNOWLEDGE), sources: used, availableSources: sources.length, selectedCharacters: Math.min(text.length, MAX_REPLY_KNOWLEDGE) };
}
