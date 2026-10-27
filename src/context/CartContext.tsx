import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Product } from '../types/index.js';

export interface CartItem {
  productId: string;
  quantity: number;
  product: Product;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItemsCount: number;
  totalSubtotalFcfa: number;
}

const CART_STORAGE_KEY = 'ms_cart_items';

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Erreur sauvegarde panier local:', e);
    }
  }, [items]);

  const addToCart = (product: Product, quantity = 1) => {
    setItems(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        const newQty = Math.min(product.stock_quantity, existing.quantity + quantity);
        return prev.map(i => (i.productId === product.id ? { ...i, quantity: newQty, product } : i));
      }
      return [...prev, { productId: product.id, quantity: Math.min(product.stock_quantity, quantity), product }];
    });
  };

  const removeFromCart = (productId: string) => {
    setItems(prev => prev.filter(i => i.productId !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setItems(prev =>
      prev.map(i => {
        if (i.productId === productId) {
          const max = i.product.stock_quantity;
          return { ...i, quantity: Math.min(max, quantity) };
        }
        return i;
      })
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const totalItemsCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalSubtotalFcfa = items.reduce((sum, item) => sum + item.product.price_fcfa * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalItemsCount,
        totalSubtotalFcfa
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return ctx;
}
