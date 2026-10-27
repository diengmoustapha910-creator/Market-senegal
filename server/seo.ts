import type express from 'express';
import { db } from './db.js';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toAbsoluteUrl(urlOrPath: string | undefined, baseUrl: string, fallbackPath: string): string {
  if (!urlOrPath) {
    return `${baseUrl}${fallbackPath}`;
  }
  if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
    return urlOrPath;
  }
  const cleanPath = urlOrPath.startsWith('/') ? urlOrPath : `/${urlOrPath}`;
  return `${baseUrl}${cleanPath}`;
}

export async function injectSeoMeta(req: express.Request, rawHtml: string): Promise<string> {
  try {
    const appUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
    const pathname = req.path || '/';
    const query = req.query || {};

    let title = 'MARKET SÉNÉGAL | Le grand marché en ligne du Sénégal';
    let description = 'Le grand marché en ligne du Sénégal - Plateforme e-commerce multi-vendeurs avec 0% de commission sur les ventes, gestion de boutiques, commandes et livraisons locales.';
    let imageUrl = `${appUrl}/assets/aistudio/a_clean_professional_vector_logo_graphic_on_a_whi_98efa245.png`;
    let canonicalUrl = `${appUrl}${pathname}`;
    let ogType = 'website';
    let structuredData: any = null;

    // Check if this is a boutique/store request
    let storeSlugOrId: string | null = null;
    if (pathname.startsWith('/boutique/')) {
      storeSlugOrId = decodeURIComponent(pathname.replace('/boutique/', '').split('/')[0].split('?')[0]);
    } else if (typeof query.store === 'string' && query.store.trim()) {
      storeSlugOrId = query.store.trim();
    }

    // Check if this is a product request
    let productId: string | null = null;
    if (pathname.startsWith('/produit/')) {
      productId = decodeURIComponent(pathname.replace('/produit/', '').split('/')[0].split('?')[0]);
    } else if (typeof query.product === 'string' && query.product.trim()) {
      productId = query.product.trim();
    }

    if (storeSlugOrId) {
      let store = await db.getStoreBySlug(storeSlugOrId);
      if (!store) {
        store = await db.getStoreById(storeSlugOrId);
      }

      if (store) {
        title = `${store.name} – Boutique Officielle | MARKET SÉNÉGAL`;
        description = store.description
          ? (store.description.length > 155 ? `${store.description.slice(0, 152)}...` : store.description)
          : `Visitez la boutique officielle de ${store.name} sur MARKET SÉNÉGAL. Commandez en ligne avec livraison à domicile partout au Sénégal.`;
        
        const rawImg = store.banner_url || store.logo_url;
        imageUrl = toAbsoluteUrl(rawImg, appUrl, '/assets/aistudio/a_clean_professional_vector_logo_graphic_on_a_whi_98efa245.png');
        canonicalUrl = `${appUrl}/boutique/${store.slug || store.id}`;
        ogType = 'profile';

        structuredData = {
          '@context': 'https://schema.org',
          '@type': 'Store',
          name: store.name,
          description: store.description || undefined,
          image: imageUrl,
          telephone: store.phone || undefined,
          address: {
            '@type': 'PostalAddress',
            streetAddress: store.address || undefined,
            addressLocality: store.city || 'Dakar',
            addressCountry: 'SN'
          },
          url: canonicalUrl
        };
      }
    } else if (productId) {
      const product = await db.getProductById(productId);
      if (product) {
        const priceStr = new Intl.NumberFormat('fr-FR').format(product.price_fcfa) + ' FCFA';
        title = `${product.name} – ${product.store?.name || 'MARKET SÉNÉGAL'} (${priceStr})`;
        description = product.description
          ? (product.description.length > 155 ? `${product.description.slice(0, 152)}...` : product.description)
          : `${product.name} disponible à ${priceStr} sur MARKET SÉNÉGAL. Vendeur : ${product.store?.name || 'MARKET SÉNÉGAL'}.`;

        const firstImage = Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : undefined;
        imageUrl = toAbsoluteUrl(firstImage, appUrl, '/assets/aistudio/a_clean_professional_vector_logo_graphic_on_a_whi_98efa245.png');
        canonicalUrl = `${appUrl}/produit/${product.id}`;
        ogType = 'product';

        structuredData = {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.name,
          description: product.description || undefined,
          image: imageUrl,
          offers: {
            '@type': 'Offer',
            price: product.price_fcfa,
            priceCurrency: 'XOF',
            availability: product.stock_quantity > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            url: canonicalUrl,
            seller: {
              '@type': 'Store',
              name: product.store?.name || 'MARKET SÉNÉGAL'
            }
          }
        };
      }
    }

    const metaTags = `
    <!-- Dynamic Social OpenGraph & SEO Meta Tags -->
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    
    <!-- OpenGraph (Facebook, WhatsApp, LinkedIn) -->
    <meta property="og:type" content="${escapeHtml(ogType)}" />
    <meta property="og:site_name" content="MARKET SÉNÉGAL" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${escapeHtml(imageUrl)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    
    <!-- Twitter / X Cards -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
    ${structuredData ? `<script type="application/ld+json">${JSON.stringify(structuredData)}</script>` : ''}
  `;

    // Remove static existing tags from head and replace
    let modifiedHtml = rawHtml
      .replace(/<title>.*?<\/title>/gi, '')
      .replace(/<meta name="description"[^>]*>/gi, '')
      .replace(/<meta property="og:[^"]*"[^>]*>/gi, '')
      .replace(/<meta name="twitter:[^"]*"[^>]*>/gi, '')
      .replace(/<link rel="canonical"[^>]*>/gi, '');

    modifiedHtml = modifiedHtml.replace('</head>', `${metaTags}\n  </head>`);
    return modifiedHtml;
  } catch (err) {
    console.error('[SEO Meta Injection Error]', err);
    return rawHtml;
  }
}
