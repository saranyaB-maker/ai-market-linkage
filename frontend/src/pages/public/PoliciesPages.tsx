import React from 'react';
import { ShieldCheck, Award, Lock, FileText, CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react';

export const AboutPage: React.FC = () => (
  <div className="max-w-4xl mx-auto px-4 py-16 space-y-8">
    <div className="text-center space-y-3">
      <span className="text-xs uppercase font-bold tracking-wider text-terracotta-700">Platform Purpose</span>
      <h1 className="font-serif text-3xl sm:text-4xl font-extrabold text-forest-950">About AI Market Linkage</h1>
      <p className="text-sm text-stone-600 max-w-2xl mx-auto">
        Empowering rural master artisans, self-help groups (SHGs), and craft cooperatives with direct wholesale access to businesses, institutional buyers, and exporters.
      </p>
    </div>

    <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm space-y-6 text-sm text-charcoal-800 leading-relaxed">
      <h2 className="font-serif text-xl font-bold text-forest-900">The Problem We Solve</h2>
      <p>
        Across rural craft clusters—from Thanjavur handloom weavers to Manamadurai terracotta potters—authentic producers are isolated from large wholesale buyers. Unverified middlemen frequently purchase artisan work at predatory prices and resell it under inflated markups while falsely presenting themselves as original manufacturers.
      </p>
      <p>
        AI Market Linkage eliminates middleman opacity by combining <strong>perceptual image hash duplicate detection</strong>, <strong>administrative evidence verification</strong>, and an <strong>AI Bulk Buyer Matching Engine</strong> that directly links verified producer capacity with large-scale commercial procurement.
      </p>

      <h3 className="font-serif text-lg font-bold text-forest-900 pt-4">Key Innovations:</h3>
      <ul className="list-disc pl-5 space-y-2 text-stone-700">
        <li><strong>AI Smart Catalog Generator:</strong> Vision intelligence transforms simple craft workshop photos into professional wholesale listings.</li>
        <li><strong>Artisan Fair-Price Calculator:</strong> Transparent formulas that calculate cost-plus sustainable artisan wages.</li>
        <li><strong>Collective Order Pooling:</strong> Coordinates production across multiple artisan SHGs when an order exceeds a single workshop's capacity.</li>
        <li><strong>Strict Reseller Separation:</strong> Resellers are never awarded manufacturer badges.</li>
      </ul>
    </div>
  </div>
);

export const VerificationPolicyPage: React.FC = () => (
  <div className="max-w-4xl mx-auto px-4 py-16 space-y-8">
    <div className="text-center space-y-3">
      <span className="text-xs uppercase font-bold tracking-wider text-emerald-700">Authenticity Standard</span>
      <h1 className="font-serif text-3xl sm:text-4xl font-extrabold text-forest-950">Producer Verification Policy</h1>
      <p className="text-sm text-stone-600 max-w-2xl mx-auto">
        Why we strictly distinguish original manufacturers from resellers and how our verification pipeline operates.
      </p>
    </div>

    <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm space-y-6 text-sm text-charcoal-800 leading-relaxed">
      <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
        <div className="text-xs text-emerald-950">
          <strong>Non-Negotiable Rule:</strong> A person who purchases handmade goods and resells them will NEVER be falsely verified as a manufacturer.
        </div>
      </div>

      <h2 className="font-serif text-xl font-bold text-forest-900">Recognized Seller Categories</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-1">
          <strong className="text-forest-900 text-sm block">1. Individual Producer</strong>
          <p className="text-stone-600">Individual artisan operating their own handloom, potter wheel, carving bench, or metal furnace.</p>
        </div>
        <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-1">
          <strong className="text-forest-900 text-sm block">2. Producer Group / SHG</strong>
          <p className="text-stone-600">A registered rural Self-Help Group or artisan federation pooling tools and production capacity.</p>
        </div>
        <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-1">
          <strong className="text-forest-900 text-sm block">3. Cooperative Society</strong>
          <p className="text-stone-600">Registered weavers' cooperative or craft society governed by democratic member committees.</p>
        </div>
        <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-1">
          <strong className="text-forest-900 text-sm block">4. Verified Reseller</strong>
          <p className="text-stone-600">A commercial trader or curator. Transparently labeled with a Reseller badge so buyers know they are not buying directly from the maker.</p>
        </div>
      </div>

      <h2 className="font-serif text-xl font-bold text-forest-900 pt-4">Evidence Requirements</h2>
      <p>
        Artisans may upload workshop photographs, tools and raw materials inventory, artisan registration cards (e.g. Pahchan card), or video evidence of the production process. Document access is strictly restricted to authorized administrative reviewers.
      </p>

      <h2 className="font-serif text-xl font-bold text-forest-900 pt-4">Duplicate Image Detection Safeguards</h2>
      <p>
        Every uploaded image is hashed using perceptual image hashing (pHash/dHash). If an image matches another account's listing, a review flag is queued. However, <strong>similar images are treated as a risk signal, not definitive proof of fraud</strong>. Legitimate artisans may share photos with family or cooperative members, so only human administrative reviewers make suspension decisions.
      </p>
    </div>
  </div>
);

export const TermsPage: React.FC = () => (
  <div className="max-w-4xl mx-auto px-4 py-16 space-y-6">
    <h1 className="font-serif text-3xl font-extrabold text-forest-950">Terms of Wholesale Trade</h1>
    <div className="bg-white p-8 rounded-3xl border border-stone-200 space-y-4 text-xs sm:text-sm text-stone-700 leading-relaxed">
      <p><strong>1. Quotations and Price Validity:</strong> All submitted quotations specify validity periods and minimum order quantities in INR (₹). Once accepted by the buyer, terms are binding.</p>
      <p><strong>2. Production Milestones:</strong> Producers agree to provide truthful production milestone updates throughout fulfillment.</p>
      <p><strong>3. Dispatch and Inspection:</strong> Buyers are granted an inspection window upon delivery confirmation to verify craft specifications prior to dispute deadline.</p>
    </div>
  </div>
);

export const PrivacyPage: React.FC = () => (
  <div className="max-w-4xl mx-auto px-4 py-16 space-y-6">
    <h1 className="font-serif text-3xl font-extrabold text-forest-950">Privacy & Artisan Data Protection</h1>
    <div className="bg-white p-8 rounded-3xl border border-stone-200 space-y-4 text-xs sm:text-sm text-stone-700 leading-relaxed">
      <p><strong>Private Verification Vault:</strong> Identification documents and workshop evidence files are kept in private server directories accessible only to authorized administrators and the account owner.</p>
      <p><strong>No Plaintext Passwords:</strong> Passwords are encrypted using modern scrypt hashing.</p>
      <p><strong>Data Deletion:</strong> Users may request complete account and data removal at any time subject to completed transaction auditing requirements.</p>
    </div>
  </div>
);

export const HelpFaqPage: React.FC = () => (
  <div className="max-w-4xl mx-auto px-4 py-16 space-y-6">
    <h1 className="font-serif text-3xl font-extrabold text-forest-950">Frequently Asked Questions & Support</h1>
    <div className="bg-white p-8 rounded-3xl border border-stone-200 space-y-4 text-xs sm:text-sm text-stone-700">
      <div className="p-4 bg-stone-50 rounded-2xl">
        <h3 className="font-bold text-charcoal-900 mb-1">How does Collective Order Pooling work?</h3>
        <p className="text-stone-600">If a buyer orders 1,000 units and an artisan group has capacity for 400, our system identifies compatible verified groups in the cluster to supply the remaining 600 under synchronized specifications.</p>
      </div>
      <div className="p-4 bg-stone-50 rounded-2xl">
        <h3 className="font-bold text-charcoal-900 mb-1">What if I do not have a formal government artisan card?</h3>
        <p className="text-stone-600">We offer alternative verification through workshop photo evidence, loom inspection, and cooperative committee resolutions.</p>
      </div>
    </div>
  </div>
);
