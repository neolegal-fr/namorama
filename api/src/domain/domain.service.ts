import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { exec } from 'child_process';
import { promisify } from 'util';
import { MatchMode } from './dto/search-domains.dto';

const execAsync = promisify(exec);

@Injectable()
export class DomainService {
  private readonly logger = new Logger(DomainService.name);
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  async refineDescription(description: string): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Tu es un expert en marketing et branding. Reformule et complète la description suivante pour en extraire l\'essence et la valeur ajoutée du produit. Sois concis mais percutant.',
          },
          { role: 'user', content: description },
        ],
        max_tokens: 200,
      });

      return response.choices[0].message.content?.trim() ?? '';
    } catch (error) {
      this.logger.error('Erreur lors de la reformulation IA:', error);
      throw error;
    }
  }

  async generateKeywords(description: string): Promise<string[]> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `Tu es un expert en SEO et sémantique. 
            Identifie AU MOINS 20 mots-clés et termes associés pertinents pour la description suivante. 
            Varie les angles : synonymes, termes techniques, bénéfices utilisateurs, et concepts abstraits liés au domaine.
            Retourne UNIQUEMENT une liste de mots séparés par des virgules, sans numérotation.`,
          },
          { role: 'user', content: description },
        ],
        max_tokens: 300,
        temperature: 0.8,
      });

      const content = response.choices[0].message.content;
      if (!content) return [];
      return content.split(',').map(k => k.trim()).filter(k => k.length > 0);
    } catch (error) {
      this.logger.error('Erreur lors de la génération des mots-clés:', error);
      throw error;
    }
  }

  async generateDomainIdeas(description: string, keywords: string[]): Promise<string[]> {
    const vocabStr = keywords.join(', ');
    const prompt = `
      Tu es un expert en branding et naming de classe mondiale. 
      Ta mission est de générer 30 noms de marque percutants pour le projet suivant :
      Description : "${description}"
      Mots-clés sémantiques : ${vocabStr}

      Critères de qualité (IMPÉRATIF) :
      1. Court (2-3 syllabes max).
      2. Facile à prononcer et à épeler (doit passer le "test de la radio").
      3. Éviter les chiffres et les tirets.
      4. Sonorité moderne et mémorisable.

      Utilise un mélange de ces techniques de naming :
      - Portmanteaux (fusion de 2 mots pertinents).
      - Mots composés courts et élégants.
      - Noms évocateurs (métaphores liées au bénéfice client).
      - Noms inventés avec une racine latine ou anglo-saxonne forte.

      Ta réponse doit être UNIQUEMENT un objet JSON avec une clé "names" contenant une liste de chaînes de caractères (uniquement le nom, sans l'extension).
      Exemple: {"names": ["Altro", "Velora", "Flowly"]}
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
        temperature: 0.95,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0].message.content;
      if (!content) return [];
      
      const parsed = JSON.parse(content);
      const names: string[] = parsed.names || [];
      
      return names
        .map(name => name.trim().toLowerCase().replace(/[^a-z0-9]/g, ''))
        .filter(name => name.length > 3);
    } catch (error) {
      this.logger.error('Erreur lors de la génération des noms:', error);
      return [];
    }
  }

  async isDomainAvailable(domain: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`whois ${domain}`, { timeout: 5000 });
      const output = stdout.toLowerCase();

      const patterns = [
        'domain name:',
        'registrar:',
        'creation date:',
        'registry domain id:',
        'reserved'
      ];

      return !patterns.some(pattern => output.includes(pattern));
    } catch (error: any) {
      const errorMsg = error.stdout?.toLowerCase() || error.message?.toLowerCase() || '';
      return errorMsg.includes('no match') || errorMsg.includes('not found') || errorMsg.includes('available');
    }
  }

  async findAvailableDomains(
    description: string, 
    keywords: string[], 
    targetCount = 10,
    extensions = ['.com'],
    matchMode = MatchMode.ANY
  ): Promise<{ results: any[], totalChecked: number }> {
    const finalResults: any[] = [];
    const checkedNames = new Set<string>();
    let attempts = 0;
    const maxAttempts = 5;

    while (finalResults.length < targetCount && attempts < maxAttempts) {
      const names = await this.generateDomainIdeas(description, keywords);
      
      const newNames = names.filter(name => !checkedNames.has(name));
      newNames.forEach(name => checkedNames.add(name));

      if (newNames.length === 0) {
        attempts++;
        continue;
      }

      for (const name of newNames) {
        if (finalResults.length >= targetCount) break;

        const extStatus: Record<string, boolean> = {};
        
        await Promise.all(extensions.map(async (ext) => {
          extStatus[ext] = await this.isDomainAvailable(`${name}${ext}`);
        }));

        const availableExts = Object.keys(extStatus).filter(ext => extStatus[ext]);
        
        let isMatch = false;
        if (matchMode === MatchMode.ALL) {
          isMatch = availableExts.length === extensions.length;
        } else {
          isMatch = availableExts.length > 0;
        }

        if (isMatch) {
          finalResults.push({
            name,
            availableExtensions: availableExts,
            allExtensions: extStatus
          });
        }
      }
      attempts++;
    }

    return {
      results: finalResults,
      totalChecked: checkedNames.size
    };
  }
}