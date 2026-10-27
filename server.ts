import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { authenticateToken } from './server/auth.js';
import { apiRouter } from './server/routes.js';

import { injectSeoMeta } from './server/seo.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  // Body Parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Static uploads directory (public/uploads)
  const uploadsDir = path.resolve(__dirname, 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir));

  // Global Auth middleware
  app.use(authenticateToken);

  // Mount API router
  app.use('/api', apiRouter);

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'MARKET SÉNÉGAL API',
      timestamp: new Date().toISOString()
    });
  });

  if (!isProduction) {
    // Development mode: attach Vite middleware with dynamic SEO metadata injection
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/uploads')) {
        return next();
      }
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        const finalHtml = await injectSeoMeta(req, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(finalHtml);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    // Production mode: serve built assets from dist with dynamic SEO metadata injection
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir, { index: false }));
      app.get('*', async (req, res) => {
        const indexPath = path.join(distDir, 'index.html');
        if (fs.existsSync(indexPath)) {
          const rawHtml = fs.readFileSync(indexPath, 'utf-8');
          const finalHtml = await injectSeoMeta(req, rawHtml);
          res.status(200).set({ 'Content-Type': 'text/html' }).send(finalHtml);
        } else {
          res.sendFile(indexPath);
        }
      });
    } else {
      console.warn('Dossier dist non trouvé. Lancez npm run build d\'abord.');
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[MARKET SÉNÉGAL] Serveur démarré avec succès sur http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[MARKET SÉNÉGAL] Erreur fatale au démarrage du serveur:', err);
  process.exit(1);
});
