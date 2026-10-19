import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ShieldCheck, CheckCircle2, AlertCircle, ArrowLeft, 
  Truck, ShoppingCart, RefreshCw, MapPin, User, Phone, Check, Home
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart, type CartItem } from '../../context/CartContext';
import { ProductImage } from '../../components/common/ProductImage';
import api from '../../services/api';

const INDIAN_STATES = [
  'Tamil Nadu', 'Karnataka', 'Kerala', 'Andhra Pradesh', 'Telangana',
  'Maharashtra', 'Gujarat', 'Rajasthan', 'Delhi', 'West Bengal',
  'Uttar Pradesh', 'Madhya Pradesh', 'Bihar', 'Odisha', 'Punjab',
  'Haryana', 'Assam', 'Goa', 'Uttarakhand', 'Himachal Pradesh'
];

export const CheckoutPage: React.FC = () => {
  const { user, quickDemoLogin } = useAuth();
  const { items: cartItems, directPurchaseItem, clearCart, setDirectPurchaseItem } = useCart();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Determine items to checkout: direct item or cart items
  const isDirect = searchParams.get('direct') === 'true' && Boolean(directPurchaseItem);
  const checkoutItems: CartItem[] = isDirect && directPurchaseItem ? [directPurchaseItem] : cartItems;

  // Form State
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '9876543210');
  const [street, setStreet] = useState('Flat 4B, Artisan Heritage Enclave, Gandhi Road');
  const [city, setCity] = useState('Chennai');
  const [state, setState] = useState('Tamil Nadu');
  const [pincode, setPincode] = useState('600002');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash_on_delivery' | 'demo_escrow'>('cash_on_delivery');

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmedOrder, setConfirmedOrder] = useState<any | null>(null);

  // Update fullName if user logs in during checkout
  useEffect(() => {
    if (user?.full_name && !fullName) {
      setFullName(user.full_name);
    }
  }, [user]);

  const totalAmount = checkoutItems.reduce(
    (sum, it) => sum + (it.product.price_per_unit || 0) * it.quantity,
    0
  );
  const totalQuantity = checkoutItems.reduce((sum, it) => sum + it.quantity, 0);

  // Submit Order to backend
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!user) {
      setErrorMessage('Please log in with a buyer account or click Quick Buyer Login below before placing an order.');
      return;
    }

    if (checkoutItems.length === 0) {
      setErrorMessage('Your checkout session has no items. Please select a product from the marketplace.');
      return;
    }

    if (!fullName.trim() || !street.trim() || !city.trim() || !pincode.trim()) {
      setErrorMessage('Please fill in complete recipient and delivery address details.');
      return;
    }

    if (!phone.trim() || phone.replace(/\D/g, '').length < 10) {
      setErrorMessage('Please provide a valid 10-digit delivery contact phone number.');
      return;
    }

    setSubmitting(true);
    const idempotencyKey = `chk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    try {
      const payload = {
        items: checkoutItems.map((it) => ({
          product_id: it.productId,
          quantity: it.quantity,
        })),
        delivery_address: {
          full_name: fullName.trim(),
          phone: phone.trim(),
          street: street.trim(),
          city: city.trim(),
          state: state.trim(),
          pincode: pincode.trim(),
        },
        payment_method: paymentMethod,
        idempotency_key: idempotencyKey,
        notes: notes.trim(),
      };

      const res = await api.checkout(payload);

      if (res && res.success) {
        // Clear cart or direct purchase item
        if (isDirect) {
          setDirectPurchaseItem(null);
        } else {
          clearCart();
        }
        setConfirmedOrder(res);
      } else {
        throw new Error(res?.message || 'Failed to confirm order with backend.');
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      setErrorMessage(
        err.message || 'Order creation failed. Please check stock availability and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // SUCCESS CONFIRMATION VIEW
  if (confirmedOrder) {
    const primaryOrder = confirmedOrder.orders?.[0] || confirmedOrder;
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center animate-in fade-in zoom-in duration-200">
        <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-xl border border-stone-200 space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <span className="text-xs uppercase tracking-wider font-bold text-forest-700 bg-forest-50 px-3 py-1 rounded-full border border-forest-200">
              Direct Artisan Order Confirmed
            </span>
            <h2 className="font-serif text-3xl font-extrabold text-charcoal-900 mt-3">
              Thank You for Your Order!
            </h2>
            <p className="text-stone-600 text-sm mt-1">
              Your handmade craft order has been received, stock allocated, and notification dispatched to the artisan producer.
            </p>
          </div>

          {/* Order Details Card */}
          <div className="bg-[#FAF8F5] p-5 rounded-2xl border border-stone-200 text-left space-y-3 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-stone-200">
              <span className="text-stone-500 font-medium">Order Number:</span>
              <strong className="font-mono text-sm text-charcoal-900 font-bold">
                {confirmedOrder.order_number || primaryOrder.order_number}
              </strong>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-stone-500">Order Total:</span>
              <strong className="font-mono text-sm text-forest-900 font-bold">
                ₹{(confirmedOrder.total_amount || 0).toLocaleString('en-IN')}
              </strong>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-stone-500">Payment Status:</span>
              <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {paymentMethod === 'cash_on_delivery' ? 'Cash on Delivery (Pending Delivery)' : 'Demo Sandbox Authorized'}
              </span>
            </div>

            <div className="pt-2 border-t border-stone-200">
              <span className="text-stone-500 block mb-0.5">Shipping To:</span>
              <p className="text-charcoal-800 font-medium">
                {fullName} ({phone})<br />
                {street}, {city}, {state} - {pincode}
              </p>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link
              to="/buyer"
              className="flex-1 py-3 px-5 bg-forest-800 hover:bg-forest-900 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all text-center"
            >
              View in My Orders (Buyer Dashboard)
            </Link>

            <Link
              to="/marketplace"
              className="py-3 px-5 bg-stone-100 hover:bg-stone-200 text-charcoal-800 rounded-xl font-semibold text-xs sm:text-sm transition-all text-center"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // EMPTY CHECKOUT CHECK
  if (checkoutItems.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <ShoppingCart className="w-12 h-12 text-stone-300 mx-auto" />
        <h3 className="font-serif text-2xl font-bold text-charcoal-900">
          No Items to Checkout
        </h3>
        <p className="text-xs text-stone-500">
          Your cart is currently empty. Browse the marketplace to add authentic artisan goods.
        </p>
        <Link
          to="/marketplace"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-forest-800 text-white rounded-xl text-xs font-semibold"
        >
          Browse Marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="border-b border-stone-200 pb-4">
        <nav className="flex items-center gap-2 text-xs text-stone-500 mb-2">
          <Link to="/marketplace" className="hover:text-forest-900">Marketplace</Link>
          <span>/</span>
          <Link to="/cart" className="hover:text-forest-900">Cart</Link>
          <span>/</span>
          <span className="text-charcoal-800 font-semibold">Checkout</span>
        </nav>
        <h1 className="font-serif text-2xl sm:text-3xl font-extrabold text-forest-950">
          Direct Artisan Checkout
        </h1>
        <p className="text-xs text-stone-500 mt-0.5">
          Review delivery destination, order items, and confirm direct placement
        </p>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-xs sm:text-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{errorMessage}</div>
        </div>
      )}

      {/* Auth Prompt if not logged in */}
      {!user && (
        <div className="p-4 sm:p-5 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h4 className="font-bold text-amber-900 text-sm">
              You are currently browsing as a guest
            </h4>
            <p className="text-xs text-amber-800 mt-0.5">
              To associate this order with your buyer account and track production, please log in.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => quickDemoLogin('buyer')}
              className="px-3.5 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              1-Click Demo Buyer Login
            </button>
            <Link
              to="/login"
              className="px-3.5 py-2 bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 rounded-xl text-xs font-semibold transition-colors"
            >
              Log In
            </Link>
          </div>
        </div>
      )}

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Form: Delivery Address & Payment Method */}
        <div className="lg:col-span-2 space-y-6">
          {/* Delivery Address Section */}
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-stone-200 shadow-xs space-y-4">
            <h3 className="font-serif text-lg font-bold text-charcoal-900 flex items-center gap-2 border-b border-stone-100 pb-3">
              <MapPin className="w-5 h-5 text-terracotta-600" />
              Delivery Destination Address
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-charcoal-800 mb-1">
                  Recipient Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-charcoal-800 mb-1">
                  Contact Phone Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-charcoal-800 mb-1">
                Street Address / Premises <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Door/Flat No., Street, Area landmark"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-charcoal-800 mb-1">
                  City / Town <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Madurai"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-charcoal-800 mb-1">
                  State <span className="text-rose-500">*</span>
                </label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none bg-white"
                >
                  {INDIAN_STATES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-charcoal-800 mb-1">
                  Postal Pincode <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="e.g. 625001"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-charcoal-800 mb-1">
                Dispatch / Packaging Notes for Artisan (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Secure straw packaging for pottery, gate entry instructions…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Payment Method & Demo Disclosure (Requirement 12) */}
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-stone-200 shadow-xs space-y-4">
            <h3 className="font-serif text-lg font-bold text-charcoal-900 border-b border-stone-100 pb-3">
              Payment & Settlement Method
            </h3>

            <div className="space-y-3">
              {/* Option 1: Cash on Delivery */}
              <label
                className={`flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                  paymentMethod === 'cash_on_delivery'
                    ? 'border-forest-600 bg-forest-50/30'
                    : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <input
                  type="radio"
                  name="payment_choice"
                  checked={paymentMethod === 'cash_on_delivery'}
                  onChange={() => setPaymentMethod('cash_on_delivery')}
                  className="mt-1 text-forest-700 focus:ring-forest-600 cursor-pointer"
                />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-charcoal-900 text-sm">
                      Cash on Delivery (Pay upon Receipt)
                    </span>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Standard Trade
                    </span>
                  </div>
                  <p className="text-xs text-stone-500">
                    Pay directly to the delivery courier or postal carrier upon package arrival.
                  </p>
                </div>
              </label>

              {/* Option 2: Demo Escrow Sandbox */}
              <label
                className={`flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                  paymentMethod === 'demo_escrow'
                    ? 'border-forest-600 bg-forest-50/30'
                    : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <input
                  type="radio"
                  name="payment_choice"
                  checked={paymentMethod === 'demo_escrow'}
                  onChange={() => setPaymentMethod('demo_escrow')}
                  className="mt-1 text-forest-700 focus:ring-forest-600 cursor-pointer"
                />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-charcoal-900 text-sm">
                      Artisan Escrow Sandbox (Demonstration Order)
                    </span>
                    <span className="text-[10px] font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                      Sandbox Test
                    </span>
                  </div>
                  <p className="text-xs text-stone-500">
                    Simulates an instant digital escrow hold. No live credit/debit card charged.
                  </p>
                </div>
              </label>
            </div>

            {/* Transparent Honest Disclosure (Requirement 12) */}
            <div className="p-3.5 bg-[#FAF8F5] rounded-2xl border border-stone-200 text-xs text-stone-600 space-y-1">
              <div className="flex items-center gap-2 font-bold text-forest-900">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Transparent Demonstration Notice</span>
              </div>
              <p className="text-[11px] text-stone-500 leading-relaxed">
                Online payment gateway integration is currently running in demonstration mode. No actual bank funds or credit card balances will be charged. The order will be genuinely recorded in the database, reserving inventory and notifying the artisan.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary & Place Order CTA */}
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <h3 className="font-serif text-lg font-bold text-charcoal-900">
              Purchasing ({totalQuantity} units)
            </h3>
            {isDirect && (
              <span className="text-[11px] font-semibold text-terracotta-700 bg-terracotta-50 px-2 py-0.5 rounded-full border border-terracotta-200">
                Direct Buy
              </span>
            )}
          </div>

          {/* Items Preview */}
          <div className="space-y-3 max-h-64 overflow-y-auto pr-1 divide-y divide-stone-100">
            {checkoutItems.map((it) => (
              <div key={it.productId} className="pt-2 first:pt-0 flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-stone-100 border border-stone-200 shrink-0">
                  <ProductImage
                    src={it.product.images?.[0]}
                    alt={it.product.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-xs text-charcoal-900 truncate">
                    {it.product.title}
                  </h4>
                  <p className="text-[11px] text-stone-500">
                    {it.quantity} {it.product.unit || 'unit'}s × ₹{it.product.price_per_unit}
                  </p>
                  <p className="text-xs font-mono font-bold text-forest-900">
                    ₹{((it.product.price_per_unit || 0) * it.quantity).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Cost Summary */}
          <div className="space-y-2 text-xs pt-3 border-t border-stone-200">
            <div className="flex justify-between text-stone-600">
              <span>Items Total:</span>
              <span className="font-mono font-semibold text-charcoal-900">
                ₹{totalAmount.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="flex justify-between text-stone-600">
              <span>Logistics & Handling:</span>
              <span className="font-medium text-emerald-700">Free Artisan Dispatch</span>
            </div>

            <div className="pt-3 border-t border-stone-200 flex justify-between items-baseline text-sm">
              <span className="font-bold text-charcoal-900">Total Payable:</span>
              <span className="font-serif text-2xl font-extrabold text-forest-950 font-mono">
                ₹{totalAmount.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Place Order Action */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 px-4 bg-forest-800 hover:bg-forest-900 disabled:opacity-50 text-white rounded-xl font-bold text-sm sm:text-base shadow-md transition-all flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Reserving Stock & Placing Order…</span>
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                <span>Place Confirmed Order</span>
              </>
            )}
          </button>

          <p className="text-[11px] text-stone-500 text-center">
            By confirming, the order will be submitted directly to the verified artisan for production and fulfillment.
          </p>
        </div>
      </form>
    </div>
  );
};
export default CheckoutPage;
