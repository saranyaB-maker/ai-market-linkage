import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Package, FileText, ShoppingCart, Star,
  Plus, ChevronRight, Clock, CheckCircle, AlertCircle,
  Building2, TrendingUp, MessageSquare, Check, Truck, RefreshCw
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { PostRequirementModal } from '../../components/modals/PostRequirementModal';

export const BuyerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [requirements, setRequirements] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'requirements' | 'quotations' | 'orders'>('overview');
  const [showReqModal, setShowReqModal] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reqRes, ordersRes, quotRes] = await Promise.allSettled([
        api.getMyRequirements(),
        api.getMyOrders(),
        api.getMyQuotations(),
      ]);
      setRequirements(reqRes.status === 'fulfilled' ? (reqRes.value?.requirements || []) : []);
      setOrders(ordersRes.status === 'fulfilled' ? (ordersRes.value?.orders || []) : []);
      setQuotations(quotRes.status === 'fulfilled' ? (quotRes.value?.quotations || []) : []);
    } catch (e) {
      console.error('Buyer dashboard load error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAcceptQuotation = async (quotationId: string) => {
    if (!window.confirm('Accept this quotation and create a confirmed order?')) return;
    setActionLoadingId(quotationId);
    try {
      const deliveryAddress = {
        street: 'Commercial District Complex, Ring Road',
        city: 'Chennai',
        state: 'Tamil Nadu',
        pincode: '600002',
      };
      await api.createOrderFromQuotation(quotationId, deliveryAddress);
      alert('Quotation accepted! A confirmed bulk order has been generated.');
      await loadData();
      setActiveTab('orders');
    } catch (err: any) {
      alert(err.message || 'Failed to accept quotation.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmDelivery = async (orderId: string) => {
    if (!window.confirm('Confirm receipt of order goods in satisfactory condition?')) return;
    setActionLoadingId(orderId);
    try {
      await api.confirmDelivery(orderId);
      alert('Order marked as completed and delivery confirmed!');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to confirm delivery.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const stats = [
    {
      label: 'Active Requirements',
      value: requirements.filter((r) => r.status === 'open' || r.status === 'in_negotiation').length,
      icon: FileText,
      color: 'text-forest-800',
      bg: 'bg-forest-50',
    },
    {
      label: 'Quotations Received',
      value: quotations.filter((q) => q.status === 'submitted' || q.status === 'revision_requested').length,
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Active Orders',
      value: orders.filter((o) => ['confirmed', 'in_production', 'quality_check', 'dispatched'].includes(o.status)).length,
      icon: ShoppingCart,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Completed Orders',
      value: orders.filter((o) => ['delivered', 'completed'].includes(o.status)).length,
      icon: CheckCircle,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
  ];

  if (loading && requirements.length === 0 && orders.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-forest-800 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-stone-600">Loading buyer dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-serif font-bold text-charcoal-900">
            Welcome, {user?.full_name?.split(' ')[0] || 'Buyer'} 👋
          </h1>
          <p className="text-stone-600 text-sm mt-1">
            Source directly from verified rural artisan clusters and manage your bulk procurement
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/marketplace"
            className="flex items-center gap-2 px-4 py-2 border border-forest-800 text-forest-800 rounded-xl hover:bg-forest-50 transition-colors text-sm font-medium"
          >
            <Search className="w-4 h-4" /> Browse Catalog
          </Link>
          <button
            onClick={() => setShowReqModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-forest-800 text-white rounded-xl hover:bg-forest-900 transition-colors text-sm font-medium shadow-xs"
          >
            <Plus className="w-4 h-4" /> Post Requirement
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-stone-100 p-1 rounded-xl mb-8 w-fit border border-stone-200">
        {(['overview', 'requirements', 'quotations', 'orders'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
              activeTab === tab ? 'bg-white text-charcoal-900 shadow-xs' : 'text-stone-600 hover:text-charcoal-900'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map((s) => (
              <div key={s.label} className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs">
                <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <p className="text-2xl font-bold text-charcoal-900">{s.value}</p>
                <p className="text-xs text-stone-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {[
              {
                title: 'Post a Bulk Requirement',
                desc: 'Describe quantity, specs, target budget and deadline to match verified producers',
                action: () => setShowReqModal(true),
                icon: FileText,
                color: 'text-forest-800 bg-forest-50',
              },
              {
                title: 'Explore Artisan Marketplace',
                desc: 'Browse handloom textiles, pottery, woodwork, and metal crafts directly',
                href: '/marketplace',
                icon: Search,
                color: 'text-terracotta-700 bg-orange-50',
              },
              {
                title: 'Review Open Requirements',
                desc: 'Inspect existing community bulk requirements and collective production pools',
                href: '/requirements',
                icon: Building2,
                color: 'text-gold bg-amber-50',
              },
            ].map((card) =>
              card.href ? (
                <Link
                  key={card.title}
                  to={card.href}
                  className="group p-5 bg-white rounded-2xl border border-stone-200 shadow-xs hover:shadow-md transition-all flex items-start gap-4"
                >
                  <div className={`w-10 h-10 rounded-xl ${card.color} flex items-center justify-center shrink-0`}>
                    <card.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-charcoal-900 text-sm">{card.title}</p>
                    <p className="text-xs text-stone-500 mt-0.5">{card.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-charcoal-900 mt-0.5 shrink-0" />
                </Link>
              ) : (
                <button
                  key={card.title}
                  onClick={card.action}
                  className="group p-5 bg-white rounded-2xl border border-stone-200 shadow-xs hover:shadow-md transition-all flex items-start gap-4 text-left"
                >
                  <div className={`w-10 h-10 rounded-xl ${card.color} flex items-center justify-center shrink-0`}>
                    <card.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-charcoal-900 text-sm">{card.title}</p>
                    <p className="text-xs text-stone-500 mt-0.5">{card.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-charcoal-900 mt-0.5 shrink-0" />
                </button>
              )
            )}
          </div>
        </>
      )}

      {/* Requirements Tab */}
      {activeTab === 'requirements' && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-bold text-charcoal-900 text-lg">My Posted Requirements ({requirements.length})</h2>
            <button
              onClick={() => setShowReqModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-forest-800 text-white rounded-xl hover:bg-forest-900 transition-colors text-sm font-medium shadow-xs"
            >
              <Plus className="w-4 h-4" /> Post Requirement
            </button>
          </div>

          {requirements.length === 0 ? (
            <div className="text-center py-16 bg-[#FAF8F5] rounded-2xl border border-dashed border-stone-300">
              <FileText className="w-14 h-14 text-stone-300 mx-auto mb-4" />
              <h3 className="font-semibold text-charcoal-900 mb-2">No requirements posted yet</h3>
              <p className="text-stone-500 text-sm mb-6">
                Post your bulk requirement to receive competitive, transparent quotations from verified artisan producers.
              </p>
              <button
                onClick={() => setShowReqModal(true)}
                className="px-6 py-2.5 bg-forest-800 text-white rounded-xl font-medium hover:bg-forest-900 transition-colors shadow-xs"
              >
                Post Your First Requirement
              </button>
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {requirements.map((r: any) => (
                <div key={r.id} className="py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <p className="font-bold text-charcoal-900 text-base">{r.title}</p>
                      <p className="text-sm text-stone-600">
                        {r.category} · Qty: <strong className="text-charcoal-900">{r.quantity} {r.unit || 'units'}</strong>
                        {r.target_unit_price ? ` · Target: ₹${r.target_unit_price}/${r.unit || 'unit'}` : ''}
                        {r.max_budget ? ` · Max Budget: ₹${r.max_budget.toLocaleString('en-IN')}` : ''}
                      </p>
                      <p className="text-xs text-stone-400">
                        Destination: {r.destination_city || 'Chennai'}, {r.destination_state || 'Tamil Nadu'} · Posted{' '}
                        {new Date(r.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-3 py-1 rounded-full font-medium shrink-0 self-start sm:self-auto ${
                        r.status === 'open'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : r.status === 'in_negotiation'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {r.status?.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quotations Tab */}
      {activeTab === 'quotations' && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-bold text-charcoal-900 text-lg">Quotations Received ({quotations.length})</h2>
            <button
              onClick={loadData}
              className="text-stone-500 hover:text-forest-800 text-xs flex items-center gap-1 font-medium"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Quotations
            </button>
          </div>

          {quotations.length === 0 ? (
            <div className="text-center py-16 bg-[#FAF8F5] rounded-2xl border border-dashed border-stone-300">
              <FileText className="w-14 h-14 text-stone-300 mx-auto mb-4" />
              <h3 className="font-semibold text-charcoal-900 mb-2">No quotations yet</h3>
              <p className="text-stone-500 text-sm">
                When artisans submit offers against your bulk requirements, they will appear here for review and one-click ordering.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {quotations.map((q: any) => (
                <div key={q.id} className="py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-charcoal-900 text-base">
                          Offer: ₹{(q.total_price || q.quantity * q.unit_price).toLocaleString('en-IN')}
                        </p>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                            q.status === 'accepted'
                              ? 'bg-emerald-50 text-emerald-800'
                              : q.status === 'rejected'
                              ? 'bg-rose-50 text-rose-800'
                              : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          {q.status}
                        </span>
                      </div>
                      <p className="text-xs text-stone-600">
                        From Artisan: <strong className="text-charcoal-900">{q.seller?.name || q.seller_name || 'Verified Artisan'}</strong> · Qty:{' '}
                        {q.quantity} units @ ₹{q.unit_price}/unit
                      </p>
                      <p className="text-xs text-stone-400">
                        Lead Time: {q.lead_time_days || 14} days · Terms: {q.delivery_terms || 'Standard workshop dispatch'}
                      </p>
                      {q.notes && <p className="text-xs text-stone-600 italic mt-1">&quot;{q.notes}&quot;</p>}
                    </div>

                    <div className="flex items-center gap-3">
                      {q.status === 'submitted' && (
                        <button
                          type="button"
                          disabled={actionLoadingId === q.id}
                          onClick={() => handleAcceptQuotation(q.id)}
                          className="px-4 py-2 bg-forest-800 hover:bg-forest-900 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" /> Accept & Create Order
                        </button>
                      )}
                      {q.status === 'accepted' && (
                        <span className="text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl font-medium flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Converted to Order
                        </span>
                      )}
                    </div>
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
            <h2 className="font-bold text-charcoal-900 text-lg">My Orders ({orders.length})</h2>
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
              <h3 className="font-semibold text-charcoal-900 mb-2">No orders placed yet</h3>
              <p className="text-stone-500 text-sm">
                Accept an artisan quotation or order directly from the marketplace to track fulfillment here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {orders.map((o: any) => (
                <div key={o.id} className="py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-charcoal-900">
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
                        Artisan: <strong className="text-charcoal-800">{o.seller?.name || 'Artisan Producer'}</strong> · Qty:{' '}
                        {o.quantity} units · Placed{' '}
                        {new Date(o.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                      {o.product?.title && (
                        <p className="text-xs text-forest-800 font-medium">Craft Item: {o.product.title}</p>
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

                      {/* Delivery Confirmation */}
                      {o.status === 'dispatched' && (
                        <button
                          type="button"
                          disabled={actionLoadingId === o.id}
                          onClick={() => handleConfirmDelivery(o.id)}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1 transition-colors"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Confirm Delivery
                        </button>
                      )}

                      {o.status === 'completed' && (
                        <span className="text-xs text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg font-medium flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Completed
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Post Requirement Modal */}
      <PostRequirementModal
        isOpen={showReqModal}
        onClose={() => setShowReqModal(false)}
        onRequirementCreated={() => {
          setShowReqModal(false);
          loadData();
          setActiveTab('requirements');
        }}
      />
    </div>
  );
};
export default BuyerDashboard;
