import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, Package, Clock, Truck, Layers, MessageSquare, 
  FileText, MapPin, ChevronRight, Share2, AlertCircle, CheckCircle2,
  ShoppingCart, ShoppingBag, Plus, Minus, ArrowRight, Edit3, Boxes,
  ShieldAlert, RefreshCw, Eye
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useCart } from '../../context/CartContext';
import { VerificationBadge } from '../../components/common/Badge';
import { ProductImage } from '../../components/common/ProductImage';
import { QuotationModal } from '../../components/modals/QuotationModal';
import { EditProductModal } from '../../components/modals/EditProductModal';
import { Product } from '../../types';
import api from '../../services/api';

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const navigate = useNavigate();

  const [product, setProduct] = useState<any>(null);
  const [similarProducts, setSimilarProducts] = useState<any[]>([]);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Cart & Purchasing State
  const { addToCart, setDirectPurchaseItem } = useCart();
  const [quantity, setQuantity] = useState<number>(1);
  const [quantityInput, setQuantityInput] = useState<string>('1');
  const [cartSuccessMessage, setCartSuccessMessage] = useState<string>('');
  const [cartErrorMessage, setCartErrorMessage] = useState<string>('');

  // Modals & Seller Actions
  const [quotationModalOpen, setQuotationModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [quickStockValue, setQuickStockValue] = useState<number | string>('');
  const [quickStockUpdating, setQuickStockUpdating] = useState(false);
  const [quickStockMsg, setQuickStockMsg] = useState('');
  const [quickStockErr, setQuickStockErr] = useState('');

  const fetchDetail = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.getProduct(id, language);
      setProduct(res.product);
      setSimilarProducts(res.product?.similar_products || []);
      if (res.product?.images && res.product.images.length > 0) {
        setSelectedImage(res.product.images[0]);
      }
      if (res.product) {
        const curMoq = Math.max(1, Number(res.product.moq) || 1);
        const curStock = Number(res.product.stock_quantity) || 0;
        if (curStock >= curMoq) {
          setQuantity(curMoq);
          setQuantityInput(String(curMoq));
        } else {
          setQuantity(0);
          setQuantityInput('0');
        }
        setQuickStockValue(curStock);
      }
    } catch (err: any) {
      setError(err.message || (language === 'ta' ? 'தயாரிப்பு விவரம் கிடைக்கவில்லை' : 'Product not found'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id, language]);

  // Role and Ownership derivations
  const sellerId = product?.seller?.id || product?.seller_id;
  const isOwner = Boolean(user && sellerId && String(user.id) === String(sellerId));
  const isAdmin = Boolean(user && user.role === 'admin');
  const canEdit = isOwner || isAdmin;

  // Stock and MOQ calculations
  const moq = Math.max(1, Number(product?.moq) || 1);
  const stock = Number(product?.stock_quantity) || 0;
  const isOutOfStock = stock <= 0;
  const isStockBelowMoq = stock > 0 && stock < moq;
  const isPurchaseDisabled = isOutOfStock || isStockBelowMoq;
  const totalPrice = isPurchaseDisabled ? 0 : (product?.price_per_unit || 0) * quantity;

  // Directly editable numeric input commit
  const handleQuantityInputCommit = (rawStr: string) => {
    if (isPurchaseDisabled) return;
    const trimmed = rawStr.trim();
    if (!trimmed) {
      setQuantity(moq);
      setQuantityInput(String(moq));
      setCartErrorMessage(language === 'ta' ? 'அளவு காலியாக இருக்க முடியாது.' : 'Quantity cannot be empty.');
      return;
    }
    const parsed = parseInt(trimmed, 10);
    if (isNaN(parsed) || parsed <= 0) {
      setQuantity(moq);
      setQuantityInput(String(moq));
      setCartErrorMessage(language === 'ta' ? 'சரியான நேர்மறை அளவை உள்ளிடவும்.' : 'Please enter a valid positive quantity.');
      return;
    }
    if (parsed < moq) {
      setQuantity(moq);
      setQuantityInput(String(moq));
      setCartErrorMessage(
        language === 'ta'
          ? `குறைந்தபட்ச ஆர்டர் அளவு ${moq} ஆகும்.`
          : `Quantity cannot be less than minimum order quantity (${moq}).`
      );
      return;
    }
    if (parsed > stock) {
      setQuantity(stock);
      setQuantityInput(String(stock));
      setCartErrorMessage(
        language === 'ta'
          ? `கையிருப்பில் உள்ள அதிகபட்ச அளவு ${stock} ஆகும்.`
          : `Quantity cannot exceed available stock (${stock}).`
      );
      return;
    }
    setQuantity(parsed);
    setQuantityInput(String(parsed));
    setCartErrorMessage('');
  };

  // Step quantity with +/- buttons
  const handleStepQuantity = (delta: number) => {
    if (isPurchaseDisabled) return;
    const target = quantity + delta;
    if (target < moq || target > stock) return;
    setQuantity(target);
    setQuantityInput(String(target));
    setCartErrorMessage('');
  };

  const handleAddToCart = () => {
    if (isOwner) {
      setCartErrorMessage(language === 'ta' ? 'கைவினைஞர்கள் தங்கள் சொந்த தயாரிப்புகளை வாங்க முடியாது.' : 'Artisans cannot purchase their own products.');
      return;
    }
    if (isOutOfStock) {
      setCartErrorMessage(language === 'ta' ? 'இந்த தயாரிப்பு தற்போது கையிருப்பில் இல்லை.' : 'This item is currently out of stock.');
      return;
    }
    if (isStockBelowMoq) {
      setCartErrorMessage(
        language === 'ta'
          ? `கிடைக்கக்கூடிய கையிருப்பு (${stock}) குறைந்தபட்ச ஆர்டர் அளவை விட (${moq}) குறைவாக உள்ளது.`
          : `Available stock (${stock}) is below minimum order quantity (${moq}). Direct purchase unavailable.`
      );
      return;
    }
    if (quantity < moq || quantity > stock) {
      setCartErrorMessage(language === 'ta' ? 'சரியான கொள்முதல் அளவை உள்ளிடவும்.' : 'Please select a valid order quantity.');
      return;
    }

    const res = addToCart(product, quantity);
    if (res.success) {
      const unitLabel = product.unit || (language === 'ta' ? 'பொருட்கள்' : 'unit');
      setCartSuccessMessage(
        language === 'ta' 
          ? `${quantity} ${unitLabel} உங்கள் கூடையில் சேர்க்கப்பட்டது!` 
          : `Added ${quantity} ${unitLabel}${quantity > 1 ? 's' : ''} to your cart!`
      );
      setCartErrorMessage('');
      setTimeout(() => setCartSuccessMessage(''), 5000);
    } else {
      setCartErrorMessage(res.message || (language === 'ta' ? 'கூடையில் சேர்க்க முடியவில்லை.' : 'Could not add item to cart.'));
      setCartSuccessMessage('');
    }
  };

  const handleBuyNow = () => {
    if (isOwner) {
      setCartErrorMessage(language === 'ta' ? 'கைவினைஞர்கள் தங்கள் சொந்த தயாரிப்புகளை வாங்க முடியாது.' : 'Artisans cannot purchase their own products.');
      return;
    }
    if (isOutOfStock) {
      setCartErrorMessage(language === 'ta' ? 'இந்த தயாரிப்பு தற்போது கையிருப்பில் இல்லை.' : 'This item is currently out of stock.');
      return;
    }
    if (isStockBelowMoq) {
      setCartErrorMessage(
        language === 'ta'
          ? `கிடைக்கக்கூடிய கையிருப்பு (${stock}) குறைந்தபட்ச ஆர்டர் அளவை விட (${moq}) குறைவாக உள்ளது.`
          : `Available stock (${stock}) is below minimum order quantity (${moq}). Direct purchase unavailable.`
      );
      return;
    }
    if (quantity < moq || quantity > stock) {
      setCartErrorMessage(language === 'ta' ? 'சரியான கொள்முதல் அளவை உள்ளிடவும்.' : 'Please select a valid order quantity.');
      return;
    }

    setDirectPurchaseItem({
      productId: product.id,
      product,
      quantity
    });
    if (!user) {
      navigate('/login?redirect=/checkout?direct=true');
    } else {
      navigate('/checkout?direct=true');
    }
  };

  const handleQuickStockUpdate = async () => {
    const parsedStock = parseInt(String(quickStockValue), 10);
    if (isNaN(parsedStock) || parsedStock < 0) {
      setQuickStockErr(language === 'ta' ? 'கையிருப்பு எதிர்மறையாக இருக்க முடியாது.' : 'Stock cannot be negative.');
      return;
    }
    setQuickStockUpdating(true);
    setQuickStockErr('');
    setQuickStockMsg('');
    try {
      await api.updateProductStock(product.id, parsedStock);
      setProduct((prev: any) => ({ ...prev, stock_quantity: parsedStock }));
      setQuickStockMsg(t('updateStockSuccess'));
      setTimeout(() => setQuickStockMsg(''), 4000);
      // Refresh details in background
      fetchDetail();
    } catch (err: any) {
      setQuickStockErr(err.message || 'Failed to update stock.');
    } finally {
      setQuickStockUpdating(false);
    }
  };

  const handleStartConversation = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      const res = await api.createConversation({
        recipient_id: product.seller.id,
        subject: `Inquiry regarding ${product.title}`,
        product_id: product.id,
        initial_message: language === 'ta'
          ? `வணக்கம், நான் உங்கள் ${product.title} தயாரிப்பை மொத்தமாக வாங்க விரும்புகிறேன். உற்பத்தி கால அவகாசம் மற்றும் விவரங்களை பேசலாமா?`
          : `Hello, I am interested in placing an order for ${product.title}. Can we discuss custom lead times and specifications?`
      });
      navigate(`/messages?conversation=${res.conversation_id}`);
    } catch (err: any) {
      alert(`Conversation error: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20">
        <div className="h-96 rounded-3xl bg-stone-100 animate-pulse" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="font-serif text-2xl font-bold text-charcoal-900">{t('listingNotAvailable')}</h2>
        <p className="text-xs text-stone-500 mt-1 mb-6">
          {error || t('listingNotAvailableDesc')}
        </p>
        <Link
          to="/marketplace"
          className="px-5 py-2.5 rounded-xl bg-forest-800 text-white text-xs font-semibold"
        >
          {t('backToMarketplace')}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-stone-500">
        <Link to="/" className="hover:text-forest-900">{t('breadcrumbHome')}</Link>
        <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
        <Link to="/marketplace" className="hover:text-forest-900">{t('breadcrumbMarketplace')}</Link>
        <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
        <span className="text-charcoal-800 font-medium truncate max-w-xs">{product.title}</span>
      </nav>

      {/* Main Product Showcase */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        {/* Images Column */}
        <div className="space-y-4">
          <div className="h-96 sm:h-[450px] bg-white rounded-3xl border border-stone-200 overflow-hidden relative shadow-sm">
            <ProductImage
              src={selectedImage}
              alt={product.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-4 left-4">
              <VerificationBadge status={product.seller?.verification_status} />
            </div>
            {isOwner && (
              <div className="absolute top-4 right-4 bg-forest-900/90 text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-md backdrop-blur-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{language === 'ta' ? 'உங்கள் பட்டியல்' : 'Your Listing'}</span>
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {product.images && product.images.length > 1 && (
            <div className="flex items-center gap-3 overflow-x-auto pb-2">
              {product.images.map((img: string, idx: number) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedImage(img)}
                  className={`w-20 h-20 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                    selectedImage === img ? 'border-forest-700 shadow-sm' : 'border-stone-200 opacity-70'
                  }`}
                >
                  <ProductImage src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Specifications Column */}
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-bold tracking-wider text-terracotta-700">
                {product.category}
              </span>
              <span className="text-xs text-stone-400">ID: #{product.id.slice(-6)}</span>
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-extrabold text-forest-950 mt-1">
              {product.title}
            </h1>
          </div>

          {/* Pricing Box */}
          <div className="p-5 rounded-2xl bg-[#FCFAF6] border border-[#EDE5D6] flex items-baseline justify-between">
            <div>
              <span className="text-xs text-stone-500 block">{t('indicativePrice')}</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="font-serif text-3xl font-extrabold text-forest-950 font-mono">
                  ₹{product.price_per_unit.toLocaleString('en-IN')}
                </span>
                <span className="text-xs text-stone-500">/ {product.unit || (language === 'ta' ? 'அலகு' : 'unit')}</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-stone-500 block">{t('minOrderQty')}</span>
              <span className="text-sm font-bold text-charcoal-800 font-mono">
                {product.moq} {product.unit || (language === 'ta' ? 'அலகு' : 'unit')}
              </span>
            </div>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-charcoal-800 mb-1.5">
              {t('artisanCraftDesc')}
            </h3>
            <p className="text-xs sm:text-sm text-stone-700 leading-relaxed">
              {product.description}
            </p>
          </div>

          {/* Technical Specs Table */}
          <div className="grid grid-cols-2 gap-3 text-xs bg-white p-4 rounded-2xl border border-[#E5DAC8] shadow-craft">
            <div>
              <span className="text-stone-400 block text-[11px]">{t('materialsLabel')}</span>
              <strong className="text-charcoal-800 font-semibold">{product.materials || (language === 'ta' ? 'இயற்கை மூலப்பொருட்கள்' : 'Natural materials')}</strong>
            </div>

            <div>
              <span className="text-stone-400 block text-[11px]">{t('techniqueLabel')}</span>
              <strong className="text-charcoal-800 font-semibold">{product.production_method || (language === 'ta' ? 'கைவினை முறை' : 'Handcrafted')}</strong>
            </div>

            <div>
              <span className="text-stone-400 block text-[11px]">{t('inStock')}</span>
              <strong className={`font-semibold ${isOutOfStock ? 'text-rose-600' : isStockBelowMoq ? 'text-amber-700' : 'text-charcoal-800'}`}>
                {product.stock_quantity} {t('unitsReady')}
              </strong>
            </div>

            <div>
              <span className="text-stone-400 block text-[11px]">{t('monthlyCapacity')}</span>
              <strong className="text-charcoal-800 font-semibold">{product.monthly_capacity || 100} {t('unitsPerMonth')}</strong>
            </div>

            <div>
              <span className="text-stone-400 block text-[11px]">{t('leadTime')}</span>
              <strong className="text-charcoal-800 font-semibold">{product.lead_time_days} {t('days')}</strong>
            </div>

            <div>
              <span className="text-stone-400 block text-[11px]">{t('dimensionsLabel')}</span>
              <strong className="text-charcoal-800 font-semibold">{product.dimensions || (language === 'ta' ? 'வழக்கமான கைவினை அளவு' : 'Standard craft size')}</strong>
            </div>
          </div>

          {/* Seller Profile Card */}
          <div className="p-4 rounded-2xl bg-white border border-[#E5DAC8] shadow-craft space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-stone-400 block uppercase tracking-wider">{t('manufacturerSeller')}</span>
                <strong className="text-sm font-serif font-bold text-charcoal-900">
                  {product.seller?.name}
                </strong>
              </div>
              <VerificationBadge status={product.seller?.verification_status} />
            </div>

            <div className="flex items-center gap-1.5 text-xs text-stone-600">
              <MapPin className="w-3.5 h-3.5 text-terracotta-600 shrink-0" />
              <span>
                {product.seller?.district ? `${product.seller.district}, ` : ''}{product.seller?.state || 'Tamil Nadu'}
              </span>
            </div>

            {product.seller?.workshop_details && (
              <p className="text-xs text-stone-500 italic bg-[#FAF6ED] p-2.5 rounded-xl border border-[#E8DFC8]">
                &ldquo;{product.seller.workshop_details}&rdquo;
              </p>
            )}
          </div>

          {/* ─────────────────────────────────────────────────────────────────
              ROLE-BASED ACTIONS: OWNER SELLER VIEW vs BUYER VIEW
             ───────────────────────────────────────────────────────────────── */}
          {isOwner ? (
            /* SELLER OWNER MANAGEMENT PANEL (Buyer purchase controls hidden) */
            <div className="p-5 rounded-2xl bg-[#FCFAF6] border-2 border-forest-200 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-[#EDE5D6] pb-3">
                <div>
                  <span className="text-xs uppercase font-bold tracking-wider text-forest-950 block">
                    {t('sellerManagementActions')}
                  </span>
                  <span className="text-[11px] text-stone-500">
                    {t('ownerListingBanner')}
                  </span>
                </div>
                <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-forest-100 text-forest-900 border border-forest-300">
                  {language === 'ta' ? 'உரிமையாளர் கட்டுப்பாடுகள்' : 'Owner Controls'}
                </span>
              </div>

              {/* Stock vs MOQ Diagnostic for Owner */}
              {isStockBelowMoq && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-2.5">
                  <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-semibold">
                      {language === 'ta' ? 'கையிருப்பு எச்சரிக்கை (குறைந்தபட்ச அளவை விட குறைவு)' : 'Stock Alert (Below Minimum Order Quantity)'}
                    </strong>
                    <p className="mt-1 text-amber-800 leading-relaxed">
                      {language === 'ta'
                        ? `தற்போதைய கையிருப்பு (${stock}) குறைந்தபட்ச ஆர்டர் அளவை விட (${moq}) குறைவாக உள்ளது. வாங்குபவர்களுக்கான நேரடி கொள்முதல் தானாகவே முடக்கப்பட்டுள்ளது. கையிருப்பை அதிகரிக்கவும் அல்லது குறைந்தபட்ச ஆர்டர் அளவை திருத்தவும்.`
                        : `Available stock (${stock}) is below the minimum order quantity (${moq}). Immediate purchase is automatically disabled for wholesale buyers until you restock or adjust the minimum order quantity.`}
                    </p>
                  </div>
                </div>
              )}

              {/* Quick Stock Management */}
              <div className="p-4 bg-white rounded-2xl border border-stone-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-charcoal-800">
                    {t('quickStockUpdate')}
                  </label>
                  <span className="text-[11px] text-stone-500">
                    {t('currentStock')}: <strong className="font-mono text-charcoal-900">{stock} {product.unit || 'units'}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={quickStockValue}
                    onChange={(e) => setQuickStockValue(e.target.value)}
                    placeholder="Enter stock"
                    className="w-32 px-3 py-2 border border-stone-300 rounded-xl text-sm font-mono font-bold bg-[#FAF8F5] focus:outline-hidden focus:border-forest-700"
                  />
                  <button
                    type="button"
                    onClick={handleQuickStockUpdate}
                    disabled={quickStockUpdating}
                    className="px-4 py-2 rounded-xl bg-forest-800 hover:bg-forest-900 disabled:bg-stone-300 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${quickStockUpdating ? 'animate-spin' : ''}`} />
                    {quickStockUpdating ? (language === 'ta' ? 'சேமிக்கிறது...' : 'Saving...') : t('saveStock')}
                  </button>
                </div>

                {quickStockMsg && (
                  <p className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {quickStockMsg}
                  </p>
                )}
                {quickStockErr && (
                  <p className="text-xs text-rose-700 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {quickStockErr}
                  </p>
                )}
              </div>

              {/* Seller Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(true)}
                  className="w-full py-3 px-4 rounded-xl bg-forest-800 hover:bg-forest-900 text-white text-xs sm:text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  <Edit3 className="w-4 h-4 text-cream-100" />
                  {t('editProduct')}
                </button>

                <button
                  type="button"
                  onClick={() => setEditModalOpen(true)}
                  className="w-full py-3 px-4 rounded-xl bg-white hover:bg-stone-50 border border-forest-700 text-forest-900 text-xs sm:text-sm font-bold shadow-2xs transition-all flex items-center justify-center gap-2"
                >
                  <Boxes className="w-4 h-4 text-forest-700" />
                  {t('manageStock')}
                </button>

                <Link
                  to="/seller/orders"
                  className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-stone-50 border border-stone-300 text-charcoal-800 text-xs font-semibold text-center transition-all flex items-center justify-center gap-1.5"
                >
                  <Package className="w-3.5 h-3.5 text-stone-500" />
                  {t('viewOrders')}
                </Link>

                <Link
                  to="/seller/dashboard"
                  className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-stone-50 border border-stone-300 text-charcoal-800 text-xs font-semibold text-center transition-all flex items-center justify-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5 text-stone-500" />
                  {t('viewQuotations')}
                </Link>
              </div>
            </div>
          ) : (
            /* WHOLESALE BUYER & GUEST PURCHASE PANEL */
            <div className="p-5 rounded-2xl bg-[#FCFAF6] border-2 border-forest-100 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#EDE5D6] pb-3">
                <div>
                  <span className="text-xs uppercase font-bold tracking-wider text-forest-950 block">
                    {t('directPurchase')}
                  </span>
                  <span className="text-[11px] text-stone-500">
                    {t('readyStock')}
                  </span>
                </div>
                <div className="text-right">
                  {isOutOfStock ? (
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                      {t('outOfStock')}
                    </span>
                  ) : isStockBelowMoq ? (
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                      {t('stockBelowMoqShort')}
                    </span>
                  ) : (
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                      {stock} {t('inStock')}
                    </span>
                  )}
                </div>
              </div>

              {/* Inconsistency Root-Cause Explanatory Alert (e.g. Stock = 2, MOQ = 50) */}
              {isStockBelowMoq ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-amber-800">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{t('stockBelowMoqShort')}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-800">
                    {language === 'ta'
                      ? `தற்போதுள்ள மொத்த கையிருப்பு (${stock}) குறைந்தபட்ச ஆர்டர் அளவை விட (${moq}) குறைவாக உள்ளது. உடனடி நேரடி கொள்முதல் இயங்காது. எதிர்கால உற்பத்திக்கு கீழே உள்ள 'மொத்த விலைக் கோரிக்கை' பொத்தானை பயன்படுத்தி உற்பத்தியாளரிடம் விசாரிக்கலாம்.`
                      : `Available stock (${stock}) is below the minimum order quantity (${moq}). Immediate direct purchase is disabled until restocked. Please submit a wholesale quotation inquiry below for custom batch production.`}
                  </p>
                </div>
              ) : isOutOfStock ? (
                <div className="p-3 bg-stone-100 border border-stone-200 rounded-xl text-xs text-stone-600">
                  {language === 'ta'
                    ? 'இந்த கைவினை தயாரிப்பு தற்போது கையிருப்பில் இல்லை. எதிர்கால தொகுதி உற்பத்திக்கு கீழே விசாரிக்கவும்.'
                    : 'This craft item is currently out of stock. Submit an inquiry below for batch reproduction.'}
                </div>
              ) : (
                /* Editable Quantity Selector when stock >= moq */
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-semibold text-charcoal-800">
                      {t('orderQuantity')}
                    </label>
                    <span className="text-stone-500 text-[11px]">
                      ({language === 'ta' ? 'குறைந்தது' : 'Min'}: {moq} &bull; {language === 'ta' ? 'அதிகபட்சம்' : 'Max'}: {stock})
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center border border-stone-300 rounded-xl overflow-hidden bg-white shadow-2xs">
                      <button
                        type="button"
                        onClick={() => handleStepQuantity(-1)}
                        disabled={isPurchaseDisabled || quantity <= moq}
                        className="p-2.5 hover:bg-stone-100 text-stone-700 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <input
                        type="number"
                        min={moq}
                        max={stock}
                        value={quantityInput}
                        onChange={(e) => setQuantityInput(e.target.value)}
                        onBlur={(e) => handleQuantityInputCommit(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleQuantityInputCommit(quantityInput);
                          }
                        }}
                        disabled={isPurchaseDisabled}
                        className="w-16 text-center bg-transparent py-2 font-mono font-bold text-sm text-charcoal-900 border-x border-stone-300 focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={() => handleStepQuantity(1)}
                        disabled={isPurchaseDisabled || quantity >= stock}
                        className="p-2.5 hover:bg-stone-100 text-stone-700 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex-1 bg-white px-3 py-2 rounded-xl border border-stone-200">
                      <span className="text-[10px] text-stone-400 uppercase tracking-wider block font-semibold">{t('totalPrice')}</span>
                      <div className="text-lg sm:text-xl font-bold font-mono text-forest-950">
                        ₹{totalPrice.toLocaleString('en-IN')}
                        <span className="text-xs font-normal text-stone-500 ml-1.5 font-sans">
                          ({quantity} {product.unit || (language === 'ta' ? 'அலகு' : 'unit')})
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons: Buy Now & Add to Cart */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleBuyNow}
                  disabled={isPurchaseDisabled}
                  className="w-full py-3 px-4 rounded-xl bg-terracotta-700 hover:bg-terracotta-800 disabled:bg-stone-300 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <ShoppingBag className="w-4 h-4 text-cream-100" />
                  {t('buyNow')}
                </button>

                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={isPurchaseDisabled}
                  className="w-full py-3 px-4 rounded-xl bg-forest-800 hover:bg-forest-900 disabled:bg-stone-300 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <ShoppingCart className="w-4 h-4 text-gold-300" />
                  {t('addToCart')}
                </button>
              </div>

              {/* Notifications / Alerts */}
              {cartSuccessMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{cartSuccessMessage}</span>
                  </div>
                  <Link to="/cart" className="font-bold underline text-emerald-900 hover:text-emerald-950 flex items-center gap-1 shrink-0 ml-2">
                    {t('viewCart')} <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              )}

              {cartErrorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{cartErrorMessage}</span>
                </div>
              )}
            </div>
          )}

          {/* Wholesale & Custom Inquiries Section */}
          <div className="pt-2 border-t border-stone-200 space-y-2">
            <span className="text-[11px] uppercase font-bold text-stone-500 tracking-wider block">
              {t('wholesaleCustomInquiries')}
            </span>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (!user) navigate('/login');
                  else if (user.role === 'buyer') {
                    handleStartConversation();
                  } else {
                    setQuotationModalOpen(true);
                  }
                }}
                className="w-full sm:flex-1 py-3 px-5 rounded-xl bg-white hover:bg-stone-50 text-forest-900 border border-forest-700 text-xs font-semibold shadow-2xs transition-all flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4 text-forest-700" />
                {user?.role === 'buyer' ? t('inquireWholesale') : t('submitQuotation')}
              </button>

              <button
                type="button"
                onClick={handleStartConversation}
                className="w-full sm:w-auto py-3 px-5 rounded-xl bg-white hover:bg-stone-50 text-forest-900 text-xs font-semibold border border-stone-300 shadow-2xs transition-all flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4 text-terracotta-600" />
                {t('messageArtisan')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Similar Products */}
      {similarProducts.length > 0 && (
        <div className="pt-10 border-t border-stone-200 space-y-6">
          <h3 className="font-serif text-xl font-bold text-forest-950">
            {t('similarOfferings')}: {product.category}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {similarProducts.map((sp) => (
              <Link
                key={sp.id}
                to={`/products/${sp.id}`}
                className="bg-white p-3 rounded-2xl border border-stone-200 hover:shadow-md transition-all group"
              >
                <div className="h-32 bg-stone-100 rounded-xl overflow-hidden mb-2">
                  {sp.images && sp.images[0] ? (
                    <img src={sp.images[0]} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-400">
                      <Package className="w-8 h-8" />
                    </div>
                  )}
                </div>
                <h4 className="text-xs font-semibold text-charcoal-900 line-clamp-1 group-hover:text-forest-800">
                  {sp.title}
                </h4>
                <div className="flex items-center justify-between text-[11px] mt-1 font-mono">
                  <span className="font-bold text-forest-900">₹{sp.price_per_unit}</span>
                  <span className="text-stone-400">{t('moqLabel')}: {sp.moq}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quotation Submission Modal */}
      {quotationModalOpen && (
        <QuotationModal
          isOpen={quotationModalOpen}
          onClose={() => setQuotationModalOpen(false)}
          productId={product.id}
          productTitle={product.title}
          buyerId={user?.role === 'buyer' ? user.id : undefined}
          initialQuantity={product.moq}
          initialPrice={product.price_per_unit}
          onQuotationSubmitted={() => {
            alert(language === 'ta' ? 'விலைக் கோரிக்கை வெற்றிகரமாக சமர்ப்பிக்கப்பட்டது!' : "Quotation request submitted! Check your dashboard or messages for updates.");
          }}
        />
      )}

      {/* Edit Product Modal (for authenticated owner / admin) */}
      {editModalOpen && (
        <EditProductModal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          product={product}
          onSuccess={(updated) => {
            setProduct(updated);
            fetchDetail();
          }}
        />
      )}
    </div>
  );
};

export default ProductDetailPage;
