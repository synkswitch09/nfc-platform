import { EventEmitter } from 'node:events';
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock('node:dns/promises', () => ({ lookup: mocks.lookup }));
vi.mock('node:https', () => ({ request: mocks.request }));
import { readPublicWebsite, websiteUrl } from '@/lib/assistants/website-http';
beforeEach(() => {
 vi.clearAllMocks();
 mocks.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
 mocks.request.mockImplementation((_url, _options, receive) => {
  const req = new EventEmitter() as EventEmitter & { end: () => void };
  req.end = () => queueMicrotask(() => { const response = new EventEmitter() as EventEmitter & { headers: Record<string, string>; statusCode: number }; response.headers = { 'content-type': 'text/html' }; response.statusCode = 200; receive(response); response.emit('data', Buffer.from('<main>Public FAQ</main>')); response.emit('end'); });
  return req;
 });
});
it('pins the validated public DNS address into the real request lookup', async () => {
 const url = websiteUrl('example.com'); const result = await readPublicWebsite(url, Date.now() + 10000);
 expect(result.body).toContain('Public FAQ'); expect(mocks.lookup).toHaveBeenCalledWith('example.com', { all: true, family: 4 });
 const options = mocks.request.mock.calls[0][1], callback = vi.fn(); options.lookup('example.com', { all: true }, callback);
 expect(callback).toHaveBeenCalledWith(null, [{ address: '93.184.216.34', family: 4 }]); expect(options.agent).toBe(false);
});
it('blocks mixed public/private DNS results before opening a connection', async () => {
 mocks.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }, { address: '169.254.169.254', family: 4 }]);
 await expect(readPublicWebsite(websiteUrl('example.com'), Date.now() + 10000)).rejects.toThrow('public website'); expect(mocks.request).not.toHaveBeenCalled();
});
it('reports DNS failures as an actionable website field error', async () => { mocks.lookup.mockRejectedValue(new Error('ENOTFOUND')); await expect(readPublicWebsite(websiteUrl('example.com'), Date.now() + 10000)).rejects.toThrow('websiteUrl:'); expect(mocks.request).not.toHaveBeenCalled(); });
it('stops an expired import before looking up another address', async () => { await expect(readPublicWebsite(websiteUrl('example.com'), Date.now() - 1)).rejects.toThrow('took too long'); expect(mocks.lookup).not.toHaveBeenCalled(); });
