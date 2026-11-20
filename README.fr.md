# ai-locale CLI de Traduction

Un outil en ligne de commande pour valider et traduire des fichiers de localisation en utilisant l'API OpenAI. Prend en charge plusieurs formats de fichiers avec une correspondance de chemins intelligente utilisant le placeholder `#locale`.

## 🌍 Documentation Multilingue

- 🇺🇸 [English](README.md) (Original)
- 🇫🇷 [Français](README.fr.md) (Actuel)
- 🇪🇸 [Español](README.es.md)
- 🇨🇳 [中文](README.zh.md)

## 🎯 Formats de Fichiers Supportés

Le CLI prend en charge une large gamme de formats de fichiers de localisation :

### 📱 **Fichiers iOS .strings**

```strings
/* Localizable.strings */
"SAVE_BUTTON" = "Enregistrer";
"CANCEL_BUTTON" = "Annuler";
"ERROR_MESSAGE" = "Une erreur s'est produite : {error}";
```

### 📄 **Chaînes XML Android**

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="save_button">Enregistrer</string>
    <string name="cancel_button">Annuler</string>
    <string name="error_message">Une erreur s'est produite : %1$s</string>
</resources>
```

### 📦 **Fichiers JSON**

```json
{
  "save_button": "Enregistrer",
  "cancel_button": "Annuler",
  "error_message": "Une erreur s'est produite : {error}"
}
```

### 🔧 **Objets d'Export TypeScript/JavaScript**

```typescript
export default {
  save_button: "Enregistrer",
  cancel_button: "Annuler",
  error_message: "Une erreur s'est produite : {error}",
} as const;
```

### 🌍 **Fichiers GNU gettext .po**

```po
msgid "Bienvenue"
msgstr "Bienvenue"

msgid "Bonjour %(name)s"
msgstr "Bonjour %(name)s"

msgid "Enregistrer"
msgstr "Enregistrer"
```

## 🗂️ Correspondance de Chemins avec `#locale`

Le CLI utilise le placeholder `#locale` pour la découverte intelligente de fichiers et la détection de langue :

### **Comment `#locale` Fonctionne**

Le placeholder `#locale` est automatiquement remplacé par les codes de langue détectés dans votre structure de fichiers :

```bash
# Modèle : locales/#locale/messages.json
# Correspond à : locales/en/messages.json, locales/fr/messages.json, locales/es/messages.json
# Langues détectées : en, fr, es

ai-locale translate 'locales/#locale/messages.json'
```

### **Modèles `#locale` Courants**

```bash
# Structure iOS/Android
'locales/#locale/Localizable.strings'
'locales/#locale/strings.xml'

# Structure JSON
'locales/#locale/messages.json'
'i18n/#locale/translations.json'

# Structure TypeScript
'src/locales/#locale/index.ts'
'locales/#locale/translation.ts'

# Formats mixtes
'locales/#locale/strings.xml'
'locales/#locale/messages.json'
```

### **Détection de Langue**

Le CLI détecte automatiquement les langues à partir de :

- **Noms de répertoires** : `locales/en/`, `locales/fr/`
- **Noms de fichiers** : `en.json`, `fr.json`, `en.ts`
- **Chemins de fichiers** : `locales/en/messages.json`

## Fonctionnalités

- ✅ **Support Multi-format** : Gère les fichiers iOS `.strings`, Android XML, JSON, TypeScript/JavaScript et GNU gettext `.po`
- ✅ **Correspondance de Chemins Intelligente** : Utilisez le placeholder `#locale` pour la découverte intelligente de fichiers
- ✅ **Détection de Clés Manquantes** : Identifie automatiquement les traductions manquantes dans les fichiers de langue
- ✅ **Traduction Alimentée par IA** : Utilise GPT-4o-mini d'OpenAI pour des traductions de haute qualité
- ✅ **Optimisé pour le Coût** : Traite les traductions en lots parallèles avec estimation des coûts
- ✅ **Conscient du Contexte** : Utilise TOUTES les traductions existantes comme contexte pour une précision maximale
- ✅ **CLI Interactif** : Interface de terminal magnifique avec indicateurs de progression
- ✅ **Support de Sauvegarde** : Crée automatiquement des fichiers de sauvegarde avant la traduction
- ✅ **Mode Dry Run** : Prévisualise les traductions sans apporter de modifications
- ✅ **Contrôle de Lot** : Taille de lot et délai configurables pour la gestion des limites de taux

