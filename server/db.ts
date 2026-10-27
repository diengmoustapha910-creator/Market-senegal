import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
import type {
  User, UserRole, Session, Store, StoreSuspension, DeliveryZone,
  StoreCategory, Product, Coupon, Order, OrderItem,
  Conversation, Message, Subscription, PlatformReview, AuditLog,
  StoreCertification, AiConfig, PasswordResetToken, AiUsageLog
} from './types.js';

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'marketsenegal.json');

interface SchemaState {
  users: User[];
  sessions: Session[];
  stores: Store[];
  store_suspensions: StoreSuspension[];
  store_certifications: StoreCertification[];
  delivery_zones: DeliveryZone[];
  store_categories: StoreCategory[];
  products: Product[];
  coupons: Coupon[];
  orders: Order[];
  order_items: OrderItem[];
  conversations: Conversation[];
  messages: Message[];
  subscriptions: Subscription[];
  platform_reviews: PlatformReview[];
  audit_logs: AuditLog[];
  ai_config: AiConfig;
  password_reset_tokens: PasswordResetToken[];
  ai_usage_logs: AiUsageLog[];
}

const defaultState: SchemaState = {
  users: [],
  sessions: [],
  stores: [],
  store_suspensions: [],
  store_certifications: [],
  delivery_zones: [],
  store_categories: [],
  products: [],
  coupons: [],
  orders: [],
  order_items: [],
  conversations: [],
  messages: [],
  subscriptions: [],
  platform_reviews: [],
  audit_logs: [],
  ai_config: {
    daily_quota_per_store: 25,
    enabled: true,
    provider: 'Google Gemini'
  },
  password_reset_tokens: [],
  ai_usage_logs: []
};

class DatabaseService {
  private state: SchemaState = { ...defaultState };
  private pgPool: pg.Pool | null = null;
  private isPostgres = false;

  constructor() {
    this.init();
  }

