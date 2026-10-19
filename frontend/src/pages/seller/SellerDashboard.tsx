import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Package, Plus, TrendingUp, CheckCircle, Clock, AlertCircle,
  Star, MessageSquare, ShoppingCart, Eye, Edit3, Trash2,
  BarChart3, Award, RefreshCw, Upload, Truck, PlayCircle, ShieldCheck, Mic
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import api from '../../services/api';
import { AddProductModal } from '../../components/modals/AddProductModal';
import { FairPriceModal } from '../../components/modals/FairPriceModal';
import { VoiceListingModal } from '../../components/modals/VoiceListingModal';
import { ProductImage } from '../../components/common/ProductImage';

interface DashboardStats {
  totalProducts: number;
  activeProducts: number;
  pendingOrders: number;
  completedOrders: number;
  totalRevenue: number;
  avgRating: number;
}

export const SellerDashboard: React.FC = () => {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [verificationApp, setVerificationApp] = useState<any>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    activeProducts: 0,
    pendingOrders: 0,
    completedOrders: 0,
    totalRevenue: 0,
    avgRating: 4.8,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'orders' | 'verification'>('overview');
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get('action') === 'add-product') {
      setShowAddProductModal(true);
    }
  }, [searchParams]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodRes, ordersRes, reviewSummary, verifRes] = await Promise.allSettled([
        api.getMyProducts(),
        api.getMyOrders(),
        api.getMyReviewSummary(),
        api.getVerificationApplication(),
      ]);

      const prods = prodRes.status === 'fulfilled' ? (prodRes.value?.products || []) : [];
      const ords = ordersRes.status === 'fulfilled' ? (ordersRes.value?.orders || []) : [];
      const reviewStats = reviewSummary.status === 'fulfilled' ? reviewSummary.value : { average_rating: 4.8 };
      const verifData = verifRes.status === 'fulfilled' ? verifRes.value?.application : null;

      setProducts(prods);
      setOrders(ords);
      setVerificationApp(verifData);

      const activeProds = prods.filter((p: any) => p.is_published);
      const pendingOrds = ords.filter((o: any) =>
        ['pending_confirmation', 'confirmed', 'in_production', 'quality_check', 'dispatched'].includes(o.status)
      );
      const completedOrds = ords.filter((o: any) => ['delivered', 'completed'].includes(o.status));
      const revenue = completedOrds.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0);

      setStats({
        totalProducts: prods.length,
        activeProducts: activeProds.length,
        pendingOrders: pendingOrds.length,
        completedOrders: completedOrds.length,
        totalRevenue: revenue,
        avgRating: reviewStats?.average_rating ? Number(reviewStats.average_rating.toFixed(1)) : 4.8,
      });
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStartProduction = async (orderId: string) => {
    setUpdatingOrderId(orderId);
    try {
      await api.updateProductionProgress(orderId, 'In Production', 25, 'Artisan started crafting order items.');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update order');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleDispatchOrder = async (orderId: string) => {
    const trackingNumber = prompt('Enter parcel tracking number (or leave default):', `INP-${Date.now().toString().slice(-6)}`);
    if (trackingNumber === null) return;

    setUpdatingOrderId(orderId);
    try {
      await api.dispatchOrder(orderId, 'India Post Speed Post', trackingNumber || 'INP-STANDARD');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch order');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const verificationColor = (status: string) => {
    switch (status) {
      case 'verified_producer':
      case 'verified_group':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'pending':
        return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'needs_more_information':
        return 'text-orange-700 bg-orange-50 border-orange-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const verificationLabel = (status: string) => {
    if (language === 'ta') {
      const mapTa: Record<string, string> = {
        unverified: 'சரிபார்க்கப்படாத கைவினைஞர்',
        pending: 'சரிபார்ப்பு பரிசீலனையில் உள்ளது',
        needs_more_information: 'கூடுதல் விவரங்கள் தேவை',
        verified_producer: 'சரிபார்க்கப்பட்ட கைவினைஞர்',
        verified_group: 'சான்றளிக்கப்பட்ட குழு',
        verified_reseller: 'சான்றளிக்கப்பட்ட மறுவிற்பனையாளர்',
      };
      return mapTa[status] || status;
    }
    const map: Record<string, string> = {
      unverified: 'Unverified Artisan',
      pending: 'Verification Pending',
      needs_more_information: 'More Info Needed',
      verified_producer: 'Verified Artisan',
      verified_group: 'Verified Group',
      verified_reseller: 'Verified Reseller',
    };
    return map[status] || status;
  };

  if (loading && products.length === 0 && orders.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-forest-800 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-stone-600">Loading your seller dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-charcoal-900">
            {t('welcomeBack')}, {user?.full_name?.split(' ')[0] || (language === 'ta' ? 'கைவினைஞர்' : 'Artisan Seller')} 👋
          </h1>
          <p className="text-stone-600 text-sm mt-1">{t('sellerSubtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto shrink-0">
          <button
            type="button"
            onClick={() => setShowVoiceModal(true)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 h-11 px-4 border border-amber-600/40 text-amber-950 bg-amber-50 hover:bg-amber-100/80 rounded-xl transition-all text-sm font-semibold shadow-xs whitespace-nowrap"
            title="Tamil / English Voice Assistant for product listing"
          >
            <Mic className="w-4 h-4 text-amber-700 animate-pulse" />
            <span>{language === 'ta' ? 'குரல் வழி பதிவேற்றம்' : 'Voice Listing (தமிழ் / Eng)'}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowPriceModal(true)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 h-11 px-4 border border-forest-800 text-forest-800 bg-white hover:bg-forest-50/70 rounded-xl transition-colors text-sm font-semibold shadow-xs whitespace-nowrap"
          >
            <TrendingUp className="w-4 h-4 text-forest-800" />
            <span>{t('fairPriceCalculator')}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAddProductModal(true)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 h-11 px-5 bg-forest-800 hover:bg-forest-900 text-white rounded-xl transition-colors text-sm font-semibold shadow-sm hover:shadow-md whitespace-nowrap"
          >
            <Plus className="w-4 h-4 text-gold-300" />
            <span>{t('addProduct')}</span>
          </button>
        </div>
      </div>

      {/* Verification status banner */}
      {(!verificationApp || verificationApp.verification_status !== 'approved') && (
        <div className={`mb-8 p-5 sm:p-6 rounded-2xl border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5 ${
          verificationApp?.verification_status === 'pending'
            ? 'bg-amber-50/80 border-amber-200'
            : verificationApp?.verification_status === 'rejected'
            ? 'bg-rose-50/80 border-rose-200'
            : verificationApp?.verification_status === 'draft'
            ? 'bg-blue-50/80 border-blue-200'
            : 'bg-[#FAF8F5] border-[#E8E2D5]'
        }`}>
          <div className="flex items-start gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
              verificationApp?.verification_status === 'pending'
                ? 'bg-amber-100 text-amber-700'
                : verificationApp?.verification_status === 'rejected'
                ? 'bg-rose-100 text-rose-700'
                : verificationApp?.verification_status === 'draft'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-forest-100/70 text-forest-800'
            }`}>
              {verificationApp?.verification_status === 'pending' ? (
                <Clock className="w-5 h-5" />
              ) : verificationApp?.verification_status === 'rejected' ? (
                <AlertCircle className="w-5 h-5" />
              ) : (
                <ShieldCheck className="w-5 h-5" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <p className="font-semibold text-charcoal-900 text-base">
                  {verificationApp?.verification_status === 'pending'
                    ? t('verificationUnderReview')
                    : verificationApp?.verification_status === 'rejected'
                    ? t('verificationRequiresRevision')
                    : verificationApp?.verification_status === 'draft'
                    ? t('verificationInProgress')
                    : t('getVerifiedArtisan')}
                </p>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                  verificationApp?.verification_status === 'pending'
                    ? 'bg-amber-200 text-amber-900'
                    : verificationApp?.verification_status === 'rejected'
                    ? 'bg-rose-200 text-rose-900'
                    : verificationApp?.verification_status === 'draft'
                    ? 'bg-blue-200 text-blue-900'
                    : 'bg-stone-200 text-stone-700'
                }`}>
                  {verificationApp?.verification_status?.replace(/_/g, ' ') || 'Not Started'}
                </span>
              </div>

              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed max-w-3xl">
                {verificationApp?.verification_status === 'pending'
                  ? `${t('verificationDescPending')} ${verificationApp.submitted_at ? new Date(verificationApp.submitted_at).toLocaleDateString() : ''}`
                  : verificationApp?.verification_status === 'rejected'
                  ? `${t('verificationRequiresRevision')}: "${verificationApp.rejection_reason || 'Evidence insufficient'}"`
                  : verificationApp?.verification_status === 'draft'
                  ? t('verificationDescDraft')
                  : t('verificationDescNotStarted')}
              </p>
            </div>
          </div>

          <div className="shrink-0 self-start md:self-center">
            <Link
              to="/seller/verification"
              className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-forest-800 hover:bg-forest-900 text-white text-xs font-semibold shadow-xs transition-all whitespace-nowrap"
            >
              {verificationApp?.verification_status === 'pending'
                ? t('viewApplication')
                : verificationApp?.verification_status === 'rejected'
                ? t('updateResubmit')
                : verificationApp?.verification_status === 'draft'
                ? t('continueVerification')
                : t('completeVerification')}
            </Link>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 bg-stone-100/90 p-1.5 rounded-2xl mb-8 w-fit border border-stone-200/80 shadow-2xs overflow-x-auto max-w-full">
        {(['overview', 'products', 'orders', 'verification'] as const).map((tab) => {
          const tabLabel = tab === 'overview' ? t('tabOverview')
            : tab === 'products' ? t('tabProducts')
            : tab === 'orders' ? t('tabOrders')
            : t('tabVerification');
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`h-9 px-4 rounded-xl text-sm font-medium capitalize transition-all whitespace-nowrap flex items-center justify-center ${
                activeTab === tab
                  ? 'bg-white text-charcoal-900 font-semibold shadow-xs'
                  : 'text-stone-600 hover:text-charcoal-900 hover:bg-stone-200/50'
              }`}
            >
              {tabLabel}
            </button>
          );
        })}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-8">
            {[
              {
                label: t('statActiveProducts'),
                value: stats.activeProducts,
                icon: Package,
                color: 'text-forest-800',
                bg: 'bg-forest-50',
              },
              {
                label: t('statPendingOrders'),
                value: stats.pendingOrders,
                icon: Clock,
                color: 'text-amber-600',
                bg: 'bg-amber-50',
              },
              {
                label: t('statCompletedOrders'),
                value: stats.completedOrders,
                icon: CheckCircle,
                color: 'text-emerald-600',
                bg: 'bg-emerald-50',
              },
              {
                label: t('statTotalRevenue'),
                value: `₹${stats.totalRevenue.toLocaleString('en-IN')}`,
                icon: TrendingUp,
                color: 'text-terracotta-700',
                bg: 'bg-orange-50',
              },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-xs flex flex-col justify-between">
                <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-charcoal-900 tracking-tight">{stat.value}</p>
                  <p className="text-xs font-medium text-stone-500 mt-1">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Recent products */}
          <div className="bg-white rounded-2xl border border-stone-200/90 shadow-xs p-6 mb-8">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-stone-100">
              <div>
                <h2 className="font-bold text-charcoal-900 text-base">Your Products ({products.length})</h2>
                <p className="text-xs text-stone-500 mt-0.5">Recently listed artisan crafts and inventory</p>
              </div>
              <button
                onClick={() => setActiveTab('products')}
                className="text-forest-800 text-xs font-semibold hover:underline"
              >
                View all listings →
              </button>
            </div>
            {products.length === 0 ? (
              <div className="text-center py-12 px-4 bg-[#FAF8F5] rounded-xl border border-dashed border-stone-300 my-2">
                <Package className="w-10 h-10 text-stone-400 mx-auto mb-3" />
                <p className="text-stone-700 text-sm font-medium">No products listed yet.</p>
                <p className="text-stone-500 text-xs mt-1 max-w-sm mx-auto">
                  Add your first handmade craft listing with AI assistance to start selling to verified wholesale buyers.
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(true)}
                  className="mt-4 inline-flex items-center gap-2 h-10 px-5 bg-forest-800 hover:bg-forest-900 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
                >
                  <Plus className="w-4 h-4 text-gold-300" />
                  <span>Add First Product</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {products.slice(0, 4).map((p: any) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-stone-50 transition-colors border border-stone-100"
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-stone-100 shrink-0 border border-stone-200">
                      <ProductImage
                        src={p.images?.[0]}
                        alt={p.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-charcoal-900 text-sm truncate">{p.title}</p>
                      <p className="text-xs text-stone-500">
                        ₹{p.price_per_unit} / {p.unit || 'piece'} · Stock: {p.available_stock ?? p.stock_quantity}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        p.is_published ? 'bg-emerald-50 text-emerald-800' : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {p.is_published ? t('published') : t('draft')}
                    </span>
                    <Link
                      to={`/products/${p.id}`}
                      className="p-1.5 text-stone-400 hover:text-forest-800 transition-colors"
                      title="View product page"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Verification status */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-6">
            <h2 className="font-bold text-charcoal-900 mb-3">Producer Verification Status</h2>
            <div
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-sm font-medium ${verificationColor(
                user?.verification_status || 'unverified'
              )}`}
            >
              <Award className="w-4 h-4" />
              {verificationLabel(user?.verification_status || 'unverified')}
            </div>
            {(!user?.verification_status || user.verification_status === 'unverified') && (
              <p className="text-sm text-stone-600 mt-3">
                Submit workspace evidence, loom/workshop video, or artisan card to become a verified seller.{' '}
                <button
                  onClick={() => setActiveTab('verification')}
                  className="text-forest-800 font-semibold hover:underline"
                >
                  Learn how →
                </button>
              </p>
            )}
          </div>
        </>
      )}

      {/* Products Tab */}
      {activeTab === 'products' && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-bold text-charcoal-900 text-lg">All Products ({products.length})</h2>
            <button
              onClick={() => setShowAddProductModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-forest-800 text-white rounded-xl hover:bg-forest-900 transition-colors text-sm font-medium shadow-xs"
            >
              <Plus className="w-4 h-4" /> Add Product
            </button>
          </div>
          {products.length === 0 ? (
            <div className="text-center py-16 bg-[#FAF8F5] rounded-2xl border border-dashed border-stone-300">
              <Package className="w-14 h-14 text-stone-300 mx-auto mb-4" />
              <h3 className="font-semibold text-charcoal-900 mb-2">No products added yet</h3>
              <p className="text-stone-500 text-sm mb-6">
                Use camera capture or gallery upload with AI catalog assistant to list your handcrafted creations.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => setShowVoiceModal(true)}
                  className="px-5 py-2.5 bg-amber-700 text-white rounded-xl font-medium hover:bg-amber-800 transition-colors shadow-xs inline-flex items-center gap-2"
                >
                  <Mic className="w-4 h-4" />
                  {language === 'ta' ? 'குரல் வழி பதிவேற்றம் தொடங்கு' : 'Start Voice Listing (Tamil / English)'}
                </button>
                <button
                  onClick={() => setShowAddProductModal(true)}
                  className="px-5 py-2.5 bg-forest-800 text-white rounded-xl font-medium hover:bg-forest-900 transition-colors shadow-xs"
                >
                  {language === 'ta' ? 'வழக்கமான படிவம்' : 'Standard Add Form'}
                </button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {products.map((p: any) => (
                <div key={p.id} className="flex items-center gap-4 py-4">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-stone-100 shrink-0 border border-stone-200">
                    <ProductImage
                      src={p.images?.[0]}
                      alt={p.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-charcoal-900 truncate">{p.title}</p>
                    <p className="text-sm text-stone-600">
                      {p.category} · <span className="font-semibold text-charcoal-900">₹{p.price_per_unit}</span> / {p.unit || 'piece'}
                    </p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      Available Stock: {p.available_stock ?? p.stock_quantity} {p.unit || 'piece'}s · MOQ: {p.moq || 1}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        p.is_published ? 'bg-emerald-50 text-emerald-800' : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {p.is_published ? (language === 'ta' ? 'வெளியிடப்பட்டது' : 'Published') : t('draft')}
                    </span>
                    <Link
                      to={`/products/${p.id}`}
                      className="p-2 text-stone-500 hover:text-forest-800 rounded-lg hover:bg-forest-50 transition-colors"
                      title="View public product page"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-bold text-charcoal-900 text-lg">Orders Received ({orders.length})</h2>
            <button
              onClick={loadData}
              className="text-stone-500 hover:text-forest-800 text-xs flex items-center gap-1 font-medium"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Orders
            </button>
          </div>

          {orders.length === 0 ? (
            <div className="text-center py-16 bg-[#FAF8F5] rounded-2xl border border-dashed border-stone-300">
              <ShoppingCart className="w-14 h-14 text-stone-300 mx-auto mb-4" />
              <h3 className="font-semibold text-charcoal-900 mb-2">No orders yet</h3>
              <p className="text-stone-500 text-sm">
                Orders from wholesale buyers and direct customers will appear here once your products are published.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {orders.map((o: any) => (
                <div key={o.id} className="py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-charcoal-900 text-sm">
                          Order #{o.order_number || o.id?.slice(-6).toUpperCase()}
                        </p>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                            o.status === 'delivered' || o.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-800'
                              : o.status === 'dispatched'
                              ? 'bg-purple-50 text-purple-800'
                              : o.status === 'in_production'
                              ? 'bg-amber-50 text-amber-800'
                              : o.status === 'confirmed'
                              ? 'bg-blue-50 text-blue-800'
                              : 'bg-stone-100 text-stone-700'
                          }`}
                        >
                          {o.status?.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-stone-500">
                        Buyer: <span className="font-medium text-charcoal-800">{o.buyer?.name || 'Buyer'}</span> · Qty: {o.quantity} units · Date:{' '}
                        {new Date(o.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                      {o.product?.title && (
                        <p className="text-xs text-forest-800 font-medium">Item: {o.product.title}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-4 justify-between sm:justify-end">
                      <div className="text-right">
                        <p className="font-bold text-charcoal-900 text-base">
                          ₹{(o.total_amount || 0).toLocaleString('en-IN')}
                        </p>
                        <p className="text-[11px] text-stone-500">
                          ₹{o.unit_price || Math.round((o.total_amount || 0) / (o.quantity || 1))} / unit
                        </p>
                      </div>

                      {/* Action buttons for seller order progression */}
                      <div className="flex items-center gap-2">
                        {o.status === 'confirmed' && (
                          <button
                            type="button"
                            disabled={updatingOrderId === o.id}
                            onClick={() => handleStartProduction(o.id)}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors"
                          >
                            <PlayCircle className="w-3.5 h-3.5" /> Start Production
                          </button>
                        )}

                        {o.status === 'in_production' && (
                          <button
                            type="button"
                            disabled={updatingOrderId === o.id}
                            onClick={() => handleDispatchOrder(o.id)}
                            className="px-3 py-1.5 bg-forest-800 hover:bg-forest-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors"
                          >
                            <Truck className="w-3.5 h-3.5" /> Mark Dispatched
                          </button>
                        )}

                        {o.status === 'dispatched' && (
                          <span className="text-xs text-purple-700 font-medium bg-purple-50 px-2.5 py-1 rounded-lg">
                            In Transit to Buyer
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Verification Tab */}
      {activeTab === 'verification' && (
        <div className="bg-white rounded-3xl border border-stone-200 shadow-xs p-6 sm:p-8 space-y-6">
          <div className="border-b border-stone-100 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif font-bold text-charcoal-900 text-xl">
                  Artisan Producer Verification Dossier
                </h2>
                <p className="text-stone-600 text-xs sm:text-sm mt-1">
                  Verified producers unlock direct public listing on the marketplace and receive the verified trust badge.
                </p>
              </div>

              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                verificationApp?.verification_status === 'approved'
                  ? 'bg-emerald-100 text-emerald-800'
                  : verificationApp?.verification_status === 'pending'
                  ? 'bg-amber-100 text-amber-800'
                  : verificationApp?.verification_status === 'rejected'
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-stone-100 text-stone-700'
              }`}>
                Status: {verificationApp?.verification_status?.replace(/_/g, ' ') || 'Not Started'}
              </span>
            </div>
          </div>

          {/* Current Application Summary Card */}
          <div className="p-5 rounded-2xl bg-[#FCFAF6] border border-[#EDE5D6] space-y-3">
            <h4 className="font-semibold text-xs uppercase tracking-wider text-forest-900">
              4-Step Application Checklist
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-white rounded-xl border border-stone-200 flex items-center justify-between">
                <span className="font-medium text-charcoal-800">Step 1: Workshop & Craft Profile</span>
                {verificationApp?.artisan_profile?.workshop_details ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Saved
                  </span>
                ) : (
                  <span className="text-stone-400">Pending</span>
                )}
              </div>

              <div className="p-3 bg-white rounded-xl border border-stone-200 flex items-center justify-between">
                <span className="font-medium text-charcoal-800">Step 2: Supporting Documents</span>
                {verificationApp?.documents?.length > 0 ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> {verificationApp.documents.length} Uploaded
                  </span>
                ) : (
                  <span className="text-stone-400">0 Uploaded</span>
                )}
              </div>

              <div className="p-3 bg-white rounded-xl border border-stone-200 flex items-center justify-between">
                <span className="font-medium text-charcoal-800">Step 3: Craft Process Video</span>
                {verificationApp?.craft_video ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Video Ready
                  </span>
                ) : (
                  <span className="text-stone-400">Pending</span>
                )}
              </div>

              <div className="p-3 bg-white rounded-xl border border-stone-200 flex items-center justify-between">
                <span className="font-medium text-charcoal-800">Step 4: Submission & Declaration</span>
                {verificationApp?.verification_status === 'pending' || verificationApp?.verification_status === 'approved' ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Submitted
                  </span>
                ) : (
                  <span className="text-stone-400">Draft</span>
                )}
              </div>
            </div>

            {verificationApp?.rejection_reason && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                <strong>Reviewer Feedback:</strong> {verificationApp.rejection_reason}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              to="/seller/verification"
              className="inline-flex items-center gap-2 px-6 py-3 bg-forest-800 text-white rounded-xl font-semibold hover:bg-forest-900 transition-all text-xs sm:text-sm shadow-sm hover:shadow-md"
            >
              <Upload className="w-4 h-4 text-gold-300" />
              {verificationApp?.verification_status === 'pending'
                ? 'View Submitted Dossier'
                : verificationApp?.verification_status === 'rejected'
                ? 'Update & Resubmit Application'
                : verificationApp?.verification_status === 'draft'
                ? 'Continue 4-Step Verification Form'
                : 'Start 4-Step Verification Form'}
            </Link>

            <Link
              to="/verification-policy"
              className="inline-flex items-center gap-1.5 px-4 py-3 bg-white border border-stone-300 text-stone-700 rounded-xl font-medium hover:bg-stone-50 transition-colors text-xs"
            >
              Read Public Verification Standards &rsaquo;
            </Link>
          </div>
        </div>
      )}

      {/* Modals */}
      <AddProductModal
        isOpen={showAddProductModal}
        onClose={() => setShowAddProductModal(false)}
        onSuccess={() => {
          setShowAddProductModal(false);
          loadData();
        }}
      />

      <FairPriceModal
        isOpen={showPriceModal}
        onClose={() => setShowPriceModal(false)}
        onApplyPrice={(price) => {
          setShowPriceModal(false);
          setShowAddProductModal(true);
        }}
      />

      <VoiceListingModal
        isOpen={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        onSuccess={() => {
          setShowVoiceModal(false);
          loadData();
        }}
        initialLanguage={language === 'ta' ? 'ta' : 'en'}
      />
    </div>
  );
};
export default SellerDashboard;
