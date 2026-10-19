import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ShoppingCart, Trash2, Plus, Minus, ArrowRight, 
  ArrowLeft, ShieldCheck, Truck, Package, Store
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { ProductImage } from '../../components/common/ProductImage';

export const CartPage: React.FC = () => {
  const { items, updateQuantity, removeFromCart, clearCart, subtotal, totalItems } = useCart();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 sm:py-24 text-center">
        <div className="w-20 h-20 rounded-full bg-forest-50 text-forest-700 flex items-center justify-center mx-auto mb-4 border border-forest-100">
          <ShoppingCart className="w-10 h-10 text-forest-700" />
        </div>
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-charcoal-900 mb-2">
          Your Cart is Empty
        </h2>
        <p className="text-sm text-stone-600 max-w-md mx-auto mb-8">
          Browse our verified artisan marketplace to discover genuine handmade crafts, pottery, handlooms, and more.
        </p>
        <Link
          to="/marketplace"
          className="inline-flex items-center gap-2 px-6 py-3 bg-forest-800 hover:bg-forest-900 text-white rounded-xl font-semibold text-sm shadow-md transition-all"
        >
          <Store className="w-4 h-4 text-gold-300" />
          Explore Marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-extrabold text-forest-950">
            Shopping Cart ({totalItems} {totalItems === 1 ? 'item' : 'items'})
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Direct orders from authentic rural artisans and verified self-help groups
          </p>
        </div>

        <button
          type="button"
          onClick={clearCart}
          className="text-xs text-stone-500 hover:text-rose-600 flex items-center gap-1 font-medium transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" /> Empty Cart
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Cart Items List */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => {
            const p = item.product;
            const lineTotal = (p.price_per_unit || 0) * item.quantity;
            const isMin = item.quantity <= (p.moq || 1);
            const isMax = item.quantity >= (p.stock_quantity || 0);

            return (
              <div
                key={item.productId}
                className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-stone-100 border border-stone-200 shrink-0">
                    <ProductImage
                      src={p.images?.[0]}
                      alt={p.title}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="space-y-1 min-w-0">
                    <span className="text-[10px] font-semibold text-terracotta-700 uppercase tracking-wider block">
                      {p.category || 'Handicraft'}
                    </span>
                    <Link
                      to={`/products/${p.id}`}
                      className="font-bold text-charcoal-900 text-sm sm:text-base hover:text-forest-800 truncate block"
                    >
                      {p.title}
                    </Link>
                    <p className="text-xs text-stone-500">
                      Artisan: <strong className="text-charcoal-800">{p.seller?.name || 'Artisan Producer'}</strong>
                    </p>
                    <p className="text-xs font-semibold text-forest-900 font-mono">
                      ₹{p.price_per_unit?.toLocaleString('en-IN')} <span className="text-[10px] font-normal text-stone-500">/ {p.unit || 'piece'}</span>
                    </p>
                  </div>
                </div>

                {/* Quantity Controls & Line Total */}
                <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                  <div className="flex items-center gap-1.5 bg-stone-50 p-1 rounded-xl border border-stone-200">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      disabled={isMin}
                      className="w-7 h-7 rounded-lg bg-white hover:bg-stone-100 disabled:opacity-40 flex items-center justify-center text-charcoal-800 transition-colors shadow-2xs"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-10 text-center font-mono font-bold text-xs">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      disabled={isMax}
                      className="w-7 h-7 rounded-lg bg-white hover:bg-stone-100 disabled:opacity-40 flex items-center justify-center text-charcoal-800 transition-colors shadow-2xs"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-stone-400 block">Total</span>
                    <span className="font-bold text-charcoal-900 text-sm sm:text-base font-mono">
                      ₹{lineTotal.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeFromCart(item.productId)}
                    className="p-1.5 text-stone-400 hover:text-rose-600 transition-colors"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}

          <div className="pt-2">
            <Link
              to="/marketplace"
              className="text-xs font-semibold text-forest-800 hover:text-forest-900 inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Continue Shopping
            </Link>
          </div>
        </div>

        {/* Order Summary Card */}
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm space-y-6">
          <h3 className="font-serif text-lg font-bold text-charcoal-900 border-b border-stone-100 pb-3">
            Order Summary
          </h3>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-stone-600">
              <span>Items Total ({totalItems} units):</span>
              <span className="font-mono font-semibold text-charcoal-900">
                ₹{subtotal.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="flex justify-between text-stone-600">
              <span>Artisan Direct Logistics:</span>
              <span className="font-medium text-emerald-700">Free / Tracked Speed Post</span>
            </div>

            <div className="pt-3 border-t border-stone-200 flex justify-between items-baseline text-sm">
              <span className="font-bold text-charcoal-900">Total Payable:</span>
              <span className="font-serif text-2xl font-extrabold text-forest-950 font-mono">
                ₹{subtotal.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <div className="p-3 bg-[#FAF8F5] rounded-xl border border-stone-200 text-stone-600 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-forest-900">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Artisan Direct Guarantee</span>
            </div>
            <p className="text-[11px] text-stone-500">
              100% of purchase goes directly to verified rural makers. Authentic craft inspection guarantee included.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/checkout')}
            className="w-full py-3.5 px-4 bg-forest-800 hover:bg-forest-900 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
          >
            <span>Proceed to Checkout</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
export default CartPage;
