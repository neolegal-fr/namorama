import { HorlogeService } from './horloge.service';

describe('HorlogeService', () => {
  const avecDecalage = async (decalageBase: number) => {
    const logger = { error: jest.fn(), warn: jest.fn() };
    const ds = { query: jest.fn(async () => [{ decalage: decalageBase }]) };
    await new HorlogeService(ds as any, logger as any).onApplicationBootstrap();
    return logger;
  };

  it('ne dit rien quand la base et l\'API ont la même heure', async () => {
    const logger = await avecDecalage(-new Date().getTimezoneOffset());
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('signale en erreur une base décalée de deux heures sur l\'API', async () => {
    const logger = await avecDecalage(-new Date().getTimezoneOffset() + 120);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Horloges en désaccord'), undefined, 'HorlogeService');
  });

  it('ne bloque jamais le démarrage si la base ne répond pas', async () => {
    const logger = { error: jest.fn(), warn: jest.fn() };
    const ds = { query: jest.fn(async () => { throw new Error('ECONNREFUSED'); }) };
    await expect(new HorlogeService(ds as any, logger as any).onApplicationBootstrap()).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });
});
