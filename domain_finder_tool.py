import subprocess
import concurrent.futures
import shutil
import os
import argparse
import openai
import json # Import for parsing JSON response
from typing import List, Optional

class DomainFinderTool:
    """
    Une extension pour trouver des noms de domaine disponibles basés sur une description.
    """

    MIN_DOMAIN_LENGTH = 7 # Nouvelle variable de classe pour la longueur minimale
    TARGET_AVAILABLE_DOMAINS = 20 # Nouvelle variable de classe pour le nombre cible de domaines disponibles

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialise l'outil de recherche de domaine.
        """
        if not self.is_whois_installed():
            raise FileNotFoundError(
                "L'outil 'whois' n'est pas trouvé. Veuillez l'installer. "
                "Sur Debian/Ubuntu: sudo apt-get install whois. "
                "Sur macOS: brew install whois."
            )
        
        # Configurer l'API OpenAI
        if api_key:
            openai.api_key = api_key
        else:
            env_api_key = os.environ.get("OPENAI_API_KEY")
            if not env_api_key:
                raise EnvironmentError(
                    "La clé API OpenAI n'est pas fournie via l'argument --api-key "
                    "ni via la variable d'environnement OPENAI_API_KEY. "
                    "Veuillez la configurer : export OPENAI_API_KEY='votre_clé_api' ou utilisez --api-key."
                )
            openai.api_key = env_api_key
        
        self.llm_client = openai.OpenAI()
        self.model_name = "gpt-3.5-turbo"

    def is_whois_installed(self) -> bool:
        """Vérifie si la commande 'whois' est disponible dans le PATH système."""
        return shutil.which("whois") is not None

    def _identify_vocabulary(self, description: str) -> List[str]:
        """
        Utilise OpenAI pour identifier les mots clés et le vocabulaire associé à la description.
        """
        prompt_message = f"""
        À partir de la description suivante, identifiez 5 à 10 mots clés et termes associés pertinents.
        La réponse doit être UNIQUEMENT un objet JSON avec une clé "vocabulary" dont la valeur est une liste de chaînes de caractères, sans aucun autre texte, explication ou formatage supplémentaire.

        Description : "{description}"

        Exemple de format de sortie : {{'vocabulary': ['motcle1', 'motcle2', 'terme_associé1']}}
        """
        print("Identification du vocabulaire avec OpenAI...")
        try:
            response = self.llm_client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": "Vous êtes un assistant utile qui identifie des mots clés pertinents et des termes associés à partir d'une description. Votre réponse doit être UNIQUEMENT un objet JSON avec une clé 'vocabulary' dont la valeur est une liste de chaînes de caractères."},
                    {"role": "user", "content": prompt_message}
                ],
                max_tokens=150,
                n=1,
                stop=None,
                temperature=0.5,
                response_format={"type": "json_object"}
            )
            response_text = response.choices[0].message.content.strip()
            print(f"Réponse brute d'OpenAI (vocabulaire) : {response_text}")
            
            parsed_response = json.loads(response_text)
            vocabulary = parsed_response.get("vocabulary", [])
            
            if isinstance(vocabulary, list) and all(isinstance(item, str) for item in vocabulary):
                print(f"Vocabulaire identifié : {', '.join(vocabulary)}")
                return vocabulary
            else:
                print("La réponse d'OpenAI était un JSON valide mais ne contenait pas une liste de chaînes de caractères sous la clé 'vocabulary'.")
                return []
        except json.JSONDecodeError:
            print(f"Erreur de décodage JSON de la réponse d'OpenAI. Réponse brute: {response_text}")
            return []
        except Exception as e:
            print(f"Erreur lors de l'identification du vocabulaire avec OpenAI : {e}")
            return []

    def _generate_domain_ideas(self, description: str, vocabulary: List[str], count: int = 20) -> List[str]:
        """
        Utilise OpenAI pour générer des idées de noms de domaine basées sur la description et le vocabulaire identifié.
        Filtre les idées pour ne retenir que celles de MIN_DOMAIN_LENGTH caractères ou plus (hors .com).
        """
        vocab_str = ", ".join(vocabulary)
        prompt_message = f"""
        Je cherche un nom de marque pour un produit.
        Le nom doit être court, moderne, et facile à mémoriser (mnémonique).
        L'extension de domaine doit être exclusivement '.com'.

        Description du produit : "{description}"
        Vocabulaire et mots clés pertinents : {vocab_str}

        Génère une liste de {count} idées de noms de marque potentiels (sans l'extension).
        Ne retourne QUE la liste des noms, séparés par des virgules, sans aucun autre texte, numérotation ou explication.
        Exemple de format : nomun, nomdeux, nomtrois
        """
        
        print("Génération d'idées avec OpenAI (en utilisant le vocabulaire)...")
        try:
            response = self.llm_client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that generates brand names."},
                    {"role": "user", "content": prompt_message}
                ],
                max_tokens=200,
                n=1,
                stop=None,
                temperature=0.7,
            )
            response_text = response.choices[0].message.content.strip()
            raw_ideas = [idea.strip().lower().replace(" ", "") for idea in response_text.split(',')]
        except Exception as e:
            print(f"Erreur lors de la génération d'idées avec OpenAI : {e}")
            return []
        
        # Filtrer les idées de domaine de MIN_DOMAIN_LENGTH caractères ou plus
        filtered_ideas = []
        for idea in raw_ideas:
            if len(idea) >= self.MIN_DOMAIN_LENGTH:
                filtered_ideas.append(idea + ".com")
            else:
                print(f"  - Ignoré (moins de {self.MIN_DOMAIN_LENGTH} caractères): {idea}")
        
        if not filtered_ideas:
            print(f"  - Aucune idée de domaine de {self.MIN_DOMAIN_LENGTH} caractères ou plus n'a été générée. Réessayez avec une description différente ou moins de contraintes.")
            return []

        return filtered_ideas

    def _is_domain_available(self, domain_name: str) -> bool:
        """
        Vérifie la disponibilité d'un nom de domaine en utilisant la commande 'whois'.
        """
        try:
            result = subprocess.run(
                ['whois', domain_name],
                capture_output=True, text=True, timeout=10, check=False
            )
            output = result.stdout.lower()
            
            not_found_patterns = [
                "no match for domain", "not found", "no whois information found",
                "domain not found", "no entries found", 
                "the queried object does not exist", "available for registration"
            ]
            
            if any(pattern in output for pattern in not_found_patterns):
                return True
            
            # Heuristique pour .com où 'whois' peut ne pas être explicite
            if ".com" in domain_name and "creation date:" not in output and "domain status:" not in output:
                 return True

            return False
        except (subprocess.TimeoutExpired, Exception):
            return False

    def find_available_domains(self, product_description: str) -> List[str]:
        """
        Fonction principale : génère des idées et retourne celles qui sont disponibles.
        Insiste jusqu'à trouver au moins TARGET_AVAILABLE_DOMAINS domaines disponibles ou atteindre la limite de tentatives.
        """
        max_retries = 10
        retries = 0
        available_domains = []

        # Phase 1: Identifier le vocabulaire
        vocabulary = self._identify_vocabulary(product_description)
        if not vocabulary:
            print("# Impossible d'identifier le vocabulaire. Arrêt.")
            return []

        while len(available_domains) < self.TARGET_AVAILABLE_DOMAINS and retries < max_retries:
            if retries > 0:
                print(f"\n# Seulement {len(available_domains)} domaines trouvés. Nouvelle tentative ({retries}/{max_retries}) pour en trouver au moins {self.TARGET_AVAILABLE_DOMAINS}...")
            
            # Phase 2: Générer des idées de domaines en utilisant le vocabulaire
            domain_ideas = self._generate_domain_ideas(product_description, vocabulary)
            if not domain_ideas:
                break

            print(f"\n# Idées de domaines considérées ({len(domain_ideas)}):")
            for idea in domain_ideas:
                print(f"  - {idea}")

            print(f"\nVérification de {len(domain_ideas)} idées (cela peut prendre un moment)...")
            
            if retries == 0:
                print(f"\n# Domaines .com disponibles (objectif : {self.TARGET_AVAILABLE_DOMAINS}) :")

            with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
                future_to_domain = {executor.submit(self._is_domain_available, d): d for d in domain_ideas}
                for future in concurrent.futures.as_completed(future_to_domain):
                    domain = future_to_domain[future]
                    if future.result():
                        available_domains.append(domain)
                        print(f"  - {domain}")
            retries += 1
        
        if len(available_domains) < self.TARGET_AVAILABLE_DOMAINS:
            print(f"\n# Attention: Seulement {len(available_domains)} domaines disponibles trouvés après {retries} tentatives. (Objectif : {self.TARGET_AVAILABLE_DOMAINS})")
        return available_domains


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description="Trouve des noms de domaine disponibles basés sur une description de produit."
    )
    parser.add_argument(
        "product_description",
        type=str,
        help="Une description textuelle du produit ou du service."
    )
    parser.add_argument(
        "--api-key",
        type=str,
        help="Votre clé API OpenAI. Si elle n'est pas fournie, la variable d'environnement OPENAI_API_KEY sera utilisée."
    )
    args = parser.parse_args()

    try:
        finder = DomainFinderTool(api_key=args.api_key)
        domaines_disponibles = finder.find_available_domains(args.product_description)
        
        if domaines_disponibles:
            print(f"\n# {len(domaines_disponibles)} Domaines .com disponibles trouvés :")
            for domain in sorted(domaines_disponibles):
                print(domain)
        else:
            print(f"\n# Aucun des {len(domaines_disponibles)} domaines suggérés ne semble être disponible après plusieurs tentatives.")
    
    except (FileNotFoundError, EnvironmentError) as e:
        print(f"\n# ERREUR DE CONFIGURATION : {e}")
    except Exception as e:
        print(f"\n# Une erreur inattendue est survenue : {e}")
