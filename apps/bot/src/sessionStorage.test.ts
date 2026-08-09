import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSessionStorage } from './sessionStorage';

import * as queries from './queries';

vi.mock('./queries', () => ({
  readSession: vi.fn(),
  writeSession: vi.fn(),
  deleteSession: vi.fn(),
}));

const readSession = vi.mocked(queries.readSession);
const writeSession = vi.mocked(queries.writeSession);
const deleteSession = vi.mocked(queries.deleteSession);

const TENANT = '11111111-1111-1111-1111-111111111111';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createSessionStorage', () => {
  it('returns what the database holds and scopes by tenant', async () => {
    readSession.mockResolvedValueOnce({ step: 'awaiting_tracks' });
    const storage = createSessionStorage(TENANT);

    expect(await storage.read('42')).toEqual({ step: 'awaiting_tracks' });
    expect(readSession).toHaveBeenCalledWith(TENANT, '42');
  });

  it('never persists the empty session most updates carry', async () => {
    readSession.mockResolvedValueOnce(undefined);
    const storage = createSessionStorage(TENANT);

    await storage.read('42');
    await storage.write('42', {});

    expect(writeSession).not.toHaveBeenCalled();
  });

  it('skips the write-back when nothing changed this update', async () => {
    readSession.mockResolvedValueOnce({ lang: 'uz' });
    const storage = createSessionStorage(TENANT);

    await storage.read('42');
    await storage.write('42', { lang: 'uz' });

    expect(writeSession).not.toHaveBeenCalled();
  });

  it('persists a session that actually changed', async () => {
    readSession.mockResolvedValueOnce(undefined);
    const storage = createSessionStorage(TENANT);

    await storage.read('42');
    await storage.write('42', { step: 'awaiting_phone' });

    expect(writeSession).toHaveBeenCalledWith(TENANT, '42', {
      step: 'awaiting_phone',
    });
  });

  it('writes again after a change even if a later value repeats an old one', async () => {
    readSession.mockResolvedValueOnce({ calcRetried: true });
    const storage = createSessionStorage(TENANT);

    await storage.read('42');
    await storage.write('42', { calcRetried: false });
    await storage.write('42', { calcRetried: true });

    expect(writeSession).toHaveBeenCalledTimes(2);
  });

  it('delete removes the row and a following empty write stays skipped', async () => {
    readSession.mockResolvedValueOnce({ step: 'awaiting_phone' });
    const storage = createSessionStorage(TENANT);

    await storage.read('42');
    await storage.delete('42');
    await storage.write('42', {});

    expect(deleteSession).toHaveBeenCalledWith(TENANT, '42');
    expect(writeSession).not.toHaveBeenCalled();
  });

  it('keeps tenants apart: same chat id, different bots', async () => {
    readSession.mockResolvedValue(undefined);
    const a = createSessionStorage(TENANT);
    const b = createSessionStorage('22222222-2222-2222-2222-222222222222');

    await a.read('42');
    await b.read('42');
    await a.write('42', { lang: 'ru' });
    await b.write('42', { lang: 'uz' });

    expect(writeSession).toHaveBeenCalledTimes(2);
    expect(writeSession).toHaveBeenNthCalledWith(1, TENANT, '42', {
      lang: 'ru',
    });
  });
});
