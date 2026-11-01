import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { BlockList, isIP } from 'node:net';
import { brotliDecompressSync, gunzipSync, inflateSync } from 'node:zlib';
import { AssistantError } from './http';

const denied = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) denied.addSubnet(address, prefix, 'ipv4');
denied.addAddress('168.63.129.16', 'ipv4'); // Azure platform virtual IP
export function publicIPv4(address: string) {
  return isIP(address) === 4 && !denied.check(address, 'ipv4');
}
export function websiteUrl(value: string) {
  let url: URL;
  try { url = new URL(/^[a-z][a-z\d+.-]*:/i.test(value.trim()) ? value.trim() : `https://${value.trim()}`); }
  catch { throw new AssistantError('websiteUrl: Enter a valid website address.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search ||
      isIP(url.hostname.replace(/^\[|\]$/g, '')) || !url.hostname.includes('.') ||
      /(?:^|\.)(?:localhost|local|internal|test|invalid|home|lan)$/.test(url.hostname) ||
      /[\\\s]/.test(value) || url.hostname.endsWith('.')) {
    throw new AssistantError('websiteUrl: Use a public HTTPS website address without credentials, a port or query parameters.');
  }
  url.hash = '';
  return url;
}
export type WebsiteResponse = { status: number; body: string; type: string; location?: string };
const MAX_BYTES = 750_000;
export async function readPublicWebsite(url: URL, deadline: number): Promise<WebsiteResponse> {
  websiteUrl(url.href);
  const remaining = Math.min(6000, deadline - Date.now());
  if (remaining < 1) throw new AssistantError('Website import took too long. Try a specific FAQ or product page.', 504);
  // Resolve once and pin that public address into the actual socket lookup.
  // Validating DNS and then using fetch would allow a DNS rebinding bypass.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const addresses = await Promise.race([
    lookup(url.hostname, { all: true, family: 4 }),
    new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new AssistantError('The website DNS lookup timed out.', 504)), remaining); timer.unref(); }),
  ]).catch(error => { throw error instanceof AssistantError ? error : new AssistantError("websiteUrl: The website address could not be resolved. Check the spelling and try again."); }).finally(() => clearTimeout(timer));
  if (!addresses.length || addresses.some(item => !publicIPv4(item.address))) {
    throw new AssistantError('websiteUrl: This address does not resolve to a supported public website.');
  }
  const pinned = addresses[0].address;
  return new Promise((resolve, reject) => {
    const req = request(url, {
      method: 'GET', agent: false, family: 4,
      headers: { 'user-agent': 'BusinessAssistantImporter/1.0', accept: 'text/html, application/xhtml+xml, application/xml, text/plain;q=0.8', 'accept-encoding': 'gzip, br, deflate' },
      signal: AbortSignal.timeout(Math.max(1, Math.min(remaining, deadline - Date.now()))),
      lookup: (_hostname, options, callback) => {
        if (options.all) callback(null, [{ address: pinned, family: 4 }]);
        else callback(null, pinned, 4);
      },
    }, response => {
      const chunks: Buffer[] = [];
      let bytes = 0;
      response.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > MAX_BYTES) { response.destroy(); req.destroy(new AssistantError('This page is too large to import.')); }
        else chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => {
        try {
          let buffer = Buffer.concat(chunks);
          const encoding = response.headers['content-encoding'];
          const limits = { maxOutputLength: MAX_BYTES };
          if (encoding === 'gzip') buffer = gunzipSync(buffer, limits);
          else if (encoding === 'br') buffer = brotliDecompressSync(buffer, limits);
          else if (encoding === 'deflate') buffer = inflateSync(buffer, limits);
          else if (encoding && encoding !== 'identity') throw new Error('Unsupported encoding');
          resolve({ status: response.statusCode || 0, type: response.headers['content-type'] || '', body: buffer.toString('utf8'), location: response.headers.location });
        } catch { reject(new AssistantError('This page could not be read. Try another public page.')); }
      });
    });
    req.on('error', error => reject(error instanceof AssistantError ? error : new AssistantError('The website could not be reached. Check that it is publicly accessible.', 502)));
    req.end();
  });
}
