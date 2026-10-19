import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

export interface CartItem {
  productId: string;
  product: {
    id: string;
    title: string;
    category?: string;
    price_per_unit: number;
    unit?: string;
    stock_quantity: number;
    moq: number;
    lead_time_days?: number;
    images?: string[];
    seller?: {
      id: string;
      name: string;
    };
  };
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: any, quantity: number) => { success: boolean; message?: string };
  updateQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
  setDirectPurchaseItem: (item: CartItem | null) => void;
  directPurchaseItem: CartItem | null;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const storageKey = `market_linkage_cart_${user?.id || 'guest'}`;

  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [directPurchaseItem, setDirectPurchaseItem] = useState<CartItem | null>(null);

  // Sync with localStorage whenever items or user changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setItems(JSON.parse(saved));
      } else {
        setItems([]);
      }
    } catch {
      setItems([]);
    }
  }, [user?.id]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      // Ignore storage errors
    }
  }, [items, storageKey]);

  const addToCart = (product: any, quantity: number): { success: boolean; message?: string } => {
    const moq = Math.max(1, Number(product.moq) || 1);
    const stock = Number(product.stock_quantity) || 0;
    const sellerId = product.seller?.id || product.seller_id;

    // Self-purchase prevention
    if (user && sellerId && String(user.id) === String(sellerId)) {
      return { success: false, message: 'Artisans cannot purchase their own products.' };
    }

    if (stock <= 0) {
      return { success: false, message: 'This craft product is currently out of stock.' };
    }

    if (stock < moq) {
      return {
        success: false,
        message: `Available stock (${stock}) is below the minimum order quantity (${moq}). Immediate purchase is unavailable. Please submit a wholesale quotation inquiry.`
      };
    }

    if (!quantity || isNaN(quantity) || quantity <= 0) {
      return { success: false, message: 'Please enter a valid positive quantity.' };
    }

    if (quantity < moq) {
      return { success: false, message: `Quantity cannot be less than minimum order quantity (${moq}).` };
    }

    if (quantity > stock) {
      return { success: false, message: `Quantity cannot exceed available stock (${stock}).` };
    }

    let errorMsg = '';

    setItems((prevItems) => {
      const existingIdx = prevItems.findIndex((it) => it.productId === product.id);
      if (existingIdx > -1) {
        const existing = prevItems[existingIdx];
        const newQty = existing.quantity + quantity;
        if (newQty > stock) {
          errorMsg = `Cannot add more units. Total requested (${newQty}) exceeds available stock (${stock}).`;
          return prevItems;
        }
        const updated = [...prevItems];
        updated[existingIdx] = { ...existing, quantity: newQty };
        return updated;
      } else {
        return [
          ...prevItems,
          {
            productId: product.id,
            product: {
              id: product.id,
              title: product.title,
              category: product.category,
              price_per_unit: Number(product.price_per_unit) || 0,
              unit: product.unit || 'piece',
              stock_quantity: stock,
              moq,
              lead_time_days: product.lead_time_days || 7,
              images: product.images || [],
              seller: product.seller || { id: sellerId, name: 'Artisan Producer' },
            },
            quantity,
          },
        ];
      }
    });

    if (errorMsg) {
      return { success: false, message: errorMsg };
    }
    return { success: true };
  };

  const updateQuantity = (productId: string, quantity: number) => {
    setItems((prevItems) =>
      prevItems
        .map((it) => {
          if (it.productId !== productId) return it;
          const moq = it.product.moq || 1;
          const stock = it.product.stock_quantity || 0;
          const validQty = Math.max(moq, Math.min(stock, quantity));
          return { ...it, quantity: validQty };
        })
        .filter((it) => it.quantity > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setItems((prevItems) => prevItems.filter((it) => it.productId !== productId));
  };

  const clearCart = () => {
    setItems([]);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Ignore
    }
  };

  const totalItems = items.reduce((sum, it) => sum + it.quantity, 0);
  const subtotal = items.reduce((sum, it) => sum + (it.product.price_per_unit || 0) * it.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        totalItems,
        subtotal,
        directPurchaseItem,
        setDirectPurchaseItem,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
