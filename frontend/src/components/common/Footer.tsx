import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Heart, Sparkles, MapPin } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export const Footer: React.FC = () => {
  const { t } = useLanguage();

  return (
    <footer className="bg-[#1C2C22] text-[#E8E2D5] pt-16 pb-12 border-t border-forest-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-forest-900/60">
          {/* Col 1: Brand & Purpose */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-forest-700 flex items-center justify-center text-gold-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <span className="font-serif text-lg font-bold text-white tracking-tight">
                {t('brandName')}
              </span>
            </div>
            <p className="text-xs text-stone-300 leading-relaxed">
              Empowering rural artisans, weavers, pottery clusters, and self-help groups to connect transparently with institutional wholesale buyers and ethical retail chains.
            </p>
            <div className="flex items-center gap-2 text-xs text-gold-300 font-medium">
              <MapPin className="w-4 h-4 text-terracotta-400" />
              <span>Headquartered in Tamil Nadu, India</span>
            </div>
          </div>

          {/* Col 2: Marketplace */}
          <div className="space-y-3">
            <h4 className="font-serif text-sm font-semibold text-white tracking-wide uppercase">
              Marketplace
            </h4>
            <ul className="space-y-2 text-xs text-stone-300">
              <li>
                <Link to="/marketplace?category=Handloom+%26+Textiles" className="hover:text-gold-300 transition-colors">
                  Handloom & Textiles
                </Link>
              </li>
              <li>
                <Link to="/marketplace?category=Pottery+%26+Terracotta" className="hover:text-gold-300 transition-colors">
                  Pottery & Terracotta
                </Link>
              </li>
              <li>
                <Link to="/marketplace?category=Jute+%26+Natural+Fiber+Crafts" className="hover:text-gold-300 transition-colors">
                  Jute & Natural Fiber Crafts
                </Link>
              </li>
              <li>
                <Link to="/marketplace?category=Woodwork+%26+Carving" className="hover:text-gold-300 transition-colors">
                  Woodwork & Carving
                </Link>
              </li>
              <li>
                <Link to="/marketplace" className="hover:text-gold-300 transition-colors">
                  Explore Full Catalog
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Artisans & Wholesale */}
          <div className="space-y-3">
            <h4 className="font-serif text-sm font-semibold text-white tracking-wide uppercase">
              Producer Linkage
            </h4>
            <ul className="space-y-2 text-xs text-stone-300">
              <li>
                <Link to="/register?role=seller" className="hover:text-gold-300 transition-colors">
                  Artisan Onboarding
                </Link>
              </li>
              <li>
                <Link to="/verification-policy" className="hover:text-gold-300 transition-colors">
                  Producer Verification Criteria
                </Link>
              </li>
              <li>
                <Link to="/requirements" className="hover:text-gold-300 transition-colors">
                  Live Bulk Buyer Requirements
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-gold-300 transition-colors">
                  Collective Pooling Model
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Trust & Policies */}
          <div className="space-y-3">
            <h4 className="font-serif text-sm font-semibold text-white tracking-wide uppercase">
              Trust & Transparency
            </h4>
            <ul className="space-y-2 text-xs text-stone-300">
              <li>
                <Link to="/verification-policy" className="hover:text-gold-300 transition-colors">
                  Anti-Reseller Spoofing Policy
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-gold-300 transition-colors">
                  Privacy Policy & Artisan Data
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-gold-300 transition-colors">
                  Terms of Wholesale Trade
                </Link>
              </li>
              <li>
                <Link to="/help" className="hover:text-gold-300 transition-colors">
                  Help & Dispute Support
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright & disclaimer */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-stone-400">
          <p>
            &copy; {new Date().getFullYear()} AI Market Linkage Platform. All rights reserved. Prices quoted in Indian Rupees (₹).
          </p>
          <div className="flex items-center gap-1.5 text-stone-400">
            <span>Built with respect for traditional rural heritage & fair artisan livelihood</span>
            <Heart className="w-3.5 h-3.5 text-terracotta-400 fill-terracotta-400" />
          </div>
        </div>
      </div>
    </footer>
  );
};
