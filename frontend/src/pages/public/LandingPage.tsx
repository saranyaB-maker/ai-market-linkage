import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Sparkles, Search, ShieldCheck, ArrowRight, CheckCircle2, 
  Users, TrendingUp, Layers, Package, Award, ArrowUpRight,
  ChevronRight, Heart, Store
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { VerificationBadge } from '../../components/common/Badge';
import { Product } from '../../types';
import api from '../../services/api';

const CRAFT_CATEGORIES = [
  { name: 'Handloom & Textiles', slug: 'Handloom & Textiles', count: '45+ Weavers', color: 'bg-rose-50 border-rose-200 text-rose-900', img: '🧵' },
  { name: 'Pottery & Terracotta', slug: 'Pottery & Terracotta', count: '30+ Potters', color: 'bg-amber-50 border-amber-200 text-amber-900', img: '🏺' },
  { name: 'Jute & Natural Fiber', slug: 'Jute & Natural Fiber Crafts', count: '60+ SHGs', color: 'bg-emerald-50 border-emerald-200 text-emerald-900', img: '🌾' },
  { name: 'Woodwork & Carving', slug: 'Woodwork & Carving', count: '25+ Artisans', color: 'bg-stone-100 border-stone-300 text-stone-900', img: '🪵' },
  { name: 'Metal & Bell Metal', slug: 'Metal & Bell Metal Crafts', count: '18+ Foundry Groups', color: 'bg-yellow-50 border-yellow-200 text-yellow-900', img: '🔔' },
  { name: 'Bamboo & Cane', slug: 'Bamboo & Cane Crafts', count: '35+ Rural Clusters', color: 'bg-lime-50 border-lime-200 text-lime-900', img: '🎋' }
];

