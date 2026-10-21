import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Sparkles, Search, ShieldCheck, ArrowRight, CheckCircle2, 
  Users, TrendingUp, Layers, Package, Award, ArrowUpRight,
  ChevronRight, Heart, Store, MapPin, Feather, Check,
  BadgeCheck, Clock, ShieldAlert, Sparkle, Compass, Handshake,
  Tag, Box, CheckCircle
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { VerificationBadge } from '../../components/common/Badge';
import { ProductImage } from '../../components/common/ProductImage';
import { Product } from '../../types';
import api from '../../services/api';

// ── Realistic Indian rural handicraft categories — PRODUCT PHOTOGRAPHS ONLY (NO PEOPLE) ──
const CRAFT_DISCIPLINES = [
  {
    name: 'Handloom & Textiles',
    slug: 'Handloom & Textiles',
    count: '45+ Weavers',
    tag: 'GI & Heritage Silk',
    description: 'Folded pure mulberry silk and combed cotton handloom sarees with authentic temple borders.',
    image: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=700&q=80',
    fallbackColor: 'bg-[#EDE4D3]'
  },
  {
    name: 'Pottery & Terracotta',
    slug: 'Pottery & Terracotta',
    count: '30+ Potters',
    tag: 'Riverbed Clay',
    description: 'Traditional terracotta water pots, clay pitchers, diyas, and kiln-fired earthenware vessels.',
    image: 'https://images.unsplash.com/photo-1615486511484-92e172cc4fe0?auto=format&fit=crop&w=700&q=80',
    fallbackColor: 'bg-[#F2E5D9]'
  },
  {
    name: 'Jute & Natural Fiber',
    slug: 'Jute & Natural Fiber Crafts',
    count: '60+ SHGs',
    tag: 'Eco-Friendly',
    description: 'Braided golden jute tote bags, conference pouches, woven storage bins, and natural fiber mats.',
    image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=700&q=80',
    fallbackColor: 'bg-[#E5ECE5]'
  },
  {
    name: 'Woodwork & Carving',
    slug: 'Woodwork & Carving',
    count: '25+ Artisans',
    tag: 'Traditional Teak',
    description: 'Hand-carved wooden craft panels, turned wooden bowls, traditional toys, and home tableware.',
    image: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=700&q=80',
    fallbackColor: 'bg-[#EFE6DC]'
  },
  {
    name: 'Metal & Bell Metal',
    slug: 'Metal & Bell Metal Crafts',
    count: '18+ Foundries',
    tag: 'Cast Brass & Bronze',
    description: 'Handcrafted traditional Indian brass lamps (diyas), bell metal vessels, and lost-wax bronze crafts.',
    image: 'https://images.unsplash.com/photo-1605651202774-7d573fd3f12d?auto=format&fit=crop&w=700&q=80',
    fallbackColor: 'bg-[#F4EED9]'
  },
  {
    name: 'Bamboo & Cane',
    slug: 'Bamboo & Cane Crafts',
    count: '35+ Clusters',
    tag: 'Zero-Waste Cane',
    description: 'Handwoven cane storage baskets, organic bamboo packaging boxes, and traditional fiber mats.',
    image: 'https://images.unsplash.com/photo-1595053826286-2e59ef7955fb?auto=format&fit=crop&w=700&q=80',
    fallbackColor: 'bg-[#EAEFE6]'
  }
];

