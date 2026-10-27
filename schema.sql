-- ==============================================================================
-- MARKET SÉNÉGAL - SCHÉMA DE BASE DE DONNÉES POSTGRESQL OFFICIEL
-- Plateforme : Node.js / TypeScript / PostgreSQL (Railway)
-- Devise : FCFA (Franc CFA BCEAO)
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLE : UTILISATEURS (Comptes Clients, Vendeurs, Administrateurs)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(30),
    role VARCHAR(20) NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'vendeur', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABLE : SESSIONS AUTHENTIFIÉES
CREATE TABLE IF NOT EXISTS sessions (
    token VARCHAR(128) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 4. TABLE : BOUTIQUES (Vendeurs)
CREATE TABLE IF NOT EXISTS stores (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(180) UNIQUE NOT NULL,
    description TEXT,
    logo_url TEXT,
    banner_url TEXT,
    phone VARCHAR(30) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(80) NOT NULL DEFAULT 'Dakar',
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_suspended BOOLEAN NOT NULL DEFAULT false,
    suspension_reason TEXT,
    suspended_at TIMESTAMP WITH TIME ZONE,
    suspended_by VARCHAR(64) REFERENCES users(id),
    plan_tier VARCHAR(30) NOT NULL DEFAULT 'essentiel' CHECK (plan_tier IN ('essentiel', 'croissance')),
    plan_expires_at TIMESTAMP WITH TIME ZONE,
    allows_cod BOOLEAN NOT NULL DEFAULT true, -- Paiement à la livraison
    is_certified BOOLEAN NOT NULL DEFAULT false, -- Badge Boutique certifiée (après validation paiement 10 000 FCFA & justificatifs)
    certification_status VARCHAR(30) NOT NULL DEFAULT 'non_certifiee' CHECK (certification_status IN ('non_certifiee', 'demande_envoyee', 'paiement_a_verifier', 'verification_en_cours', 'certifiee', 'refusee', 'retiree')),
    certified_at TIMESTAMP WITH TIME ZONE,
    certified_by VARCHAR(64) REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. TABLE : DEMANDES & HISTORIQUE DES CERTIFICATIONS DE BOUTIQUE (10 000 FCFA via Wave)
CREATE TABLE IF NOT EXISTS store_certifications (
    id VARCHAR(64) PRIMARY KEY,
    store_id VARCHAR(64) NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    wave_payment_reference VARCHAR(150),
    proof_document_url TEXT, -- NINEA, Registre de Commerce ou CNI
    status VARCHAR(30) NOT NULL DEFAULT 'paiement_a_verifier' CHECK (status IN ('demande_envoyee', 'paiement_a_verifier', 'verification_en_cours', 'certifiee', 'refusee', 'retiree')),
    amount_fcfa INTEGER NOT NULL DEFAULT 10000,
    vendor_notes TEXT,
    admin_id VARCHAR(64) REFERENCES users(id),
    admin_notes TEXT,
    rejection_reason TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. TABLE : HISTORIQUE DES SUSPENSIONS DE BOUTIQUE
CREATE TABLE IF NOT EXISTS store_suspensions (
    id VARCHAR(64) PRIMARY KEY,
    store_id VARCHAR(64) NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    admin_id VARCHAR(64) NOT NULL REFERENCES users(id),
    action VARCHAR(20) NOT NULL CHECK (action IN ('suspend', 'reactivate')),
    reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. TABLE : ZONES DE LIVRAISON PAR BOUTIQUE
-- 14 Régions du Sénégal : Dakar, Thiès, Diourbel, Fatick, Kaolack, Kaffrine, 
-- Louga, Matam, Saint-Louis, Tambacounda, Kédougou, Kolda, Sédhiou, Ziguinchor
CREATE TABLE IF NOT EXISTS delivery_zones (
    id VARCHAR(64) PRIMARY KEY,
    store_id VARCHAR(64) NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    region VARCHAR(80) NOT NULL,
    price_fcfa INTEGER NOT NULL CHECK (price_fcfa >= 0),
    estimated_days VARCHAR(50) NOT NULL DEFAULT '24-48h',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. TABLE : CATÉGORIES PERSONNALISÉES PAR BOUTIQUE
CREATE TABLE IF NOT EXISTS store_categories (
    id VARCHAR(64) PRIMARY KEY,
    store_id VARCHAR(64) NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. TABLE : PRODUITS
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(64) PRIMARY KEY,
    store_id VARCHAR(64) NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    category_id VARCHAR(64) REFERENCES store_categories(id) ON DELETE SET NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    price_fcfa INTEGER NOT NULL CHECK (price_fcfa > 0),
    compare_price_fcfa INTEGER, -- Prix barré facultatif
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    images JSONB NOT NULL DEFAULT '[]'::jsonb, -- Minimum 1 photo requise
    is_active BOOLEAN NOT NULL DEFAULT true, -- Actif ou Masqué par le vendeur
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. TABLE : PROMOTIONS & CODES DE RÉDUCTION (Forfait Croissance)
CREATE TABLE IF NOT EXISTS coupons (
    id VARCHAR(64) PRIMARY KEY,
    store_id VARCHAR(64) NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    discount_percent INTEGER CHECK (discount_percent > 0 AND discount_percent <= 100),
    discount_amount_fcfa INTEGER CHECK (discount_amount_fcfa > 0),
    min_order_amount_fcfa INTEGER DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. TABLE : COMMANDES (Séparées par boutique)
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(64) PRIMARY KEY,
    order_number VARCHAR(30) UNIQUE NOT NULL,
    customer_id VARCHAR(64) NOT NULL REFERENCES users(id),
    store_id VARCHAR(64) NOT NULL REFERENCES stores(id),
    status VARCHAR(30) NOT NULL DEFAULT 'en_attente' CHECK (status IN ('en_attente', 'confirmee', 'en_livraison', 'livree', 'annulee')),
    subtotal_fcfa INTEGER NOT NULL CHECK (subtotal_fcfa >= 0),
    delivery_fee_fcfa INTEGER NOT NULL CHECK (delivery_fee_fcfa >= 0),
    discount_amount_fcfa INTEGER NOT NULL DEFAULT 0,
    total_fcfa INTEGER NOT NULL CHECK (total_fcfa >= 0),
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('paiement_livraison', 'wave', 'orange_money')),
    payment_status VARCHAR(30) NOT NULL DEFAULT 'non_paye' CHECK (payment_status IN ('non_paye', 'en_attente', 'paye', 'echoue')),
    customer_name VARCHAR(150) NOT NULL,
    customer_phone VARCHAR(30) NOT NULL,
    delivery_region VARCHAR(80) NOT NULL,
    delivery_address TEXT NOT NULL,
    delivery_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. TABLE : ARTICLES DE LA COMMANDE
CREATE TABLE IF NOT EXISTS order_items (
    id VARCHAR(64) PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id VARCHAR(64) REFERENCES products(id) ON DELETE SET NULL,
    product_name VARCHAR(200) NOT NULL,
    product_image TEXT,
    unit_price_fcfa INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    total_price_fcfa INTEGER NOT NULL
);

-- 12. TABLE : CONVERSATIONS & MESSAGERIE PRIVÉE
CREATE TABLE IF NOT EXISTS conversations (
    id VARCHAR(64) PRIMARY KEY,
    store_id VARCHAR(64) NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    customer_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, customer_id)
);

CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(64) PRIMARY KEY,
    conversation_id VARCHAR(64) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id VARCHAR(64) NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. TABLE : ABONNEMENTS ET VALIDATIONS MANUELLES HORS-PLATEFORME
CREATE TABLE IF NOT EXISTS subscriptions (
    id VARCHAR(64) PRIMARY KEY,
    store_id VARCHAR(64) NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    plan_tier VARCHAR(30) NOT NULL CHECK (plan_tier IN ('essentiel', 'croissance')),
    price_fcfa INTEGER NOT NULL,
    duration_months INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(30) NOT NULL DEFAULT 'actif' CHECK (status IN ('actif', 'expire', 'en_attente')),
    offline_payment_reference VARCHAR(150) NOT NULL, -- Réf. virement ou transfert Wave/OM vérifié
    verified_by_admin_id VARCHAR(64) NOT NULL REFERENCES users(id),
    starts_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 14. TABLE : AVIS SUR LA PLATEFORME MARKET SÉNÉGAL
CREATE TABLE IF NOT EXISTS platform_reviews (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT NOT NULL,
    is_approved BOOLEAN NOT NULL DEFAULT true, -- Modération admin
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 15. TABLE : JOURNAL D'AUDIT SÉCURISÉ (Actions d'administration)
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    admin_id VARCHAR(64) NOT NULL REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id VARCHAR(64),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- INDEX POUR LES PERFORMANCES
CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_store ON orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
