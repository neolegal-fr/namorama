import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { exec } from 'child_process';
import { promisify } from 'util';

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
            content: 'Identifie 20 mots-clés pertinents pour la description suivante. Retourne UNIQUEMENT une liste de mots séparés par des virgules.',
          },
          { role: 'user', content: description },
        ],
        max_tokens: 150,
        response_format: { type: 'text' },
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
      Je cherche un nom de marque pour un produit.
      Le nom doit être court, moderne et facile à mémoriser.
      Description : "${description}"
      Mots-clés : ${vocabStr}
      Génère 20 idées de noms de marque originaux (sans l'extension).
      Ta réponse doit être UNIQUEMENT un objet JSON avec une clé "names" contenant une liste de chaînes de caractères.
      Exemple: {"names": ["brand1", "brand2"]}
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0].message.content;
      if (!content) return [];
      
      const parsed = JSON.parse(content);
      const names: string[] = parsed.names || [];
      
      return names
        .map(name => {
          const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
          return cleanName ? `${cleanName}.com` : null;
        })
        .filter((idea): idea is string => idea !== null && idea.length > 4);
    } catch (error) {
      this.logger.error('Erreur lors de la génération des noms:', error);
      return [];
    }
  }

  async isDomainAvailable(domain: string): Promise<boolean> {
    try {
      // On utilise la commande système 'whois' avec un timeout de 5s
      const { stdout } = await execAsync(`whois ${domain}`, { timeout: 5000 });
      const output = stdout.toLowerCase();

      // Indicateurs d'occupation (si l'un d'eux est présent, le domaine est pris)
      const patterns = [
        'domain name:',
        'registrar:',
        'creation date:',
        'registry domain id:',
        'reserved'
      ];

      const isTaken = patterns.some(pattern => output.includes(pattern));
      return !isTaken;
    } catch (error: any) {
      // Si whois renvoie un code d'erreur (ex: 1), c'est souvent parce qu'il n'a rien trouvé
      // On vérifie si l'erreur contient des messages de disponibilité
      const errorMsg = error.stdout?.toLowerCase() || error.message?.toLowerCase() || '';
      if (errorMsg.includes('no match') || errorMsg.includes('not found') || errorMsg.includes('available')) {
        return true;
      }
      
      return false; // Par sécurité, on ne propose pas en cas d'erreur inconnue ou timeout
    }
  }

  async findAvailableDomains(description: string, keywords: string[], targetCount = 10): Promise<string[]> {
    const availableDomains: string[] = [];
    let attempts = 0;
    const maxAttempts = 2;

    while (availableDomains.length < targetCount && attempts < maxAttempts) {
      const ideas = await this.generateDomainIdeas(description, keywords);
      
      const batchSize = 5;
      for (let i = 0; i < ideas.length; i += batchSize) {
        if (availableDomains.length >= targetCount) break;
        
        const batch = ideas.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(domain => this.isDomainAvailable(domain))
        );

        batch.forEach((domain, idx) => {
          if (results[idx] && availableDomains.length < targetCount) {
            availableDomains.push(domain);
          }
        });
      }
      attempts++;
    }

    return availableDomains;
  }
}