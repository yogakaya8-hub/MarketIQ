import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [cart, setCart] = useState(null);

  const refresh = useCallback(async () => {
    if (user?.role !== 'customer') { setCart(null); return; }
    try {
      const { data } = await api.get('/cart');
      setCart(data.cart);
    } catch {
      setCart(null);
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const add = useCallback(async (productId, quantity = 1) => {
    const { data } = await api.post('/cart/items', { productId, quantity });
    setCart(data.cart);
    return data.cart;
  }, []);
  const update = useCallback(async (productId, quantity) => {
    const { data } = await api.patch(`/cart/items/${productId}`, { quantity });
    setCart(data.cart);
  }, []);
  const remove = useCallback(async (productId, reason) => {
    const { data } = await api.delete(`/cart/items/${productId}`, { data: reason ? { reason } : {} });
    setCart(data.cart);
  }, []);

  return <CartContext.Provider value={{ cart, setCart, refresh, add, update, remove, count: cart?.itemCount || 0 }}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
