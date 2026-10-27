// server.ts
import express2 from "express";
import path4 from "node:path";
import fs4 from "node:fs";
import { fileURLToPath as fileURLToPath2 } from "node:url";
import dotenv from "dotenv";

// server/auth.ts
import crypto2 from "node:crypto";

// server/db.ts
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import pg from "pg";
var DATA_DIR = path.resolve(process.cwd(), ".data");
var DATA_FILE = path.join(DATA_DIR, "marketsenegal.json");
var defaultState = {
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
    provider: "Google Gemini"
  },
  password_reset_tokens: [],
  ai_usage_logs: []
};
var DatabaseService = class {
  constructor() {
    this.state = { ...defaultState };
    this.pgPool = null;
    this.isPostgres = false;
    this.init();
  }
  init() {
    const isProduction = process.env.NODE_ENV === "production";
    if (isProduction && !process.env.DATABASE_URL) {
      const configError = "[ERREUR CONFIGURATION CLOUD RUN] En mode production, la variable d\u2019environnement DATABASE_URL pour PostgreSQL est obligatoire. Le basculement sur le stockage local (.data/marketsenegal.json) est strictement r\xE9serv\xE9 au d\xE9veloppement car le conteneur Cloud Run est sans \xE9tat et \xE9ph\xE9m\xE8re. Veuillez configurer DATABASE_URL dans Secret Manager / Cloud Run avec l\u2019adresse de votre instance Cloud SQL ou PostgreSQL.";
      console.error(configError);
      throw new Error(configError);
    }
    if (!isProduction) {
      if (!fs.existsSync(DATA_DIR)) {
        try {
          fs.mkdirSync(DATA_DIR, { recursive: true });
        } catch (e) {
          console.error("Erreur cr\xE9ation dossier data:", e);
        }
      }
      if (fs.existsSync(DATA_FILE)) {
        try {
          const raw = fs.readFileSync(DATA_FILE, "utf-8");
          this.state = { ...defaultState, ...JSON.parse(raw) };
        } catch (err) {
          console.error("Erreur lecture base locale:", err);
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
          ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false }
        });
        this.isPostgres = true;
        console.log("[DB] Mode PostgreSQL configur\xE9 via DATABASE_URL");
        this.initPostgresSchema();
      } catch (err) {
        if (isProduction) {
          console.error("[DB FATAL] \xC9chec critique initialisation PostgreSQL:", err);
          throw new Error(`[DB PRODUCTION] Erreur PostgreSQL : ${err.message}`);
        } else {
          console.warn("[DB] \xC9chec initialisation PostgreSQL, utilisation de la base locale persistante en dev:", err);
        }
      }
    } else {
      console.log("[DB DEV] Mode stockage persistant local actif (.data/marketsenegal.json)");
    }
    this.seedInitialAdminIfNeeded();
  }
  async initPostgresSchema() {
    if (!this.pgPool) return;
    const isProduction = process.env.NODE_ENV === "production";
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
        console.log("[DB] Donn\xE9es PostgreSQL charg\xE9es avec succ\xE8s");
      } else {
        await this.persistPostgres();
        console.log("[DB] Sch\xE9ma et donn\xE9es initiales synchronis\xE9s dans PostgreSQL");
      }
    } catch (err) {
      if (isProduction) {
        console.error("[DB FATAL] \xC9chec critique sch\xE9ma PostgreSQL:", err);
        throw new Error(`[DB PRODUCTION] Erreur sch\xE9ma PostgreSQL : ${err.message}`);
      } else {
        console.warn("[DB DEV] Avertissement initialisation PostgreSQL (fallback local maintenu):", err);
      }
    }
  }
  async persistPostgres() {
    if (!this.pgPool || !this.isPostgres) return;
    try {
      await this.pgPool.query(
        `INSERT INTO app_state (key, data, updated_at)
         VALUES ('marketsenegal_v1', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET data = $1, updated_at = NOW()`,
        [JSON.stringify(this.state)]
      );
    } catch (err) {
      console.error("[DB] Erreur persistPostgres:", err);
    }
  }
  persistLocal() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tmp = `${DATA_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2), "utf-8");
      fs.renameSync(tmp, DATA_FILE);
      if (this.isPostgres) {
        this.persistPostgres().catch((e) => console.error("[DB] Erreur async persistPostgres:", e));
      }
    } catch (e) {
      console.error("[DB] Erreur persistLocal:", e);
    }
  }
  seedInitialAdminIfNeeded() {
    const adminEmail = (process.env.ADMIN_EMAIL || "diengmoustapha910@gmail.com").trim().toLowerCase();
    let adminUser = this.state.users.find((u) => u.email.toLowerCase() === adminEmail);
    if (!adminUser) {
      const otherAdmin = this.state.users.find((u) => u.role === "admin");
      if (otherAdmin) {
        otherAdmin.email = adminEmail;
        otherAdmin.updated_at = (/* @__PURE__ */ new Date()).toISOString();
        adminUser = otherAdmin;
      }
    }
    if (!adminUser) {
      const initialSecret = process.env.ADMIN_INITIAL_PASSWORD || crypto.randomBytes(16).toString("hex") + "Aa1!";
      const salt = crypto.randomBytes(16).toString("hex");
      const hash = crypto.pbkdf2Sync(initialSecret, salt, 1e3, 64, "sha512").toString("hex");
      adminUser = {
        id: crypto.randomUUID(),
        email: adminEmail,
        password_hash: `${salt}:${hash}`,
        full_name: "Direction Market S\xE9n\xE9gal",
        phone: "+221 33 800 00 00",
        role: "admin",
        must_change_password: true,
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.state.users.push(adminUser);
      this.state.audit_logs.push({
        id: crypto.randomUUID(),
        admin_id: adminUser.id,
        admin_name: adminUser.full_name,
        action: "admin_initialized",
        target_type: "platform",
        details: { message: `Compte administrateur initialis\xE9. M\xE9canisme d'initialisation d\xE9sormais verrouill\xE9.` },
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      });
      this.persistLocal();
      console.log(`[DB] Administrateur principal initialis\xE9. Le m\xE9canisme d'initialisation initial est d\xE9sormais d\xE9sactiv\xE9.`);
    } else {
      if (adminUser.must_change_password === void 0) {
        adminUser.must_change_password = false;
      }
      console.log(`[DB] Compte administrateur principal v\xE9rifi\xE9. M\xE9canisme d'initialisation d\xE9sactiv\xE9.`);
    }
  }
  // --- USERS ---
  async getUserByEmail(email) {
    const norm = email.trim().toLowerCase();
    return this.state.users.find((u) => u.email.toLowerCase() === norm) || null;
  }
  async getUserById(id) {
    return this.state.users.find((u) => u.id === id) || null;
  }
  async createUser(data) {
    const user = {
      ...data,
      id: crypto.randomUUID(),
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.users.push(user);
    this.persistLocal();
    return user;
  }
  async updateUserRole(id, role) {
    const user = this.state.users.find((u) => u.id === id);
    if (!user) return null;
    user.role = role;
    user.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    this.persistLocal();
    return user;
  }
  async updateUserProfile(id, data) {
    const user = this.state.users.find((u) => u.id === id);
    if (!user) return null;
    if (data.full_name) user.full_name = data.full_name;
    if (data.phone !== void 0) user.phone = data.phone;
    user.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    this.persistLocal();
    return user;
  }
  async getUserByGoogleId(googleId) {
    return this.state.users.find((u) => u.google_id === googleId) || null;
  }
  async linkGoogleAccount(userId, googleId, avatarUrl) {
    const user = this.state.users.find((u) => u.id === userId);
    if (!user) return null;
    user.google_id = googleId;
    if (avatarUrl && !user.avatar_url) user.avatar_url = avatarUrl;
    user.is_email_verified = true;
    user.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    this.persistLocal();
    return user;
  }
  async createEmailVerificationToken(userId) {
    const user = this.state.users.find((u) => u.id === userId);
    if (!user) return null;
    const token = crypto.randomBytes(32).toString("hex");
    user.email_verification_token = token;
    user.email_verification_expires_at = new Date(Date.now() + 24 * 60 * 60 * 1e3).toISOString();
    user.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    this.persistLocal();
    return token;
  }
  async verifyEmailToken(token) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const user = this.state.users.find(
      (u) => u.email_verification_token === token && u.email_verification_expires_at && u.email_verification_expires_at > now
    );
    if (!user) return null;
    user.is_email_verified = true;
    user.email_verification_token = void 0;
    user.email_verification_expires_at = void 0;
    user.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    this.persistLocal();
    return user;
  }
  async listUsers() {
    return [...this.state.users];
  }
  // --- SESSIONS ---
  async createSession(userId) {
    const session = {
      token: crypto.randomBytes(32).toString("hex"),
      user_id: userId,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3).toISOString()
      // 30 jours
    };
    this.state.sessions.push(session);
    this.persistLocal();
    return session;
  }
  async getSession(token) {
    const sess = this.state.sessions.find((s) => s.token === token);
    if (!sess) return null;
    if (new Date(sess.expires_at).getTime() < Date.now()) {
      this.deleteSession(token);
      return null;
    }
    return sess;
  }
  async deleteSession(token) {
    this.state.sessions = this.state.sessions.filter((s) => s.token !== token);
    this.persistLocal();
  }
  async invalidateOtherSessions(userId, keepSessionToken) {
    const initialCount = this.state.sessions.length;
    this.state.sessions = this.state.sessions.filter(
      (s) => s.user_id !== userId || keepSessionToken && s.token === keepSessionToken
    );
    const removed = initialCount - this.state.sessions.length;
    if (removed > 0) {
      this.persistLocal();
    }
    return removed;
  }
  async updateUserPassword(userId, newPasswordHash, mustChangePassword = false) {
    const user = this.state.users.find((u) => u.id === userId);
    if (!user) return null;
    user.password_hash = newPasswordHash;
    user.must_change_password = mustChangePassword;
    user.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    this.persistLocal();
    return user;
  }
  // --- STORES ---
  async getStoreById(id) {
    return this.state.stores.find((s) => s.id === id) || null;
  }
  async getStoreByUserId(userId) {
    return this.state.stores.find((s) => s.user_id === userId) || null;
  }
  async getStoreBySlug(slug) {
    return this.state.stores.find((s) => s.slug === slug) || null;
  }
  async listPublicStores() {
    const active = this.state.stores.filter((s) => s.is_active && !s.is_suspended);
    return active.sort((a, b) => {
      const aCert = a.is_certified ? 1 : 0;
      const bCert = b.is_certified ? 1 : 0;
      if (bCert !== aCert) return bCert - aCert;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }
  async listAllStoresForAdmin() {
    return [...this.state.stores];
  }
  async createStore(data) {
    const store = {
      ...data,
      id: crypto.randomUUID(),
      is_active: true,
      is_suspended: false,
      is_certified: false,
      certification_status: "non_certifiee",
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.stores.push(store);
    const user = this.state.users.find((u) => u.id === data.user_id);
    if (user && user.role === "client") {
      user.role = "vendeur";
      user.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    }
    this.state.delivery_zones.push({
      id: crypto.randomUUID(),
      store_id: store.id,
      region: "Dakar",
      price_fcfa: 2e3,
      estimated_days: "24h-48h",
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    this.persistLocal();
    return store;
  }
  async updateStore(id, data) {
    const store = this.state.stores.find((s) => s.id === id);
    if (!store) return null;
    Object.assign(store, data, { updated_at: (/* @__PURE__ */ new Date()).toISOString() });
    this.persistLocal();
    return store;
  }
  async suspendStore(storeId, adminId, reason) {
    const store = this.state.stores.find((s) => s.id === storeId);
    if (!store) return null;
    store.is_suspended = true;
    store.suspension_reason = reason;
    store.suspended_at = (/* @__PURE__ */ new Date()).toISOString();
    store.suspended_by = adminId;
    store.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    const suspensionEntry = {
      id: crypto.randomUUID(),
      store_id: storeId,
      admin_id: adminId,
      action: "suspend",
      reason,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.store_suspensions.push(suspensionEntry);
    this.persistLocal();
    return store;
  }
  async reactivateStore(storeId, adminId, reason) {
    const store = this.state.stores.find((s) => s.id === storeId);
    if (!store) return null;
    store.is_suspended = false;
    store.suspension_reason = void 0;
    store.suspended_at = void 0;
    store.suspended_by = void 0;
    store.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    const suspensionEntry = {
      id: crypto.randomUUID(),
      store_id: storeId,
      admin_id: adminId,
      action: "reactivate",
      reason,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.store_suspensions.push(suspensionEntry);
    this.persistLocal();
    return store;
  }
  async getStoreSuspensionHistory(storeId) {
    return this.state.store_suspensions.filter((s) => s.store_id === storeId);
  }
  // --- DELIVERY ZONES ---
  async getDeliveryZones(storeId) {
    return this.state.delivery_zones.filter((z) => z.store_id === storeId);
  }
  async createDeliveryZone(data) {
    const existing = this.state.delivery_zones.find((z) => z.store_id === data.store_id && z.region.toLowerCase() === data.region.toLowerCase());
    if (existing) {
      existing.price_fcfa = data.price_fcfa;
      existing.estimated_days = data.estimated_days;
      this.persistLocal();
      return existing;
    }
    const zone = {
      ...data,
      id: crypto.randomUUID(),
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.delivery_zones.push(zone);
    this.persistLocal();
    return zone;
  }
  async deleteDeliveryZone(id, storeId) {
    const initialLen = this.state.delivery_zones.length;
    this.state.delivery_zones = this.state.delivery_zones.filter((z) => !(z.id === id && z.store_id === storeId));
    this.persistLocal();
    return this.state.delivery_zones.length < initialLen;
  }
  // --- CATEGORIES ---
  async getStoreCategories(storeId) {
    return this.state.store_categories.filter((c) => c.store_id === storeId);
  }
  async createStoreCategory(storeId, name) {
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const cat = {
      id: crypto.randomUUID(),
      store_id: storeId,
      name: name.trim(),
      slug: slug || "cat-" + Date.now(),
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.store_categories.push(cat);
    this.persistLocal();
    return cat;
  }
  async deleteStoreCategory(id, storeId) {
    const initialLen = this.state.store_categories.length;
    this.state.store_categories = this.state.store_categories.filter((c) => !(c.id === id && c.store_id === storeId));
    this.persistLocal();
    return this.state.store_categories.length < initialLen;
  }
  // --- PRODUCTS ---
  async listPublicProducts(options = {}) {
    const activeStoreIds = new Set(
      this.state.stores.filter((s) => s.is_active && !s.is_suspended).map((s) => s.id)
    );
    let filtered = this.state.products.filter((p) => p.is_active && activeStoreIds.has(p.store_id));
    if (options.storeId) {
      filtered = filtered.filter((p) => p.store_id === options.storeId);
    }
    if (options.categoryId) {
      filtered = filtered.filter((p) => p.category_id === options.categoryId);
    }
    if (options.minPrice !== void 0) {
      filtered = filtered.filter((p) => p.price_fcfa >= options.minPrice);
    }
    if (options.maxPrice !== void 0) {
      filtered = filtered.filter((p) => p.price_fcfa <= options.maxPrice);
    }
    if (options.region) {
      const storesDeliveringToRegion = new Set(
        this.state.delivery_zones.filter((z) => z.region.toLowerCase() === options.region.toLowerCase()).map((z) => z.store_id)
      );
      filtered = filtered.filter((p) => storesDeliveringToRegion.has(p.store_id));
    }
    if (options.search) {
      const q = options.search.trim().toLowerCase();
      filtered = filtered.filter(
        (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
      );
    }
    if (options.sort === "price_asc") {
      filtered.sort((a, b) => a.price_fcfa - b.price_fcfa);
    } else if (options.sort === "price_desc") {
      filtered.sort((a, b) => b.price_fcfa - a.price_fcfa);
    } else if (options.sort === "name") {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      filtered.sort((a, b) => {
        const storeA = this.state.stores.find((s) => s.id === a.store_id);
        const storeB = this.state.stores.find((s) => s.id === b.store_id);
        const aCert = storeA?.is_certified ? 1 : 0;
        const bCert = storeB?.is_certified ? 1 : 0;
        if (bCert !== aCert) return bCert - aCert;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }
    const enriched = filtered.map((p) => {
      const store = this.state.stores.find((s) => s.id === p.store_id);
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
  async getProductById(id) {
    const product = this.state.products.find((p) => p.id === id);
    if (!product) return null;
    const store = this.state.stores.find((s) => s.id === product.store_id);
    if (!store) return null;
    const category = product.category_id ? this.state.store_categories.find((c) => c.id === product.category_id) : void 0;
    return { ...product, store, category };
  }
  async listStoreProducts(storeId) {
    return this.state.products.filter((p) => p.store_id === storeId);
  }
  async createProduct(data) {
    if (!data.images || data.images.length === 0) {
      throw new Error("Au moins une photo est requise pour publier un produit.");
    }
    const product = {
      ...data,
      id: crypto.randomUUID(),
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.products.push(product);
    this.persistLocal();
    return product;
  }
  async updateProduct(id, storeId, data) {
    const product = this.state.products.find((p) => p.id === id && p.store_id === storeId);
    if (!product) return null;
    if (data.images && data.images.length === 0) {
      throw new Error("Le produit doit avoir au moins une photo.");
    }
    Object.assign(product, data, { updated_at: (/* @__PURE__ */ new Date()).toISOString() });
    this.persistLocal();
    return product;
  }
  async deleteProduct(id, storeId) {
    const initialLen = this.state.products.length;
    this.state.products = this.state.products.filter((p) => !(p.id === id && p.store_id === storeId));
    this.persistLocal();
    return this.state.products.length < initialLen;
  }
  // --- COUPONS ---
  async getStoreCoupons(storeId) {
    return this.state.coupons.filter((c) => c.store_id === storeId);
  }
  async createCoupon(storeId, data) {
    const coupon = {
      ...data,
      id: crypto.randomUUID(),
      store_id: storeId,
      code: data.code.toUpperCase().trim(),
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.coupons.push(coupon);
    this.persistLocal();
    return coupon;
  }
  async validateCoupon(storeId, code, orderAmount) {
    const coupon = this.state.coupons.find(
      (c) => c.store_id === storeId && c.code === code.toUpperCase().trim() && c.is_active
    );
    if (!coupon) return null;
    if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) return null;
    if (orderAmount < coupon.min_order_amount_fcfa) return null;
    return coupon;
  }
  // --- ORDERS ---
  async createOrderGroup(params) {
    const createdOrders = [];
    const now = (/* @__PURE__ */ new Date()).toISOString();
    for (const group of params.storeOrders) {
      const store = this.state.stores.find((s) => s.id === group.storeId);
      if (!store || store.is_suspended || !store.is_active) {
        throw new Error(`La boutique "${store ? store.name : group.storeId}" n'est plus active ou est suspendue.`);
      }
      const zone = this.state.delivery_zones.find(
        (z) => z.store_id === group.storeId && z.region.toLowerCase() === params.deliveryRegion.toLowerCase()
      );
      if (!zone) {
        throw new Error(`La boutique "${store.name}" ne livre pas dans la r\xE9gion s\xE9lectionn\xE9e (${params.deliveryRegion}).`);
      }
      let subtotal = 0;
      const orderItemsToCreate = [];
      for (const itemReq of group.items) {
        const product = this.state.products.find((p) => p.id === itemReq.productId && p.store_id === group.storeId);
        if (!product || !product.is_active) {
          throw new Error(`Un des produits demand\xE9s n'est plus disponible.`);
        }
        if (product.stock_quantity < itemReq.quantity) {
          throw new Error(`Stock insuffisant pour le produit "${product.name}" (${product.stock_quantity} disponible(s)).`);
        }
        const lineTotal = product.price_fcfa * itemReq.quantity;
        subtotal += lineTotal;
        orderItemsToCreate.push({
          product_id: product.id,
          product_name: product.name,
          product_image: product.images[0] || "",
          unit_price_fcfa: product.price_fcfa,
          quantity: itemReq.quantity,
          total_price_fcfa: lineTotal
        });
        product.stock_quantity -= itemReq.quantity;
      }
      let discountAmount = 0;
      if (group.couponCode) {
        const validCoupon = await this.validateCoupon(group.storeId, group.couponCode, subtotal);
        if (validCoupon) {
          if (validCoupon.discount_percent) {
            discountAmount = Math.round(subtotal * validCoupon.discount_percent / 100);
          } else if (validCoupon.discount_amount_fcfa) {
            discountAmount = Math.min(subtotal, validCoupon.discount_amount_fcfa);
          }
        }
      }
      const deliveryFee = zone.price_fcfa;
      const total = Math.max(0, subtotal - discountAmount + deliveryFee);
      const orderId = crypto.randomUUID();
      const orderNumber = `MS-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
      const order = {
        id: orderId,
        order_number: orderNumber,
        customer_id: params.customerId,
        store_id: group.storeId,
        status: "en_attente",
        subtotal_fcfa: subtotal,
        delivery_fee_fcfa: deliveryFee,
        discount_amount_fcfa: discountAmount,
        total_fcfa: total,
        payment_method: params.paymentMethod,
        payment_status: params.paymentMethod === "paiement_livraison" ? "non_paye" : "en_attente",
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
      order.items = this.state.order_items.filter((i) => i.order_id === orderId);
      createdOrders.push(order);
    }
    this.persistLocal();
    return createdOrders;
  }
  async getCustomerOrders(customerId) {
    const orders = this.state.orders.filter((o) => o.customer_id === customerId);
    orders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return orders.map((o) => {
      const store = this.state.stores.find((s) => s.id === o.store_id);
      const items = this.state.order_items.filter((i) => i.order_id === o.id);
      return {
        ...o,
        store_name: store ? store.name : "Boutique",
        items
      };
    });
  }
  async getStoreOrders(storeId) {
    const orders = this.state.orders.filter((o) => o.store_id === storeId);
    orders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return orders.map((o) => {
      const items = this.state.order_items.filter((i) => i.order_id === o.id);
      return {
        ...o,
        items
      };
    });
  }
  async updateOrderStatus(orderId, storeId, status) {
    const order = this.state.orders.find((o) => o.id === orderId && o.store_id === storeId);
    if (!order) return null;
    order.status = status;
    if (status === "livree" && order.payment_method === "paiement_livraison") {
      order.payment_status = "paye";
    }
    order.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    this.persistLocal();
    return order;
  }
  async listAllOrdersForAdmin() {
    const orders = [...this.state.orders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return orders.map((o) => {
      const store = this.state.stores.find((s) => s.id === o.store_id);
      const items = this.state.order_items.filter((i) => i.order_id === o.id);
      return {
        ...o,
        store_name: store ? store.name : "Boutique",
        items
      };
    });
  }
  // --- CONVERSATIONS & MESSAGES ---
  async getOrCreateConversation(storeId, customerId) {
    let conv = this.state.conversations.find((c) => c.store_id === storeId && c.customer_id === customerId);
    if (!conv) {
      conv = {
        id: crypto.randomUUID(),
        store_id: storeId,
        customer_id: customerId,
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.state.conversations.push(conv);
      this.persistLocal();
    }
    return conv;
  }
  async listUserConversations(userId, role) {
    const userStore = this.state.stores.find((s) => s.user_id === userId);
    const storeId = userStore?.id;
    const convs = this.state.conversations.filter(
      (c) => c.customer_id === userId || storeId && c.store_id === storeId
    );
    convs.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    return convs.map((c) => {
      const store = this.state.stores.find((s) => s.id === c.store_id);
      const customer = this.state.users.find((u) => u.id === c.customer_id);
      const msgs = this.state.messages.filter((m) => m.conversation_id === c.id);
      msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const lastMsg = msgs[msgs.length - 1];
      const unreadCount = msgs.filter((m) => !m.is_read && m.sender_id !== userId).length;
      return {
        ...c,
        store_name: store?.name || "Boutique",
        customer_name: customer?.full_name || "Client",
        last_message: lastMsg?.content || "",
        last_message_date: lastMsg?.created_at || c.created_at,
        unread_count: unreadCount
      };
    });
  }
  async getConversationMessages(conversationId, userId) {
    const conv = this.state.conversations.find((c) => c.id === conversationId);
    if (!conv) return [];
    const store = this.state.stores.find((s) => s.id === conv.store_id);
    const user = this.state.users.find((u) => u.id === userId);
    const isAllowed = conv.customer_id === userId || store && store.user_id === userId || user?.role === "admin";
    if (!isAllowed) throw new Error("Non autoris\xE9 \xE0 consulter cette discussion.");
    for (const msg of this.state.messages) {
      if (msg.conversation_id === conversationId && msg.sender_id !== userId) {
        msg.is_read = true;
      }
    }
    this.persistLocal();
    const msgs = this.state.messages.filter((m) => m.conversation_id === conversationId);
    msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return msgs;
  }
  async sendMessage(conversationId, senderId, content) {
    const conv = this.state.conversations.find((c) => c.id === conversationId);
    if (!conv) throw new Error("Conversation introuvable.");
    const store = this.state.stores.find((s) => s.id === conv.store_id);
    const user = this.state.users.find((u) => u.id === senderId);
    const isAllowed = conv.customer_id === senderId || store && store.user_id === senderId || user?.role === "admin";
    if (!isAllowed) throw new Error("Non autoris\xE9 \xE0 envoyer un message.");
    const msg = {
      id: crypto.randomUUID(),
      conversation_id: conversationId,
      sender_id: senderId,
      content: content.trim(),
      is_read: false,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.messages.push(msg);
    conv.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    this.persistLocal();
    return msg;
  }
  async getConversationById(id) {
    return this.state.conversations.find((c) => c.id === id) || null;
  }
  async getMessagesByConversationId(conversationId) {
    return this.state.messages.filter((m) => m.conversation_id === conversationId).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }
  async getProducts(options) {
    const res = await this.listPublicProducts({});
    if (options?.is_active !== void 0) {
      return res.products.filter((p) => p.is_active === options.is_active);
    }
    return res.products;
  }
  // --- SUBSCRIPTIONS (Abonnements boutiques) ---
  async createSubscriptionRequest(storeId, planTier, offlineRef, proofDocumentUrl, notes, adminId) {
    const price = planTier === "essentiel" ? 8e3 : 18e3;
    const sub = {
      id: crypto.randomUUID(),
      store_id: storeId,
      plan_tier: planTier,
      price_fcfa: price,
      duration_months: 1,
      status: adminId ? "actif" : "paiement_a_verifier",
      offline_payment_reference: offlineRef,
      proof_document_url: proofDocumentUrl || "",
      vendor_notes: notes || "",
      verified_by_admin_id: adminId || "",
      verified_payment_reference: adminId ? offlineRef : "",
      starts_at: (/* @__PURE__ */ new Date()).toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3).toISOString(),
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.subscriptions.push(sub);
    if (adminId) {
      const store = this.state.stores.find((s) => s.id === storeId);
      if (store) {
        store.plan_tier = planTier;
        store.plan_expires_at = sub.expires_at;
      }
    }
    this.persistLocal();
    return sub;
  }
  async validateSubscriptionOffline(subscriptionId, adminId, paymentRef) {
    const sub = this.state.subscriptions.find((s) => s.id === subscriptionId);
    if (!sub) return null;
    sub.status = "actif";
    sub.verified_by_admin_id = adminId;
    sub.verified_payment_reference = paymentRef;
    if (!sub.offline_payment_reference) {
      sub.offline_payment_reference = paymentRef;
    }
    sub.starts_at = (/* @__PURE__ */ new Date()).toISOString();
    sub.expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3).toISOString();
    const store = this.state.stores.find((s) => s.id === sub.store_id);
    if (store) {
      store.plan_tier = sub.plan_tier;
      store.plan_expires_at = sub.expires_at;
    }
    const admin = this.state.users.find((u) => u.id === adminId);
    this.state.audit_logs.push({
      id: crypto.randomUUID(),
      admin_id: adminId,
      admin_name: admin?.full_name,
      action: "validate_subscription",
      target_type: "subscription",
      target_id: sub.id,
      details: {
        store_id: sub.store_id,
        plan_tier: sub.plan_tier,
        payment_reference: paymentRef,
        amount_fcfa: sub.price_fcfa,
        duration: "1 mois (30 jours)"
      },
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    this.persistLocal();
    return sub;
  }
  async getStoreSubscriptions(storeId) {
    const subs = this.state.subscriptions.filter((s) => s.store_id === storeId);
    subs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return subs;
  }
  async listSubscriptions() {
    const subs = [...this.state.subscriptions];
    subs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return subs.map((s) => {
      const store = this.state.stores.find((st) => st.id === s.store_id);
      return {
        ...s,
        store_name: store?.name || "Boutique"
      };
    });
  }
  isPaymentReferenceUsed(ref, excludeId) {
    const clean = ref.trim().toLowerCase();
    if (!clean) return false;
    const subExists = this.state.subscriptions.some((s) => {
      if (s.id === excludeId) return false;
      return s.offline_payment_reference && s.offline_payment_reference.trim().toLowerCase() === clean || s.verified_payment_reference && s.verified_payment_reference.trim().toLowerCase() === clean;
    });
    if (subExists) return true;
    const certExists = this.state.store_certifications.some((c) => {
      if (c.id === excludeId) return false;
      return c.wave_payment_reference && c.wave_payment_reference.trim().toLowerCase() === clean || c.verified_payment_reference && c.verified_payment_reference.trim().toLowerCase() === clean;
    });
    return certExists;
  }
  async getVendorProPayments(storeId) {
    const store = this.state.stores.find((s) => s.id === storeId);
    const subscriptions = await this.getStoreSubscriptions(storeId);
    const certifications = await this.getStoreCertificationHistory(storeId);
    const currentCert = await this.getStoreCertification(storeId);
    const history = [];
    for (const s of subscriptions) {
      history.push({
        id: s.id,
        category: "abonnement",
        object_name: s.plan_tier === "essentiel" ? "Forfait Essentiel" : "Forfait Croissance",
        frequency: "Abonnement mensuel (30 jours)",
        amount_fcfa: s.price_fcfa,
        payment_reference: s.offline_payment_reference,
        proof_document_url: s.proof_document_url,
        status: s.status,
        status_label: s.status === "actif" ? "Actif (Valid\xE9)" : s.status === "expire" ? "Expir\xE9" : "Paiement \xE0 v\xE9rifier",
        verified_payment_reference: s.verified_payment_reference,
        admin_decision: s.status === "actif" ? `Valid\xE9 par l'administration \xB7 R\xE9f: ${s.verified_payment_reference || s.offline_payment_reference}` : void 0,
        created_at: s.created_at,
        expires_at: s.expires_at
      });
    }
    for (const c of certifications) {
      history.push({
        id: c.id,
        category: "certification",
        object_name: "Certification officielle de la boutique",
        frequency: "Paiement unique",
        amount_fcfa: c.amount_fcfa || 1e4,
        payment_reference: c.wave_payment_reference || "",
        proof_document_url: c.proof_document_url,
        status: c.status,
        status_label: c.status === "certifiee" ? "Certifi\xE9e" : c.status === "refusee" ? "Refus\xE9e" : c.status === "verification_en_cours" ? "V\xE9rification en cours" : "Paiement \xE0 v\xE9rifier",
        verified_payment_reference: c.verified_payment_reference,
        rejection_reason: c.rejection_reason,
        admin_decision: c.status === "certifiee" ? `Certifi\xE9e par l'administration \xB7 R\xE9f: ${c.verified_payment_reference || c.wave_payment_reference}` : c.status === "refusee" ? `Demande refus\xE9e \xB7 Motif: ${c.rejection_reason}` : void 0,
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
  async listApprovedPlatformReviews() {
    return this.state.platform_reviews.filter((r) => r.is_approved);
  }
  async listAllPlatformReviewsForAdmin() {
    return [...this.state.platform_reviews];
  }
  async createPlatformReview(userId, rating, comment) {
    const user = this.state.users.find((u) => u.id === userId);
    const review = {
      id: crypto.randomUUID(),
      user_id: userId,
      user_name: user?.full_name || "Client",
      rating: Math.max(1, Math.min(5, Math.round(rating))),
      comment: comment.trim(),
      is_approved: true,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.platform_reviews.push(review);
    this.persistLocal();
    return review;
  }
  async toggleReviewApproval(reviewId, isApproved) {
    const review = this.state.platform_reviews.find((r) => r.id === reviewId);
    if (!review) return null;
    review.is_approved = isApproved;
    this.persistLocal();
    return review;
  }
  // --- AUDIT LOGS ---
  async addAuditLog(adminId, action, targetType, targetId, details) {
    const admin = this.state.users.find((u) => u.id === adminId);
    this.state.audit_logs.push({
      id: crypto.randomUUID(),
      admin_id: adminId,
      admin_name: admin?.full_name || "Admin",
      action,
      target_type: targetType,
      target_id: targetId,
      details,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    this.persistLocal();
  }
  async listAuditLogs() {
    return [...this.state.audit_logs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  // --- STATS COMPUTATION ---
  async getAdminStats() {
    const totalUsers = this.state.users.length;
    const totalClients = this.state.users.filter((u) => u.role === "client").length;
    const totalVendors = this.state.users.filter((u) => u.role === "vendeur").length;
    const totalStores = this.state.stores.length;
    const activeStores = this.state.stores.filter((s) => s.is_active && !s.is_suspended).length;
    const suspendedStores = this.state.stores.filter((s) => s.is_suspended).length;
    const totalProducts = this.state.products.length;
    const activeProducts = this.state.products.filter((p) => p.is_active).length;
    const totalOrders = this.state.orders.length;
    const totalCompletedOrders = this.state.orders.filter((o) => o.status === "livree").length;
    const gmvTotalFcfa = this.state.orders.filter((o) => o.status !== "annulee").reduce((acc, o) => acc + o.total_fcfa, 0);
    const activeSubscriptions = this.state.subscriptions.filter((s) => s.status === "actif").length;
    return {
      totalUsers,
      totalClients,
      totalVendors,
      totalStores,
      activeStores,
      suspendedStores,
      certifiedStores: this.state.stores.filter((s) => s.is_certified && s.is_active && !s.is_suspended).length,
      pendingCertifications: this.state.store_certifications.filter((c) => c.status === "paiement_a_verifier" || c.status === "verification_en_cours").length,
      totalProducts,
      activeProducts,
      totalOrders,
      totalCompletedOrders,
      gmvTotalFcfa,
      activeSubscriptions
    };
  }
  // --- CERTIFICATIONS DES BOUTIQUES (10 000 FCFA via Wave) ---
  async getStoreCertification(storeId) {
    const list = this.state.store_certifications.filter((c) => c.store_id === storeId);
    if (list.length === 0) return null;
    return list[list.length - 1];
  }
  async getStoreCertificationHistory(storeId) {
    return this.state.store_certifications.filter((c) => c.store_id === storeId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  async submitCertificationRequest(params) {
    const store = this.state.stores.find((s) => s.id === params.storeId);
    if (!store) throw new Error("Boutique introuvable.");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const cert = {
      id: crypto.randomUUID(),
      store_id: params.storeId,
      wave_payment_reference: params.wavePaymentReference.trim(),
      proof_document_url: params.proofDocumentUrl,
      status: "paiement_a_verifier",
      amount_fcfa: 1e4,
      vendor_notes: params.vendorNotes?.trim(),
      created_at: now,
      updated_at: now
    };
    this.state.store_certifications.push(cert);
    store.certification_status = "paiement_a_verifier";
    store.updated_at = now;
    this.persistLocal();
    return cert;
  }
  async listAllCertificationsForAdmin() {
    return this.state.store_certifications.map((c) => {
      const store = this.state.stores.find((s) => s.id === c.store_id);
      return {
        ...c,
        store_name: store?.name || "Boutique",
        store_slug: store?.slug || "",
        store_city: store?.city || "S\xE9n\xE9gal"
      };
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  async approveCertification(certId, adminId, verifiedPaymentRef, adminNotes) {
    const cert = this.state.store_certifications.find((c) => c.id === certId);
    if (!cert) return null;
    const store = this.state.stores.find((s) => s.id === cert.store_id);
    if (!store) return null;
    const admin = this.state.users.find((u) => u.id === adminId);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    cert.status = "certifiee";
    cert.wave_payment_reference = verifiedPaymentRef.trim();
    cert.admin_id = adminId;
    cert.admin_name = admin?.full_name || "Admin";
    cert.admin_notes = adminNotes?.trim();
    cert.reviewed_at = now;
    cert.updated_at = now;
    store.is_certified = true;
    store.certification_status = "certifiee";
    store.certified_at = now;
    store.certified_by = adminId;
    store.updated_at = now;
    await this.addAuditLog(adminId, "approve_certification", "store", store.id, {
      store_name: store.name,
      wave_payment_reference: verifiedPaymentRef,
      amount_fcfa: cert.amount_fcfa,
      admin_notes: adminNotes
    });
    this.persistLocal();
    return cert;
  }
  async rejectCertification(certId, adminId, rejectionReason, adminNotes) {
    const cert = this.state.store_certifications.find((c) => c.id === certId);
    if (!cert) return null;
    const store = this.state.stores.find((s) => s.id === cert.store_id);
    if (!store) return null;
    const admin = this.state.users.find((u) => u.id === adminId);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    cert.status = "refusee";
    cert.rejection_reason = rejectionReason.trim();
    cert.admin_id = adminId;
    cert.admin_name = admin?.full_name || "Admin";
    cert.admin_notes = adminNotes?.trim();
    cert.reviewed_at = now;
    cert.updated_at = now;
    store.is_certified = false;
    store.certification_status = "refusee";
    store.updated_at = now;
    await this.addAuditLog(adminId, "reject_certification", "store", store.id, {
      store_name: store.name,
      reason: rejectionReason,
      admin_notes: adminNotes
    });
    this.persistLocal();
    return cert;
  }
  async revokeCertification(storeId, adminId, reason) {
    const store = this.state.stores.find((s) => s.id === storeId);
    if (!store) return null;
    const admin = this.state.users.find((u) => u.id === adminId);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    store.is_certified = false;
    store.certification_status = "retiree";
    store.updated_at = now;
    this.state.store_certifications.push({
      id: crypto.randomUUID(),
      store_id: storeId,
      status: "retiree",
      amount_fcfa: 1e4,
      admin_id: adminId,
      admin_name: admin?.full_name || "Admin",
      rejection_reason: reason.trim(),
      reviewed_at: now,
      created_at: now,
      updated_at: now
    });
    await this.addAuditLog(adminId, "revoke_certification", "store", store.id, {
      store_name: store.name,
      reason
    });
    this.persistLocal();
    return store;
  }
  // --- AI CONFIGURATION & USAGE ---
  getAiConfig() {
    if (!this.state.ai_config) {
      this.state.ai_config = {
        daily_quota_per_store: 25,
        enabled: true,
        provider: "Google Gemini"
      };
    }
    return this.state.ai_config;
  }
  async updateAiConfig(updates, adminId) {
    const current = this.getAiConfig();
    this.state.ai_config = {
      ...current,
      ...updates,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (adminId) {
      await this.addAuditLog(adminId, "update_ai_config", "platform", "ai_settings", { updates });
    }
    this.persistLocal();
    return this.state.ai_config;
  }
  async logAiUsage(data) {
    if (!this.state.ai_usage_logs) {
      this.state.ai_usage_logs = [];
    }
    this.state.ai_usage_logs.push({
      id: crypto.randomUUID(),
      ...data,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    if (this.state.ai_usage_logs.length > 2e3) {
      this.state.ai_usage_logs = this.state.ai_usage_logs.slice(-2e3);
    }
    this.persistLocal();
  }
  getStoreAiUsageToday(storeId) {
    if (!this.state.ai_usage_logs) return 0;
    const startOfToday = /* @__PURE__ */ new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayIso = startOfToday.toISOString();
    return this.state.ai_usage_logs.filter(
      (log) => log.store_id === storeId && log.type === "image_generation" && log.created_at >= todayIso
    ).length;
  }
  // --- PASSWORD RECOVERY (ADMIN & USERS) ---
  async createPasswordResetToken(email, role) {
    if (!this.state.password_reset_tokens) {
      this.state.password_reset_tokens = [];
    }
    const now = /* @__PURE__ */ new Date();
    this.state.password_reset_tokens = this.state.password_reset_tokens.filter(
      (t) => new Date(t.expires_at) > now
    );
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1e3).toISOString();
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
  async checkPasswordResetToken(token) {
    if (!this.state.password_reset_tokens) return null;
    const now = /* @__PURE__ */ new Date();
    const entry = this.state.password_reset_tokens.find(
      (t) => t.token === token && new Date(t.expires_at) > now
    );
    if (!entry) return null;
    return {
      valid: true,
      email: entry.email,
      role: entry.role,
      expiresAt: entry.expires_at
    };
  }
  async verifyAndConsumePasswordResetToken(token, newPasswordHash) {
    if (!this.state.password_reset_tokens) return null;
    const now = /* @__PURE__ */ new Date();
    const entryIndex = this.state.password_reset_tokens.findIndex(
      (t) => t.token === token && new Date(t.expires_at) > now
    );
    if (entryIndex === -1) return null;
    const entry = this.state.password_reset_tokens[entryIndex];
    this.state.password_reset_tokens.splice(entryIndex, 1);
    const user = this.state.users.find((u) => u.email.toLowerCase() === entry.email.toLowerCase());
    if (!user) return null;
    user.password_hash = newPasswordHash;
    user.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    if (user.role === "admin") {
      await this.addAuditLog(user.id, "admin_password_reset", "user", user.id, {
        email: user.email,
        method: "secure_recovery_token"
      });
    }
    this.persistLocal();
    return user;
  }
};
var db = new DatabaseService();

// server/auth.ts
function hashPassword(password) {
  const salt = crypto2.randomBytes(16).toString("hex");
  const hash = crypto2.pbkdf2Sync(password, salt, 1e3, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const testHash = crypto2.pbkdf2Sync(password, salt, 1e3, 64, "sha512").toString("hex");
  return crypto2.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(testHash, "hex"));
}
async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : req.cookies?.session_token;
  if (!token) {
    return next();
  }
  try {
    const session = await db.getSession(token);
    if (!session) {
      return next();
    }
    const user = await db.getUserById(session.user_id);
    if (user) {
      req.user = user;
      req.sessionToken = token;
    }
  } catch (err) {
    console.error("[Auth] Erreur v\xE9rification session:", err);
  }
  next();
}
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentification requise. Veuillez vous connecter." });
  }
  next();
}
function requireSeller(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentification requise." });
  }
  if (req.user.role !== "vendeur" && req.user.role !== "admin") {
    return res.status(403).json({ error: "Acc\xE8s r\xE9serv\xE9 aux vendeurs enregistr\xE9s." });
  }
  next();
}
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentification requise." });
  }
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Acc\xE8s strictement r\xE9serv\xE9 aux administrateurs." });
  }
  next();
}

// server/routes.ts
import express from "express";
import multer from "multer";

// server/payments.ts
import crypto3 from "node:crypto";
var PaymentGatewayService = class {
  /**
   * Retourne l'état de configuration des passerelles sans exposer de clés
   */
  getAvailableMethods(storeAllowsCod = true) {
    const waveConfigured = Boolean(process.env.WAVE_API_KEY && process.env.WAVE_SECRET_KEY);
    const orangeMoneyConfigured = Boolean(process.env.ORANGE_MONEY_CLIENT_ID && process.env.ORANGE_MONEY_CLIENT_SECRET);
    const methods = [];
    if (storeAllowsCod) {
      methods.push({
        id: "paiement_livraison",
        name: "Paiement en esp\xE8ces \xE0 la livraison",
        isAvailable: true,
        description: "R\xE9glez le livreur en esp\xE8ces \xE0 la r\xE9ception de votre colis. Simple et s\xE9curis\xE9."
      });
    }
    methods.push({
      id: "wave",
      name: "Wave S\xE9n\xE9gal",
      isAvailable: waveConfigured,
      description: waveConfigured ? "Paiement direct et instantan\xE9 via Wave (0% de frais ajout\xE9s)." : "Paiement par Wave bient\xF4t disponible. En attente de finalisation des cl\xE9s API marchandes officielles.",
      missingConfig: waveConfigured ? [] : ["WAVE_API_KEY", "WAVE_SECRET_KEY"]
    });
    methods.push({
      id: "orange_money",
      name: "Orange Money S\xE9n\xE9gal",
      isAvailable: orangeMoneyConfigured,
      description: orangeMoneyConfigured ? "Paiement s\xE9curis\xE9 via Orange Money." : "Paiement par Orange Money en cours d\u2019int\xE9gration avec Orange Developer.",
      missingConfig: orangeMoneyConfigured ? [] : ["ORANGE_MONEY_CLIENT_ID", "ORANGE_MONEY_CLIENT_SECRET"]
    });
    return methods;
  }
  /**
   * Initialise un paiement Wave avec contrôle d'intégrité
   */
  async initiateWavePayment(req) {
    const apiKey = process.env.WAVE_API_KEY;
    const secretKey = process.env.WAVE_SECRET_KEY;
    if (!apiKey || !secretKey) {
      return {
        success: false,
        isConfigured: false,
        errorMessage: "Le paiement en ligne Wave n'est pas encore actif. Les cl\xE9s API officielles sont en cours de d\xE9ploiement par la direction."
      };
    }
    try {
      return {
        success: false,
        isConfigured: true,
        errorMessage: "Initialisation de transaction Wave pr\xEAte. Veuillez compl\xE9ter le param\xE9trage r\xE9seau."
      };
    } catch (err) {
      return {
        success: false,
        isConfigured: true,
        errorMessage: `Erreur passerelle Wave: ${err.message}`
      };
    }
  }
  /**
   * Vérifie la signature cryptographique d'un webhook Wave pour empêcher l'usurpation
   */
  verifyWaveWebhookSignature(payload, signature) {
    const secret = process.env.WAVE_WEBHOOK_SECRET;
    if (!secret || !signature) return false;
    const computedSignature = crypto3.createHmac("sha256", secret).update(payload, "utf8").digest("hex");
    return crypto3.timingSafeEqual(Buffer.from(signature), Buffer.from(computedSignature));
  }
  /**
   * Vérifie la signature d'un webhook Orange Money
   */
  verifyOrangeMoneyWebhook(payload, signature) {
    const secret = process.env.ORANGE_MONEY_WEBHOOK_SECRET;
    if (!secret || !signature) return false;
    const computed = crypto3.createHmac("sha256", secret).update(payload, "utf8").digest("hex");
    return crypto3.timingSafeEqual(Buffer.from(signature), Buffer.from(computed));
  }
};
var paymentGateway = new PaymentGatewayService();

// server/ai.ts
import { GoogleGenAI } from "@google/genai";
import fs2 from "node:fs";
import path2 from "node:path";
var getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
};
function checkAiStatus() {
  const apiKey = process.env.GEMINI_API_KEY;
  const config = db.getAiConfig();
  if (!apiKey) {
    return {
      available: false,
      provider: config.provider || "Google Gemini",
      textModel: "gemini-3.8-flash",
      imageModel: "gemini-3.1-flash-lite-image",
      reason: "Cl\xE9 API d\u2019IA non configur\xE9e sur le serveur. Les fonctionnalit\xE9s d\u2019IA sont momentan\xE9ment d\xE9sactiv\xE9es sans simulation.",
      dailyQuotaPerStore: config.daily_quota_per_store
    };
  }
  if (!config.enabled) {
    return {
      available: false,
      provider: config.provider || "Google Gemini",
      textModel: "gemini-3.8-flash",
      imageModel: "gemini-3.1-flash-lite-image",
      reason: "Le service d\u2019IA est temporairement suspendu par l\u2019administration de MARKET S\xC9N\xC9GAL.",
      dailyQuotaPerStore: config.daily_quota_per_store
    };
  }
  return {
    available: true,
    provider: config.provider || "Google Gemini",
    textModel: "gemini-3.8-flash",
    imageModel: "gemini-3.1-flash-lite-image",
    dailyQuotaPerStore: config.daily_quota_per_store
  };
}
async function chatWithAssistant(userMessage, history = []) {
  const status = checkAiStatus();
  if (!status.available) {
    return {
      reply: "",
      available: false,
      error: status.reason || "Service d\u2019IA indisponible."
    };
  }
  const ai = getGeminiClient();
  if (!ai) {
    return {
      reply: "",
      available: false,
      error: "Client IA indisponible."
    };
  }
  try {
    const allProducts = await db.getProducts({ is_active: true });
    const inStockProducts = allProducts.filter((p) => p.stock_quantity > 0).slice(0, 40);
    const catalogCatalogSummary = inStockProducts.map(
      (p) => `- "${p.name}" (Prix: ${p.price_fcfa.toLocaleString("fr-FR")} FCFA, Boutique: "${p.store_name || "Boutique"}", Ville: "${p.store_city || "S\xE9n\xE9gal"}", En stock: ${p.stock_quantity} unit\xE9(s)). Description: ${p.description.slice(0, 120)}`
    ).join("\n");
    const systemInstruction = `Tu es l'\xAB IA de MARKET S\xC9N\xC9GAL \xBB, l'assistant officiel de la plateforme e-commerce multi-boutiques s\xE9n\xE9galaise (https://marketsenegal.sn).
R\xC8GLES ABSOLUES ET STRICTES :
1. IDENTIT\xC9 : Pr\xE9sente-toi et agis toujours comme l'\xAB IA de MARKET S\xC9N\xC9GAL \xBB. Tu ne dois JAMAIS te faire passer pour un vendeur, pour un client ou pour un \xEAtre humain.
2. T\xC2CHES : 
   - Expliquer le fonctionnement du site : le panier multi-boutique, les livraisons fix\xE9es par chaque vendeur selon les r\xE9gions (Dakar, Thi\xE8s, Saint-Louis, etc.), la diff\xE9rence entre paiements de commandes (qui se r\xE8glent selon les options activ\xE9es par le vendeur) et abonnements professionnels des vendeurs (Wave Essentiel 8 000 FCFA, etc.).
   - Aider les clients \xE0 trouver un produit r\xE9el parmi la liste ci-dessous.
3. V\xC9RIT\xC9 ET FIABILIT\xC9 DES DONN\xC9ES (GROUNDING STRICT) :
   - Tu n'affirmes JAMAIS qu'un produit est disponible ou en stock s'il n'est pas explicitement list\xE9 dans les DONN\xC9ES R\xC9ELLES ci-dessous.
   - N'invente aucun produit, aucun prix, aucune fausse garantie de livraison.
   - Si le client cherche un article qui ne figure pas dans cette liste, dis-lui poliment qu'aucun vendeur ne le propose actuellement en stock sur MARKET S\xC9N\xC9GAL.
4. TON : Chaleureux, courtois, professionnel, adapt\xE9 au S\xE9n\xE9gal (quelques mots usuels comme "Dalal ak j\xE0mm" ou "Teranga" sont les bienvenus avec parcimonie). Monnaie : Franc CFA (FCFA).

DONN\xC9ES R\xC9ELLES DU CATALOGUE EN STOCK ACTUELLEMENT :
${catalogCatalogSummary || "Aucun produit actuellement en stock dans le catalogue public."}
`;
    const contents = [];
    const recentHistory = history.slice(-6);
    for (const h of recentHistory) {
      contents.push({
        role: h.role,
        parts: [{ text: h.text }]
      });
    }
    contents.push({
      role: "user",
      parts: [{ text: userMessage }]
    });
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents,
      config: {
        systemInstruction,
        temperature: 0.4
      }
    });
    const reply = response.text || "D\xE9sol\xE9, je ne peux pas formuler de r\xE9ponse pour le moment.";
    await db.logAiUsage({ type: "discussion_assistance" });
    return { reply, available: true };
  } catch (err) {
    console.error("[AI Chat] Erreur:", err);
    const rawMsg = err.message || "";
    const isOverloaded = rawMsg.includes("503") || rawMsg.includes("UNAVAILABLE") || rawMsg.includes("high demand");
    return {
      reply: "",
      available: false,
      error: isOverloaded ? "Le mod\xE8le d\u2019IA subit actuellement un pic temporaire de forte demande. Veuillez patienter quelques instants avant de relancer." : `Service d\u2019IA momentan\xE9ment indisponible (${rawMsg.slice(0, 100)}).`
    };
  }
}
async function draftConversationReply(conversationId, userRole, customInstruction) {
  const status = checkAiStatus();
  if (!status.available) {
    return {
      draft: "",
      available: false,
      error: status.reason || "Service d\u2019IA indisponible."
    };
  }
  const ai = getGeminiClient();
  if (!ai) {
    return {
      draft: "",
      available: false,
      error: "Client d\u2019IA non configur\xE9."
    };
  }
  try {
    const messages = await db.getMessagesByConversationId(conversationId);
    if (!messages || messages.length === 0) {
      return {
        draft: "",
        available: false,
        error: "Aucun message dans cette conversation pour formuler une suggestion."
      };
    }
    const recentMessages = messages.slice(-5).map(
      (m) => `${m.sender_id === "vendeur" ? "Vendeur" : "Client"} : ${m.content}`
    ).join("\n");
    const roleName = userRole === "vendeur" ? "le vendeur" : "le client";
    const otherRoleName = userRole === "vendeur" ? "le client" : "le vendeur";
    const prompt = `Voici les derniers \xE9changes d'une conversation sur MARKET S\xC9N\xC9GAL :
${recentMessages}

Consigne : R\xE9dige une proposition de r\xE9ponse polie, concise et bienveillante pour ${roleName} s'adressant \xE0 ${otherRoleName}.
${customInstruction ? `Instruction particuli\xE8re de l'utilisateur : "${customInstruction}".` : ""}

R\xC8GLES IMPORTANTES :
1. N'affirme pas qu'un colis est d\xE9j\xE0 exp\xE9di\xE9 ou garanti \xE0 telle date sans que ce soit explicitement dit.
2. Ne promets pas de remises ou de gratuit\xE9 non convenues.
3. R\xE9dige UNIQUEMENT le texte propos\xE9 du message (sans guillemets superflus, ni pr\xE9ambule, ni balises), pr\xEAt \xE0 \xEAtre relu et modifi\xE9 par l'utilisateur avant envoi.`;
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        systemInstruction: "Tu es un assistant de r\xE9daction courtois et professionnel pour la messagerie de MARKET S\xC9N\xC9GAL.",
        temperature: 0.5
      }
    });
    const draft = response.text?.trim() || "";
    await db.logAiUsage({ type: "draft_suggestion" });
    return { draft, available: true };
  } catch (err) {
    console.error("[AI Draft] Erreur:", err);
    const rawMsg = err.message || "";
    const isOverloaded = rawMsg.includes("503") || rawMsg.includes("UNAVAILABLE") || rawMsg.includes("high demand");
    return {
      draft: "",
      available: false,
      error: isOverloaded ? "Le mod\xE8le d\u2019IA subit actuellement un pic temporaire de forte demande. Veuillez r\xE9essayer dans quelques instants." : `Service de suggestion d\u2019IA momentan\xE9ment indisponible.`
    };
  }
}
async function generateProductIllustration(params) {
  const status = checkAiStatus();
  if (!status.available) {
    return {
      available: false,
      is_ai_generated: false,
      error: status.reason || "G\xE9n\xE9rateur d\u2019images IA indisponible."
    };
  }
  const usedToday = db.getStoreAiUsageToday(params.storeId);
  const maxQuota = status.dailyQuotaPerStore || 25;
  if (usedToday >= maxQuota) {
    return {
      available: false,
      is_ai_generated: false,
      error: `Quota journalier d'illustrations IA atteint (${usedToday}/${maxQuota} images cr\xE9\xE9es aujourd'hui). R\xE9essayez demain.`
    };
  }
  const ai = getGeminiClient();
  if (!ai) {
    return {
      available: false,
      is_ai_generated: false,
      error: "Client IA indisponible."
    };
  }
  try {
    const promptText = `Professional, ultra-clean commercial studio e-commerce presentation illustration of:
Product: "${params.productName}"
Category: "${params.categoryName || "G\xE9n\xE9ral"}"
Product details: "${params.description}"
Environment: Pristine contemporary clean background, soft shadow, authentic product packaging and details, vibrant natural colors, professional catalog standards for African and Senegalese commerce. No distorted text, accurate shape and color.`;
    const parts = [];
    if (params.referenceImageBase64) {
      parts.push({
        inlineData: {
          mimeType: params.referenceImageMimeType || "image/jpeg",
          data: params.referenceImageBase64
        }
      });
      parts.push({
        text: `Based strictly on the real product reference photo provided, generate an enhanced commercial catalog presentation illustration. Faithfully preserve the exact shape, color, brand name, label, and texture of the product. Do not distort the original product features.`
      });
    }
    parts.push({ text: promptText });
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-image",
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });
    let generatedBase64 = null;
    let mimeType = "image/png";
    const candidates = response.candidates;
    if (candidates && candidates.length > 0 && candidates[0].content?.parts) {
      for (const part of candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          generatedBase64 = part.inlineData.data;
          mimeType = part.inlineData.mimeType || "image/png";
          break;
        }
      }
    }
    if (!generatedBase64) {
      return {
        available: false,
        is_ai_generated: false,
        error: "Le mod\xE8le n\u2019a pas renvoy\xE9 d\u2019image valide. Veuillez r\xE9ajuster les crit\xE8res et r\xE9essayer."
      };
    }
    const UPLOAD_DIR = path2.resolve(process.cwd(), "public", "uploads");
    if (!fs2.existsSync(UPLOAD_DIR)) {
      fs2.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    const ext = mimeType.includes("jpeg") ? ".jpg" : ".png";
    const filename = `ai_illustration_${Date.now()}_${params.storeId.substring(0, 8)}${ext}`;
    const filePath = path2.join(UPLOAD_DIR, filename);
    fs2.writeFileSync(filePath, Buffer.from(generatedBase64, "base64"));
    const url = `/uploads/${filename}`;
    await db.logAiUsage({
      store_id: params.storeId,
      type: "image_generation"
    });
    const newUsed = usedToday + 1;
    return {
      url,
      is_ai_generated: true,
      available: true,
      quotaRemaining: Math.max(0, maxQuota - newUsed)
    };
  } catch (err) {
    console.error("[AI Image Gen] Erreur:", err);
    return {
      available: false,
      is_ai_generated: false,
      error: `Erreur lors de la g\xE9n\xE9ration d'image : ${err.message || "\xC9chec du service"}`
    };
  }
}

// server/email.ts
import nodemailer from "nodemailer";
function checkEmailConfig() {
  const isProduction = process.env.NODE_ENV === "production";
  const mode = (process.env.EMAIL_MODE || (isProduction ? "production" : "sandbox")).toLowerCase() === "production" ? "production" : "sandbox";
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD?.trim() || process.env.SMTP_PASS?.trim();
  const port = process.env.SMTP_PORT?.trim() || "587";
  const from = process.env.SMTP_FROM?.trim() || "contact@marketsenegal.sn";
  const missingVars = [];
  if (!host) missingVars.push("SMTP_HOST");
  if (!user) missingVars.push("SMTP_USER");
  if (!password) missingVars.push("SMTP_PASSWORD");
  const configured = missingVars.length === 0;
  return {
    configured,
    missingVars,
    provider: host ? `SMTP (${host}:${port})` : mode === "sandbox" ? "Bac \xE0 sable (Sandbox de test)" : "SMTP (Non configur\xE9)",
    host,
    from,
    mode
  };
}
var cachedTestAccount = null;
async function getTransporter() {
  const config = checkEmailConfig();
  if (config.mode === "production" || config.configured) {
    if (!config.configured) {
      throw new Error(`Fournisseur SMTP incomplet en production (variables manquantes : ${config.missingVars.join(", ")}).`);
    }
    const port = Number(process.env.SMTP_PORT) || 587;
    const transporter2 = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD || process.env.SMTP_PASS
      }
    });
    return { transporter: transporter2, mode: "production", from: config.from };
  }
  if (!cachedTestAccount) {
    try {
      cachedTestAccount = await nodemailer.createTestAccount();
    } catch {
      cachedTestAccount = {
        user: "sandbox@marketsenegal.local",
        pass: "sandbox-pass",
        smtp: { host: "smtp.ethereal.email", port: 587, secure: false },
        imap: { host: "imap.ethereal.email", port: 993, secure: true },
        pop3: { host: "pop3.ethereal.email", port: 995, secure: true },
        web: "https://ethereal.email"
      };
    }
  }
  const transporter = nodemailer.createTransport({
    host: cachedTestAccount.smtp.host,
    port: cachedTestAccount.smtp.port,
    secure: cachedTestAccount.smtp.secure,
    auth: {
      user: cachedTestAccount.user,
      pass: cachedTestAccount.pass
    }
  });
  return { transporter, mode: "sandbox", from: config.from };
}
async function sendPasswordResetEmail(params) {
  const config = checkEmailConfig();
  if (config.mode === "production" && !config.configured) {
    const reason = `Fournisseur d'e-mails non configur\xE9 sur le serveur Cloud Run (variables manquantes : ${config.missingVars.join(", ")}). Les e-mails de r\xE9initialisation ne fonctionneront pas en production tant que le SMTP n'est pas renseign\xE9.`;
    console.warn(`[Email Service Production] ${reason}`);
    return {
      sent: false,
      configured: false,
      mode: "production",
      reason,
      missingVars: config.missingVars
    };
  }
  try {
    const { transporter, mode, from } = await getTransporter();
    const isHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #0f172a; margin: 0; font-size: 22px;">MARKET S\xC9N\xC9GAL</h2>
          <p style="color: #ea580c; font-size: 13px; font-weight: bold; margin: 4px 0 0 0;">Le grand march\xE9 en ligne du S\xE9n\xE9gal</p>
        </div>
        
        <div style="color: #334155; font-size: 14px; line-height: 1.6;">
          <p>Bonjour ${params.userName ? `<strong>${params.userName}</strong>` : ""},</p>
          <p>Une demande de r\xE9initialisation de mot de passe a \xE9t\xE9 initi\xE9e pour votre compte MARKET S\xC9N\xC9GAL.</p>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="${params.resetUrl}" style="background-color: #ea580c; color: #ffffff; padding: 14px 28px; text-decoration: none; font-weight: bold; font-size: 14px; border-radius: 12px; display: inline-block;">
              R\xE9initialiser mon mot de passe
            </a>
          </div>

          <p style="font-size: 12px; color: #64748b;">
            Ce lien est \xE0 <strong>usage unique</strong> et expirera automatiquement dans <strong>30 minutes</strong>.
          </p>
          <p style="font-size: 12px; color: #64748b;">
            Si vous n'\xEAtes pas \xE0 l'origine de cette demande, vous pouvez ignorer cet e-mail : votre mot de passe actuel reste inchang\xE9.
          </p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
          MARKET S\xC9N\xC9GAL \xB7 Plateforme e-commerce s\xE9curis\xE9e
        </p>
      </div>
    `;
    const info = await transporter.sendMail({
      from: `"MARKET S\xC9N\xC9GAL" <${from}>`,
      to: params.to,
      subject: "R\xE9initialisation s\xE9curis\xE9e de votre mot de passe - MARKET S\xC9N\xC9GAL",
      text: `Bonjour,

Pour r\xE9initialiser votre mot de passe MARKET S\xC9N\xC9GAL, rendez-vous sur le lien suivant (valable 30 minutes, usage unique) :
${params.resetUrl}

Si vous n'avez pas demand\xE9 cette r\xE9initialisation, veuillez ignorer ce message.`,
      html: isHtml
    });
    let previewUrl;
    if (mode === "sandbox") {
      const etherealUrl = nodemailer.getTestMessageUrl(info);
      if (etherealUrl) {
        previewUrl = etherealUrl;
        console.log(`[Email Sandbox] Aper\xE7u de l'e-mail captur\xE9 : ${previewUrl}`);
      }
    }
    return {
      sent: true,
      configured: true,
      mode,
      messageId: info.messageId,
      sandboxPreviewUrl: previewUrl
    };
  } catch (err) {
    console.error("[Email Service] \xC9chec d\u2019envoi e-mail SMTP:", err);
    return {
      sent: false,
      configured: true,
      mode: config.mode,
      reason: `Erreur d'envoi SMTP : ${err.message || "Impossible de joindre le serveur SMTP."}`
    };
  }
}

// server/storage.ts
import path3 from "node:path";
import fs3 from "node:fs";
import { fileURLToPath } from "node:url";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path3.dirname(__filename);
function checkStorageConfig() {
  const isProduction = process.env.NODE_ENV === "production";
  const provider = (process.env.STORAGE_PROVIDER || (isProduction ? "s3" : "local")).toLowerCase();
  if (isProduction && provider === "local") {
    return {
      provider: "local",
      configured: false,
      isProduction: true,
      error: "Le stockage local (STORAGE_PROVIDER=local) est interdit en production sur Cloud Run car le conteneur est \xE9ph\xE9m\xE8re. Configurez STORAGE_PROVIDER=s3 avec un bucket Cloudflare R2, Google Cloud Storage ou AWS S3."
    };
  }
  if (provider === "s3") {
    const bucket = process.env.S3_BUCKET_NAME;
    const accessKey = process.env.S3_ACCESS_KEY_ID;
    const secretKey = process.env.S3_SECRET_ACCESS_KEY;
    const endpoint = process.env.S3_ENDPOINT;
    const missing = [];
    if (!bucket) missing.push("S3_BUCKET_NAME");
    if (!accessKey) missing.push("S3_ACCESS_KEY_ID");
    if (!secretKey) missing.push("S3_SECRET_ACCESS_KEY");
    if (!endpoint) missing.push("S3_ENDPOINT");
    if (missing.length > 0) {
      return {
        provider: "s3",
        configured: false,
        isProduction,
        error: `Configuration S3 incompl\xE8te. Variables requises manquantes : ${missing.join(", ")}.`
      };
    }
    return {
      provider: "s3",
      configured: true,
      isProduction,
      bucket,
      endpoint
    };
  }
  return {
    provider: "local",
    configured: true,
    isProduction: false
  };
}
var cachedS3Client = null;
function getS3Client() {
  if (cachedS3Client) return cachedS3Client;
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION || "auto";
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  cachedS3Client = new S3Client({
    region,
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey
    },
    // Force path style for Cloudflare R2 / MinIO / GCS compatibility
    forcePathStyle: true
  });
  return cachedS3Client;
}
async function storeFile(file) {
  const status = checkStorageConfig();
  if (!status.configured) {
    throw new Error(status.error || "Erreur de configuration du stockage de fichiers.");
  }
  const ext = path3.extname(file.originalname).toLowerCase() || ".jpg";
  const cleanBase = path3.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, "");
  const filename = `market_sn_${Date.now()}_${cleanBase || "upload"}${ext}`;
  if (status.provider === "s3") {
    const s3 = getS3Client();
    const bucket = process.env.S3_BUCKET_NAME;
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `uploads/${filename}`,
        Body: file.buffer,
        ContentType: file.mimetype
      })
    );
    let publicUrl;
    if (process.env.S3_PUBLIC_DOMAIN) {
      publicUrl = `${process.env.S3_PUBLIC_DOMAIN.replace(/\/+$/, "")}/uploads/${filename}`;
    } else {
      const endpoint = process.env.S3_ENDPOINT.replace(/\/+$/, "");
      publicUrl = `${endpoint}/${bucket}/uploads/${filename}`;
    }
    return {
      url: publicUrl,
      filename,
      provider: "s3"
    };
  }
  const uploadsDir = path3.resolve(process.cwd(), "public", "uploads");
  if (!fs3.existsSync(uploadsDir)) {
    fs3.mkdirSync(uploadsDir, { recursive: true });
  }
  const targetPath = path3.join(uploadsDir, filename);
  fs3.writeFileSync(targetPath, file.buffer);
  return {
    url: `/uploads/${filename}`,
    filename,
    provider: "local"
  };
}

// server/routes.ts
import { OAuth2Client } from "google-auth-library";
var apiRouter = express.Router();
var adminFailedAttempts = /* @__PURE__ */ new Map();
function checkAdminRateLimit(key) {
  const now = Date.now();
  const info = adminFailedAttempts.get(key);
  if (!info) return { allowed: true, remainingAttempts: 5 };
  if (info.lockedUntil && info.lockedUntil > now) {
    const remainingMinutes = Math.ceil((info.lockedUntil - now) / (60 * 1e3));
    return { allowed: false, remainingMinutes };
  }
  if (now - info.lastAttempt > 15 * 60 * 1e3) {
    adminFailedAttempts.delete(key);
    return { allowed: true, remainingAttempts: 5 };
  }
  if (info.count >= 5) {
    info.lockedUntil = now + 15 * 60 * 1e3;
    return { allowed: false, remainingMinutes: 15 };
  }
  return { allowed: true, remainingAttempts: 5 - info.count };
}
function recordAdminFailedAttempt(key) {
  const now = Date.now();
  const info = adminFailedAttempts.get(key) || { count: 0, lastAttempt: now };
  info.count += 1;
  info.lastAttempt = now;
  if (info.count >= 5) {
    info.lockedUntil = now + 15 * 60 * 1e3;
  }
  adminFailedAttempts.set(key, info);
}
function resetAdminFailedAttempts(key) {
  adminFailedAttempts.delete(key);
}
var upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  // 5 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/jpg", "application/pdf"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Format non support\xE9. Veuillez envoyer une image JPG, PNG, WEBP ou un document PDF."));
    }
  }
});
apiRouter.get("/storage/status", (_req, res) => {
  const status = checkStorageConfig();
  res.json(status);
});
apiRouter.post("/upload", requireAuth, upload.single("photo"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Aucun fichier photo ou justificatif fourni." });
  }
  try {
    const uploaded = await storeFile({
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype
    });
    res.json({
      success: true,
      url: uploaded.url,
      filename: uploaded.filename,
      provider: uploaded.provider
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Erreur lors de l\u2019enregistrement du fichier." });
  }
});
apiRouter.get("/auth/google/status", (_req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  res.json({
    configured: Boolean(clientId && clientSecret),
    clientId: clientId || void 0
  });
});
apiRouter.get("/auth/google/url", (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return res.status(400).json({
      configured: false,
      error: "Google OAuth n\u2019est pas configur\xE9 sur le serveur (variables GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET requises)."
    });
  }
  const appUrl = (process.env.APP_URL || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
  const redirectUri = `${appUrl}/api/auth/google/callback`;
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20email%20profile&access_type=offline&prompt=select_account`;
  res.json({
    configured: true,
    url,
    redirectUri
  });
});
apiRouter.get("/auth/google/callback", async (req, res) => {
  const { code, error } = req.query;
  const appUrl = (process.env.APP_URL || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
  if (error) {
    return res.redirect(`${appUrl}/?google_error=${encodeURIComponent(String(error))}`);
  }
  if (!code || typeof code !== "string") {
    return res.redirect(`${appUrl}/?google_error=Code_autorisation_manquant`);
  }
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return res.redirect(`${appUrl}/?google_error=Configuration_Google_manquante`);
  }
  try {
    const redirectUri = `${appUrl}/api/auth/google/callback`;
    const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    let googleEmail;
    let googleName;
    if (tokens.id_token) {
      const ticket = await oauth2Client.verifyIdToken({
        idToken: tokens.id_token,
        audience: clientId
      });
      const payload = ticket.getPayload();
      googleEmail = payload?.email;
      googleName = payload?.name;
    }
    if (!googleEmail && tokens.access_token) {
      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });
      const info = await userInfoRes.json();
      googleEmail = info.email;
      googleName = info.name;
    }
    if (!googleEmail) {
      return res.redirect(`${appUrl}/?google_error=Impossible_de_recuperer_adresse_email`);
    }
    const cleanEmail = googleEmail.toLowerCase().trim();
    let user = await db.getUserByEmail(cleanEmail);
    if (!user) {
      user = await db.createUser({
        email: cleanEmail,
        password_hash: "",
        // Utilisateur authentifié via OAuth Google
        full_name: googleName || "Client Google",
        role: "client"
      });
      await db.addAuditLog(user.id, "google_signup", "user", user.id, {
        email: cleanEmail,
        role: "client",
        provider: "google"
      });
    } else {
      await db.addAuditLog(user.id, "google_login", "user", user.id, {
        email: cleanEmail,
        provider: "google"
      });
    }
    const session = await db.createSession(user.id);
    res.redirect(`${appUrl}/?auth_token=${session.token}`);
  } catch (err) {
    console.error("[Google OAuth Error]", err);
    res.redirect(`${appUrl}/?google_error=${encodeURIComponent(err.message || "Erreur_echange_oauth")}`);
  }
});
apiRouter.post("/auth/google/verify-credential", async (req, res) => {
  try {
    const { credential } = req.body;
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!clientId) {
      return res.status(400).json({ error: "Google OAuth non configur\xE9 sur le serveur (GOOGLE_CLIENT_ID manquant)." });
    }
    if (!credential) {
      return res.status(400).json({ error: "Jeton d\u2019identification Google manquant." });
    }
    const oauth2Client = new OAuth2Client(clientId);
    const ticket = await oauth2Client.verifyIdToken({
      idToken: credential,
      audience: clientId
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({ error: "Jeton Google invalide ou e-mail introuvable." });
    }
    const cleanEmail = payload.email.toLowerCase().trim();
    let user = await db.getUserByEmail(cleanEmail);
    if (!user) {
      user = await db.createUser({
        email: cleanEmail,
        password_hash: "",
        full_name: payload.name || "Client Google",
        role: "client"
      });
      await db.addAuditLog(user.id, "google_signup", "user", user.id, {
        email: cleanEmail,
        role: "client",
        provider: "google"
      });
    }
    const session = await db.createSession(user.id);
    const { password_hash: _, ...safeUser } = user;
    const store = await db.getStoreByUserId(user.id);
    res.json({
      success: true,
      user: safeUser,
      store: store || null,
      token: session.token
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Erreur lors de la validation du compte Google." });
  }
});
apiRouter.post("/auth/register", async (req, res) => {
  try {
    const { email, password, full_name, phone } = req.body;
    if (!email || !password || !full_name) {
      return res.status(400).json({ error: "Veuillez remplir votre nom complet, email et mot de passe." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Le mot de passe doit contenir au moins 6 caract\xE8res." });
    }
    const existing = await db.getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: "Un compte avec cette adresse e-mail existe d\xE9j\xE0." });
    }
    const password_hash = hashPassword(password);
    const user = await db.createUser({
      email: email.trim().toLowerCase(),
      password_hash,
      full_name: full_name.trim(),
      phone: phone ? phone.trim() : void 0,
      role: "client"
    });
    const session = await db.createSession(user.id);
    const { password_hash: _, ...safeUser } = user;
    res.status(201).json({
      success: true,
      user: safeUser,
      token: session.token
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Erreur lors de l\u2019inscription." });
  }
});
apiRouter.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Veuillez renseigner votre email et mot de passe." });
    }
    const user = await db.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "Identifiants incorrects." });
    }
    const isValid = verifyPassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: "Identifiants incorrects." });
    }
    const session = await db.createSession(user.id);
    const { password_hash: _, ...safeUser } = user;
    const store = await db.getStoreByUserId(user.id);
    res.json({
      success: true,
      user: safeUser,
      store: store || null,
      token: session.token
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Erreur lors de la connexion." });
  }
});
apiRouter.get("/auth/me", requireAuth, async (req, res) => {
  const { password_hash: _, ...safeUser } = req.user;
  const store = await db.getStoreByUserId(req.user.id);
  res.json({ user: safeUser, store });
});
apiRouter.post("/auth/logout", async (req, res) => {
  if (req.sessionToken) {
    await db.deleteSession(req.sessionToken);
  }
  res.json({ success: true });
});
apiRouter.get("/auth/email-status", (_req, res) => {
  const status = checkEmailConfig();
  res.json({
    configured: status.configured,
    missingVars: status.missingVars,
    provider: status.provider
  });
});
apiRouter.post("/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ error: "Veuillez renseigner votre adresse e-mail." });
    }
    const cleanEmail = email.trim().toLowerCase();
    const emailConfig = checkEmailConfig();
    const user = await db.getUserByEmail(cleanEmail);
    let resetToken = null;
    let resetUrl = null;
    let emailSent = false;
    let sendFailureReason = null;
    if (user) {
      resetToken = await db.createPasswordResetToken(cleanEmail, user.role);
      const appUrl = (process.env.APP_URL || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
      resetUrl = `${appUrl}/?reset_token=${resetToken}`;
      if (emailConfig.configured) {
        const sendResult = await sendPasswordResetEmail({
          to: cleanEmail,
          resetUrl,
          token: resetToken,
          role: user.role,
          userName: user.full_name
        });
        emailSent = sendResult.sent;
        if (!sendResult.sent) {
          sendFailureReason = sendResult.reason || "\xC9chec de transmission SMTP";
        }
      }
    }
    if (!emailConfig.configured) {
      return res.json({
        success: true,
        email_configured: false,
        email_sent: false,
        missing_config: emailConfig.missingVars,
        message: "La proc\xE9dure de r\xE9initialisation a \xE9t\xE9 amorc\xE9e. Toutefois, le fournisseur d\u2019e-mails (SMTP) n\u2019est pas configur\xE9 sur le serveur (variables SMTP_HOST, SMTP_USER, SMTP_PASSWORD manquantes) : aucun e-mail n\u2019a pu \xEAtre exp\xE9di\xE9 et ce service ne fonctionnera pas en production tant que le SMTP n\u2019est pas configur\xE9.",
        dev_reset_token: resetToken || void 0,
        dev_reset_url: resetUrl || void 0
      });
    }
    return res.json({
      success: true,
      email_configured: true,
      email_sent: true,
      message: "Si cette adresse correspond \xE0 un compte actif sur la plateforme, les instructions s\xE9curis\xE9es de r\xE9initialisation ont \xE9t\xE9 transmises par e-mail."
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Erreur lors de la demande de r\xE9initialisation." });
  }
});
apiRouter.get("/auth/verify-reset-token", async (req, res) => {
  try {
    const token = req.query.token;
    if (!token) {
      return res.status(400).json({ valid: false, error: "Jeton manquant." });
    }
    const check = await db.checkPasswordResetToken(token);
    if (!check) {
      return res.status(400).json({
        valid: false,
        error: "Ce lien de r\xE9initialisation est invalide ou a expir\xE9 (dur\xE9e limite : 30 minutes)."
      });
    }
    res.json({
      valid: true
    });
  } catch (err) {
    res.status(500).json({ valid: false, error: err.message });
  }
});
apiRouter.post("/auth/reset-password", async (req, res) => {
  try {
    const { token, new_password, newPassword } = req.body;
    const passwordToSet = (new_password || newPassword || "").trim();
    if (!token) {
      return res.status(400).json({ error: "Jeton de r\xE9initialisation manquant." });
    }
    if (!passwordToSet || passwordToSet.length < 6) {
      return res.status(400).json({ error: "Le nouveau mot de passe doit comporter au moins 6 caract\xE8res." });
    }
    const newHash = hashPassword(passwordToSet);
    const updatedUser = await db.verifyAndConsumePasswordResetToken(token, newHash);
    if (!updatedUser) {
      return res.status(400).json({
        error: "Ce lien de r\xE9initialisation est invalide, a expir\xE9 ou a d\xE9j\xE0 \xE9t\xE9 utilis\xE9 (jeton \xE0 usage unique)."
      });
    }
    const session = await db.createSession(updatedUser.id);
    const { password_hash: _, ...safeUser } = updatedUser;
    const store = await db.getStoreByUserId(updatedUser.id);
    res.json({
      success: true,
      message: "Votre mot de passe a \xE9t\xE9 r\xE9initialis\xE9 avec succ\xE8s. Vous \xEAtes d\xE9sormais connect\xE9 avec vos nouveaux identifiants.",
      user: safeUser,
      store: store || null,
      token: session.token
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Erreur lors de la r\xE9initialisation du mot de passe." });
  }
});
apiRouter.post("/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "ip";
    const rateLimitKey = `${clientIp}_${(email || "").toLowerCase().trim()}`;
    const limitStatus = checkAdminRateLimit(rateLimitKey);
    if (!limitStatus.allowed) {
      return res.status(429).json({
        error: `Acc\xE8s temporairement suspendu suite \xE0 5 tentatives infructueuses. Veuillez patienter ${limitStatus.remainingMinutes} minute(s) avant de r\xE9essayer.`
      });
    }
    if (!email || !password) {
      return res.status(400).json({ error: "Veuillez saisir votre e-mail administrateur et votre mot de passe." });
    }
    const user = await db.getUserByEmail(email);
    if (!user || user.role !== "admin") {
      recordAdminFailedAttempt(rateLimitKey);
      const updatedLimit = checkAdminRateLimit(rateLimitKey);
      return res.status(401).json({
        error: "Identifiants administrateur non reconnus.",
        attemptsRemaining: updatedLimit.remainingAttempts
      });
    }
    const isValid = verifyPassword(password, user.password_hash);
    if (!isValid) {
      recordAdminFailedAttempt(rateLimitKey);
      const updatedLimit = checkAdminRateLimit(rateLimitKey);
      await db.addAuditLog(user.id, "admin_login_failed", "security", user.id, {
        ip: clientIp,
        attemptsRemaining: updatedLimit.remainingAttempts
      });
      return res.status(401).json({
        error: "Mot de passe administrateur incorrect.",
        attemptsRemaining: updatedLimit.remainingAttempts
      });
    }
    resetAdminFailedAttempts(rateLimitKey);
    const session = await db.createSession(user.id);
    const { password_hash: _, ...safeUser } = user;
    await db.addAuditLog(user.id, "admin_login_success", "security", user.id, {
      ip: clientIp
    });
    res.json({
      success: true,
      user: safeUser,
      token: session.token,
      must_change_password: Boolean(user.must_change_password)
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Erreur lors de la connexion administrateur." });
  }
});
apiRouter.post("/admin/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Veuillez saisir votre adresse e-mail d\u2019administration." });
    }
    const cleanEmail = email.trim().toLowerCase();
    const user = await db.getUserByEmail(cleanEmail);
    const emailConfig = checkEmailConfig();
    let resetToken = null;
    let resetUrl = null;
    let emailSent = false;
    let sendFailureReason = null;
    if (user && user.role === "admin") {
      resetToken = await db.createPasswordResetToken(cleanEmail, "admin");
      const appUrl = (process.env.APP_URL || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
      resetUrl = `${appUrl}/admin/login?reset_token=${resetToken}`;
      console.log(`[S\xE9curit\xE9 Admin] Jeton de r\xE9cup\xE9ration g\xE9n\xE9r\xE9 pour ${cleanEmail} : ${resetToken}`);
      if (emailConfig.configured) {
        const sendResult = await sendPasswordResetEmail({
          to: cleanEmail,
          resetUrl,
          token: resetToken,
          role: "admin",
          userName: user.full_name
        });
        emailSent = sendResult.sent;
        if (!sendResult.sent) {
          sendFailureReason = sendResult.reason || "\xC9chec d\u2019envoi SMTP";
        }
      }
    }
    if (!emailConfig.configured) {
      return res.json({
        success: true,
        email_configured: false,
        email_sent: false,
        missing_config: emailConfig.missingVars,
        message: "La proc\xE9dure a \xE9t\xE9 initi\xE9e. Le serveur SMTP d\u2019e-mails n\u2019\xE9tant pas configur\xE9 sur ce serveur (variables SMTP_HOST, SMTP_USER, SMTP_PASSWORD manquantes), aucun e-mail n\u2019a \xE9t\xE9 exp\xE9di\xE9. En production, les e-mails ne fonctionneront pas tant que le SMTP n\u2019est pas configur\xE9.",
        recovery_token: resetToken || void 0,
        dev_reset_url: resetUrl || void 0
      });
    }
    return res.json({
      success: true,
      email_configured: true,
      email_sent: true,
      message: "Si les informations saisies correspondent \xE0 un compte d\u2019administration valide, un lien s\xE9curis\xE9 de r\xE9initialisation a \xE9t\xE9 transmis par e-mail."
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.post("/admin/reset-password", async (req, res) => {
  try {
    const { token, new_password } = req.body;
    if (!token || !new_password) {
      return res.status(400).json({ error: "Jeton de r\xE9cup\xE9ration et nouveau mot de passe requis." });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ error: "Le mot de passe administrateur doit comporter au moins 8 caract\xE8res." });
    }
    const newHash = hashPassword(new_password);
    const updatedUser = await db.verifyAndConsumePasswordResetToken(token, newHash);
    if (!updatedUser) {
      return res.status(400).json({ error: "Jeton de s\xE9curit\xE9 invalide ou expir\xE9." });
    }
    res.json({
      success: true,
      message: "Votre mot de passe administrateur a \xE9t\xE9 mis \xE0 jour avec succ\xE8s. Vous pouvez d\xE9sormais vous connecter."
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.post("/admin/first-login-password", requireAdmin, async (req, res) => {
  try {
    const { new_password, newPassword } = req.body;
    const passwordToSet = (new_password || newPassword || "").trim();
    if (!passwordToSet || passwordToSet.length < 8) {
      return res.status(400).json({ error: "Le nouveau mot de passe doit comporter au moins 8 caract\xE8res." });
    }
    const newHash = hashPassword(passwordToSet);
    const updated = await db.updateUserPassword(req.user.id, newHash, false);
    if (!updated) {
      return res.status(404).json({ error: "Administrateur introuvable." });
    }
    if (req.sessionToken) {
      await db.invalidateOtherSessions(req.user.id, req.sessionToken);
    }
    await db.addAuditLog(req.user.id, "admin_first_login_password_set", "security", req.user.id, {
      email: req.user.email
    });
    const { password_hash: _, ...safeUser } = updated;
    res.json({
      success: true,
      message: "Votre mot de passe administrateur personnel a \xE9t\xE9 configur\xE9 avec succ\xE8s.",
      user: safeUser
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Erreur lors de la configuration du mot de passe." });
  }
});
apiRouter.post("/admin/change-password", requireAdmin, async (req, res) => {
  try {
    const { current_password, currentPassword, new_password, newPassword } = req.body;
    const currentPass = (current_password || currentPassword || "").trim();
    const newPass = (new_password || newPassword || "").trim();
    if (!currentPass) {
      return res.status(400).json({ error: "Veuillez saisir votre mot de passe actuel." });
    }
    if (!newPass || newPass.length < 8) {
      return res.status(400).json({ error: "Le nouveau mot de passe doit comporter au moins 8 caract\xE8res." });
    }
    if (currentPass === newPass) {
      return res.status(400).json({ error: "Le nouveau mot de passe doit \xEAtre diff\xE9rent de l\u2019actuel." });
    }
    const isValid = verifyPassword(currentPass, req.user.password_hash);
    if (!isValid) {
      await db.addAuditLog(req.user.id, "admin_password_change_failed", "security", req.user.id, {
        reason: "wrong_current_password"
      });
      return res.status(401).json({ error: "Le mot de passe actuel est incorrect." });
    }
    const newHash = hashPassword(newPass);
    const updated = await db.updateUserPassword(req.user.id, newHash, false);
    if (!updated) {
      return res.status(404).json({ error: "Administrateur introuvable." });
    }
    const otherSessionsTerminated = req.sessionToken ? await db.invalidateOtherSessions(req.user.id, req.sessionToken) : 0;
    await db.addAuditLog(req.user.id, "admin_password_changed", "security", req.user.id, {
      otherSessionsTerminated
    });
    const { password_hash: _, ...safeUser } = updated;
    res.json({
      success: true,
      message: "Votre mot de passe a \xE9t\xE9 modifi\xE9 avec succ\xE8s. Toutes vos autres sessions actives ont \xE9t\xE9 invalid\xE9es pour prot\xE9ger votre compte.",
      otherSessionsTerminated,
      user: safeUser
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Erreur lors du changement de mot de passe." });
  }
});
apiRouter.put("/auth/profile", requireAuth, async (req, res) => {
  try {
    const { full_name, phone } = req.body;
    const updated = await db.updateUserProfile(req.user.id, { full_name, phone });
    if (!updated) return res.status(404).json({ error: "Utilisateur introuvable." });
    const { password_hash: _, ...safeUser } = updated;
    res.json({ success: true, user: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.get("/stores", async (_req, res) => {
  try {
    const stores = await db.listPublicStores();
    res.json({ stores });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.get("/stores/:slugOrId", async (req, res) => {
  try {
    const { slugOrId } = req.params;
    let store = await db.getStoreBySlug(slugOrId);
    if (!store) {
      store = await db.getStoreById(slugOrId);
    }
    if (!store) {
      return res.status(404).json({ error: "Boutique introuvable." });
    }
    if (store.is_suspended) {
      return res.status(403).json({ error: "Cette boutique est temporairement suspendue par la mod\xE9ration." });
    }
    const categories = await db.getStoreCategories(store.id);
    const deliveryZones = await db.getDeliveryZones(store.id);
    const productsRes = await db.listPublicProducts({ storeId: store.id });
    res.json({
      store,
      categories,
      deliveryZones,
      products: productsRes.products
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.post("/stores", requireAuth, async (req, res) => {
  try {
    const existing = await db.getStoreByUserId(req.user.id);
    if (existing) {
      return res.status(400).json({ error: "Vous poss\xE9dez d\xE9j\xE0 une boutique enregistr\xE9e sur Market S\xE9n\xE9gal." });
    }
    const { name, description, phone, address, city, logo_url, banner_url, allows_cod } = req.body;
    if (!name || !phone || !address) {
      return res.status(400).json({ error: "Le nom de la boutique, le t\xE9l\xE9phone et l\u2019adresse sont obligatoires." });
    }
    const baseSlug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const slug = `${baseSlug}-${Math.floor(100 + Math.random() * 900)}`;
    const store = await db.createStore({
      user_id: req.user.id,
      name: name.trim(),
      slug,
      description: description ? description.trim() : "",
      phone: phone.trim(),
      address: address.trim(),
      city: city ? city.trim() : "Dakar",
      logo_url,
      banner_url,
      plan_tier: "essentiel",
      // Plan par défaut
      allows_cod: allows_cod !== false
    });
    res.status(201).json({ success: true, store });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.put("/vendor/store", requireSeller, async (req, res) => {
  try {
    const store = await db.getStoreByUserId(req.user.id);
    if (!store) return res.status(404).json({ error: "Boutique introuvable." });
    const { name, description, phone, address, city, logo_url, banner_url, allows_cod } = req.body;
    const updated = await db.updateStore(store.id, {
      name,
      description,
      phone,
      address,
      city,
      logo_url,
      banner_url,
      allows_cod
    });
    res.json({ success: true, store: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.get("/vendor/my-store", requireSeller, async (req, res) => {
  try {
    const store = await db.getStoreByUserId(req.user.id);
    if (!store) return res.status(404).json({ error: "Aucune boutique associ\xE9e." });
    const zones = await db.getDeliveryZones(store.id);
    const categories = await db.getStoreCategories(store.id);
    const coupons = await db.getStoreCoupons(store.id);
    res.json({ store, zones, categories, coupons });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.get("/vendor/categories", requireSeller, async (req, res) => {
  const store = await db.getStoreByUserId(req.user.id);
  if (!store) return res.status(404).json({ error: "Boutique introuvable." });
  const categories = await db.getStoreCategories(store.id);
  res.json({ categories });
});
apiRouter.post("/vendor/categories", requireSeller, async (req, res) => {
  const store = await db.getStoreByUserId(req.user.id);
  if (!store) return res.status(404).json({ error: "Boutique introuvable." });
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Nom de cat\xE9gorie obligatoire." });
  const category = await db.createStoreCategory(store.id, name);
  res.status(201).json({ success: true, category });
});
apiRouter.delete("/vendor/categories/:id", requireSeller, async (req, res) => {
  const store = await db.getStoreByUserId(req.user.id);
  if (!store) return res.status(404).json({ error: "Boutique introuvable." });
  const success = await db.deleteStoreCategory(req.params.id, store.id);
  res.json({ success });
});
apiRouter.get("/vendor/delivery-zones", requireSeller, async (req, res) => {
  const store = await db.getStoreByUserId(req.user.id);
  if (!store) return res.status(404).json({ error: "Boutique introuvable." });
  const zones = await db.getDeliveryZones(store.id);
  res.json({ zones });
});
apiRouter.post("/vendor/delivery-zones", requireSeller, async (req, res) => {
  const store = await db.getStoreByUserId(req.user.id);
  if (!store) return res.status(404).json({ error: "Boutique introuvable." });
  const { region, price_fcfa, estimated_days } = req.body;
  if (!region || price_fcfa === void 0) {
    return res.status(400).json({ error: "La r\xE9gion et le tarif en FCFA sont obligatoires." });
  }
  const zone = await db.createDeliveryZone({
    store_id: store.id,
    region,
    price_fcfa: Number(price_fcfa),
    estimated_days: estimated_days || "24-48h"
  });
  res.status(201).json({ success: true, zone });
});
apiRouter.delete("/vendor/delivery-zones/:id", requireSeller, async (req, res) => {
  const store = await db.getStoreByUserId(req.user.id);
  if (!store) return res.status(404).json({ error: "Boutique introuvable." });
  const success = await db.deleteDeliveryZone(req.params.id, store.id);
  res.json({ success });
});
apiRouter.get("/products", async (req, res) => {
  try {
    const { search, storeId, categoryId, region, minPrice, maxPrice, sort } = req.query;
    const result = await db.listPublicProducts({
      search,
      storeId,
      categoryId,
      region,
      minPrice: minPrice ? Number(minPrice) : void 0,
      maxPrice: maxPrice ? Number(maxPrice) : void 0,
      sort
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.get("/products/:id", async (req, res) => {
  try {
    const product = await db.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Produit introuvable." });
    }
    if (product.store.is_suspended) {
      return res.status(403).json({ error: "Ce produit n\u2019est plus disponible." });
    }
    const deliveryZones = await db.getDeliveryZones(product.store_id);
    res.json({ product, deliveryZones });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.get("/vendor/products", requireSeller, async (req, res) => {
  const store = await db.getStoreByUserId(req.user.id);
  if (!store) return res.status(404).json({ error: "Boutique introuvable." });
  const products = await db.listStoreProducts(store.id);
  res.json({ products });
});
apiRouter.post("/vendor/products", requireSeller, async (req, res) => {
  try {
    const store = await db.getStoreByUserId(req.user.id);
    if (!store) return res.status(404).json({ error: "Boutique introuvable." });
    const { name, description, price_fcfa, compare_price_fcfa, stock_quantity, images, ai_images, category_id, is_active } = req.body;
    if (!name || !description || !price_fcfa) {
      return res.status(400).json({ error: "Nom, description et prix sont obligatoires." });
    }
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: "Une photo r\xE9elle du produit est obligatoirement requise comme r\xE9f\xE9rence principale." });
    }
    const product = await db.createProduct({
      store_id: store.id,
      category_id: category_id || void 0,
      name: name.trim(),
      description: description.trim(),
      price_fcfa: Number(price_fcfa),
      compare_price_fcfa: compare_price_fcfa ? Number(compare_price_fcfa) : void 0,
      stock_quantity: Number(stock_quantity || 0),
      images,
      ai_images: Array.isArray(ai_images) ? ai_images : [],
      is_active: is_active !== false
    });
    res.status(201).json({ success: true, product });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.put("/vendor/products/:id", requireSeller, async (req, res) => {
  try {
    const store = await db.getStoreByUserId(req.user.id);
    if (!store) return res.status(404).json({ error: "Boutique introuvable." });
    if (req.body.images && (!Array.isArray(req.body.images) || req.body.images.length === 0)) {
      return res.status(400).json({ error: "La photo r\xE9elle principale du produit ne peut pas \xEAtre supprim\xE9e." });
    }
    const updated = await db.updateProduct(req.params.id, store.id, req.body);
    if (!updated) return res.status(404).json({ error: "Produit introuvable." });
    res.json({ success: true, product: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.delete("/vendor/products/:id", requireSeller, async (req, res) => {
  const store = await db.getStoreByUserId(req.user.id);
  if (!store) return res.status(404).json({ error: "Boutique introuvable." });
  const success = await db.deleteProduct(req.params.id, store.id);
  res.json({ success });
});
apiRouter.get("/vendor/coupons", requireSeller, async (req, res) => {
  const store = await db.getStoreByUserId(req.user.id);
  if (!store) return res.status(404).json({ error: "Boutique introuvable." });
  if (store.plan_tier !== "croissance") {
    return res.status(403).json({
      error: "La cr\xE9ation de codes promo n\xE9cessite le forfait Croissance (18 000 FCFA / mois)."
    });
  }
  const coupons = await db.getStoreCoupons(store.id);
  res.json({ coupons });
});
apiRouter.post("/vendor/coupons", requireSeller, async (req, res) => {
  const store = await db.getStoreByUserId(req.user.id);
  if (!store) return res.status(404).json({ error: "Boutique introuvable." });
  if (store.plan_tier !== "croissance") {
    return res.status(403).json({
      error: "La cr\xE9ation de codes promo n\xE9cessite le forfait Croissance (18 000 FCFA / mois)."
    });
  }
  const { code, discount_percent, discount_amount_fcfa, min_order_amount_fcfa, expires_at } = req.body;
  if (!code) return res.status(400).json({ error: "Code promo requis." });
  const coupon = await db.createCoupon(store.id, {
    code,
    discount_percent: discount_percent ? Number(discount_percent) : void 0,
    discount_amount_fcfa: discount_amount_fcfa ? Number(discount_amount_fcfa) : void 0,
    min_order_amount_fcfa: Number(min_order_amount_fcfa || 0),
    is_active: true,
    expires_at
  });
  res.status(201).json({ success: true, coupon });
});
apiRouter.post("/cart/quote", async (req, res) => {
  try {
    const { items, deliveryRegion } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.json({ groups: [], totalItems: 0, grandTotal: 0 });
    }
    const storeMap = /* @__PURE__ */ new Map();
    for (const it of items) {
      const p = await db.getProductById(it.productId);
      if (!p) continue;
      if (!storeMap.has(p.store_id)) {
        storeMap.set(p.store_id, []);
      }
      storeMap.get(p.store_id).push(it);
    }
    const groups = [];
    let grandTotal = 0;
    for (const [storeId, storeItems] of storeMap.entries()) {
      const store = await db.getStoreById(storeId);
      if (!store || store.is_suspended) continue;
      const zones = await db.getDeliveryZones(storeId);
      const matchedZone = deliveryRegion ? zones.find((z) => z.region.toLowerCase() === deliveryRegion.toLowerCase()) : void 0;
      let subtotal = 0;
      const parsedItems = [];
      for (const it of storeItems) {
        const prod = await db.getProductById(it.productId);
        if (!prod) continue;
        const lineTotal = prod.price_fcfa * it.quantity;
        subtotal += lineTotal;
        parsedItems.push({
          productId: prod.id,
          name: prod.name,
          image: prod.images[0] || "",
          unitPrice: prod.price_fcfa,
          quantity: it.quantity,
          lineTotal,
          stock: prod.stock_quantity
        });
      }
      const deliveryFee = matchedZone ? matchedZone.price_fcfa : 0;
      const storeTotal = subtotal + deliveryFee;
      grandTotal += storeTotal;
      groups.push({
        storeId: store.id,
        storeName: store.name,
        storeSlug: store.slug,
        storeCity: store.city,
        allowsCod: store.allows_cod,
        isDeliveringToRegion: Boolean(matchedZone),
        deliveryFee,
        deliveryTime: matchedZone ? matchedZone.estimated_days : "Non desservi",
        availableZones: zones.map((z) => z.region),
        subtotal,
        storeTotal,
        items: parsedItems
      });
    }
    res.json({
      groups,
      grandTotal,
      supportedPaymentMethods: paymentGateway.getAvailableMethods(true)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.post("/orders", requireAuth, async (req, res) => {
  try {
    const {
      customerName,
      customerPhone,
      deliveryRegion,
      deliveryAddress,
      deliveryNotes,
      paymentMethod,
      storeOrders
    } = req.body;
    if (!customerName || !customerPhone || !deliveryRegion || !deliveryAddress) {
      return res.status(400).json({
        error: "Nom, t\xE9l\xE9phone, r\xE9gion et adresse de livraison compl\xE8te sont requis."
      });
    }
    if (!storeOrders || !Array.isArray(storeOrders) || storeOrders.length === 0) {
      return res.status(400).json({ error: "Le panier de commande est vide." });
    }
    if (paymentMethod === "wave" || paymentMethod === "orange_money") {
      return res.status(400).json({
        error: "Les paiements Wave et Orange Money des commandes clients n\xE9cessitent une future int\xE9gration API dynamique (le montant varie selon le panier). Le paiement en ligne n\u2019est pas encore disponible pour les commandes. N\u2019utilisez pas les liens de paiement professionnels des vendeurs."
      });
    }
    if (paymentMethod === "paiement_livraison") {
      for (const group of storeOrders) {
        const store = await db.getStoreById(group.storeId);
        if (store && store.allows_cod === false) {
          return res.status(400).json({
            error: `La boutique "${store.name}" n\u2019a pas activ\xE9 le paiement \xE0 la livraison. Aucun moyen de paiement disponible pour cette commande.`
          });
        }
      }
    } else {
      return res.status(400).json({
        error: "Moyen de paiement non configur\xE9 pour les commandes clients."
      });
    }
    const created = await db.createOrderGroup({
      customerId: req.user.id,
      customerName,
      customerPhone,
      deliveryRegion,
      deliveryAddress,
      deliveryNotes,
      paymentMethod,
      storeOrders
    });
    res.status(201).json({
      success: true,
      orders: created,
      message: `Votre commande a \xE9t\xE9 transmise aux vendeurs avec succ\xE8s.`
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
apiRouter.get("/customer/orders", requireAuth, async (req, res) => {
  try {
    const orders = await db.getCustomerOrders(req.user.id);
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.get("/vendor/orders", requireSeller, async (req, res) => {
  try {
    const store = await db.getStoreByUserId(req.user.id);
    if (!store) return res.status(404).json({ error: "Boutique introuvable." });
    const orders = await db.getStoreOrders(store.id);
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.put("/vendor/orders/:id/status", requireSeller, async (req, res) => {
  try {
    const store = await db.getStoreByUserId(req.user.id);
    if (!store) return res.status(404).json({ error: "Boutique introuvable." });
    const { status } = req.body;
    const allowed = ["confirmee", "en_livraison", "livree", "annulee"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: "Statut de commande invalide." });
    }
    const order = await db.updateOrderStatus(req.params.id, store.id, status);
    if (!order) return res.status(404).json({ error: "Commande introuvable." });
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.get("/vendor/orders/export-csv", requireSeller, async (req, res) => {
  try {
    const store = await db.getStoreByUserId(req.user.id);
    if (!store) return res.status(404).json({ error: "Boutique introuvable." });
    if (store.plan_tier !== "croissance") {
      return res.status(403).json({
        error: "L\u2019export CSV des commandes est une fonctionnalit\xE9 r\xE9serv\xE9e au forfait Croissance."
      });
    }
    const orders = await db.getStoreOrders(store.id);
    const headers = "Num\xE9ro;Date;Client;T\xE9l\xE9phone;R\xE9gion;Adresse;Articles;Total FCFA;Mode Paiement;Statut\n";
    const rows = orders.map((o) => {
      const itemsStr = o.items.map((i) => `${i.product_name} (x${i.quantity})`).join(" | ");
      return `"${o.order_number}";"${o.created_at}";"${o.customer_name}";"${o.customer_phone}";"${o.delivery_region}";"${o.delivery_address.replace(/"/g, '""')}";"${itemsStr}";${o.total_fcfa};"${o.payment_method}";"${o.status}"`;
    }).join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="commandes_${store.slug}_${Date.now()}.csv"`);
    res.send("\uFEFF" + headers + rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.get("/conversations", requireAuth, async (req, res) => {
  try {
    const convs = await db.listUserConversations(req.user.id, req.user.role);
    res.json({ conversations: convs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.get("/conversations/unread-count", requireAuth, async (req, res) => {
  try {
    const convs = await db.listUserConversations(req.user.id, req.user.role);
    const unreadCount = convs.reduce((sum, c) => sum + (Number(c.unread_count) || 0), 0);
    res.json({ unread_count: unreadCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.post("/conversations/start", requireAuth, async (req, res) => {
  try {
    const { storeId } = req.body;
    if (!storeId) return res.status(400).json({ error: "ID de la boutique requis." });
    const store = await db.getStoreById(storeId);
    if (!store) return res.status(404).json({ error: "Boutique introuvable." });
    if (store.user_id === req.user.id) {
      return res.status(400).json({ error: "Vous ne pouvez pas engager une conversation avec vous-m\xEAme." });
    }
    const conversation = await db.getOrCreateConversation(storeId, req.user.id);
    res.json({ success: true, conversation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.get("/conversations/:id/messages", requireAuth, async (req, res) => {
  try {
    const messages = await db.getConversationMessages(req.params.id, req.user.id);
    res.json({ messages });
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
});
apiRouter.post("/conversations/:id/messages", requireAuth, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Le message ne peut pas \xEAtre vide." });
    }
    const message = await db.sendMessage(req.params.id, req.user.id, content);
    res.status(201).json({ success: true, message });
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
});
apiRouter.get("/vendor/subscriptions", requireSeller, async (req, res) => {
  try {
    const store = await db.getStoreByUserId(req.user.id);
    if (!store) return res.status(404).json({ error: "Boutique introuvable." });
    const subscriptions = await db.getStoreSubscriptions(store.id);
    const pendingSubscription = subscriptions.find((s) => s.status === "paiement_a_verifier" || s.status === "en_attente") || null;
    res.json({ subscriptions, pendingSubscription, store });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.get("/vendor/pro-payments", requireSeller, async (req, res) => {
  try {
    const store = await db.getStoreByUserId(req.user.id);
    if (!store) return res.status(404).json({ error: "Boutique introuvable." });
    const data = await db.getVendorProPayments(store.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.post("/vendor/subscriptions/request", requireSeller, async (req, res) => {
  try {
    const store = await db.getStoreByUserId(req.user.id);
    if (!store) return res.status(404).json({ error: "Boutique introuvable." });
    const { planTier, offlineReference, proofDocumentUrl, notes } = req.body;
    if (planTier !== "essentiel" && planTier !== "croissance") {
      return res.status(400).json({ error: "Forfait invalide (Essentiel ou Croissance)." });
    }
    if (planTier === "croissance") {
      return res.status(400).json({
        error: "Le moyen de paiement pour le forfait Croissance (18 000 FCFA) n\u2019est pas configur\xE9. N\u2019utilisez pas le lien Essentiel. Veuillez contacter l\u2019administration."
      });
    }
    const ref = (offlineReference || "").trim();
    if (!ref && !proofDocumentUrl) {
      return res.status(400).json({
        error: "Veuillez saisir votre r\xE9f\xE9rence de transaction Wave ou t\xE9l\xE9verser un justificatif de paiement."
      });
    }
    if (ref && db.isPaymentReferenceUsed(ref)) {
      return res.status(400).json({
        error: "Cette r\xE9f\xE9rence de paiement Wave a d\xE9j\xE0 \xE9t\xE9 enregistr\xE9e pour une autre transaction. Pour \xE9viter tout paiement en double, veuillez v\xE9rifier votre re\xE7u Wave."
      });
    }
    const sub = await db.createSubscriptionRequest(
      store.id,
      planTier,
      ref,
      proofDocumentUrl,
      notes
    );
    res.status(201).json({
      success: true,
      subscription: sub,
      message: "Demande enregistr\xE9e au statut \xAB Paiement \xE0 v\xE9rifier \xBB. L\u2019administrateur v\xE9rifiera l\u2019encaissement r\xE9el avant d\u2019activer le forfait pour un mois."
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.get("/vendor/stats", requireSeller, async (req, res) => {
  try {
    const store = await db.getStoreByUserId(req.user.id);
    if (!store) return res.status(404).json({ error: "Boutique introuvable." });
    const orders = await db.getStoreOrders(store.id);
    const validOrders = orders.filter((o) => o.status !== "annulee");
    const totalRevenue = validOrders.reduce((sum, o) => sum + o.subtotal_fcfa, 0);
    const isCroissance = store.plan_tier === "croissance";
    res.json({
      planTier: store.plan_tier,
      isCroissance,
      totalOrders: orders.length,
      deliveredOrders: orders.filter((o) => o.status === "livree").length,
      totalRevenueFcfa: totalRevenue,
      // Advanced analytics for Croissance tier
      recentSalesBreakdown: isCroissance ? validOrders.slice(0, 10).map((o) => ({
        orderNumber: o.order_number,
        date: o.created_at,
        amount: o.total_fcfa,
        region: o.delivery_region
      })) : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.get("/reviews", async (_req, res) => {
  try {
    const reviews = await db.listApprovedPlatformReviews();
    res.json({ reviews });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.post("/reviews", requireAuth, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || !comment) {
      return res.status(400).json({ error: "La note (1 \xE0 5) et un commentaire sont requis." });
    }
    const review = await db.createPlatformReview(req.user.id, rating, comment);
    res.status(201).json({ success: true, review });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.get("/admin/stats", requireAdmin, async (_req, res) => {
  try {
    const stats = await db.getAdminStats();
    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.get("/admin/users", requireAdmin, async (_req, res) => {
  try {
    const users = await db.listUsers();
    const safeUsers = users.map(({ password_hash: _, ...u }) => u);
    res.json({ users: safeUsers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.get("/admin/stores", requireAdmin, async (_req, res) => {
  try {
    const stores = await db.listAllStoresForAdmin();
    res.json({ stores });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.post("/admin/stores/:id/suspend", requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: "Le motif de suspension est obligatoire." });
    const store = await db.suspendStore(req.params.id, req.user.id, reason);
    if (!store) return res.status(404).json({ error: "Boutique introuvable." });
    await db.addAuditLog(req.user.id, "suspend_store", "store", store.id, {
      store_name: store.name,
      reason
    });
    res.json({ success: true, store });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.post("/admin/stores/:id/reactivate", requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    const store = await db.reactivateStore(req.params.id, req.user.id, reason || "R\xE9activation administrative");
    if (!store) return res.status(404).json({ error: "Boutique introuvable." });
    await db.addAuditLog(req.user.id, "reactivate_store", "store", store.id, {
      store_name: store.name,
      reason
    });
    res.json({ success: true, store });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.get("/admin/stores/:id/suspension-history", requireAdmin, async (req, res) => {
  try {
    const history = await db.getStoreSuspensionHistory(req.params.id);
    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.get("/admin/subscriptions", requireAdmin, async (_req, res) => {
  try {
    const subscriptions = await db.listSubscriptions();
    res.json({ subscriptions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.post("/admin/subscriptions/:id/validate", requireAdmin, async (req, res) => {
  try {
    const { paymentReference } = req.body;
    if (!paymentReference) {
      return res.status(400).json({ error: "R\xE9f\xE9rence du paiement hors-plateforme requise." });
    }
    const sub = await db.validateSubscriptionOffline(req.params.id, req.user.id, paymentReference);
    if (!sub) return res.status(404).json({ error: "Abonnement introuvable." });
    res.json({ success: true, subscription: sub });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.get("/admin/reviews", requireAdmin, async (_req, res) => {
  try {
    const reviews = await db.listAllPlatformReviewsForAdmin();
    res.json({ reviews });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.put("/admin/reviews/:id/approve", requireAdmin, async (req, res) => {
  try {
    const { isApproved } = req.body;
    const review = await db.toggleReviewApproval(req.params.id, Boolean(isApproved));
    if (!review) return res.status(404).json({ error: "Avis introuvable." });
    await db.addAuditLog(req.user.id, "moderate_review", "platform_review", review.id, {
      isApproved
    });
    res.json({ success: true, review });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.get("/admin/audit-logs", requireAdmin, async (_req, res) => {
  try {
    const logs = await db.listAuditLogs();
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.get("/admin/orders", requireAdmin, async (_req, res) => {
  try {
    const orders = await db.listAllOrdersForAdmin();
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.get("/vendor/certification", requireSeller, async (req, res) => {
  try {
    const store = await db.getStoreByUserId(req.user.id);
    if (!store) return res.status(404).json({ error: "Boutique introuvable." });
    const currentCert = await db.getStoreCertification(store.id);
    const history = await db.getStoreCertificationHistory(store.id);
    res.json({
      store,
      currentCert,
      history
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.post("/vendor/certification/request", requireSeller, async (req, res) => {
  try {
    const store = await db.getStoreByUserId(req.user.id);
    if (!store) return res.status(404).json({ error: "Boutique introuvable." });
    const { wavePaymentReference, proofDocumentUrl, vendorNotes } = req.body;
    const ref = (wavePaymentReference || "").trim();
    if (!ref) {
      return res.status(400).json({
        error: "Veuillez saisir la r\xE9f\xE9rence de la transaction Wave (10 000 FCFA) pour permettre sa v\xE9rification."
      });
    }
    if (db.isPaymentReferenceUsed(ref)) {
      return res.status(400).json({
        error: "Cette r\xE9f\xE9rence de paiement Wave a d\xE9j\xE0 \xE9t\xE9 enregistr\xE9e sur la plateforme pour une autre transaction. Pour \xE9viter tout paiement en double, veuillez v\xE9rifier votre re\xE7u Wave."
      });
    }
    const cert = await db.submitCertificationRequest({
      storeId: store.id,
      wavePaymentReference: ref,
      proofDocumentUrl: proofDocumentUrl || void 0,
      vendorNotes: vendorNotes || void 0
    });
    const updatedStore = await db.getStoreById(store.id);
    res.status(201).json({
      success: true,
      certification: cert,
      store: updatedStore,
      message: "Demande de certification transmise. Statut : Paiement \xE0 v\xE9rifier par l\u2019administrateur."
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.get("/admin/certifications", requireAdmin, async (_req, res) => {
  try {
    const certifications = await db.listAllCertificationsForAdmin();
    res.json({ certifications });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.post("/admin/certifications/:id/approve", requireAdmin, async (req, res) => {
  try {
    const { verifiedPaymentReference, adminNotes } = req.body;
    if (!verifiedPaymentReference || !verifiedPaymentReference.trim()) {
      return res.status(400).json({
        error: "La r\xE9f\xE9rence v\xE9rifi\xE9e du paiement Wave (10 000 FCFA) est obligatoire."
      });
    }
    const cert = await db.approveCertification(
      req.params.id,
      req.user.id,
      verifiedPaymentReference.trim(),
      adminNotes
    );
    if (!cert) return res.status(404).json({ error: "Demande de certification introuvable." });
    res.json({ success: true, certification: cert, message: "Boutique certifi\xE9e avec succ\xE8s." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.post("/admin/certifications/:id/reject", requireAdmin, async (req, res) => {
  try {
    const { rejectionReason, adminNotes } = req.body;
    if (!rejectionReason || !rejectionReason.trim()) {
      return res.status(400).json({ error: "Le motif de refus est obligatoire." });
    }
    const cert = await db.rejectCertification(
      req.params.id,
      req.user.id,
      rejectionReason.trim(),
      adminNotes
    );
    if (!cert) return res.status(404).json({ error: "Demande introuvable." });
    res.json({ success: true, certification: cert, message: "Demande refus\xE9e." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.post("/admin/stores/:id/revoke-certification", requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: "Le motif du retrait de certification est obligatoire." });
    }
    const store = await db.revokeCertification(req.params.id, req.user.id, reason.trim());
    if (!store) return res.status(404).json({ error: "Boutique introuvable." });
    res.json({ success: true, store, message: "Certification retir\xE9e de la boutique." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.get("/admin/stores/:id/certification-history", requireAdmin, async (req, res) => {
  try {
    const history = await db.getStoreCertificationHistory(req.params.id);
    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.get("/ai/status", (_req, res) => {
  const status = checkAiStatus();
  res.json(status);
});
apiRouter.post("/ai/chat", async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Message requis." });
    }
    const result = await chatWithAssistant(message.trim(), Array.isArray(history) ? history : []);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || "Erreur assistant IA" });
  }
});
apiRouter.post("/ai/draft-response", requireAuth, async (req, res) => {
  try {
    const { conversationId, customInstruction } = req.body;
    if (!conversationId) {
      return res.status(400).json({ error: "Identifiant de conversation requis." });
    }
    const conv = await db.getConversationById(conversationId);
    if (!conv) {
      return res.status(404).json({ error: "Conversation introuvable." });
    }
    const store = await db.getStoreById(conv.store_id);
    const isClient = conv.customer_id === req.user.id;
    const isVendor = store && store.user_id === req.user.id;
    const isAdmin = req.user.role === "admin";
    if (!isClient && !isVendor && !isAdmin) {
      return res.status(403).json({ error: "Vous ne faites pas partie de cette conversation." });
    }
    const roleForPrompt = isVendor ? "vendeur" : "client";
    const result = await draftConversationReply(conversationId, roleForPrompt, customInstruction);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || "Erreur de g\xE9n\xE9ration du brouillon" });
  }
});
apiRouter.post("/ai/generate-product-image", requireSeller, async (req, res) => {
  try {
    const store = await db.getStoreByUserId(req.user.id);
    if (!store) {
      return res.status(404).json({ error: "Boutique introuvable." });
    }
    const { productName, description, categoryName, referenceImageBase64, referenceImageMimeType } = req.body;
    if (!productName || !description) {
      return res.status(400).json({ error: "Nom et description du produit requis pour g\xE9n\xE9rer une illustration." });
    }
    const result = await generateProductIllustration({
      storeId: store.id,
      productName: productName.trim(),
      description: description.trim(),
      categoryName: categoryName?.trim(),
      referenceImageBase64,
      referenceImageMimeType
    });
    if (!result.available || result.error) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || "Erreur lors de la cr\xE9ation d\u2019image" });
  }
});
apiRouter.get("/admin/ai-config", requireAdmin, async (_req, res) => {
  try {
    const config = db.getAiConfig();
    const status = checkAiStatus();
    res.json({ config, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.put("/admin/ai-config", requireAdmin, async (req, res) => {
  try {
    const { daily_quota_per_store, enabled } = req.body;
    const updated = await db.updateAiConfig({
      daily_quota_per_store: Number(daily_quota_per_store) || 25,
      enabled: Boolean(enabled)
    }, req.user.id);
    res.json({ success: true, config: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// server.ts
dotenv.config();
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = path4.dirname(__filename2);
async function startServer() {
  const app = express2();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
  const isProduction = process.env.NODE_ENV === "production";
  app.use(express2.json({ limit: "10mb" }));
  app.use(express2.urlencoded({ extended: true, limit: "10mb" }));
  const uploadsDir = path4.resolve(__dirname2, "public", "uploads");
  if (!fs4.existsSync(uploadsDir)) {
    fs4.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use("/uploads", express2.static(uploadsDir));
  app.use(authenticateToken);
  app.use("/api", apiRouter);
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "MARKET S\xC9N\xC9GAL API",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  if (!isProduction) {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path4.resolve(__dirname2, "dist");
    if (fs4.existsSync(distDir)) {
      app.use(express2.static(distDir));
      app.get("*", (_req, res) => {
        res.sendFile(path4.join(distDir, "index.html"));
      });
    } else {
      console.warn("Dossier dist non trouv\xE9. Lancez npm run build d'abord.");
    }
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[MARKET S\xC9N\xC9GAL] Serveur d\xE9marr\xE9 avec succ\xE8s sur http://0.0.0.0:${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("[MARKET S\xC9N\xC9GAL] Erreur fatale au d\xE9marrage du serveur:", err);
  process.exit(1);
});
