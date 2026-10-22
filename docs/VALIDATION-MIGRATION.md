# Validation de la préparation publique

Contrôles effectués localement le **21 octobre 2026** (Pacific/Tahiti). Ce document décrit l’état vérifié des sources ; il ne certifie ni une publication GitHub, ni une installation sur une autre machine.

## Résultats

| Contrôle                                                                | Résultat vérifié                                                                                  |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Installation avec le verrou npm (`npm ci --no-audit --no-fund`)         | Réussie, sans changement des versions des dépendances                                             |
| TypeScript                                                              | Réussi                                                                                            |
| Vitest                                                                  | 32 tests réussis                                                                                  |
| Playwright / Chromium                                                   | 5 tests réussis, pont Tauri simulé et données fictives                                            |
| Export statique Next.js                                                 | Réussi                                                                                            |
| Compilation native Tauri, profil release, Cargo `--locked`, sans bundle | Réussie ; exécutable construit, sans lancement ni installation                                    |
| Rust                                                                    | 11 tests réussis avec de vraies bases SQLite temporaires                                          |
| Clippy                                                                  | Tous les targets contrôlés avec `-D warnings`, réussi                                             |
| Captures du portfolio                                                   | Trois images générées depuis `tests/fixtures/portfolio.json` dans Chromium et relues visuellement |
| Licence                                                                 | MIT ajoutée selon le choix du propriétaire du projet                                              |

Environnement : Node.js 24.16.0, npm 11.13.0, rustc 1.99.1 MSVC. Le toolchain local nommé `stable` correspond à cette version exacte ; il a été sélectionné via `RUSTUP_TOOLCHAIN=stable` pour éviter un téléchargement redondant dans le bac à sable. La version de référence est fixée dans `rust-toolchain.toml`.

## Régressions couvertes

- `Africa/Cairo`, journée du 24 avril 2026 : début réel à `2026-04-23T22:00:00Z` (01:00 locale), fin exclusive à `2026-04-24T21:00:00Z`, soit 23 heures.
- Chargement de l’interface le jour de la transition, sélection de cette journée, graphique et CSV limités à la période, sans inclure une entrée extérieure.
- Minuit répété à La Havane, retour au jour précédent à Casey et date entière sautée à Apia ; les horaires saisis continuent à passer par la validation stricte.
- Tahiti et Paris, journées de 23/25 heures, créneaux traversant minuit, secondes conservées et durée complète distincte de la durée dans la période exportée.
- Périodes vides, inversées ou invalides : message explicite, aucun élargissement automatique et export bloqué.
- Parcours existant : projet, client, démarrage/arrêt du chronomètre et rechargement, saisie manuelle, rapports, calendrier, préférences, sauvegarde/restauration simulée et petit écran.

## Contenu publiable

Le dépôt n’a aucun fichier suivi, commit ou dépôt distant configuré à la date du contrôle. Les fichiers sources étaient déjà présents comme fichiers non suivis avant l’intervention. Aucun commit, ajout à l’index ou changement de configuration distante n’a été effectué.

L’examen a porté sur les candidats retournés par `git ls-files --others --exclude-standard`, ainsi que sur les blobs des objets Git locaux non référencés. Les recherches ciblées de clés privées, jetons de fournisseurs, identifiants dans les URL, affectations de secrets et chemins personnels n’ont détecté aucun secret dans ce périmètre. Les objets locaux inspectés ne contiennent pas de base SQLite. Aucune valeur sensible n’a été affichée.

Les exclusions couvrent les bases SQLite et leurs journaux, sauvegardes, archives, exports locaux, fichiers d’environnement, clés/certificats privés, outils locaux, caches, sorties de compilation et installateurs. Les fichiers de verrouillage npm/Cargo, sources, migrations, permissions Tauri, icônes et captures fictives restent candidats à l’ajout dans Git. Les fichiers de données locaux n’ont pas été supprimés ou restaurés.

Les anciennes références documentaires à des archives privées, à une installation propre à une machine et à des livrables absents ont été retirées. Les captures publiques ne proviennent pas de l’application installée ni de ses données.

## Restrictions rencontrées et portée des contrôles

Les premiers essais dans le bac à sable ont rencontré des refus de renommage dans le répertoire temporaire et de connexion au serveur local de Playwright. Vitest et Rust ont réussi avec `TEMP`/`TMP` dirigés vers un sous-dossier ignoré de `.test-data/public-prep/`. L’installation npm et les tests/captures navigateur ont réussi avec les autorisations d’exécution appropriées. Ces incidents relevaient de l’environnement et n’ont pas nécessité d’assouplir les validations ou les assertions.

Clippy a signalé une impossibilité de créer des liens physiques dans le cache incrémental du bac à sable ; Cargo a utilisé des copies et terminé avec succès. Aucun avertissement de code n’a été ignoré.

La CI GitHub Actions est préparée, mais n’a pas été exécutée sur GitHub puisque le dépôt n’a pas été publié. Aucun badge de réussite distant n’est revendiqué.

Le parcours WebDriver natif, les dialogues Windows et la génération/installation NSIS n’ont pas été rejoués pendant cette préparation. Les tests navigateur ne les remplacent pas. L’application installée et ses données n’ont pas été ouvertes ou remplacées. Le script natif optionnel est désormais limité à l’identifiant de vérification et refuse l’ancien mode permettant d’ouvrir la copie de production.
