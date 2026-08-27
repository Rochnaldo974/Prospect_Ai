import { describe, expect, it, vi, afterEach } from 'vitest';
import { createLogger, logger } from '../../packages/core/src/logger';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('logger', () => {
  it('écrit le message sur la sortie standard', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('pipeline démarré');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0]?.[0]).toContain('pipeline démarré');
  });

  it('propage le contexte du logger enfant', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.child({ job_id: 42 }).info('job réclamé', { company_id: 'abc' });
    const line = String(spy.mock.calls[0]?.[0]);
    expect(line).toContain('"job_id":42');
    expect(line).toContain('"company_id":"abc"');
  });

  it('sérialise les erreurs plutôt que de produire un objet vide', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('échec du scan', { error: new Error('timeout DNS') });
    const line = String(spy.mock.calls[0]?.[0]);
    expect(line).toContain('timeout DNS');
    expect(line).toContain('"name":"Error"');
  });

  it('filtre les niveaux sous le seuil configuré', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const quiet = createLogger({ level: 'warn' });
    quiet.debug('trace verbeuse');
    quiet.info('information');
    expect(spy).not.toHaveBeenCalled();
  });

  it('laisse passer les niveaux au-dessus du seuil', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    createLogger({ level: 'warn' }).warn('quota bientôt atteint');
    expect(spy).toHaveBeenCalledOnce();
  });

  it('produit du JSON strict en mode non lisible', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    createLogger({ level: 'info', pretty: false, context: { job: 'scan' } }).info('ok');
    const parsed = JSON.parse(String(spy.mock.calls[0]?.[0]));
    expect(parsed).toMatchObject({ level: 'info', msg: 'ok', job: 'scan' });
  });
});