export const LandingPage: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [impactMetrics, setImpactMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [prodRes, impactRes] = await Promise.all([
          api.getProducts({ limit: 4, sort_by: 'newest' }),
          api.getSocialImpact()
        ]);
        setFeaturedProducts(prodRes.products || []);
        setImpactMetrics(impactRes.metrics || null);
      } catch (err) {
        console.error("Error fetching landing data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/marketplace?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const sampleSearchQueries = [
    "500 handmade jute bags under ₹150",
    "Thanjavur cotton sarees MOQ 10",
    "Terracotta water pots in bulk",
    "Eco-friendly bamboo gift boxes"
  ];

  return (
    <div className="space-y-20 pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 md:py-24 bg-gradient-to-b from-[#F5F0E6] via-[#FAF7F0] to-[#FAF8F5] border-b border-[#EAE3D2]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            {/* Tagline pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-forest-100 text-forest-900 text-xs font-semibold border border-forest-200 shadow-xs">
              <ShieldCheck className="w-4 h-4 text-forest-700" />
              <span>Verified Producer Marketplace &middot; Transparent Wholesale Trade</span>
            </div>

            {/* Main Title */}
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-extrabold text-forest-950 tracking-tight leading-[1.15]">
              {t('heroTitle')}
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-charcoal-700 max-w-2xl mx-auto leading-relaxed">
              {t('heroSubtitle')}
            </p>

            {/* Natural-Language Search Box */}
            <form onSubmit={handleSearchSubmit} className="max-w-2xl mx-auto mt-8">
              <div className="relative flex items-center bg-white rounded-2xl shadow-lg border-2 border-forest-700/20 p-2 focus-within:border-forest-700 transition-all">
                <Search className="w-5 h-5 text-stone-400 ml-3 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  className="w-full px-3 py-2 text-sm text-charcoal-900 placeholder-stone-400 focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-forest-800 hover:bg-forest-900 text-white text-xs font-semibold shadow-md transition-all shrink-0"
                >
                  Search Wholesale
                </button>
              </div>

              {/* Sample NLP Query Pills */}
              <div className="flex flex-wrap items-center justify-center gap-2 mt-3 text-xs text-stone-500">
                <span className="font-medium">Try natural queries:</span>
                {sampleSearchQueries.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSearchQuery(q);
                      navigate(`/marketplace?q=${encodeURIComponent(q)}`);
                    }}
                    className="px-2.5 py-1 rounded-full bg-white hover:bg-forest-50 hover:text-forest-800 border border-stone-200 transition-all text-[11px]"
                  >
                    &ldquo;{q}&rdquo;
                  </button>
                ))}
              </div>
            </form>

            {/* Action CTA Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <Link
                to="/marketplace"
                className="px-6 py-3 rounded-xl bg-forest-800 hover:bg-forest-900 text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all flex items-center gap-2"
              >
                <span>{t('ctaExplore')}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/register?role=seller"
                className="px-6 py-3 rounded-xl bg-white hover:bg-stone-50 text-forest-900 text-sm font-semibold border border-forest-300 shadow-xs transition-all"
              >
                {t('ctaSell')}
              </Link>
              <Link
                to="/requirements"
                className="px-6 py-3 rounded-xl bg-terracotta-50 hover:bg-terracotta-100 text-terracotta-800 text-sm font-semibold border border-terracotta-200 transition-all"
              >
                {t('ctaBulkSuppliers')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Social Impact Metrics (Database-Backed) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-[#EAE3D2] shadow-sm">
          <div className="text-center max-w-xl mx-auto mb-8">
            <span className="text-xs uppercase font-bold tracking-wider text-terracotta-700 block">
              Real Platform Social Impact
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-forest-950 mt-1">
              Verifiable Economic Linkage
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center divide-y md:divide-y-0 md:divide-x divide-stone-100">
            <div className="p-4">
              <span className="font-serif text-3xl sm:text-4xl font-extrabold text-forest-900 font-mono block">
                {impactMetrics ? impactMetrics.verified_artisan_groups : '3+'}
              </span>
              <span className="text-xs text-charcoal-700 font-medium mt-1 block">
                {t('impactVerifiedArtisans')}
              </span>
            </div>

            <div className="p-4">
              <span className="font-serif text-3xl sm:text-4xl font-extrabold text-terracotta-700 font-mono block">
                ₹{impactMetrics ? (impactMetrics.total_artisan_earnings_inr || 16250).toLocaleString('en-IN') : '16,250'}
              </span>
              <span className="text-xs text-charcoal-700 font-medium mt-1 block">
                {t('impactTotalEarnings')}
              </span>
            </div>

            <div className="p-4">
              <span className="font-serif text-3xl sm:text-4xl font-extrabold text-gold-700 font-mono block">
                {impactMetrics ? (impactMetrics.orders_fulfilled_or_in_progress || 1) : '1+'}
              </span>
              <span className="text-xs text-charcoal-700 font-medium mt-1 block">
                {t('impactOrdersFulfilled')}
              </span>
            </div>

            <div className="p-4">
              <span className="font-serif text-3xl sm:text-4xl font-extrabold text-forest-900 font-mono block">
                {impactMetrics ? (impactMetrics.artisan_districts_impacted || 3) : '3'}
              </span>
              <span className="text-xs text-charcoal-700 font-medium mt-1 block">
                {t('impactDistricts')}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Craft Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-8">
          <div>
            <span className="text-xs uppercase font-bold tracking-wider text-terracotta-700 block">
              Direct from Rural Clusters
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-forest-950 mt-1">
              Featured Craft Disciplines
            </h2>
          </div>
          <Link
            to="/marketplace"
            className="text-xs font-semibold text-forest-800 hover:text-forest-950 flex items-center gap-1 group"
          >
            <span>View All Categories</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {CRAFT_CATEGORIES.map((cat, idx) => (
            <Link
              key={idx}
              to={`/marketplace?category=${encodeURIComponent(cat.slug)}`}
              className="p-5 rounded-2xl bg-white border border-stone-200 hover:border-forest-600 hover:shadow-md transition-all text-center group"
            >
              <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">{cat.img}</div>
              <h3 className="font-semibold text-xs text-charcoal-900 group-hover:text-forest-800 transition-colors">
                {cat.name}
              </h3>
              <span className="text-[10px] text-stone-500 mt-1 block">
                {cat.count}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Database Product Listings */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-8">
          <div>
            <span className="text-xs uppercase font-bold tracking-wider text-terracotta-700 block">
              Real Catalog Listings
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-forest-950 mt-1">
              Verified Artisan Offerings
            </h2>
          </div>
          <Link
            to="/marketplace"
            className="text-xs font-semibold text-forest-800 hover:text-forest-950 flex items-center gap-1 group"
          >
            <span>Explore Full Marketplace</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-80 rounded-2xl bg-stone-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredProducts.map((p) => (
              <Link
                key={p.id}
                to={`/products/${p.id}`}
                className="group bg-white rounded-2xl border border-stone-200 overflow-hidden hover:shadow-lg transition-all flex flex-col"
              >
                {/* Image */}
                <div className="h-48 bg-stone-100 overflow-hidden relative">
                  {p.images && p.images[0] ? (
                    <img
                      src={p.images[0]}
                      alt={p.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-400">
                      <Package className="w-10 h-10" />
                    </div>
                  )}
                  <div className="absolute top-2.5 left-2.5">
                    <VerificationBadge status={p.seller?.verification_status} />
                  </div>
                </div>

                {/* Details */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-stone-500">
                      {p.category}
                    </span>
                    <h3 className="font-serif text-sm font-bold text-charcoal-900 group-hover:text-forest-800 transition-colors line-clamp-1 mt-0.5">
                      {p.title}
                    </h3>
                    <p className="text-xs text-stone-600 line-clamp-2 mt-1">
                      {p.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-stone-100 mt-3 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-stone-500 block">Unit Price (Wholesale)</span>
                      <span className="font-bold text-sm text-forest-950 font-mono">
                        ₹{p.price_per_unit.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-stone-500 block">MOQ</span>
                      <span className="text-xs font-semibold text-charcoal-800">
                        {p.moq} units
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Authenticity & Verification Explanation */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#FAF6ED] rounded-3xl p-8 sm:p-12 border border-[#E8DFC8]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-forest-800 text-cream-100 text-xs font-semibold">
                <Award className="w-3.5 h-3.5 text-gold-400" />
                <span>Our Core Authenticity Standard</span>
              </div>
              <h2 className="font-serif text-3xl font-extrabold text-forest-950 tracking-tight">
                {t('verificationPolicyTitle')}
              </h2>
              <p className="text-sm text-charcoal-700 leading-relaxed">
                {t('verificationPolicyDesc')}
              </p>

              <div className="space-y-3 pt-2 text-xs">
                <div className="flex items-start gap-3 bg-white p-3.5 rounded-xl border border-stone-200">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-charcoal-900 block font-semibold">
                      Verified Producer / Artisan Group
                    </strong>
                    <span className="text-stone-600">
                      Physical inspection or video proof of pitlooms, potter wheels, kilns, and genuine raw material stock.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-white p-3.5 rounded-xl border border-stone-200">
                  <Store className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-charcoal-900 block font-semibold">
                      Transparent Reseller Separation
                    </strong>
                    <span className="text-stone-600">
                      Resellers who do not manufacture the goods cannot claim the producer badge, eliminating fraudulent middleman spoofing.
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  to="/verification-policy"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-forest-800 hover:text-forest-950 underline"
                >
                  Read our complete verification standards &rarr;
                </Link>
              </div>
            </div>

            {/* Verification flowchart graphic */}
            <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm space-y-4">
              <h4 className="font-semibold text-xs text-charcoal-800 uppercase tracking-wider pb-2 border-b border-stone-100">
                Verification Pipeline:
              </h4>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between">
                  <span className="font-medium text-charcoal-800">1. Artisan Submits Evidence</span>
                  <span className="text-[10px] text-stone-500 bg-white px-2 py-0.5 rounded">Workshop photos</span>
                </div>
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between">
                  <span className="font-medium text-charcoal-800">2. Duplicate Hash Check</span>
                  <span className="text-[10px] text-stone-500 bg-white px-2 py-0.5 rounded">Pillow / ImageHash</span>
                </div>
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between">
                  <span className="font-medium text-charcoal-800">3. Admin Officer Review</span>
                  <span className="text-[10px] text-stone-500 bg-white px-2 py-0.5 rounded">Audit logged</span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                  <span className="font-semibold text-emerald-900">4. Badge Awarded & Catalog Live</span>
                  <span className="text-[10px] text-emerald-800 font-bold bg-white px-2 py-0.5 rounded">Verified Producer</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works for Buyers & Artisans */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-xl mx-auto mb-12">
          <span className="text-xs uppercase font-bold tracking-wider text-terracotta-700 block">
            End-to-End Workflow
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-forest-950 mt-1">
            How AI Market Linkage Operates
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-2xl border border-stone-200 space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-forest-100 text-forest-800 font-bold flex items-center justify-center">
              1
            </div>
            <h3 className="font-serif text-base font-bold text-charcoal-900">
              Artisan Smart Catalog & Fair Pricing
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Artisans use the AI Catalog Generator to generate specifications from photos and the Fair-Price Calculator to price for sustainable wages.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-stone-200 space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-terracotta-100 text-terracotta-800 font-bold flex items-center justify-center">
              2
            </div>
            <h3 className="font-serif text-base font-bold text-charcoal-900">
              AI Bulk Matching & Collective Pooling
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Buyers post wholesale requirements. Our engine evaluates inventory, monthly capacities, and pooling across compatible artisan SHGs.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-stone-200 space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-gold-100 text-gold-900 font-bold flex items-center justify-center">
              3
            </div>
            <h3 className="font-serif text-base font-bold text-charcoal-900">
              Escrow Quotations & Tracked Dispatch
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Parties negotiate revisions, accept quotations atomically, track production milestones, record dispatch, and confirm delivery.
            </p>
          </div>
        </div>
      </section>

      {/* Demonstration Testimonials (Explicitly Labeled) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 rounded-3xl bg-[#FAF8F5] border border-stone-200 space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 bg-white px-2.5 py-1 rounded-md border border-stone-200">
              Demonstration Testimonial & Case Study
            </span>
            <span className="text-xs text-stone-400">Sample development demonstration record</span>
          </div>

          <blockquote className="font-serif text-base sm:text-lg text-charcoal-800 italic leading-relaxed">
            &ldquo;As a handloom weaver society in Thanjavur, our biggest barrier was calculating sustainable wholesale rates for big retail buyers. The Fair-Price Calculator and Direct Collective Pooling helped us supply 500 sarees together with our neighboring cluster.&rdquo;
          </blockquote>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-forest-800 text-white font-bold flex items-center justify-center text-sm">
              RN
            </div>
            <div>
              <strong className="text-xs font-bold text-charcoal-900 block">
                Ramanathan Natarajan
              </strong>
              <span className="text-[11px] text-stone-500 block">
                Master Weaver & Secretary, Thanjavur Art & Handloom Society
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