  private init() {
    const isProduction = process.env.NODE_ENV === 'production';

    // In production on Cloud Run, DATABASE_URL for PostgreSQL is mandatory.
    // Never silently fall back to local disk JSON in production.
    if (isProduction && !process.env.DATABASE_URL) {
      const configError =
        '[ERREUR CONFIGURATION CLOUD RUN] En mode production, la variable d’environnement DATABASE_URL pour PostgreSQL est obligatoire. ' +
        'Le basculement sur le stockage local (.data/marketsenegal.json) est strictement réservé au développement car le conteneur Cloud Run est sans état et éphémère. ' +
        'Veuillez configurer DATABASE_URL dans Secret Manager / Cloud Run avec l’adresse de votre instance Cloud SQL ou PostgreSQL.';
      console.error(configError);
      throw new Error(configError);
    }

    if (!isProduction) {
      if (!fs.existsSync(DATA_DIR)) {
        try {
          fs.mkdirSync(DATA_DIR, { recursive: true });
        } catch (e) {
          console.error('Erreur création dossier data:', e);
        }
      }

      if (fs.existsSync(DATA_FILE)) {
        try {
          const raw = fs.readFileSync(DATA_FILE, 'utf-8');
          this.state = { ...defaultState, ...JSON.parse(raw) };
        } catch (err) {
          console.error('Erreur lecture base locale:', err);
          this.state = { ...defaultState };
        }
      } else {
        this.state = { ...defaultState };
        this.persistLocal();
      }
    }

    if (process.env.DATABASE_URL) {
      try {
        this.pgPool = new pg.Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
        });
        this.isPostgres = true;
        console.log('[DB] Mode PostgreSQL configuré via DATABASE_URL');
        this.initPostgresSchema();
      } catch (err: any) {
        if (isProduction) {
          console.error('[DB FATAL] Échec critique initialisation PostgreSQL:', err);
          throw new Error(`[DB PRODUCTION] Erreur PostgreSQL : ${err.message}`);
        } else {
          console.warn('[DB] Échec initialisation PostgreSQL, utilisation de la base locale persistante en dev:', err);
        }
      }
    } else {
      console.log('[DB DEV] Mode stockage persistant local actif (.data/marketsenegal.json)');
    }

    // Seed default admin if none exists yet
    this.seedInitialAdminIfNeeded();
  }

  private async initPostgresSchema() {
    if (!this.pgPool) return;
    const isProduction = process.env.NODE_ENV === 'production';
    try {
      await this.pgPool.query(`
        CREATE TABLE IF NOT EXISTS app_state (
          key VARCHAR(64) PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      const res = await this.pgPool.query(`SELECT data FROM app_state WHERE key = 'marketsenegal_v1'`);
      if (res.rows.length > 0 && res.rows[0].data) {
        this.state = { ...defaultState, ...res.rows[0].data };
        if (!isProduction) this.persistLocal();
        console.log('[DB] Données PostgreSQL chargées avec succès');
      } else {
        await this.persistPostgres();
        console.log('[DB] Schéma et données initiales synchronisés dans PostgreSQL');
      }
    } catch (err: any) {
      if (isProduction) {
        console.error('[DB FATAL] Échec critique schéma PostgreSQL:', err);
        throw new Error(`[DB PRODUCTION] Erreur schéma PostgreSQL : ${err.message}`);
      } else {
        console.warn('[DB DEV] Avertissement initialisation PostgreSQL (fallback local maintenu):', err);
      }
    }
  }

  private async persistPostgres() {
    if (!this.pgPool || !this.isPostgres) return;
    try {
      await this.pgPool.query(
        `INSERT INTO app_state (key, data, updated_at)
         VALUES ('marketsenegal_v1', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET data = $1, updated_at = NOW()`,
        [JSON.stringify(this.state)]
      );
    } catch (err) {
      console.error('[DB] Erreur persistPostgres:', err);
    }
  }

  private persistLocal() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tmp = `${DATA_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2), 'utf-8');
      fs.renameSync(tmp, DATA_FILE);
      if (this.isPostgres) {
        this.persistPostgres().catch(e => console.error('[DB] Erreur async persistPostgres:', e));
      }
    } catch (e) {
      console.error('[DB] Erreur persistLocal:', e);
    }
  }

  private seedInitialAdminIfNeeded() {
    // Admin account configured server-side via ADMIN_EMAIL (confidential, never exposed to clients)
    const adminEmail = (process.env.ADMIN_EMAIL || 'diengmoustapha910@gmail.com').trim().toLowerCase();
    let adminUser = this.state.users.find(u => u.email.toLowerCase() === adminEmail);

    if (!adminUser) {
      const otherAdmin = this.state.users.find(u => u.role === 'admin');
      if (otherAdmin) {
        otherAdmin.email = adminEmail;
        otherAdmin.updated_at = new Date().toISOString();
        adminUser = otherAdmin;
      }
    }

    if (!adminUser) {
      // First-time initialization only:
      const initialSecret = process.env.ADMIN_INITIAL_PASSWORD ||
        (crypto.randomBytes(16).toString('hex') + 'Aa1!');

      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.pbkdf2Sync(initialSecret, salt, 1000, 64, 'sha512').toString('hex');
      adminUser = {
        id: crypto.randomUUID(),
        email: adminEmail,
        password_hash: `${salt}:${hash}`,
        full_name: 'Direction Market Sénégal',
        phone: '+221 33 800 00 00',
        role: 'admin',
        must_change_password: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.state.users.push(adminUser);

      this.state.audit_logs.push({
        id: crypto.randomUUID(),
        admin_id: adminUser.id,
        admin_name: adminUser.full_name,
        action: 'admin_initialized',
        target_type: 'platform',
        details: { message: `Compte administrateur initialisé. Mécanisme d'initialisation désormais verrouillé.` },
        created_at: new Date().toISOString()
      });

      this.persistLocal();
      console.log(`[DB] Administrateur principal initialisé. Le mécanisme d'initialisation initial est désormais désactivé.`);
    } else {
      // Security rule: The initial admin setup mechanism is permanently disabled once the account exists.
      // Environment reboots will never overwrite or reset the administrator's password.
      if (adminUser.must_change_password === undefined) {
        adminUser.must_change_password = false;
      }
      console.log(`[DB] Compte administrateur principal vérifié. Mécanisme d'initialisation désactivé.`);
    }
  }

  // --- USERS ---
  async getUserByEmail(email: string): Promise<User | null> {
    const norm = email.trim().toLowerCase();
    return this.state.users.find(u => u.email.toLowerCase() === norm) || null;
  }

  async getUserById(id: string): Promise<User | null> {
    return this.state.users.find(u => u.id === id) || null;
  }

  async createUser(data: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> {
    const user: User = {
      ...data,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.state.users.push(user);
    this.persistLocal();
    return user;
  }

  async updateUserRole(id: string, role: User['role']): Promise<User | null> {
    const user = this.state.users.find(u => u.id === id);
    if (!user) return null;
    user.role = role;
    user.updated_at = new Date().toISOString();
    this.persistLocal();
    return user;
  }

  async updateUserProfile(id: string, data: Partial<Pick<User, 'full_name' | 'phone'>>): Promise<User | null> {
    const user = this.state.users.find(u => u.id === id);
    if (!user) return null;
    if (data.full_name) user.full_name = data.full_name;
    if (data.phone !== undefined) user.phone = data.phone;
    user.updated_at = new Date().toISOString();
    this.persistLocal();
    return user;
  }

  async getUserByGoogleId(googleId: string): Promise<User | null> {
    return this.state.users.find(u => u.google_id === googleId) || null;
  }

  async linkGoogleAccount(userId: string, googleId: string, avatarUrl?: string): Promise<User | null> {
    const user = this.state.users.find(u => u.id === userId);
    if (!user) return null;
    user.google_id = googleId;
    if (avatarUrl && !user.avatar_url) user.avatar_url = avatarUrl;
    user.is_email_verified = true; // Google accounts have verified email
    user.updated_at = new Date().toISOString();
    this.persistLocal();
    return user;
  }

  async createEmailVerificationToken(userId: string): Promise<string | null> {
    const user = this.state.users.find(u => u.id === userId);
    if (!user) return null;
    const token = crypto.randomBytes(32).toString('hex');
    user.email_verification_token = token;
    // 24 hours expiry
    user.email_verification_expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    user.updated_at = new Date().toISOString();
    this.persistLocal();
    return token;
  }

  async verifyEmailToken(token: string): Promise<User | null> {
    const now = new Date().toISOString();
    const user = this.state.users.find(
      u => u.email_verification_token === token &&
      u.email_verification_expires_at &&
      u.email_verification_expires_at > now
    );
    if (!user) return null;
    user.is_email_verified = true;
    user.email_verification_token = undefined;
    user.email_verification_expires_at = undefined;
    user.updated_at = new Date().toISOString();
    this.persistLocal();
    return user;
  }

  async listUsers(): Promise<User[]> {
    return [...this.state.users];
  }

  // --- SESSIONS ---
  async createSession(userId: string): Promise<Session> {
    const session: Session = {
      token: crypto.randomBytes(32).toString('hex'),
      user_id: userId,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 jours
    };
    this.state.sessions.push(session);
    this.persistLocal();
    return session;
  }

  async getSession(token: string): Promise<Session | null> {
    const sess = this.state.sessions.find(s => s.token === token);
    if (!sess) return null;
    if (new Date(sess.expires_at).getTime() < Date.now()) {
      this.deleteSession(token);
      return null;
    }
    return sess;
  }

  async deleteSession(token: string): Promise<void> {
    this.state.sessions = this.state.sessions.filter(s => s.token !== token);
    this.persistLocal();
  }

  async invalidateOtherSessions(userId: string, keepSessionToken?: string): Promise<number> {
    const initialCount = this.state.sessions.length;
    this.state.sessions = this.state.sessions.filter(
      s => s.user_id !== userId || (keepSessionToken && s.token === keepSessionToken)
    );
    const removed = initialCount - this.state.sessions.length;
    if (removed > 0) {
      this.persistLocal();
    }
    return removed;
  }

  async updateUserPassword(userId: string, newPasswordHash: string, mustChangePassword = false): Promise<User | null> {
    const user = this.state.users.find(u => u.id === userId);
    if (!user) return null;
    user.password_hash = newPasswordHash;
    user.must_change_password = mustChangePassword;
    user.updated_at = new Date().toISOString();
    this.persistLocal();
    return user;
  }

  // --- STORES ---
  async getStoreById(id: string): Promise<Store | null> {
    return this.state.stores.find(s => s.id === id) || null;
  }

  async getStoreByUserId(userId: string): Promise<Store | null> {
    return this.state.stores.find(s => s.user_id === userId) || null;
  }

  async getStoreBySlug(slug: string): Promise<Store | null> {
    return this.state.stores.find(s => s.slug === slug) || null;
  }

  async listPublicStores(): Promise<Store[]> {
    // Only active and non-suspended stores, placing certified stores first
    const active = this.state.stores.filter(s => s.is_active && !s.is_suspended);
    return active.sort((a, b) => {
      const aCert = a.is_certified ? 1 : 0;
      const bCert = b.is_certified ? 1 : 0;
      if (bCert !== aCert) return bCert - aCert;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }

  async listAllStoresForAdmin(): Promise<Store[]> {
    return [...this.state.stores];
  }

  async createStore(data: Omit<Store, 'id' | 'created_at' | 'updated_at' | 'is_suspended' | 'is_active' | 'is_certified' | 'certification_status'>): Promise<Store> {
    const store: Store = {
      ...data,
      id: crypto.randomUUID(),
      is_active: true,
      is_suspended: false,
      is_certified: false,
      certification_status: 'non_certifiee',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.state.stores.push(store);

    // Also update user's role to 'vendeur' if they were 'client'
    const user = this.state.users.find(u => u.id === data.user_id);
    if (user && user.role === 'client') {
      user.role = 'vendeur';
      user.updated_at = new Date().toISOString();
    }

    // Automatically configure default delivery zone for Dakar
    this.state.delivery_zones.push({
      id: crypto.randomUUID(),
      store_id: store.id,
      region: 'Dakar',
      price_fcfa: 2000,
      estimated_days: '24h-48h',
      created_at: new Date().toISOString()
    });

    this.persistLocal();
    return store;
  }

  async updateStore(id: string, data: Partial<Omit<Store, 'id' | 'user_id' | 'created_at'>>): Promise<Store | null> {
    const store = this.state.stores.find(s => s.id === id);
    if (!store) return null;
    Object.assign(store, data, { updated_at: new Date().toISOString() });
    this.persistLocal();
    return store;
  }

  async suspendStore(storeId: string, adminId: string, reason: string): Promise<Store | null> {
    const store = this.state.stores.find(s => s.id === storeId);
    if (!store) return null;
    store.is_suspended = true;
    store.suspension_reason = reason;
    store.suspended_at = new Date().toISOString();
    store.suspended_by = adminId;
    store.updated_at = new Date().toISOString();

    const suspensionEntry: StoreSuspension = {
      id: crypto.randomUUID(),
      store_id: storeId,
      admin_id: adminId,
      action: 'suspend',
      reason,
      created_at: new Date().toISOString()
    };
    this.state.store_suspensions.push(suspensionEntry);
    this.persistLocal();
    return store;
  }

  async reactivateStore(storeId: string, adminId: string, reason: string): Promise<Store | null> {
    const store = this.state.stores.find(s => s.id === storeId);
    if (!store) return null;
    store.is_suspended = false;
    store.suspension_reason = undefined;
    store.suspended_at = undefined;
    store.suspended_by = undefined;
    store.updated_at = new Date().toISOString();

    const suspensionEntry: StoreSuspension = {
      id: crypto.randomUUID(),
      store_id: storeId,
      admin_id: adminId,
      action: 'reactivate',
      reason,
      created_at: new Date().toISOString()
    };
    this.state.store_suspensions.push(suspensionEntry);
    this.persistLocal();
    return store;
  }

  async getStoreSuspensionHistory(storeId: string): Promise<StoreSuspension[]> {
    return this.state.store_suspensions.filter(s => s.store_id === storeId);
  }

  // --- DELIVERY ZONES ---
  async getDeliveryZones(storeId: string): Promise<DeliveryZone[]> {
    return this.state.delivery_zones.filter(z => z.store_id === storeId);
  }

  async createDeliveryZone(data: Omit<DeliveryZone, 'id' | 'created_at'>): Promise<DeliveryZone> {
    // Check if zone for region already exists
    const existing = this.state.delivery_zones.find(z => z.store_id === data.store_id && z.region.toLowerCase() === data.region.toLowerCase());
    if (existing) {
      existing.price_fcfa = data.price_fcfa;
      existing.estimated_days = data.estimated_days;
      this.persistLocal();
      return existing;
    }
    const zone: DeliveryZone = {
      ...data,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString()
    };
    this.state.delivery_zones.push(zone);
    this.persistLocal();
    return zone;
  }

  async deleteDeliveryZone(id: string, storeId: string): Promise<boolean> {
    const initialLen = this.state.delivery_zones.length;
    this.state.delivery_zones = this.state.delivery_zones.filter(z => !(z.id === id && z.store_id === storeId));
    this.persistLocal();
    return this.state.delivery_zones.length < initialLen;
  }

  // --- CATEGORIES ---
  async getStoreCategories(storeId: string): Promise<StoreCategory[]> {
    return this.state.store_categories.filter(c => c.store_id === storeId);
  }

  async createStoreCategory(storeId: string, name: string): Promise<StoreCategory> {
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const cat: StoreCategory = {
      id: crypto.randomUUID(),
      store_id: storeId,
      name: name.trim(),
      slug: slug || 'cat-' + Date.now(),
      created_at: new Date().toISOString()
    };
    this.state.store_categories.push(cat);
    this.persistLocal();
    return cat;
  }

  async deleteStoreCategory(id: string, storeId: string): Promise<boolean> {
    const initialLen = this.state.store_categories.length;
    this.state.store_categories = this.state.store_categories.filter(c => !(c.id === id && c.store_id === storeId));
    this.persistLocal();
    return this.state.store_categories.length < initialLen;
  }

  // --- PRODUCTS ---
  async listPublicProducts(options: {
    search?: string;
    storeId?: string;
    categoryId?: string;
    region?: string;
    minPrice?: number;
    maxPrice?: number;
    sort?: 'newest' | 'price_asc' | 'price_desc' | 'name';
  } = {}): Promise<{ products: (Product & { store_name: string; store_slug: string; store_city: string })[]; total: number }> {
    // Only products from active, non-suspended stores, and active products
    const activeStoreIds = new Set(
      this.state.stores.filter(s => s.is_active && !s.is_suspended).map(s => s.id)
    );

    let filtered = this.state.products.filter(p => p.is_active && activeStoreIds.has(p.store_id));

    if (options.storeId) {
      filtered = filtered.filter(p => p.store_id === options.storeId);
    }

    if (options.categoryId) {
      filtered = filtered.filter(p => p.category_id === options.categoryId);
    }

    if (options.minPrice !== undefined) {
      filtered = filtered.filter(p => p.price_fcfa >= options.minPrice!);
    }

    if (options.maxPrice !== undefined) {
      filtered = filtered.filter(p => p.price_fcfa <= options.maxPrice!);
    }

    if (options.region) {
      // Filter products whose store delivers to the specified region
      const storesDeliveringToRegion = new Set(
        this.state.delivery_zones
          .filter(z => z.region.toLowerCase() === options.region!.toLowerCase())
          .map(z => z.store_id)
      );
      filtered = filtered.filter(p => storesDeliveringToRegion.has(p.store_id));
    }

    if (options.search) {
      const q = options.search.trim().toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    }

    if (options.sort === 'price_asc') {
      filtered.sort((a, b) => a.price_fcfa - b.price_fcfa);
    } else if (options.sort === 'price_desc') {
      filtered.sort((a, b) => b.price_fcfa - a.price_fcfa);
    } else if (options.sort === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      // newest default, with certified stores products placed first
      filtered.sort((a, b) => {
        const storeA = this.state.stores.find(s => s.id === a.store_id);
        const storeB = this.state.stores.find(s => s.id === b.store_id);
        const aCert = storeA?.is_certified ? 1 : 0;
        const bCert = storeB?.is_certified ? 1 : 0;
        if (bCert !== aCert) return bCert - aCert;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }

    const enriched = filtered.map(p => {
      const store = this.state.stores.find(s => s.id === p.store_id)!;
      return {
        ...p,
        store_name: store.name,
        store_slug: store.slug,
        store_city: store.city,
        store_is_certified: Boolean(store.is_certified)
      };
    });

    return { products: enriched, total: enriched.length };
  }

  async getProductById(id: string): Promise<(Product & { store: Store; category?: StoreCategory }) | null> {
    const product = this.state.products.find(p => p.id === id);
    if (!product) return null;
    const store = this.state.stores.find(s => s.id === product.store_id);
    if (!store) return null;
    const category = product.category_id ? this.state.store_categories.find(c => c.id === product.category_id) : undefined;
    return { ...product, store, category };
  }

  async listStoreProducts(storeId: string): Promise<Product[]> {
    return this.state.products.filter(p => p.store_id === storeId);
  }

  async createProduct(data: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product> {
    if (!data.images || data.images.length === 0) {
      throw new Error('Au moins une photo est requise pour publier un produit.');
    }
    const product: Product = {
      ...data,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.state.products.push(product);
    this.persistLocal();
    return product;
  }

  async updateProduct(id: string, storeId: string, data: Partial<Omit<Product, 'id' | 'store_id' | 'created_at'>>): Promise<Product | null> {
    const product = this.state.products.find(p => p.id === id && p.store_id === storeId);
    if (!product) return null;
    if (data.images && data.images.length === 0) {
      throw new Error('Le produit doit avoir au moins une photo.');
    }
    Object.assign(product, data, { updated_at: new Date().toISOString() });
    this.persistLocal();
    return product;
  }

  async deleteProduct(id: string, storeId: string): Promise<boolean> {
    const initialLen = this.state.products.length;
    this.state.products = this.state.products.filter(p => !(p.id === id && p.store_id === storeId));
    this.persistLocal();
    return this.state.products.length < initialLen;
  }

  // --- COUPONS ---
  async getStoreCoupons(storeId: string): Promise<Coupon[]> {
    return this.state.coupons.filter(c => c.store_id === storeId);
  }

  async createCoupon(storeId: string, data: Omit<Coupon, 'id' | 'store_id' | 'created_at'>): Promise<Coupon> {
    const coupon: Coupon = {
      ...data,
      id: crypto.randomUUID(),
      store_id: storeId,
      code: data.code.toUpperCase().trim(),
      created_at: new Date().toISOString()
    };
    this.state.coupons.push(coupon);
    this.persistLocal();
    return coupon;
  }

  async validateCoupon(storeId: string, code: string, orderAmount: number): Promise<Coupon | null> {
    const coupon = this.state.coupons.find(c =>
      c.store_id === storeId &&
      c.code === code.toUpperCase().trim() &&
      c.is_active
    );
    if (!coupon) return null;
    if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) return null;
    if (orderAmount < coupon.min_order_amount_fcfa) return null;
    return coupon;
  }

  // --- ORDERS ---
  async createOrderGroup(params: {
    customerId: string;
    customerName: string;
    customerPhone: string;
    deliveryRegion: string;
    deliveryAddress: string;
    deliveryNotes?: string;
    paymentMethod: Order['payment_method'];
    storeOrders: Array<{
      storeId: string;
      items: Array<{ productId: string; quantity: number }>;
      couponCode?: string;
    }>;
  }): Promise<Order[]> {
    const createdOrders: Order[] = [];
    const now = new Date().toISOString();

    for (const group of params.storeOrders) {
      const store = this.state.stores.find(s => s.id === group.storeId);
      if (!store || store.is_suspended || !store.is_active) {
        throw new Error(`La boutique "${store ? store.name : group.storeId}" n'est plus active ou est suspendue.`);
      }

      // Check delivery zone
      const zone = this.state.delivery_zones.find(
        z => z.store_id === group.storeId && z.region.toLowerCase() === params.deliveryRegion.toLowerCase()
      );
      if (!zone) {
        throw new Error(`La boutique "${store.name}" ne livre pas dans la région sélectionnée (${params.deliveryRegion}).`);
      }

      // Calculate items and verify stock
      let subtotal = 0;
      const orderItemsToCreate: Array<Omit<OrderItem, 'id' | 'order_id'>> = [];

      for (const itemReq of group.items) {
        const product = this.state.products.find(p => p.id === itemReq.productId && p.store_id === group.storeId);
        if (!product || !product.is_active) {
          throw new Error(`Un des produits demandés n'est plus disponible.`);
        }
        if (product.stock_quantity < itemReq.quantity) {
          throw new Error(`Stock insuffisant pour le produit "${product.name}" (${product.stock_quantity} disponible(s)).`);
        }

        const lineTotal = product.price_fcfa * itemReq.quantity;
        subtotal += lineTotal;
        orderItemsToCreate.push({
          product_id: product.id,
          product_name: product.name,
          product_image: product.images[0] || '',
          unit_price_fcfa: product.price_fcfa,
          quantity: itemReq.quantity,
          total_price_fcfa: lineTotal
        });

        // Deduct stock atomically
        product.stock_quantity -= itemReq.quantity;
      }

      // Coupon discount if applicable
      let discountAmount = 0;
      if (group.couponCode) {
        const validCoupon = await this.validateCoupon(group.storeId, group.couponCode, subtotal);
        if (validCoupon) {
          if (validCoupon.discount_percent) {
            discountAmount = Math.round((subtotal * validCoupon.discount_percent) / 100);
          } else if (validCoupon.discount_amount_fcfa) {
            discountAmount = Math.min(subtotal, validCoupon.discount_amount_fcfa);
          }
        }
      }

      const deliveryFee = zone.price_fcfa;
      const total = Math.max(0, subtotal - discountAmount + deliveryFee);
      const orderId = crypto.randomUUID();
      const orderNumber = `MS-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

      const order: Order = {
        id: orderId,
        order_number: orderNumber,
        customer_id: params.customerId,
        store_id: group.storeId,
        status: 'en_attente',
        subtotal_fcfa: subtotal,
        delivery_fee_fcfa: deliveryFee,
        discount_amount_fcfa: discountAmount,
        total_fcfa: total,
        payment_method: params.paymentMethod,
        payment_status: params.paymentMethod === 'paiement_livraison' ? 'non_paye' : 'en_attente',
        customer_name: params.customerName,
        customer_phone: params.customerPhone,
        delivery_region: params.deliveryRegion,
        delivery_address: params.deliveryAddress,
        delivery_notes: params.deliveryNotes,
        created_at: now,
        updated_at: now
      };

      this.state.orders.push(order);

      for (const it of orderItemsToCreate) {
        this.state.order_items.push({
          ...it,
          id: crypto.randomUUID(),
          order_id: orderId
        });
      }

      // Attach items for return
      order.items = this.state.order_items.filter(i => i.order_id === orderId);
      createdOrders.push(order);
    }

    this.persistLocal();
    return createdOrders;
  }

  async getCustomerOrders(customerId: string): Promise<Array<Order & { store_name: string; items: OrderItem[] }>> {
    const orders = this.state.orders.filter(o => o.customer_id === customerId);
    orders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return orders.map(o => {
      const store = this.state.stores.find(s => s.id === o.store_id);
      const items = this.state.order_items.filter(i => i.order_id === o.id);
      return {
        ...o,
        store_name: store ? store.name : 'Boutique',
        items
      };
    });
  }

  async getStoreOrders(storeId: string): Promise<Array<Order & { items: OrderItem[] }>> {
    const orders = this.state.orders.filter(o => o.store_id === storeId);
    orders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return orders.map(o => {
      const items = this.state.order_items.filter(i => i.order_id === o.id);
      return {
        ...o,
        items
      };
    });
  }

  async updateOrderStatus(orderId: string, storeId: string, status: Order['status']): Promise<Order | null> {
    const order = this.state.orders.find(o => o.id === orderId && o.store_id === storeId);
    if (!order) return null;
    order.status = status;
    if (status === 'livree' && order.payment_method === 'paiement_livraison') {
      order.payment_status = 'paye';
    }
    order.updated_at = new Date().toISOString();
    this.persistLocal();
    return order;
  }

  async listAllOrdersForAdmin(): Promise<Array<Order & { store_name: string; items: OrderItem[] }>> {
    const orders = [...this.state.orders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return orders.map(o => {
      const store = this.state.stores.find(s => s.id === o.store_id);
      const items = this.state.order_items.filter(i => i.order_id === o.id);
      return {
        ...o,
        store_name: store ? store.name : 'Boutique',
        items
      };
    });
  }

  // --- CONVERSATIONS & MESSAGES ---
  async getOrCreateConversation(storeId: string, customerId: string): Promise<Conversation> {
    let conv = this.state.conversations.find(c => c.store_id === storeId && c.customer_id === customerId);
    if (!conv) {
      conv = {
        id: crypto.randomUUID(),
        store_id: storeId,
        customer_id: customerId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.state.conversations.push(conv);
      this.persistLocal();
    }
    return conv;
  }

  async listUserConversations(userId: string, role: string): Promise<any[]> {
    // If user has a store, list conversations for their store + conversations where they are customer
    const userStore = this.state.stores.find(s => s.user_id === userId);
    const storeId = userStore?.id;

    const convs = this.state.conversations.filter(c =>
      c.customer_id === userId || (storeId && c.store_id === storeId)
    );

    convs.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    return convs.map(c => {
      const store = this.state.stores.find(s => s.id === c.store_id);
      const customer = this.state.users.find(u => u.id === c.customer_id);
      const msgs = this.state.messages.filter(m => m.conversation_id === c.id);
      msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const lastMsg = msgs[msgs.length - 1];
      const unreadCount = msgs.filter(m => !m.is_read && m.sender_id !== userId).length;

      return {
        ...c,
        store_name: store?.name || 'Boutique',
        customer_name: customer?.full_name || 'Client',
        last_message: lastMsg?.content || '',
        last_message_date: lastMsg?.created_at || c.created_at,
        unread_count: unreadCount
      };
    });
  }

  async getConversationMessages(conversationId: string, userId: string): Promise<Message[]> {
    const conv = this.state.conversations.find(c => c.id === conversationId);
    if (!conv) return [];

    // Verify user is either the customer or store owner or admin
    const store = this.state.stores.find(s => s.id === conv.store_id);
    const user = this.state.users.find(u => u.id === userId);
    const isAllowed = conv.customer_id === userId || (store && store.user_id === userId) || user?.role === 'admin';
    if (!isAllowed) throw new Error('Non autorisé à consulter cette discussion.');

    // Mark messages as read for this viewer
    for (const msg of this.state.messages) {
      if (msg.conversation_id === conversationId && msg.sender_id !== userId) {
        msg.is_read = true;
      }
    }
    this.persistLocal();

    const msgs = this.state.messages.filter(m => m.conversation_id === conversationId);
    msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return msgs;
  }

  async sendMessage(conversationId: string, senderId: string, content: string): Promise<Message> {
    const conv = this.state.conversations.find(c => c.id === conversationId);
    if (!conv) throw new Error('Conversation introuvable.');

    const store = this.state.stores.find(s => s.id === conv.store_id);
    const user = this.state.users.find(u => u.id === senderId);
    const isAllowed = conv.customer_id === senderId || (store && store.user_id === senderId) || user?.role === 'admin';
    if (!isAllowed) throw new Error('Non autorisé à envoyer un message.');

    const msg: Message = {
      id: crypto.randomUUID(),
      conversation_id: conversationId,
      sender_id: senderId,
      content: content.trim(),
      is_read: false,
      created_at: new Date().toISOString()
    };
    this.state.messages.push(msg);
    conv.updated_at = new Date().toISOString();
    this.persistLocal();
    return msg;
  }

  async getConversationById(id: string): Promise<Conversation | null> {
    return this.state.conversations.find(c => c.id === id) || null;
  }

  async getMessagesByConversationId(conversationId: string): Promise<Message[]> {
    return this.state.messages
      .filter(m => m.conversation_id === conversationId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  async getProducts(options?: { is_active?: boolean }): Promise<Array<Product & { store_name?: string; store_slug?: string; store_city?: string }>> {
    const res = await this.listPublicProducts({});
    if (options?.is_active !== undefined) {
      return res.products.filter(p => p.is_active === options.is_active);
    }
    return res.products;
  }

  // --- SUBSCRIPTIONS (Abonnements boutiques) ---
  async createSubscriptionRequest(
    storeId: string,
    planTier: 'essentiel' | 'croissance',
    offlineRef: string,
    proofDocumentUrl?: string,
    notes?: string,
    adminId?: string
  ): Promise<Subscription> {
    const price = planTier === 'essentiel' ? 8000 : 18000;
    const sub: Subscription = {
      id: crypto.randomUUID(),
      store_id: storeId,
      plan_tier: planTier,
      price_fcfa: price,
      duration_months: 1,
      status: adminId ? 'actif' : 'paiement_a_verifier',
      offline_payment_reference: offlineRef,
      proof_document_url: proofDocumentUrl || '',
      vendor_notes: notes || '',
      verified_by_admin_id: adminId || '',
      verified_payment_reference: adminId ? offlineRef : '',
      starts_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString()
    };
    this.state.subscriptions.push(sub);

    if (adminId) {
      const store = this.state.stores.find(s => s.id === storeId);
      if (store) {
        store.plan_tier = planTier;
        store.plan_expires_at = sub.expires_at;
      }
    }
    this.persistLocal();
    return sub;
  }

  async validateSubscriptionOffline(subscriptionId: string, adminId: string, paymentRef: string): Promise<Subscription | null> {
    const sub = this.state.subscriptions.find(s => s.id === subscriptionId);
    if (!sub) return null;
    sub.status = 'actif';
    sub.verified_by_admin_id = adminId;
    sub.verified_payment_reference = paymentRef;
    if (!sub.offline_payment_reference) {
      sub.offline_payment_reference = paymentRef;
    }
    sub.starts_at = new Date().toISOString();
    sub.expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const store = this.state.stores.find(s => s.id === sub.store_id);
    if (store) {
      store.plan_tier = sub.plan_tier;
      store.plan_expires_at = sub.expires_at;
    }

    const admin = this.state.users.find(u => u.id === adminId);
    this.state.audit_logs.push({
      id: crypto.randomUUID(),
      admin_id: adminId,
      admin_name: admin?.full_name,
      action: 'validate_subscription',
      target_type: 'subscription',
      target_id: sub.id,
      details: {
        store_id: sub.store_id,
        plan_tier: sub.plan_tier,
        payment_reference: paymentRef,
        amount_fcfa: sub.price_fcfa,
        duration: '1 mois (30 jours)'
      },
      created_at: new Date().toISOString()
    });

    this.persistLocal();
    return sub;
  }

  async getStoreSubscriptions(storeId: string): Promise<Subscription[]> {
    const subs = this.state.subscriptions.filter(s => s.store_id === storeId);
    subs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return subs;
  }

  async listSubscriptions(): Promise<Array<Subscription & { store_name: string }>> {
    const subs = [...this.state.subscriptions];
    subs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return subs.map(s => {
      const store = this.state.stores.find(st => st.id === s.store_id);
      return {
        ...s,
        store_name: store?.name || 'Boutique'
      };
    });
  }

  isPaymentReferenceUsed(ref: string, excludeId?: string): boolean {
    const clean = ref.trim().toLowerCase();
    if (!clean) return false;

    // Check in subscriptions
    const subExists = this.state.subscriptions.some(s => {
      if (s.id === excludeId) return false;
      return (
        (s.offline_payment_reference && s.offline_payment_reference.trim().toLowerCase() === clean) ||
        (s.verified_payment_reference && s.verified_payment_reference.trim().toLowerCase() === clean)
      );
    });
    if (subExists) return true;

    // Check in certifications
    const certExists = this.state.store_certifications.some(c => {
      if (c.id === excludeId) return false;
      return (
        (c.wave_payment_reference && c.wave_payment_reference.trim().toLowerCase() === clean) ||
        (c.verified_payment_reference && c.verified_payment_reference.trim().toLowerCase() === clean)
      );
    });
    return certExists;
  }

  async getVendorProPayments(storeId: string) {
    const store = this.state.stores.find(s => s.id === storeId);
    const subscriptions = await this.getStoreSubscriptions(storeId);
    const certifications = await this.getStoreCertificationHistory(storeId);
    const currentCert = await this.getStoreCertification(storeId);

    const history: Array<{
      id: string;
      category: 'abonnement' | 'certification';
      object_name: string;
      frequency: string;
      amount_fcfa: number;
      payment_reference?: string;
      proof_document_url?: string;
      status: string;
      status_label: string;
      verified_payment_reference?: string;
      rejection_reason?: string;
      admin_decision?: string;
      created_at: string;
      expires_at?: string;
    }> = [];

    for (const s of subscriptions) {
      history.push({
        id: s.id,
        category: 'abonnement',
        object_name: s.plan_tier === 'essentiel' ? 'Forfait Essentiel' : 'Forfait Croissance',
        frequency: 'Abonnement mensuel (30 jours)',
        amount_fcfa: s.price_fcfa,
        payment_reference: s.offline_payment_reference,
        proof_document_url: s.proof_document_url,
        status: s.status,
        status_label: s.status === 'actif' ? 'Actif (Validé)' : s.status === 'expire' ? 'Expiré' : 'Paiement à vérifier',
        verified_payment_reference: s.verified_payment_reference,
        admin_decision: s.status === 'actif' ? `Validé par l'administration · Réf: ${s.verified_payment_reference || s.offline_payment_reference}` : undefined,
        created_at: s.created_at,
        expires_at: s.expires_at
      });
    }

    for (const c of certifications) {
      history.push({
        id: c.id,
        category: 'certification',
        object_name: 'Certification officielle de la boutique',
        frequency: 'Paiement unique',
        amount_fcfa: c.amount_fcfa || 10000,
        payment_reference: c.wave_payment_reference || '',
        proof_document_url: c.proof_document_url,
        status: c.status,
        status_label: c.status === 'certifiee'
          ? 'Certifiée'
          : c.status === 'refusee'
          ? 'Refusée'
          : c.status === 'verification_en_cours'
          ? 'Vérification en cours'
          : 'Paiement à vérifier',
        verified_payment_reference: c.verified_payment_reference,
        rejection_reason: c.rejection_reason,
        admin_decision: c.status === 'certifiee'
          ? `Certifiée par l'administration · Réf: ${c.verified_payment_reference || c.wave_payment_reference}`
          : c.status === 'refusee'
          ? `Demande refusée · Motif: ${c.rejection_reason}`
          : undefined,
        created_at: c.created_at
      });
    }

    history.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return {
      store,
      subscriptions,
      certifications,
      currentCert,
      history
    };
  }

  // --- PLATFORM REVIEWS (Avis sur MARKET SÉNÉGAL) ---
  async listApprovedPlatformReviews(): Promise<PlatformReview[]> {
    return this.state.platform_reviews.filter(r => r.is_approved);
  }

  async listAllPlatformReviewsForAdmin(): Promise<PlatformReview[]> {
    return [...this.state.platform_reviews];
  }

  async createPlatformReview(userId: string, rating: number, comment: string): Promise<PlatformReview> {
    const user = this.state.users.find(u => u.id === userId);
    const review: PlatformReview = {
      id: crypto.randomUUID(),
      user_id: userId,
      user_name: user?.full_name || 'Client',
      rating: Math.max(1, Math.min(5, Math.round(rating))),
      comment: comment.trim(),
      is_approved: true,
      created_at: new Date().toISOString()
    };
    this.state.platform_reviews.push(review);
    this.persistLocal();
    return review;
  }

  async toggleReviewApproval(reviewId: string, isApproved: boolean): Promise<PlatformReview | null> {
    const review = this.state.platform_reviews.find(r => r.id === reviewId);
    if (!review) return null;
    review.is_approved = isApproved;
    this.persistLocal();
    return review;
  }

  // --- AUDIT LOGS ---
  async addAuditLog(adminId: string, action: string, targetType: string, targetId?: string, details?: any): Promise<void> {
    const admin = this.state.users.find(u => u.id === adminId);
    this.state.audit_logs.push({
      id: crypto.randomUUID(),
      admin_id: adminId,
      admin_name: admin?.full_name || 'Admin',
      action,
      target_type: targetType,
      target_id: targetId,
      details,
      created_at: new Date().toISOString()
    });
    this.persistLocal();
  }

  async listAuditLogs(): Promise<AuditLog[]> {
    return [...this.state.audit_logs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  // --- STATS COMPUTATION ---
  async getAdminStats() {
    const totalUsers = this.state.users.length;
    const totalClients = this.state.users.filter(u => u.role === 'client').length;
    const totalVendors = this.state.users.filter(u => u.role === 'vendeur').length;
    const totalStores = this.state.stores.length;
    const activeStores = this.state.stores.filter(s => s.is_active && !s.is_suspended).length;
    const suspendedStores = this.state.stores.filter(s => s.is_suspended).length;
    const totalProducts = this.state.products.length;
    const activeProducts = this.state.products.filter(p => p.is_active).length;
    const totalOrders = this.state.orders.length;
    const totalCompletedOrders = this.state.orders.filter(o => o.status === 'livree').length;
    const gmvTotalFcfa = this.state.orders
      .filter(o => o.status !== 'annulee')
      .reduce((acc, o) => acc + o.total_fcfa, 0);
    const activeSubscriptions = this.state.subscriptions.filter(s => s.status === 'actif').length;

    return {
      totalUsers,
      totalClients,
      totalVendors,
      totalStores,
      activeStores,
      suspendedStores,
      certifiedStores: this.state.stores.filter(s => s.is_certified && s.is_active && !s.is_suspended).length,
      pendingCertifications: this.state.store_certifications.filter(c => c.status === 'paiement_a_verifier' || c.status === 'verification_en_cours').length,
      totalProducts,
      activeProducts,
      totalOrders,
      totalCompletedOrders,
      gmvTotalFcfa,
      activeSubscriptions
    };
  }

  // --- CERTIFICATIONS DES BOUTIQUES (10 000 FCFA via Wave) ---
  async getStoreCertification(storeId: string): Promise<StoreCertification | null> {
    const list = this.state.store_certifications.filter(c => c.store_id === storeId);
    if (list.length === 0) return null;
    return list[list.length - 1]; // latest
  }

  async getStoreCertificationHistory(storeId: string): Promise<StoreCertification[]> {
    return this.state.store_certifications
      .filter(c => c.store_id === storeId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async submitCertificationRequest(params: {
    storeId: string;
    wavePaymentReference: string;
    proofDocumentUrl?: string;
    vendorNotes?: string;
  }): Promise<StoreCertification> {
    const store = this.state.stores.find(s => s.id === params.storeId);
    if (!store) throw new Error('Boutique introuvable.');

    const now = new Date().toISOString();
    const cert: StoreCertification = {
      id: crypto.randomUUID(),
      store_id: params.storeId,
      wave_payment_reference: params.wavePaymentReference.trim(),
      proof_document_url: params.proofDocumentUrl,
      status: 'paiement_a_verifier',
      amount_fcfa: 10000,
      vendor_notes: params.vendorNotes?.trim(),
      created_at: now,
      updated_at: now
    };

    this.state.store_certifications.push(cert);
    store.certification_status = 'paiement_a_verifier';
    store.updated_at = now;

    this.persistLocal();
    return cert;
  }

  async listAllCertificationsForAdmin(): Promise<Array<StoreCertification & { store_name: string; store_slug: string; store_city: string }>> {
    return this.state.store_certifications
      .map(c => {
        const store = this.state.stores.find(s => s.id === c.store_id);
        return {
          ...c,
          store_name: store?.name || 'Boutique',
          store_slug: store?.slug || '',
          store_city: store?.city || 'Sénégal'
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async approveCertification(certId: string, adminId: string, verifiedPaymentRef: string, adminNotes?: string): Promise<StoreCertification | null> {
    const cert = this.state.store_certifications.find(c => c.id === certId);
    if (!cert) return null;

    const store = this.state.stores.find(s => s.id === cert.store_id);
    if (!store) return null;

    const admin = this.state.users.find(u => u.id === adminId);
    const now = new Date().toISOString();

    cert.status = 'certifiee';
    cert.wave_payment_reference = verifiedPaymentRef.trim();
    cert.admin_id = adminId;
    cert.admin_name = admin?.full_name || 'Admin';
    cert.admin_notes = adminNotes?.trim();
    cert.reviewed_at = now;
    cert.updated_at = now;

    // Grant badge
    store.is_certified = true;
    store.certification_status = 'certifiee';
    store.certified_at = now;
    store.certified_by = adminId;
    store.updated_at = now;

    // Record audit log
    await this.addAuditLog(adminId, 'approve_certification', 'store', store.id, {
      store_name: store.name,
      wave_payment_reference: verifiedPaymentRef,
      amount_fcfa: cert.amount_fcfa,
      admin_notes: adminNotes
    });

    this.persistLocal();
    return cert;
  }

  async rejectCertification(certId: string, adminId: string, rejectionReason: string, adminNotes?: string): Promise<StoreCertification | null> {
    const cert = this.state.store_certifications.find(c => c.id === certId);
    if (!cert) return null;

    const store = this.state.stores.find(s => s.id === cert.store_id);
    if (!store) return null;

    const admin = this.state.users.find(u => u.id === adminId);
    const now = new Date().toISOString();

    cert.status = 'refusee';
    cert.rejection_reason = rejectionReason.trim();
    cert.admin_id = adminId;
    cert.admin_name = admin?.full_name || 'Admin';
    cert.admin_notes = adminNotes?.trim();
    cert.reviewed_at = now;
    cert.updated_at = now;

    store.is_certified = false;
    store.certification_status = 'refusee';
    store.updated_at = now;

    await this.addAuditLog(adminId, 'reject_certification', 'store', store.id, {
      store_name: store.name,
      reason: rejectionReason,
      admin_notes: adminNotes
    });

    this.persistLocal();
    return cert;
  }

  async revokeCertification(storeId: string, adminId: string, reason: string): Promise<Store | null> {
    const store = this.state.stores.find(s => s.id === storeId);
    if (!store) return null;

    const admin = this.state.users.find(u => u.id === adminId);
    const now = new Date().toISOString();

    store.is_certified = false;
    store.certification_status = 'retiree';
    store.updated_at = now;

    // Append to certification history
    this.state.store_certifications.push({
      id: crypto.randomUUID(),
      store_id: storeId,
      status: 'retiree',
      amount_fcfa: 10000,
      admin_id: adminId,
      admin_name: admin?.full_name || 'Admin',
      rejection_reason: reason.trim(),
      reviewed_at: now,
      created_at: now,
      updated_at: now
    });

    await this.addAuditLog(adminId, 'revoke_certification', 'store', store.id, {
      store_name: store.name,
      reason
    });

    this.persistLocal();
    return store;
  }

  // --- AI CONFIGURATION & USAGE ---
  getAiConfig(): AiConfig {
    if (!this.state.ai_config) {
      this.state.ai_config = {
        daily_quota_per_store: 25,
        enabled: true,
        provider: 'Google Gemini'
      };
    }
    return this.state.ai_config;
  }

  async updateAiConfig(updates: Partial<AiConfig>, adminId?: string): Promise<AiConfig> {
    const current = this.getAiConfig();
    this.state.ai_config = {
      ...current,
      ...updates,
      updated_at: new Date().toISOString()
    };
    if (adminId) {
      await this.addAuditLog(adminId, 'update_ai_config', 'platform', 'ai_settings', { updates });
    }
    this.persistLocal();
    return this.state.ai_config;
  }

  async logAiUsage(data: Omit<AiUsageLog, 'id' | 'created_at'>): Promise<void> {
    if (!this.state.ai_usage_logs) {
      this.state.ai_usage_logs = [];
    }
    this.state.ai_usage_logs.push({
      id: crypto.randomUUID(),
      ...data,
      created_at: new Date().toISOString()
    });
    // Keep max 2000 log entries
    if (this.state.ai_usage_logs.length > 2000) {
      this.state.ai_usage_logs = this.state.ai_usage_logs.slice(-2000);
    }
    this.persistLocal();
  }

  getStoreAiUsageToday(storeId: string): number {
    if (!this.state.ai_usage_logs) return 0;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayIso = startOfToday.toISOString();

    return this.state.ai_usage_logs.filter(
      log => log.store_id === storeId &&
      log.type === 'image_generation' &&
      log.created_at >= todayIso
    ).length;
  }

  // --- PASSWORD RECOVERY (ADMIN & USERS) ---
  async createPasswordResetToken(email: string, role: UserRole): Promise<string> {
    if (!this.state.password_reset_tokens) {
      this.state.password_reset_tokens = [];
    }
    // Clean old expired tokens
    const now = new Date();
    this.state.password_reset_tokens = this.state.password_reset_tokens.filter(
      t => new Date(t.expires_at) > now
    );

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes

    this.state.password_reset_tokens.push({
      token,
      email: email.toLowerCase().trim(),
      role,
      expires_at: expiresAt,
      created_at: now.toISOString()
    });
    this.persistLocal();
    return token;
  }

  async checkPasswordResetToken(token: string): Promise<{ valid: boolean; email?: string; role?: UserRole; expiresAt?: string } | null> {
    if (!this.state.password_reset_tokens) return null;
    const now = new Date();
    const entry = this.state.password_reset_tokens.find(
      t => t.token === token && new Date(t.expires_at) > now
    );
    if (!entry) return null;
    return {
      valid: true,
      email: entry.email,
      role: entry.role,
      expiresAt: entry.expires_at
    };
  }

  async verifyAndConsumePasswordResetToken(token: string, newPasswordHash: string): Promise<User | null> {
    if (!this.state.password_reset_tokens) return null;
    const now = new Date();
    const entryIndex = this.state.password_reset_tokens.findIndex(
      t => t.token === token && new Date(t.expires_at) > now
    );
    if (entryIndex === -1) return null;

    const entry = this.state.password_reset_tokens[entryIndex];
    // Invalidate token
    this.state.password_reset_tokens.splice(entryIndex, 1);

    const user = this.state.users.find(u => u.email.toLowerCase() === entry.email.toLowerCase());
    if (!user) return null;

    user.password_hash = newPasswordHash;
    user.updated_at = new Date().toISOString();

    if (user.role === 'admin') {
      await this.addAuditLog(user.id, 'admin_password_reset', 'user', user.id, {
        email: user.email,
        method: 'secure_recovery_token'
      });
    }

    this.persistLocal();
    return user;
  }
}

export const db = new DatabaseService();
