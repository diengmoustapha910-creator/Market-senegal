# Guide de Déploiement : MARKET SÉNÉGAL sur Railway & Domaine Amen.fr

Ce guide explique pas à pas comment déployer l’application **MARKET SÉNÉGAL** sur **Railway** avec sa base de données **PostgreSQL**, configurer les variables d'environnement, et lier votre nom de domaine **marketsenegal.com** acheté chez **Amen.fr**.

---

## 1. Préparation du projet et du dépôt Git

1. Initialisez ou poussez le code sur votre compte GitHub / GitLab :
   ```bash
   git init
   git add .
   git commit -m "feat: Déploiement initial Market Sénégal"
   git branch -M main
   git remote add origin https://github.com/votre-compte/market-senegal.git
   git push -u origin main
   ```

2. Le fichier `package.json` contient déjà la commande de build et de démarrage requise :
   - Build : `npm run build` (compile le frontend Vite et bundle `server.ts` avec esbuild)
   - Start : `node server.js`

---

## 2. Création du projet sur Railway

1. Rendez-vous sur [Railway.app](https://railway.app) et connectez-vous.
2. Cliquez sur **« + New Project »**.
3. Choisissez **« Provision PostgreSQL »** pour ajouter la base de données relationnelle.
4. Une fois PostgreSQL créé, cliquez sur **« + New »** > **« GitHub Repo »** et sélectionnez votre dépôt `market-senegal`.
5. Railway détectera automatiquement Node.js.

---

## 3. Configuration de la base de données PostgreSQL

1. Dans Railway, cliquez sur le service PostgreSQL, ouvrez l'onglet **« Variables »** et copiez la variable `DATABASE_URL` (ou connectez directement les deux services).
2. Dans le service de votre application web, allez dans **« Variables »** et référencez la base :
   - Variable : `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (Railway lie automatiquement l'URL)
3. Initialisation du schéma :
   - Ouvrez l'onglet **« Data »** de PostgreSQL sur Railway ou connectez-vous avec `psql` / pgAdmin / DBeaver à l'aide de l'URL publique de connexion fournie par Railway.
   - Exécutez le script contenu dans `schema.sql`. Toutes les tables (`users`, `stores`, `products`, `orders`, `messages`, `delivery_zones`, `subscriptions`, etc.) seront créées avec leurs contraintes et index.

---

## 4. Configuration des Variables d'Environnement sur Railway

Dans l'onglet **« Variables »** de votre service web sur Railway, ajoutez les variables suivantes :

| Variable | Description | Exemple / Valeur |
|---|---|---|
| `NODE_ENV` | Environnement d'exécution | `production` |
| `DATABASE_URL` | URL de connexion PostgreSQL | Fournie par Railway |
| `APP_URL` | URL publique du site | `https://marketsenegal.com` |
| `SESSION_SECRET` | Clé secrète de signature des sessions | Une chaîne aléatoire de 32+ caractères |
| `ADMIN_INIT_SECRET` | Clé pour créer le premier compte admin | Ex: `SenegalMarketAdmin2026!` |
| `WAVE_API_KEY` | Clé API Wave (dès obtention du contrat) | Laisser vide en attendant |
| `WAVE_SECRET_KEY` | Clé secrète Wave | Laisser vide en attendant |
| `ORANGE_MONEY_CLIENT_ID` | Identifiant Orange Money Developer | Laisser vide en attendant |
| `ORANGE_MONEY_CLIENT_SECRET` | Clé secrète Orange Money | Laisser vide en attendant |

*Note de sécurité : Ne stockez jamais ces clés dans le code ou sur GitHub public.*

---

## 5. Stockage des photos et volumes persistants sur Railway

Sur Railway, par défaut le système de fichiers est éphémère lors des redéploiements.
Pour conserver les photos de produits et de boutiques :

1. Dans Railway, ouvrez votre service web.
2. Allez dans l'onglet **« Settings »** > **« Volumes »**.
3. Cliquez sur **« + Add Volume »**.
4. Définissez le point de montage : `/app/public/uploads` (ou utilisez un bucket S3/Cloudflare R2 en configurant `STORAGE_PROVIDER=s3` avec vos identifiants S3).

---

## 6. Liaison du domaine personnalisé `marketsenegal.com` (Amen.fr)

### Étape A : Générer le domaine sur Railway
1. Dans votre service web Railway, allez dans **« Settings »** > **« Networking »** > **« Custom Domain »**.
2. Saisissez `marketsenegal.com` puis validez.
3. Ajoutez également `www.marketsenegal.com`.
4. Railway affichera alors les enregistrements DNS exacts à renseigner chez Amen.fr (typiquement un `CNAME` ou une adresse `A`).

### Étape B : Configuration DNS sur l'espace client Amen.fr
1. Connectez-vous sur [Amen.fr](https://www.amen.fr) et accédez à votre **Espace Client**.
2. Allez dans **Domaines & DNS** > Cliquez sur **marketsenegal.com** > **Gestion du Domaine** > **Zone DNS**.
3. Ajoutez ou modifiez les enregistrements selon les valeurs exactes données par Railway :
   - Pour le sous-domaine `www` :
     - Type : `CNAME`
     - Nom d'hôte / Sous-domaine : `www`
     - Valeur / Destination : `votre-projet.up.railway.app.` (fourni par Railway)
   - Pour la racine du domaine (`@` ou `marketsenegal.com`) :
     - Si Amen propose le renvoi d'alias CNAME/ANAME pour l'apex, pointez vers l'adresse Railway.
     - Sinon, configurez l'enregistrement `A` vers l'IP fournie par Railway, ou une redirection 301 de `marketsenegal.com` vers `www.marketsenegal.com`.
4. Sauvegardez la zone DNS.

### Étape C : Propagation et certificat SSL HTTPS
- La propagation DNS chez Amen.fr prend généralement entre 15 minutes et quelques heures.
- Railway provisionne et renouvelle automatiquement un certificat SSL gratuit (Let's Encrypt). Une fois les DNS propagés, votre site sera accessible en `https://marketsenegal.com`.

---

## 7. Création du compte Administrateur Initial

Une fois le serveur en ligne :
1. Inscrivez-vous normalement avec votre adresse email (ex: `admin@marketsenegal.com`).
2. Pour promouvoir ce compte au rôle **Administrateur** en toute sécurité :
   - Exécutez dans la base PostgreSQL Railway :
     ```sql
     UPDATE users SET role = 'admin' WHERE email = 'admin@marketsenegal.com';
     ```
   - Ou appelez l'endpoint sécurisé `/api/admin/bootstrap` en fournissant le secret `ADMIN_INIT_SECRET` configuré dans vos variables.