## Installation

### Installation Globale

```bash
npm install -g ai-locale-cli
```

### Installation Locale

```bash
git clone <repository-url>
cd iara-worldwide
npm install
```

## Démarrage Rapide

### 1. Configurer la Clé API

Créez un fichier `.env` à la racine de votre projet :

```bash
OPENAI_API_KEY=sk-your-openai-api-key-here
```

Ou utilisez l'option `--api-key` :

```bash
ai-locale translate "locales/#locale/messages.json" --api-key sk-your-key
```

### 2. Traduire les Fichiers

```bash
# Utilisant le modèle #locale (recommandé)
ai-locale translate "locales/#locale/messages.json" --source en

# Spécifier les langues cibles explicitement
ai-locale translate "locales/#locale/strings.xml" --source en --target fr,es,de

# Utiliser les modèles glob traditionnels
ai-locale translate "translations/**/*.strings" --source en --target fr,es

# Dry run pour voir ce qui serait traduit
ai-locale translate "locales/#locale/messages.json" --dry-run
```

### 3. Valider les Fichiers

```bash
# Vérifier les traductions manquantes en utilisant le modèle #locale
ai-locale validate "locales/#locale/messages.json" --source en

# Modèle glob traditionnel
ai-locale validate "translations/**/*.strings" --source en
```

### 4. Voir les Statistiques

```bash
# Afficher les statistiques de complétude des traductions
ai-locale stats "locales/#locale/messages.json"

# Modèle glob traditionnel
ai-locale stats "translations/**/*.strings"
```

## Commandes CLI

### `translate` - Traduire les Clés Manquantes

Traduit les clés manquantes dans les fichiers de localisation.

```bash
ai-locale translate <pattern> [options]
```

**Arguments :**

- `pattern` - Modèle de fichier (ex. `locales/#locale/messages.json`, `translations/**/*.strings`)

**Options :**

