import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  Search, Filter, SlidersHorizontal, Package, ChevronLeft, 
  ChevronRight, ArrowUpDown, X, ShieldCheck, MapPin
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { VerificationBadge } from '../../components/common/Badge';
import { ProductImage } from '../../components/common/ProductImage';
import { Product } from '../../types';
import api from '../../services/api';

const CATEGORIES = [
  "All Categories",
  "Pottery & Ceramics",
  "Household Goods, Water Jugs & Pitchers",
  "Pottery & Terracotta",
  "Handloom & Textiles",
  "Bags & Natural Fiber Crafts",
  "Jute & Natural Fiber Crafts",
  "Woodwork & Carving",
  "Metal & Bell Metal Crafts",
  "Jewellery & Beadwork",
  "Bamboo & Cane Crafts",
  "Stone & Marble Carving",
  "Handmade Paper & Leather",
  "Painting & Folk Art",
  "Other Traditional Crafts"
];

export const MarketplacePage: React.FC = () => {
  const { language, t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters state from URL or defaults
  const keyword = searchParams.get('q') || '';
  const category = searchParams.get('category') || 'All Categories';
  const minPrice = searchParams.get('min_price') || '';
  const maxPrice = searchParams.get('max_price') || '';
  const maxMoq = searchParams.get('max_moq') || '';
  const maxLeadDays = searchParams.get('max_lead_days') || '';
  const verification = searchParams.get('verification') || '';
  const sortBy = searchParams.get('sort_by') || 'newest';
  const page = parseInt(searchParams.get('page') || '1', 10);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        page,
        limit: 12,
        sort_by: sortBy,
      };
      if (keyword) params.q = keyword;
      if (category && category !== 'All Categories') params.category = category;
      if (minPrice) params.min_price = minPrice;
      if (maxPrice) params.max_price = maxPrice;
      if (maxMoq) params.max_moq = maxMoq;
      if (maxLeadDays) params.max_lead_days = maxLeadDays;
      if (verification) params.verification = verification;

      const res = await api.getProducts(params, language);
      setProducts(res.products || []);
      setTotalCount(res.pagination?.total_count || 0);
      setTotalPages(res.pagination?.total_pages || 1);
    } catch (err) {
      console.error("Error fetching products:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [searchParams, language]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value && value !== 'All Categories') {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.set('page', '1'); // reset page on filter change
    setSearchParams(next);
  };

  const handlePageChange = (newPage: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(newPage));
    setSearchParams(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearAllFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 w-full overflow-hidden">
      {/* Page Title & Breadcrumb */}
      <div>
        <h1 className="font-serif text-3xl sm:text-4xl font-extrabold text-forest-950 tracking-tight">
          {t('marketplaceTitle')}
        </h1>
        <p className="text-xs sm:text-sm text-stone-600 mt-1">
          {t('marketplaceSubtitle')}
        </p>
      </div>

      {/* Main Grid: Filters Sidebar + Product Catalog */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Filters Sidebar */}
        <aside className="lg:col-span-1 space-y-6 bg-white p-6 rounded-2xl border border-stone-200 h-fit shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-stone-200">
            <span className="font-bold text-xs uppercase tracking-wider text-charcoal-900 flex items-center gap-1.5">
              <SlidersHorizontal className="w-4 h-4 text-forest-700" />
              {t('filterCatalog')}
            </span>
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-[11px] text-terracotta-700 hover:underline font-semibold"
            >
              {t('resetAll')}
            </button>
          </div>

          {/* Search input */}
          <div>
            <label className="block text-xs font-semibold text-charcoal-700 mb-1">
              {t('searchKeywords')}
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => updateParam('q', e.target.value)}
                placeholder={t('searchPlaceholderMarket')}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-xs font-semibold text-charcoal-700 mb-1">
              {t('craftCategory')}
            </label>
            <select
              value={category}
              onChange={(e) => updateParam('category', e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none bg-white"
            >
              {CATEGORIES.map((cat, idx) => (
                <option key={idx} value={cat}>
                  {cat === "All Categories" ? t('allCategories') : cat}
                </option>
              ))}
            </select>
          </div>

          {/* Verification Badge Filter */}
          <div>
            <label className="block text-xs font-semibold text-charcoal-700 mb-1">
              {t('producerVerificationBadge')}
            </label>
            <select
              value={verification}
              onChange={(e) => updateParam('verification', e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none bg-white"
            >
              <option value="">{t('allVerificationLevels')}</option>
              <option value="verified_producer">{t('verifiedOnly')}</option>
              <option value="verified_group">{t('badgeVerifiedGroup')}</option>
              <option value="verified_reseller">{t('badgeVerifiedReseller')}</option>
            </select>
          </div>

          {/* Price Range Filter */}
          <div>
            <label className="block text-xs font-semibold text-charcoal-700 mb-1">
              Wholesale Price Range (₹)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Min ₹"
                value={minPrice}
                onChange={(e) => updateParam('min_price', e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
              />
              <input
                type="number"
                placeholder="Max ₹"
                value={maxPrice}
                onChange={(e) => updateParam('max_price', e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Max MOQ Filter */}
          <div>
            <label className="block text-xs font-semibold text-charcoal-700 mb-1">
              Maximum MOQ (Units)
            </label>
            <input
              type="number"
              placeholder="e.g. 50"
              value={maxMoq}
              onChange={(e) => updateParam('max_moq', e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
            />
          </div>

          {/* Max Lead Days Filter */}
          <div>
            <label className="block text-xs font-semibold text-charcoal-700 mb-1">
              Max Delivery Lead Time (Days)
            </label>
            <input
              type="number"
              placeholder="e.g. 15"
              value={maxLeadDays}
              onChange={(e) => updateParam('max_lead_days', e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
            />
          </div>
        </aside>

        {/* Products Grid & Sorting */}
        <main className="lg:col-span-3 space-y-6">
          {/* Top Sort & Count Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white px-4 py-3 rounded-2xl border border-stone-200 shadow-2xs">
            <span className="text-xs text-charcoal-700 font-medium">
              {t('showing')} <strong className="text-forest-900 font-bold">{products.length}</strong> {t('of')}{' '}
              <strong className="text-forest-900 font-bold">{totalCount}</strong> {t('craftListings')}
            </span>

            <div className="flex items-center gap-2">
              <span className="text-xs text-stone-500 whitespace-nowrap">{t('sortBy')}:</span>
              <select
                value={sortBy}
                onChange={(e) => updateParam('sort_by', e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none bg-white font-medium"
              >
                <option value="newest">{t('sortNewest')}</option>
                <option value="price_asc">{t('sortPriceAsc')}</option>
                <option value="price_desc">{t('sortPriceDesc')}</option>
              </select>
            </div>
          </div>

          {/* Products List */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-84 rounded-2xl bg-stone-100 animate-pulse" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-stone-200 p-8">
              <Package className="w-12 h-12 text-stone-300 mx-auto mb-3" />
              <h3 className="font-serif text-lg font-bold text-charcoal-900">
                No matching craft listings found
              </h3>
              <p className="text-xs text-stone-500 max-w-md mx-auto mt-1 mb-4">
                Try widening your price range or clearing category filters.
              </p>
              <button
                type="button"
                onClick={clearAllFilters}
                className="px-4 py-2 rounded-xl bg-forest-800 text-white text-xs font-semibold"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {products.map((p) => (
                <Link
                  key={p.id}
                  to={`/products/${p.id}`}
                  className="group bg-white rounded-2xl border border-stone-200 overflow-hidden hover:shadow-lg transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Image */}
                    <div className="h-48 bg-stone-100 overflow-hidden relative">
                      <ProductImage
                        src={p.images?.[0]}
                        alt={p.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-2.5 left-2.5">
                        <VerificationBadge status={p.seller?.verification_status} />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between text-[10px] text-stone-500 font-medium">
                        <span className="uppercase tracking-wider">{p.category}</span>
                        {p.seller?.state && (
                          <span className="flex items-center gap-1 text-stone-400">
                            <MapPin className="w-3 h-3" />
                            {p.seller.district ? `${p.seller.district}, ` : ''}{p.seller.state}
                          </span>
                        )}
                      </div>

                      <h3 className="font-serif text-sm font-bold text-charcoal-900 group-hover:text-forest-800 transition-colors line-clamp-1">
                        {p.title}
                      </h3>

                      <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
                        {p.description}
                      </p>

                      <div className="pt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-stone-600">
                        <span className="bg-stone-50 px-2 py-0.5 rounded border border-stone-200">
                          Stock: <strong>{p.stock_quantity} {p.unit || 'piece'}s</strong>
                        </span>
                        <span className="bg-stone-50 px-2 py-0.5 rounded border border-stone-200">
                          Lead Time: <strong>{p.lead_time_days}d</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Pricing footer */}
                  <div className="p-4 pt-3 border-t border-stone-100 bg-[#FCFBF9] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-stone-500 block">Unit Price (₹)</span>
                      <span className="font-bold text-base text-forest-950 font-mono">
                        ₹{p.price_per_unit.toLocaleString('en-IN')}{' '}
                        <span className="text-xs font-normal text-stone-500">/ {p.unit || 'piece'}</span>
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-stone-500 block">MOQ</span>
                      <span className="text-xs font-semibold text-charcoal-800">
                        {p.moq} {p.unit || 'unit'}s
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-6">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
                className="p-2 rounded-xl border border-stone-300 text-stone-600 hover:bg-stone-100 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-xs font-semibold text-charcoal-700 px-3">
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => handlePageChange(page + 1)}
                className="p-2 rounded-xl border border-stone-300 text-stone-600 hover:bg-stone-100 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
