import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { getServerEnv, resetServerEnvCache } from '../../packages/core/src/config/env';

const VALID = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
};

const ORIGINAL = { ...process.env };

describe('getServerEnv', () => {
  beforeEach(() => {
    resetServerEnvCache();
    for (const key of Object.keys(VALID)) delete process.env[key];
  });

  afterEach(() => {
    process.env = { ...ORIGINAL };
    resetServerEnvCache();
  });

  it('applique les valeurs par défaut du worker', () => {
    Object.assign(process.env, VALID);
    const env = getServerEnv();
    expect(env.WORKER_ID).toBe('local');
    expect(env.WORKER_CONCURRENCY).toBe(4);
    expect(env.WORKER_POLL_INTERVAL_MS).toBe(2000);
  });

  it('convertit les nombres passés en chaîne', () => {
    Object.assign(process.env, VALID, { WORKER_CONCURRENCY: '12' });
    expect(getServerEnv().WORKER_CONCURRENCY).toBe(12);
  });

  it('échoue explicitement si la clé service_role manque', () => {
    Object.assign(process.env, { ...VALID, SUPABASE_SERVICE_ROLE_KEY: '' });
    expect(() => getServerEnv()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('refuse une URL Supabase malformée', () => {
    Object.assign(process.env, { ...VALID, NEXT_PUBLIC_SUPABASE_URL: 'pas-une-url' });
    expect(() => getServerEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it('mémoïse le résultat', () => {
    Object.assign(process.env, VALID);
    const first = getServerEnv();
    process.env['WORKER_ID'] = 'modifié-après-coup';
    expect(getServerEnv()).toBe(first);
    expect(getServerEnv().WORKER_ID).toBe('local');
  });
});