- `-k, --api-key <key>` - Clé API OpenAI (ou définir la variable d'environnement OPENAI_API_KEY)
- `-s, --source <lang>` - Code de langue source (par défaut : "en")
- `-t, --target <langs>` - Langues cibles séparées par des virgules (détectées automatiquement si non fournies)
- `-o, --output <dir>` - Répertoire de sortie (par défaut : écraser les fichiers originaux)
- `-c, --context <text>` - Courte description de votre application transmise au traducteur (vide par défaut)
- `--dry-run` - Afficher ce qui serait traduit sans apporter de modifications
- `--verbose` - Afficher la sortie détaillée
- `--no-backup` - Ne pas créer de fichiers de sauvegarde
- `--yes` - Ignorer l'invite de confirmation
- `-m, --model <model>` - Modèle (par défaut : `gpt-6-luna`, ou `OPENAI_MODEL`). Les modèles `deepseek-*` et `gemini-*` utilisent l'endpoint de leur fournisseur et `DEEPSEEK_API_KEY` / `GEMINI_API_KEY`
- `--base-url <url>` - N'importe quel endpoint compatible OpenAI, ex. OpenRouter (ou `OPENAI_BASE_URL`)
- `--reasoning <effort>` - `reasoning_effort` envoyé au modèle (`none` par défaut pour Luna/Terra, `minimal` pour Gemini ; `default` n'envoie rien)
- `--concurrency <n>` - Nombre maximum de requêtes simultanées (par défaut : 32, max 200). `--batch-size` reste un alias
- `--batch-delay <ms>` - Délai minimum entre deux démarrages de requête (par défaut : 0)

**Exemples :**

```bash
# Traduction de base avec le modèle #locale
ai-locale translate "locales/#locale/messages.json"

# Spécifier les langues source et cibles
ai-locale translate "locales/#locale/strings.xml" --source en --target fr,es,de,it

# Dry run pour prévisualiser
ai-locale translate "locales/#locale/messages.json" --dry-run --verbose

# Sauvegarder dans un répertoire différent
ai-locale translate "locales/#locale/messages.json" --output ./translated/

# Utiliser une clé API spécifique
ai-locale translate "locales/#locale/messages.json" --api-key sk-your-key

# Choisir un modèle et lancer plus de requêtes à la fois
ai-locale translate "locales/#locale/messages.json" --model deepseek-flash --concurrency 48
```

### `validate` - Valider les Fichiers de Traduction

Vérifie les fichiers de traduction pour les clés manquantes et les problèmes de cohérence.

```bash
ai-locale validate <pattern> [options]
```

**Arguments :**

- `pattern` - Modèle de fichier à valider

**Options :**

- `-s, --source <lang>` - Code de langue source (par défaut : "en")

**Exemples :**

```bash
# Valider tous les fichiers de traduction en utilisant le modèle #locale
ai-locale validate "locales/#locale/messages.json"

# Valider avec une langue source spécifique
ai-locale validate "locales/#locale/strings.xml" --source en

# Modèle glob traditionnel
ai-locale validate "translations/**/*.strings" --source en
```

### `stats` - Afficher les Statistiques de Traduction

Affiche des statistiques complètes sur les fichiers de traduction.

```bash
ai-locale stats <pattern>
```

**Arguments :**

- `pattern` - Modèle de fichier à analyser

**Exemples :**

```bash
# Afficher les statistiques pour tous les fichiers en utilisant le modèle #locale
ai-locale stats "locales/#locale/messages.json"

# Afficher les statistiques pour un modèle spécifique
ai-locale stats "locales/#locale/strings.xml"

# Modèle glob traditionnel
ai-locale stats "translations/**/*.strings"
```

### `purge` - Supprimer les Clés Obsolètes

Supprime les clés qui n'existent pas dans le fichier de langue source.

```bash
ai-locale purge <pattern> [options]
```

**Arguments :**

- `pattern` - Modèle de fichier à purger

**Options :**

- `-s, --source <lang>` - Code de langue source (par défaut : "en")
- `--dry-run` - Afficher ce qui serait purgé sans apporter de modifications
- `--verbose` - Afficher la sortie détaillée
- `--no-backup` - Ne pas créer de fichiers de sauvegarde

**Exemples :**

```bash
# Supprimer les clés non présentes en anglais en utilisant le modèle #locale
ai-locale purge "locales/#locale/messages.json" --source en

# Dry run pour prévisualiser ce qui serait purgé
ai-locale purge "locales/#locale/strings.xml" --dry-run --verbose

# Purger avec le français comme source
ai-locale purge "locales/#locale/messages.json" --source fr

# Modèle glob traditionnel
ai-locale purge "translations/**/*.strings" --source en
```

## Exemples de Modèles Glob

Le CLI prend en charge des modèles glob puissants pour la découverte de fichiers :

```bash
# Tous les fichiers de traduction dans le répertoire locales
"locales/#locale/messages.json"

# Tous les fichiers .strings récursivement
"translations/**/*.strings"

# Fichiers de langue spécifiques
"src/locales/en.ts"
"src/locales/fr.ts"

# Modèles multiples
"locales/#locale/messages.json" "src/i18n/#locale/translations.json"

# Fichiers avec une convention de nommage spécifique
"**/i18n/#locale/*.ts"
"**/locales/#locale/*.strings"

# Formats mixtes avec #locale
"locales/#locale/strings.xml"
"locales/#locale/messages.json"
```

## Langues Supportées

L'outil prend en charge 20+ langues incluant :

- Anglais (en)
- Français (fr)
- Espagnol (es)
- Allemand (de)
- Italien (it)
- Portugais (pt)
- Néerlandais (nl)
- Suédois (sv)
- Danois (da)
- Norvégien (no)
- Finnois (fi)
- Polonais (pl)
- Russe (ru)
- Japonais (ja)
- Coréen (ko)
- Chinois (zh)
- Arabe (ar)
- Hindi (hi)
- Turc (tr)
- Thaï (th)

## Contexte de Traduction et Précision

Le CLI fournit un contexte maximal à OpenAI pour les traductions les plus précises :

### **Détection Intelligente du Contexte**

- **Toutes les Traductions Existantes** : Si une clé existe en anglais et en français, les deux sont incluses dans l'invite
- **Priorité de la Langue Source** : Utilise la langue source spécifiée comme référence principale
- **Contexte Complet** : Fournit toutes les traductions disponibles pour chaque clé pour assurer la cohérence

### **Exemple de Contexte de Traduction**

```
Clé : "common.save"
Traductions existantes :
- en : "Save"
- fr : "Enregistrer"
- es : "Guardar"

Manquant dans : de, it

L'IA reçoit : "Traduire 'Save' en allemand et italien, en considérant les traductions existantes en français et espagnol pour le contexte"
```

## Optimisation des Coûts

Le CLI est optimisé pour le coût et la vitesse :

- **Traitement Parallèle** : Chaque clé et groupe de langues passe dans une file unique ; `--concurrency` requêtes tournent en même temps, une requête lente ne bloque pas les autres
- **Regroupement des Clés** : Les clés courtes auxquelles il manque les mêmes langues partagent une requête (jusqu'à 25 clés × 6 langues) ; les textes longs gardent leurs propres requêtes, et ce qu'un groupe rate est refait clé par clé
- **Reprises** : Les réponses 429 et 5xx sont relancées avec backoff (Retry-After respecté)
- **Estimation des Coûts** : Affiche les coûts estimés avant le traitement
- **Modèle Efficace** : Utilise `gpt-6-luna` sans raisonnement par défaut ; les paramètres refusés par un modèle (temperature, max_tokens…) sont retirés automatiquement
- **Optimisation du Contexte** : Utilise TOUTES les traductions existantes comme contexte pour une précision maximale

### Choisir un Modèle

| Modèle | $/1M entrée / sortie | Notes |
| --- | --- | --- |
| `gpt-6-luna` (défaut) | 0,10 / 0,50 | Modèle OpenAI le moins cher, rapide, lancé avec `reasoning_effort: none` |
| `deepseek-flash` | 0,30 / 1,20 (moitié prix hors pointe) | Meilleur score du benchmark traduction OpenMark de nov. 2026 ; demande `DEEPSEEK_API_KEY` |
| `gpt-6.1-terra` | 1,00 / 5,00 | Meilleur ton sur les textes marketing |
| `gemini-3.5-flash-lite` | 0,30 / 2,50 | Modèle Google pour la traduction en masse ; la réflexion ne peut pas être coupée |

### Exemples de Parallélisme

```bash
# Petit quota : moins de requêtes, espacées
ai-locale translate "locales/#locale/messages.json" --concurrency 4 --batch-delay 250

# Gros fichiers avec beaucoup de langues
ai-locale translate "locales/#locale/messages.json" --concurrency 64
```

### Exemple d'Estimation des Coûts

Pour 100 clés manquantes sur 3 langues :

- Coût estimé : ~0,15 USD
- Temps de traitement : ~2-3 minutes
- Tokens utilisés : ~25 000 entrée + 5 000 sortie

## Développement

### Développement Local

```bash
# Installer les dépendances
npm install

# Exécuter le CLI localement
node src/cli.js translate "examples/*.ts"

# Développement avec rechargement automatique
npm run dev translate "examples/*.ts"

# Exécuter les tests
npm test
```

### Construction de l'Exécutable

```bash
# Construire l'exécutable autonome
npm run build

# L'exécutable sera dans le répertoire dist/
./dist/ai-locale-cli translate "locales/#locale/messages.json"
```

### Variables d'Environnement

| Variable         | Description    | Défaut      |
| ---------------- | -------------- | ----------- |
| `OPENAI_API_KEY` | Clé API OpenAI | Requis      |
| `NODE_ENV`       | Environnement  | development |

### Structure du Projet

```
src/
├── cli.js                    # Point d'entrée CLI principal
├── services/
│   ├── openaiService.js      # Intégration OpenAI
│   └── translationService.js # Logique de traduction
└── utils/
    ├── fileParser.js         # Utilitaires d'analyse de fichiers
    └── validation.js         # Validation des requêtes
```

## Exemples d'Utilisation

### Exemple 1 : Traduction de Base

```bash
# Structure du projet :
# locales/
#   ├── en/
#   │   └── messages.json
#   ├── fr/
#   │   └── messages.json (manque certaines clés)
#   └── es/
#       └── messages.json (manque certaines clés)

ai-locale translate "locales/#locale/messages.json" --source en
```

### Exemple 2 : Fichiers iOS Strings

```bash
# Structure du projet :
# translations/
#   ├── en/
#   │   └── Localizable.strings
#   ├── fr/
#   │   └── Localizable.strings
#   └── es/
#       └── Localizable.strings

ai-locale translate "translations/#locale/Localizable.strings" --source en
```

### Exemple 3 : Fichiers Android XML

```bash
# Structure du projet :
# locales/
#   ├── en/
#   │   └── strings.xml
#   ├── fr/
#   │   └── strings.xml
#   └── es/
#       └── strings.xml

ai-locale translate "locales/#locale/strings.xml" --source en
```

### Exemple 4 : Fichiers GNU gettext .po

```bash
# Structure du projet :
# locale/
#   ├── en/
#   │   └── LC_MESSAGES/
#   │       └── messages.po
#   ├── fr/
#   │   └── LC_MESSAGES/
#   │       └── messages.po
#   └── es/
#       └── LC_MESSAGES/
#           └── messages.po

ai-locale translate "locale/#locale/LC_MESSAGES/messages.po" --source en
```

### Exemple 5 : Validation et Statistiques

```bash
# Vérifier ce qui manque
ai-locale validate "locales/#locale/messages.json" --source en

# Afficher les statistiques
ai-locale stats "locales/#locale/messages.json"

# Prévisualiser la traduction (dry run)
ai-locale translate "locales/#locale/messages.json" --dry-run --verbose
```

### Exemple 6 : Purge des Clés Obsolètes

```bash
# Supprimer les clés non présentes en anglais
ai-locale purge "locales/#locale/messages.json" --source en

# Prévisualiser ce qui serait purgé
ai-locale purge "translations/#locale/Localizable.strings" --dry-run --verbose

# Purger avec le français comme source
ai-locale purge "locales/#locale/messages.json" --source fr
```

## Gestion des Erreurs

Le CLI fournit une gestion d'erreurs complète :

- **Fichier Non Trouvé** : Messages d'erreur clairs pour les modèles invalides
- **Erreurs API** : Gestion gracieuse des échecs de l'API OpenAI
- **Erreurs d'Analyse** : Informations d'erreur détaillées pour les problèmes de fichiers
- **Erreurs de Validation** : Messages clairs pour les requêtes invalides

## Dépannage

### Problèmes Courants

1. **Clé API OpenAI Invalide**

   ```
   Erreur : La clé API OpenAI est requise
   ```

   Solution : Définir la variable d'environnement `OPENAI_API_KEY` ou utiliser l'option `--api-key`

2. **Aucun Fichier Trouvé**

   ```
   Erreur : Aucun fichier de traduction trouvé correspondant au modèle
   ```

   Solution : Vérifier votre modèle glob et la structure des fichiers

3. **Erreurs d'Analyse de Fichier**

   ```
   Erreur : Échec de l'analyse du fichier en.ts
   ```

   Solution : Vérifier le format du fichier et la syntaxe

4. **Erreurs d'Autorisation**

   ```
   Erreur : EACCES : accès refusé
   ```

   Solution : Vérifier les autorisations de fichier ou exécuter avec les privilèges appropriés

### Mode Debug

Activer la sortie verbeuse pour le débogage :

```bash
ai-locale translate "locales/#locale/messages.json" --verbose
```

## Contribution

1. Fork le repository
2. Créer une branche de fonctionnalité
3. Faire vos modifications
4. Ajouter des tests
5. Soumettre une pull request

## Licence

Licence MIT - voir le fichier LICENSE pour plus de détails.

## Support

Pour les problèmes et questions :

1. Vérifier la section de dépannage
2. Examiner les logs
3. Créer un problème avec des informations détaillées
4. Inclure des exemples de fichiers et messages d'erreur