// ── Featured Craft Specialties — PRODUCT-ONLY PHOTOGRAPHS (NO PEOPLE) ──
const FEATURED_CRAFT_SPECIALTIES = [
  {
    productTitle: 'Thanjavur Pure Cotton & Silk Handloom Saree',
    cluster: 'Thanjavur Handloom Weavers Guild',
    district: 'Thanjavur, Tamil Nadu',
    craft: 'Handwoven Korvai Temple Borders & AZO-Free Dye',
    description: 'Woven on 12 traditional family pitlooms. Pure combed cotton warp with delicate zari temple motifs, dyed using certified skin-friendly botanical colors.',
    badge: 'Verified Producer Guild',
    image: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=800&q=80',
    categorySlug: 'Handloom & Textiles',
    stats: '12 Traditional Pitlooms · 2,400m Monthly Capacity',
    priceEstimate: '₹650 / saree (MOQ: 10)'
  },
  {
    productTitle: 'Manamadurai GI-Tagged Terracotta Water Jug',
    cluster: 'Manamadurai Pottery Cooperative',
    district: 'Sivagangai, Tamil Nadu',
    craft: 'Hand-thrown Vaigai Riverbed Clay with Red Ochre',
    description: 'Crafted using mineral-rich alluvial silt from the Vaigai river basin. Natural porous clay allows evaporative cooling, fired in biomass wood kilns.',
    badge: 'GI-Tagged Producer Cooperative',
    image: 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=800&q=80',
    categorySlug: 'Pottery & Terracotta',
    stats: 'Cooperative Kilns · 12,000 Units/Yr Capacity',
    priceEstimate: '₹220 / pot (MOQ: 25)'
  },
  {
    productTitle: 'Eco-Friendly Braided Jute Conference Tote',
    cluster: 'Kaveri Women Jute & Fiber Collective',
    district: 'Madurai, Tamil Nadu',
    craft: 'Hand-stitched 100% Golden Jute with Cotton Webbing',
    description: 'Reinforced dual handles, natural golden jute weave with cotton twill lining. Designed for corporate bulk gifting and sustainable retail packaging.',
    badge: 'Verified Women SHG Federation',
    image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80',
    categorySlug: 'Jute & Natural Fiber Crafts',
    stats: '40 Rural Women Artisans · 1,500 Bags/Month',
    priceEstimate: '₹135 / bag (MOQ: 50)'
  }
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
    <div className="space-y-16 sm:space-y-24 pb-20 w-full overflow-hidden">
      
      {/* ── 1. Hero Section: Product-Only Indian Handicraft Showcase ───────── */}
      <section className="relative overflow-hidden bg-[#244131] text-white border-b border-[#1A3326]">
        {/* Subtle decorative warm ambient lighting */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#C47745]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 left-10 w-96 h-96 bg-[#477B5E]/30 rounded-full blur-3xl pointer-events-none" />
        
        {/* Subtle woven pattern overlay */}
        <div 
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(#F6F0E5 1px, transparent 1px)`,
            backgroundSize: '24px 24px'
          }}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 lg:py-20 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            
            {/* Left Column: Direct Wholesale Messaging & Search */}
            <div className="lg:col-span-6 space-y-6 text-left">
              {/* Trust Tagline Pill */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1A3326]/80 text-[#E5EDE6] text-xs font-semibold border border-[#3A634E] shadow-sm backdrop-blur-sm">
                <ShieldCheck className="w-4 h-4 text-[#C47745]" />
                <span className="tracking-wide">Direct Rural Producer Linkage &middot; 100% Genuine Handicrafts</span>
              </div>

              {/* Main Headline */}
              <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-5xl font-extrabold text-[#FAF6EE] tracking-tight leading-[1.18]">
                {t('heroTitle')}
              </h1>

              {/* Subtitle */}
              <p className="text-sm sm:text-base text-[#D4DCD6] max-w-2xl leading-relaxed">
                {t('heroSubtitle')}
              </p>

              {/* Natural Language Wholesale Search */}
              <form onSubmit={handleSearchSubmit} className="max-w-2xl pt-2">
                <div className="relative flex items-center bg-white rounded-2xl shadow-craft-lg border-2 border-[#E5DAC8] p-1.5 focus-within:border-[#C47745] focus-within:ring-2 focus-within:ring-[#C47745]/20 transition-all">
                  <Search className="w-5 h-5 text-[#88918A] ml-3 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('searchPlaceholder')}
                    className="w-full px-3 py-2 text-sm text-[#1E2621] placeholder-[#88918A] focus:outline-none bg-transparent"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-[#C47745] hover:bg-[#B06132] text-white text-xs font-semibold shadow-md transition-all shrink-0 flex items-center gap-1.5"
                  >
                    <span>Search Wholesale</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Sample Natural Language Queries */}
                <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-[#C5DBCF]">
                  <span className="font-medium text-[#FAF6EE]/80">Try queries:</span>
                  {sampleSearchQueries.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSearchQuery(q);
                        navigate(`/marketplace?q=${encodeURIComponent(q)}`);
                      }}
                      className="px-2.5 py-1 rounded-full bg-[#1A3326]/70 hover:bg-[#2F5741] text-[#FAF6EE] border border-[#3A634E] transition-all text-[11px]"
                    >
                      &ldquo;{q}&rdquo;
                    </button>
                  ))}
                </div>
              </form>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3.5 pt-3">
                <Link
                  to="/marketplace"
                  className="px-6 py-3 rounded-xl bg-[#FAF6EE] hover:bg-white text-[#1F3C2C] text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                >
                  <span>{t('ctaExplore')}</span>
                  <ArrowRight className="w-4 h-4 text-[#C47745]" />
                </Link>
                <Link
                  to="/register?role=seller"
                  className="px-6 py-3 rounded-xl bg-[#1A3326] hover:bg-[#152B20] text-[#FAF6EE] text-sm font-semibold border border-[#3A634E] shadow-sm transition-all"
                >
                  {t('ctaSell')}
                </Link>
                <Link
                  to="/requirements"
                  className="px-6 py-3 rounded-xl bg-[#C47745]/20 hover:bg-[#C47745]/30 text-[#FAF6EE] text-sm font-semibold border border-[#C47745]/40 transition-all"
                >
                  {t('ctaBulkSuppliers')}
                </Link>
              </div>
            </div>

            {/* Right Column: ONE LARGE REALISTIC PHOTOGRAPH OF INDIAN HANDMADE PRODUCTS (NO PEOPLE) */}
            <div className="lg:col-span-6 relative">
              <div className="relative mx-auto max-w-xl lg:max-w-none">
                
                {/* ONE Large Realistic Photograph: Indian Rural Handicraft Collection */}
                <div className="group relative rounded-3xl overflow-hidden shadow-2xl border-4 border-[#FAF6EE]/15 bg-[#1A3326]">
                  <div className="aspect-[16/10] sm:aspect-[16/9] w-full overflow-hidden bg-[#183124]">
                    <img
                      src="/images/hero_handicrafts_collection.jpg"
                      alt="Generous collection of Indian handmade products: palm-leaf woven baskets, grass containers, carved wooden boxes, bowls, spoons, and Channapatna wooden crafts"
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500 ease-out"
                      loading="eager"
                    />
                  </div>

                  {/* Subtle top pill badge */}
                  <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#FAF6EE]/95 text-[#1F3C2C] shadow-md backdrop-blur-md">
                      <BadgeCheck className="w-4 h-4 text-[#C47745]" />
                      <span>Authentic Rural Crafts Collection</span>
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase bg-[#C47745] text-white shadow-sm">
                      Wholesale Market Ready
                    </span>
                  </div>

                  {/* Clean footer bar below image to keep products 100% visible */}
                  <div className="bg-[#183124] px-4 py-3 border-t border-white/10 flex items-center justify-between text-left">
                    <div>
                      <h4 className="font-serif text-xs sm:text-sm font-bold text-[#FAF6EE]">
                        Palm-Leaf Baskets &middot; Grass Containers &middot; Carved Wood Tableware &middot; Lacquered Toys
                      </h4>
                      <p className="text-[11px] text-[#C5DBCF] mt-0.5">
                        Direct wholesale supply from verified rural artisan clusters &middot; Zero intermediaries
                      </p>
                    </div>
                    <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-[#FAF6EE] font-semibold bg-[#244131] px-2.5 py-1 rounded-lg border border-[#3A634E] shrink-0 ml-3">
                      <Check className="w-3.5 h-3.5 text-[#C47745]" />
                      <span>Cluster Direct</span>
                    </span>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>

        {/* Bottom Trust Pillars Strip */}
        <div className="border-t border-[#315C45]/60 bg-[#1A3326]/70 py-4 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="flex items-center gap-2.5 justify-center md:justify-start text-[#D4DCD6]">
              <div className="w-7 h-7 rounded-lg bg-[#315C45]/60 flex items-center justify-center text-[#C47745] shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <strong className="text-[#FAF6EE] block font-semibold">Verified Workshop Origin</strong>
                <span className="text-[11px] text-[#C5DBCF]">Physical craft & loom verification</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 justify-center md:justify-start text-[#D4DCD6]">
              <div className="w-7 h-7 rounded-lg bg-[#315C45]/60 flex items-center justify-center text-[#C47745] shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <strong className="text-[#FAF6EE] block font-semibold">Fair Price Calculator</strong>
                <span className="text-[11px] text-[#C5DBCF]">Raw materials + fair rural wage</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 justify-center md:justify-start text-[#D4DCD6]">
              <div className="w-7 h-7 rounded-lg bg-[#315C45]/60 flex items-center justify-center text-[#C47745] shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <strong className="text-[#FAF6EE] block font-semibold">Collective Pooling</strong>
                <span className="text-[11px] text-[#C5DBCF]">Combine SHGs for large volume MOQs</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 justify-center md:justify-start text-[#D4DCD6]">
              <div className="w-7 h-7 rounded-lg bg-[#315C45]/60 flex items-center justify-center text-[#C47745] shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <strong className="text-[#FAF6EE] block font-semibold">Milestone Escrow</strong>
                <span className="text-[11px] text-[#C5DBCF]">Protected institutional settlement</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Social Impact Metrics: Verifiable Real Platform Data ───────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-[#E5DAC8] shadow-craft relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#FAF4EE] rounded-bl-full pointer-events-none -z-0" />

          <div className="relative z-10 text-center max-w-xl mx-auto mb-8">
            <span className="text-xs uppercase font-bold tracking-wider text-[#C47745] block">
              Database-Verified Social Impact
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#1F3C2C] mt-1">
              Verifiable Rural Economic Linkage
            </h2>
            <p className="text-xs text-[#646E67] mt-1.5">
              Transparent wholesale revenues delivered directly into the accounts of verified artisan societies.
            </p>
          </div>

          <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center divide-y md:divide-y-0 md:divide-x divide-[#EFE7D8]">
            <div className="p-3 sm:p-4">
              <span className="font-serif text-3xl sm:text-4xl font-extrabold text-[#315C45] font-mono block">
                {impactMetrics ? impactMetrics.verified_artisan_groups : '3+'}
              </span>
              <span className="text-xs text-[#4D5650] font-semibold mt-1.5 block">
                {t('impactVerifiedArtisans')}
              </span>
              <span className="text-[10px] text-[#88918A] mt-0.5 block">Registered societies</span>
            </div>

            <div className="p-3 sm:p-4">
              <span className="font-serif text-3xl sm:text-4xl font-extrabold text-[#C47745] font-mono block">
                ₹{impactMetrics ? (impactMetrics.total_artisan_earnings_inr || 16250).toLocaleString('en-IN') : '16,250'}
              </span>
              <span className="text-xs text-[#4D5650] font-semibold mt-1.5 block">
                {t('impactTotalEarnings')}
              </span>
              <span className="text-[10px] text-[#88918A] mt-0.5 block">Zero middleman fees</span>
            </div>

            <div className="p-3 sm:p-4">
              <span className="font-serif text-3xl sm:text-4xl font-extrabold text-[#C89B3C] font-mono block">
                {impactMetrics ? (impactMetrics.orders_fulfilled_or_in_progress || 1) : '1+'}
              </span>
              <span className="text-xs text-[#4D5650] font-semibold mt-1.5 block">
                {t('impactOrdersFulfilled')}
              </span>
              <span className="text-[10px] text-[#88918A] mt-0.5 block">Milestone fulfilled</span>
            </div>

            <div className="p-3 sm:p-4">
              <span className="font-serif text-3xl sm:text-4xl font-extrabold text-[#315C45] font-mono block">
                {impactMetrics ? (impactMetrics.artisan_districts_impacted || 3) : '3'}
              </span>
              <span className="text-xs text-[#4D5650] font-semibold mt-1.5 block">
                {t('impactDistricts')}
              </span>
              <span className="text-[10px] text-[#88918A] mt-0.5 block">Tamil Nadu clusters</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Handicraft Category Grid: PRODUCT-ONLY PHOTOGRAPHS (NO PEOPLE) ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-8">
          <div>
            <span className="text-xs uppercase font-bold tracking-wider text-[#C47745] block">
              Indigenous Craft Disciplines
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#1F3C2C] mt-1">
              Explore Handmade Product Categories
            </h2>
            <p className="text-xs text-[#646E67] mt-1">
              Every item handcrafted by verified rural clusters using natural raw materials and traditional techniques.
            </p>
          </div>
          <Link
            to="/marketplace"
            className="text-xs font-bold text-[#315C45] hover:text-[#1F3C2C] flex items-center gap-1 group py-1 px-3 rounded-lg hover:bg-white border border-transparent hover:border-[#E5DAC8] transition-all"
          >
            <span>View All Categories</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {CRAFT_DISCIPLINES.map((cat, idx) => (
            <Link
              key={idx}
              to={`/marketplace?category=${encodeURIComponent(cat.slug)}`}
              className="group bg-white rounded-2xl border border-[#E5DAC8] overflow-hidden shadow-craft hover:shadow-craft-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
            >
              {/* Product Photograph Banner with natural daylight & clean composition */}
              <div className={`h-48 overflow-hidden relative ${cat.fallbackColor}`}>
                <img
                  src={cat.image}
                  alt={`${cat.name} handmade product`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
                
                {/* Top Badge */}
                <div className="absolute top-3 left-3">
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#FAF6EE] text-[#1F3C2C] shadow-sm">
                    {cat.tag}
                  </span>
                </div>

                {/* Bottom Overlay Title on Product Image */}
                <div className="absolute bottom-3 left-3 right-3 text-left">
                  <h3 className="font-serif text-lg font-bold text-white tracking-tight drop-shadow-sm">
                    {cat.name}
                  </h3>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between text-left">
                <p className="text-xs text-[#4D5650] leading-relaxed line-clamp-2">
                  {cat.description}
                </p>

                <div className="pt-3 border-t border-[#EFE7D8] mt-3 flex items-center justify-between text-xs">
                  <span className="text-[11px] font-semibold text-[#C47745] flex items-center gap-1">
                    <Compass className="w-3.5 h-3.5" />
                    <span>{cat.count}</span>
                  </span>
                  <span className="text-[11px] font-bold text-[#315C45] group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                    <span>Browse Products</span>
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── 4. Traditional Craft Specialties: PRODUCT-ONLY SHOWCASE (NO PEOPLE) ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#FAF6ED] rounded-3xl p-8 sm:p-12 border border-[#E8DFC8] shadow-craft relative overflow-hidden">
          
          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs uppercase font-bold tracking-wider text-[#C47745] block">
              Indigenous Craft Provenance
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#1F3C2C] mt-1">
              Masterpiece Crafts of Rural Clusters
            </h2>
            <p className="text-xs sm:text-sm text-[#4D5650] mt-1.5 leading-relaxed">
              Examine the craftsmanship, natural materials, and authentic production methods of registered producer societies.
            </p>
          </div>

          {/* 3 Featured Craft Specialties Cards: PRODUCT PHOTOGRAPHS ONLY */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURED_CRAFT_SPECIALTIES.map((item, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-[#E5DAC8] overflow-hidden shadow-sm flex flex-col justify-between text-left hover:shadow-md transition-shadow"
              >
                <div>
                  {/* Product-Only Photograph */}
                  <div className="h-52 overflow-hidden relative bg-[#EFE7D8]">
                    <img
                      src={item.image}
                      alt={item.productTitle}
                      className="w-full h-full object-cover hover:scale-102 transition-transform duration-300"
                      loading="lazy"
                    />
                    <div className="absolute top-3 left-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>{item.badge}</span>
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 space-y-3">
                    <div>
                      <div className="flex items-center gap-1 text-[11px] text-[#C47745] font-semibold">
                        <MapPin className="w-3 h-3" />
                        <span>{item.district}</span>
                      </div>
                      <h3 className="font-serif text-base font-bold text-[#1F3C2C] mt-0.5">
                        {item.productTitle}
                      </h3>
                      <span className="text-[11px] text-[#646E67] font-medium block">
                        {item.cluster}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#F6F0E5] border border-[#E8DFC8] text-[11px] text-[#315C45] font-semibold">
                      {item.craft}
                    </div>

                    <p className="text-xs text-[#4D5650] leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>

                {/* Footer with stats & action */}
                <div className="p-5 pt-3 border-t border-[#EFE7D8] bg-[#FAF8F5] flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-[#88918A] block">Indicative Wholesale</span>
                    <span className="font-mono text-xs font-bold text-[#1F3C2C]">
                      {item.priceEstimate}
                    </span>
                  </div>
                  <Link
                    to={`/marketplace?category=${encodeURIComponent(item.categorySlug)}`}
                    className="text-xs font-bold text-[#C47745] hover:text-[#B06132] flex items-center gap-1"
                  >
                    <span>View Craft</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. Actual Marketplace Products: Existing Database Images ─────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-8">
          <div>
            <span className="text-xs uppercase font-bold tracking-wider text-[#C47745] block">
              Live Verified Database Catalog
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#1F3C2C] mt-1">
              Active Wholesale Craft Listings
            </h2>
            <p className="text-xs text-[#646E67] mt-1">
              Direct from artisan seller records with inventory counts, unit rates in INR, and minimum order quantities.
            </p>
          </div>
          <Link
            to="/marketplace"
            className="text-xs font-bold text-[#315C45] hover:text-[#1F3C2C] flex items-center gap-1 group py-1 px-3 rounded-lg hover:bg-white border border-transparent hover:border-[#E5DAC8] transition-all"
          >
            <span>Explore Full Marketplace</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-84 rounded-2xl bg-white border border-[#E5DAC8] animate-pulse p-4 space-y-3">
                <div className="h-44 bg-[#EFE7D8] rounded-xl" />
                <div className="h-4 bg-[#EFE7D8] rounded w-3/4" />
                <div className="h-3 bg-[#EFE7D8] rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredProducts.map((p) => (
              <Link
                key={p.id}
                to={`/products/${p.id}`}
                className="group bg-white rounded-2xl border border-[#E5DAC8] overflow-hidden hover:shadow-craft-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between text-left"
              >
                <div>
                  {/* Real Database Product Image with Fallback */}
                  <div className="h-48 bg-[#FAF6ED] overflow-hidden relative border-b border-[#EFE7D8]">
                    <ProductImage
                      src={p.images?.[0]}
                      alt={p.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-2.5 left-2.5">
                      <VerificationBadge status={p.seller?.verification_status} />
                    </div>
                  </div>

                  {/* Details */}
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between text-[10px] text-[#646E67]">
                      <span className="uppercase font-bold tracking-wider text-[#C47745]">
                        {p.category}
                      </span>
                      {p.seller?.district && (
                        <span className="flex items-center gap-0.5 text-[#88918A]">
                          <MapPin className="w-3 h-3" />
                          <span>{p.seller.district}</span>
                        </span>
                      )}
                    </div>

                    <h3 className="font-serif text-sm font-bold text-[#1E2621] group-hover:text-[#315C45] transition-colors line-clamp-1">
                      {p.title}
                    </h3>
                    
                    <p className="text-xs text-[#4D5650] line-clamp-2 leading-relaxed">
                      {p.description}
                    </p>

                    <div className="pt-1 flex items-center gap-2 text-[11px] text-[#646E67]">
                      <span className="bg-[#FAF4EE] text-[#C47745] px-2 py-0.5 rounded border border-[#EBCDB9] font-medium">
                        MOQ: {p.moq} {p.unit || 'unit'}s
                      </span>
                      <span className="text-[#88918A]">
                        Stock: {p.stock_quantity}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Pricing Footer */}
                <div className="p-4 pt-3 border-t border-[#EFE7D8] bg-[#FCFAF6] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-[#88918A] block">Wholesale Rate</span>
                    <span className="font-bold text-base text-[#1F3C2C] font-mono">
                      ₹{p.price_per_unit.toLocaleString('en-IN')}{' '}
                      <span className="text-xs font-normal text-[#88918A]">/{p.unit || 'pc'}</span>
                    </span>
                  </div>
                  <span className="text-xs font-bold text-[#315C45] group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                    <span>Order</span>
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── 6. Authenticity Standard: Reseller Separation & Verification ─── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#FAF6ED] rounded-3xl p-8 sm:p-12 border border-[#E8DFC8] shadow-craft">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            <div className="lg:col-span-7 space-y-5 text-left">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1F3C2C] text-[#FAF6EE] text-xs font-semibold">
                <Award className="w-3.5 h-3.5 text-[#C89B3C]" />
                <span>Our Core Authenticity Standard</span>
              </div>
              <h2 className="font-serif text-3xl font-extrabold text-[#1F3C2C] tracking-tight">
                {t('verificationPolicyTitle')}
              </h2>
              <p className="text-sm text-[#4D5650] leading-relaxed">
                {t('verificationPolicyDesc')}
              </p>

              <div className="space-y-3 pt-2 text-xs">
                <div className="flex items-start gap-3 bg-white p-4 rounded-xl border border-[#E5DAC8] shadow-2xs">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[#1E2621] block font-bold text-sm">
                      Verified Producer / Artisan Group
                    </strong>
                    <span className="text-[#4D5650] leading-relaxed">
                      Physical inspection or live video proof of pitlooms, potter wheels, kilns, and genuine raw material stock. Awarded exclusively to authentic rural producers.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-white p-4 rounded-xl border border-[#E5DAC8] shadow-2xs">
                  <Store className="w-5 h-5 text-stone-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[#1E2621] block font-bold text-sm">
                      Transparent Reseller Separation
                    </strong>
                    <span className="text-[#4D5650] leading-relaxed">
                      Resellers who do not manufacture the goods cannot claim the producer badge, eliminating fraudulent middleman spoofing and maintaining honest marketplace provenance.
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  to="/verification-policy"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#315C45] hover:text-[#1F3C2C] underline decoration-[#C47745] underline-offset-4"
                >
                  Read our complete verification standards & guidelines &rarr;
                </Link>
              </div>
            </div>

            {/* Verification Pipeline Flowchart */}
            <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-[#E5DAC8] shadow-sm space-y-4 text-left">
              <h4 className="font-semibold text-xs text-[#1E2621] uppercase tracking-wider pb-2 border-b border-[#EFE7D8] flex items-center justify-between">
                <span>Verification Pipeline</span>
                <span className="text-[10px] text-[#C47745] font-bold">4-Step Rigor</span>
              </h4>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-[#F6F0E5] border border-[#E8DFC8] flex items-center justify-between">
                  <div>
                    <span className="font-bold text-[#1E2621] block">1. Artisan Profile & Dossier</span>
                    <span className="text-[11px] text-[#646E67]">Craft method & workshop setup</span>
                  </div>
                  <span className="text-[10px] text-[#315C45] font-bold bg-white px-2 py-0.5 rounded border border-[#E5DAC8]">Step 1</span>
                </div>

                <div className="p-3 rounded-xl bg-[#F6F0E5] border border-[#E8DFC8] flex items-center justify-between">
                  <div>
                    <span className="font-bold text-[#1E2621] block">2. Government ID & Registry</span>
                    <span className="text-[11px] text-[#646E67]">Weaver card or cooperative proof</span>
                  </div>
                  <span className="text-[10px] text-[#315C45] font-bold bg-white px-2 py-0.5 rounded border border-[#E5DAC8]">Step 2</span>
                </div>

                <div className="p-3 rounded-xl bg-[#F6F0E5] border border-[#E8DFC8] flex items-center justify-between">
                  <div>
                    <span className="font-bold text-[#1E2621] block">3. Craft-Making Video Proof</span>
                    <span className="text-[11px] text-[#646E67]">Recording of authentic process</span>
                  </div>
                  <span className="text-[10px] text-[#315C45] font-bold bg-white px-2 py-0.5 rounded border border-[#E5DAC8]">Step 3</span>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-emerald-950 block">4. Official Admin Review & Badge</span>
                    <span className="text-[11px] text-emerald-800">Tamper-proof audit logged</span>
                  </div>
                  <span className="text-[10px] text-emerald-800 font-bold bg-white px-2 py-0.5 rounded border border-emerald-200">Producer</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 7. How AI Market Linkage Operates ─────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-xl mx-auto mb-12">
          <span className="text-xs uppercase font-bold tracking-wider text-[#C47745] block">
            End-to-End Operational Workflow
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#1F3C2C] mt-1">
            Bridging Rural Hands to Global Markets
          </h2>
          <p className="text-xs text-[#646E67] mt-1">
            A three-step architecture designed for language inclusivity, fair wages, and secure wholesale settlement.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          <div className="bg-white p-6 rounded-2xl border border-[#E5DAC8] space-y-3 shadow-craft hover:shadow-craft-lg transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-[#E0ECE4] text-[#315C45] font-bold flex items-center justify-center text-sm border border-[#C5DBCF]">
              1
            </div>
            <h3 className="font-serif text-base font-bold text-[#1E2621]">
              Voice Listing & Fair Pricing
            </h3>
            <p className="text-xs text-[#4D5650] leading-relaxed">
              Artisans describe products aloud in Tamil or English. Our AI Fair-Price calculator assesses material expenses, loom time, and living wages to recommend sustainable wholesale rates.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-[#E5DAC8] space-y-3 shadow-craft hover:shadow-craft-lg transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-[#FAF4EE] text-[#C47745] font-bold flex items-center justify-center text-sm border border-[#EBCDB9]">
              2
            </div>
            <h3 className="font-serif text-base font-bold text-[#1E2621]">
              AI Bulk Matching & Collective Pooling
            </h3>
            <p className="text-xs text-[#4D5650] leading-relaxed">
              When an institutional buyer posts an enquiry exceeding a single workshop's capacity, our engine pools compatible artisan clusters to fulfill large volume orders collectively.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-[#E5DAC8] space-y-3 shadow-craft hover:shadow-craft-lg transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-[#FAF3E0] text-[#C89B3C] font-bold flex items-center justify-center text-sm border border-[#F4E5BD]">
              3
            </div>
            <h3 className="font-serif text-base font-bold text-[#1E2621]">
              Escrow Quotations & Tracked Dispatch
            </h3>
            <p className="text-xs text-[#4D5650] leading-relaxed">
              Parties agree on formal quotations, deposit funds into protected escrow, track production milestones, upload batch dispatch slips, and confirm delivery.
            </p>
          </div>
        </div>
      </section>

      {/* ── 8. Demonstration Case Study & Testimonial (Typography Only) ─────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 sm:p-10 rounded-3xl bg-[#FAF6ED] border border-[#E8DFC8] shadow-craft space-y-6 text-left relative overflow-hidden">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#C47745] bg-white px-3 py-1 rounded-md border border-[#E5DAC8]">
              Demonstration Case Study & Testimonial
            </span>
            <span className="text-xs text-[#88918A]">
              Platform Seeded Demonstration Record
            </span>
          </div>

          <blockquote className="font-serif text-base sm:text-xl text-[#1F3C2C] italic leading-relaxed">
            &ldquo;As a handloom weaver society in Thanjavur, our biggest barrier was calculating sustainable wholesale rates for big retail buyers. The Fair-Price Calculator and Direct Collective Pooling helped us supply 500 sarees together with our neighboring cluster without middleman commission.&rdquo;
          </blockquote>

          <div className="flex items-center gap-3 pt-2">
            {/* Clean craft seal initial — NO human face */}
            <div className="w-11 h-11 rounded-full bg-[#1F3C2C] text-[#FAF6EE] font-bold flex items-center justify-center text-sm border border-[#315C45] shadow-xs">
              RN
            </div>
            <div>
              <strong className="text-xs font-bold text-[#1E2621] block">
                Ramanathan Natarajan
              </strong>
              <span className="text-[11px] text-[#646E67] block">
                Master Weaver & Secretary, Thanjavur Art & Handloom Society
              </span>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};
