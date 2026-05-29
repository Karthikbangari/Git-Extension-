import { vi, describe, it, expect, beforeEach } from 'vitest';

const managedStore: Record<string, unknown> = {};
const localStore: Record<string, unknown> = {};

const managedGetMock = vi.fn(async (key: string) => ({ [key]: managedStore[key] }));

vi.stubGlobal('chrome', {
  storage: {
    managed: {
      get: managedGetMock,
    },
    local: {
      get: vi.fn(async (key: string) => ({ [key]: localStore[key] })),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(localStore, items);
      }),
    },
    session: {
      get: vi.fn(async () => ({})),
      set: vi.fn(async () => {}),
      remove: vi.fn(async () => {}),
    },
  },
});

const { getApiKey, isManagedApiKey, isEnabledForHost } = await import('../src/utils/storage');

beforeEach(() => {
  for (const k of Object.keys(managedStore)) delete managedStore[k];
  for (const k of Object.keys(localStore)) delete localStore[k];
  vi.clearAllMocks();
  managedGetMock.mockImplementation(async (key: string) => ({ [key]: managedStore[key] }));
});

describe('getApiKey — managed → local fallback', () => {
  it('returns managed key when managed storage has one', async () => {
    managedStore['apiKey'] = 'sk-ant-managed-key';
    expect(await getApiKey()).toBe('sk-ant-managed-key');
  });

  it('returns local key when managed has no key', async () => {
    localStore['apiKey'] = 'sk-ant-local-key';
    expect(await getApiKey()).toBe('sk-ant-local-key');
  });

  it('returns null when neither managed nor local has a key', async () => {
    expect(await getApiKey()).toBeNull();
  });

  it('falls back to local when managed storage throws', async () => {
    managedGetMock.mockRejectedValueOnce(new Error('managed unavailable'));
    localStore['apiKey'] = 'sk-ant-fallback';
    expect(await getApiKey()).toBe('sk-ant-fallback');
  });

  it('returns managed key even when local also has a key (managed wins)', async () => {
    managedStore['apiKey'] = 'sk-ant-managed';
    localStore['apiKey'] = 'sk-ant-local';
    expect(await getApiKey()).toBe('sk-ant-managed');
  });
});

describe('isManagedApiKey', () => {
  it('returns true when managed storage has an API key', async () => {
    managedStore['apiKey'] = 'sk-ant-managed-key';
    expect(await isManagedApiKey()).toBe(true);
  });

  it('returns false when managed storage has no API key', async () => {
    expect(await isManagedApiKey()).toBe(false);
  });

  it('returns false when managed storage throws', async () => {
    managedGetMock.mockRejectedValueOnce(new Error('managed unavailable'));
    expect(await isManagedApiKey()).toBe(false);
  });
});

describe('isEnabledForHost — managed → local fallback', () => {
  it('respects managed disabledHosts when present', async () => {
    managedStore['disabledHosts'] = ['github.com'];
    expect(await isEnabledForHost('github.com')).toBe(false);
    expect(await isEnabledForHost('gitlab.com')).toBe(true);
  });

  it('falls back to local disabledHosts when managed has none', async () => {
    localStore['disabledHosts'] = ['gitlab.com'];
    expect(await isEnabledForHost('gitlab.com')).toBe(false);
    expect(await isEnabledForHost('github.com')).toBe(true);
  });

  it('returns true when neither managed nor local has disabledHosts', async () => {
    expect(await isEnabledForHost('github.com')).toBe(true);
  });

  it('falls back to local when managed storage throws', async () => {
    managedGetMock.mockRejectedValueOnce(new Error('managed unavailable'));
    localStore['disabledHosts'] = ['github.com'];
    expect(await isEnabledForHost('github.com')).toBe(false);
  });

  it('ignores managed disabledHosts if value is not an array', async () => {
    managedStore['disabledHosts'] = 'not-an-array';
    localStore['disabledHosts'] = ['github.com'];
    expect(await isEnabledForHost('github.com')).toBe(false);
  });
});
