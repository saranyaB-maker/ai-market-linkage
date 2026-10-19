import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Filter, FileText, MapPin, Package, Clock, ChevronRight,
  Plus, Calendar, ShieldCheck, CheckCircle2, Send, X, Info
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { PostRequirementModal } from '../../components/modals/PostRequirementModal';
import { QuotationModal } from '../../components/modals/QuotationModal';

export const RequirementsPage: React.FC = () => {
  const { user } = useAuth();
  const [requirements, setRequirements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showPostModal, setShowPostModal] = useState(false);

  // Quote modal state
  const [selectedReqForQuote, setSelectedReqForQuote] = useState<any | null>(null);

  // View details modal state
  const [detailReq, setDetailReq] = useState<any | null>(null);

  const CATEGORIES = [
    'All Categories',
    'Handloom & Textiles',
    'Pottery & Terracotta',
    'Jute & Natural Fiber Crafts',
    'Woodwork & Carving',
    'Metal & Bell Metal Crafts',
    'Bamboo & Cane Crafts',
    'Stone & Marble Carving',
    'Handmade Paper & Leather',
    'Jewellery & Beadwork',
    'Painting & Folk Art',
    'Other Traditional Crafts',
  ];

  const loadRequirements = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 50 };
      if (categoryFilter && categoryFilter !== 'All Categories') params.category = categoryFilter;
      if (search) params.search = search;
      const res = await api.getRequirements(params);
      setRequirements(res?.requirements || []);
    } catch (e) {
      console.error('Failed to load requirements:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequirements();
  }, [categoryFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadRequirements();
  };

  const formatDate = (ts?: string) => {
    if (!ts) return 'Flexible';
    try {
      return new Date(ts).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return ts;
    }
  };

  const buyerTypeLabel = (type?: string) =>
    ({
      wholesaler: 'Wholesale Buyer',
      retailer: 'Retail Boutique',
      business: 'Enterprise / Corporate',
      institution: 'Cultural Institution',
      exporter: 'Handicraft Exporter',
      individual: 'Direct Customer',
    }[type || 'business'] || 'Verified Buyer');

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold text-charcoal-900">
            Wholesale Buyer Requirements
          </h1>
          <p className="text-stone-600 text-sm mt-1">
            Verified bulk purchase tenders and procurement requests direct from retail, corporate, and export buyers
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          {user?.role === 'buyer' && (
            <button
              onClick={() => setShowPostModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-forest-800 text-white rounded-xl font-medium hover:bg-forest-900 transition-colors text-sm shadow-xs"
            >
              <Plus className="w-4 h-4" /> Post Bulk Requirement
            </button>
          )}
          {!user && (
            <Link
              to="/register"
              className="flex items-center gap-2 px-5 py-2.5 bg-forest-800 text-white rounded-xl font-medium hover:bg-forest-900 transition-colors text-sm shadow-xs"
            >
              <Plus className="w-4 h-4" /> Post as Buyer
            </Link>
          )}
        </div>
      </div>

      {/* Role notice banner */}
      {user?.role === 'seller' && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" />
            <p className="text-xs sm:text-sm text-emerald-900">
              <strong className="font-semibold">Artisan Seller Opportunity:</strong> Review buyer requirements below and submit direct workshop quotations with transparent unit pricing and lead times.
            </p>
          </div>
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search requirements by craft, keywords, city…"
            className="w-full pl-10 pr-4 py-2.5 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-800/30 focus:border-forest-800 text-sm bg-white"
          />
        </form>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="pl-9 pr-8 py-2.5 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-800/30 focus:border-forest-800 text-sm bg-white appearance-none cursor-pointer"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c === 'All Categories' ? '' : c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Requirements List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-forest-800 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : requirements.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-stone-200">
          <FileText className="w-12 h-12 text-stone-300 mx-auto mb-4" />
          <h3 className="font-serif font-bold text-charcoal-900 text-lg mb-2">No requirements found</h3>
          <p className="text-stone-500 text-sm mb-4">
            {user?.role === 'buyer'
              ? 'Be the first to post a bulk craft procurement requirement.'
              : 'No open tenders match your filter. Check back soon!'}
          </p>
          {user?.role === 'buyer' && (
            <button
              onClick={() => setShowPostModal(true)}
              className="px-6 py-2.5 bg-forest-800 text-white rounded-xl font-medium hover:bg-forest-900 transition-colors text-sm shadow-xs"
            >
              Post Requirement
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {requirements.map((req: any) => (
            <div
              key={req.id}
              className="bg-white rounded-2xl border border-stone-200 shadow-xs p-5 sm:p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                {/* Left content */}
                <div className="flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-xs px-2.5 py-0.5 bg-forest-50 text-forest-800 font-semibold rounded-full border border-forest-100">
                      {req.category}
                    </span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                        req.status === 'open'
                          ? 'bg-emerald-50 text-emerald-800'
                          : req.status === 'in_negotiation'
                          ? 'bg-amber-50 text-amber-800'
                          : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {req.status === 'open' ? 'Open for Quotations' : req.status?.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-stone-400">Ref #{req.id?.slice(-6).toUpperCase()}</span>
                  </div>

                  <div>
                    <h3 className="font-serif font-bold text-charcoal-900 text-lg leading-snug">
                      {req.title}
                    </h3>
                    {req.description && (
                      <p className="text-xs sm:text-sm text-stone-600 mt-1 line-clamp-2 leading-relaxed">
                        {req.description}
                      </p>
                    )}
                  </div>

                  {/* Badges / specifications row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs border-t border-stone-100">
                    <div className="flex items-center gap-1.5 text-stone-600">
                      <Package className="w-3.5 h-3.5 text-forest-800 shrink-0" />
                      <span>
                        Qty: <strong className="text-charcoal-900">{req.quantity?.toLocaleString('en-IN')}</strong> {req.unit || 'units'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-stone-600">
                      <span>Target:</span>
                      <strong className="text-charcoal-900">
                        {req.target_unit_price ? `₹${req.target_unit_price}/${req.unit || 'unit'}` : 'Negotiable'}
                      </strong>
                    </div>

                    <div className="flex items-center gap-1.5 text-stone-600">
                      <MapPin className="w-3.5 h-3.5 text-terracotta-700 shrink-0" />
                      <span className="truncate">
                        {req.destination_city || req.delivery_location || 'Tamil Nadu'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-stone-600">
                      <Clock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span>{req.max_lead_time_days ? `${req.max_lead_time_days} days lead` : 'Standard lead'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-stone-400 pt-1">
                    <span>Buyer: {buyerTypeLabel(req.buyer_type)}</span>
                    <span>•</span>
                    <span>Posted {formatDate(req.created_at)}</span>
                  </div>
                </div>

                {/* Right Actions */}
                <div className="flex lg:flex-col items-center lg:items-end justify-between gap-3 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-stone-100">
                  {req.max_budget && (
                    <div className="text-left lg:text-right">
                      <span className="text-[11px] text-stone-500 block">Total Budget:</span>
                      <span className="text-base font-bold text-charcoal-900">
                        ₹{req.max_budget.toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDetailReq(req)}
                      className="px-3 py-2 border border-stone-300 hover:bg-stone-50 text-stone-700 rounded-xl text-xs font-medium transition-colors"
                    >
                      View Details
                    </button>

                    {user?.role === 'seller' && (
                      <button
                        type="button"
                        onClick={() => setSelectedReqForQuote(req)}
                        className="px-4 py-2 bg-forest-800 hover:bg-forest-900 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
                      >
                        <Send className="w-3.5 h-3.5" /> Submit Quotation
                      </button>
                    )}

                    {!user && (
                      <Link
                        to="/login"
                        className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-charcoal-800 rounded-xl text-xs font-medium transition-colors"
                      >
                        Login to Quote
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VIEW DETAILS MODAL */}
      {detailReq && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-stone-200 my-8 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <span className="text-xs px-2.5 py-0.5 bg-forest-50 text-forest-800 font-semibold rounded-full">
                {detailReq.category}
              </span>
              <button
                type="button"
                onClick={() => setDetailReq(null)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h3 className="font-serif font-bold text-xl text-charcoal-900">{detailReq.title}</h3>
              <p className="text-xs text-stone-400 mt-1">Ref #{detailReq.id?.slice(-8).toUpperCase()}</p>
            </div>

            <div className="bg-[#FAF8F5] p-4 rounded-xl border border-stone-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-stone-500">Order Quantity:</span>
                <span className="font-semibold text-charcoal-900">
                  {detailReq.quantity?.toLocaleString('en-IN')} {detailReq.unit || 'units'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Target Unit Budget:</span>
                <span className="font-semibold text-charcoal-900">
                  {detailReq.target_unit_price ? `₹${detailReq.target_unit_price} / ${detailReq.unit || 'unit'}` : 'Negotiable'}
                </span>
              </div>
              {detailReq.max_budget && (
                <div className="flex justify-between">
                  <span className="text-stone-500">Max Stated Budget:</span>
                  <span className="font-semibold text-charcoal-900">₹{detailReq.max_budget?.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-stone-500">Delivery Destination:</span>
                <span className="font-semibold text-charcoal-900">
                  {detailReq.destination_city || 'Chennai'}, {detailReq.destination_state || 'Tamil Nadu'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Max Production Lead Time:</span>
                <span className="font-semibold text-charcoal-900">{detailReq.max_lead_time_days || 25} days</span>
              </div>
            </div>

            {detailReq.description && (
              <div>
                <h4 className="text-xs font-bold text-charcoal-800 mb-1">Requirement Overview</h4>
                <p className="text-xs text-stone-600 leading-relaxed bg-white p-3 rounded-xl border border-stone-200">
                  {detailReq.description}
                </p>
              </div>
            )}

            {detailReq.quality_specifications && (
              <div>
                <h4 className="text-xs font-bold text-charcoal-800 mb-1">Quality Specifications</h4>
                <p className="text-xs text-stone-600 leading-relaxed bg-stone-50 p-3 rounded-xl border border-stone-200">
                  {detailReq.quality_specifications}
                </p>
              </div>
            )}

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setDetailReq(null)}
                className="flex-1 py-2.5 border border-stone-300 text-stone-700 rounded-xl text-xs font-medium hover:bg-stone-50"
              >
                Close
              </button>
              {user?.role === 'seller' && (
                <button
                  type="button"
                  onClick={() => {
                    const r = detailReq;
                    setDetailReq(null);
                    setSelectedReqForQuote(r);
                  }}
                  className="flex-1 py-2.5 bg-forest-800 hover:bg-forest-900 text-white rounded-xl text-xs font-semibold shadow-xs"
                >
                  Submit Workshop Quote
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* POST REQUIREMENT MODAL (FOR BUYERS) */}
      <PostRequirementModal
        isOpen={showPostModal}
        onClose={() => setShowPostModal(false)}
        onRequirementCreated={() => {
          setShowPostModal(false);
          loadRequirements();
        }}
      />

      {/* QUOTATION MODAL (FOR ARTISAN SELLERS) */}
      {selectedReqForQuote && (
        <QuotationModal
          isOpen={true}
          onClose={() => setSelectedReqForQuote(null)}
          requirementId={selectedReqForQuote.id}
          buyerId={selectedReqForQuote.buyer_id || selectedReqForQuote.buyer?.id}
          productTitle={selectedReqForQuote.title}
          initialQuantity={selectedReqForQuote.quantity || 100}
          initialPrice={selectedReqForQuote.target_unit_price || 150}
          onQuotationSubmitted={() => {
            loadRequirements();
          }}
        />
      )}
    </div>
  );
};
export default RequirementsPage;
