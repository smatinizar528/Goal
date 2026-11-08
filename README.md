# GOAL — Sports & pronostics en points virtuels

Version initiale du projet GOAL. Interface française, responsive, avec données de démonstration et coupon de pronostics virtuels.

## Démarrer
1. Décompresser le dossier.
2. Ouvrir `index.html` dans un navigateur, ou publier le dossier sur GitHub Pages.
3. Les sélections, le solde et l'historique sont sauvegardés localement dans le navigateur (`localStorage`).

## Contenu
- `index.html` : page d'accueil.
- `css/style.css` : thème responsive.
- `js/config.js` : configuration.
- `js/app.js` : matchs fictifs, coupon, calcul du gain potentiel, solde et historique.
- `supabase/schema.sql` : base de départ et règles RLS.

## Important
Cette version est une maquette fonctionnelle locale. Les scores, équipes et cotes sont fictifs. Les points sont virtuels, non échangeables et sans valeur monétaire. Il n'y a ni dépôt, ni retrait, ni paiement.
Le navigateur ne doit jamais être considéré comme une source fiable pour le solde. Avant une mise en production multi-utilisateur, déplacer toute logique de solde et d'enregistrement dans des fonctions serveur sécurisées (par exemple Supabase Edge Functions), valider les transactions côté serveur et faire auditer les politiques RLS.

## Connecter Supabase
1. Créer un projet Supabase.
2. Exécuter `supabase/schema.sql` dans SQL Editor.
3. Ajouter l'URL du projet et la clé `anon` publique dans `js/config.js`.
4. Implémenter ensuite Auth et les appels API. Ne jamais exposer la clé `service_role`.

## Publication GitHub Pages
Créer un dépôt GitHub, téléverser le contenu du dossier, puis dans Settings → Pages choisir la branche `main` et le dossier `/ (root)`.
