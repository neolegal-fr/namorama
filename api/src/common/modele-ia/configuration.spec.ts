import { lireConfigurationIA } from './configuration';

const env = (vars: Record<string, string>) => (k: string) => vars[k];

describe('lireConfigurationIA', () => {
  it('sans AI_PROVIDER, sert tout par OpenAI avec les modèles d\'avant', () => {
    const c = lireConfigurationIA(env({ OPENAI_API_KEY: 'sk-x' }));
    expect(c.principal).toBe('openai');
    expect(c.secours).toBeUndefined();
    expect(c.modeles.openai).toEqual({ simple: 'gpt-5.6-luna', creatif: 'gpt-5.6-terra', analyse: 'gpt-5.6-luna' });
  });

  it('le modèle d\'analyse non défini vaut le modèle simple du même fournisseur', () => {
    const c = lireConfigurationIA(env({
      AI_PROVIDER: 'anthropic',
      ANTHROPIC_API_KEY: 'sk-ant',
      ANTHROPIC_MODEL: 'claude-haiku-5-5',
      ANTHROPIC_MODEL_CREATIVE: 'claude-sonnet-5-5',
    }));
    expect(c.principal).toBe('anthropic');
    expect(c.modeles.anthropic).toEqual({ simple: 'claude-haiku-5-5', creatif: 'claude-sonnet-5-5', analyse: 'claude-haiku-5-5' });
  });

  it('ignore les variables d\'Anthropic quand OpenAI est choisi', () => {
    const c = lireConfigurationIA(env({ OPENAI_API_KEY: 'sk-x', ANTHROPIC_MODEL: 'claude-haiku-5-5', OPENAI_MODEL: 'gpt-a' }));
    expect(c.principal).toBe('openai');
    expect(c.modeles.openai?.simple).toBe('gpt-a');
  });

  it('refuse un fournisseur inconnu, en nommant la variable et ses valeurs', () => {
    expect(() => lireConfigurationIA(env({ AI_PROVIDER: 'mistral', OPENAI_API_KEY: 'sk-x' })))
      .toThrow(/AI_PROVIDER.*openai ou anthropic/);
    expect(() => lireConfigurationIA(env({ AI_FALLBACK_PROVIDER: 'gemini', OPENAI_API_KEY: 'sk-x' })))
      .toThrow(/AI_FALLBACK_PROVIDER/);
  });

  it('refuse Claude sans clé', () => {
    expect(() => lireConfigurationIA(env({
      AI_PROVIDER: 'anthropic',
      ANTHROPIC_MODEL: 'claude-haiku-5-5',
      ANTHROPIC_MODEL_CREATIVE: 'claude-sonnet-5-5',
    }))).toThrow(/ANTHROPIC_API_KEY/);
  });

  it('refuse OpenAI sans clé — une clé vide ne compte pas', () => {
    expect(() => lireConfigurationIA(env({ OPENAI_API_KEY: '  ' }))).toThrow(/OPENAI_API_KEY/);
  });

  it('refuse Claude sans ses deux modèles : aucun n\'a de valeur par défaut', () => {
    expect(() => lireConfigurationIA(env({ AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk-ant', ANTHROPIC_MODEL: 'claude-haiku-5-5' })))
      .toThrow(/ANTHROPIC_MODEL et ANTHROPIC_MODEL_CREATIVE/);
  });

  it('un secours sans clé est désactivé avec un avertissement, sans bloquer le démarrage', () => {
    const c = lireConfigurationIA(env({
      AI_PROVIDER: 'anthropic',
      AI_FALLBACK_PROVIDER: 'openai',
      ANTHROPIC_API_KEY: 'sk-ant',
      ANTHROPIC_MODEL: 'claude-haiku-5-5',
      ANTHROPIC_MODEL_CREATIVE: 'claude-sonnet-5-5',
    }));
    expect(c.secours).toBeUndefined();
    expect(c.avertissements.join()).toMatch(/OPENAI_API_KEY/);
  });

  it('retient le secours quand il est configuré', () => {
    const c = lireConfigurationIA(env({
      AI_PROVIDER: 'anthropic',
      AI_FALLBACK_PROVIDER: 'openai',
      ANTHROPIC_API_KEY: 'sk-ant',
      OPENAI_API_KEY: 'sk-x',
      ANTHROPIC_MODEL: 'claude-haiku-5-5',
      ANTHROPIC_MODEL_CREATIVE: 'claude-sonnet-5-5',
    }));
    expect(c.secours).toBe('openai');
    expect(c.avertissements).toEqual([]);
  });

  it('un secours identique au principal ne sert à rien : il est ignoré', () => {
    const c = lireConfigurationIA(env({ OPENAI_API_KEY: 'sk-x', AI_FALLBACK_PROVIDER: 'openai' }));
    expect(c.secours).toBeUndefined();
  });
});
