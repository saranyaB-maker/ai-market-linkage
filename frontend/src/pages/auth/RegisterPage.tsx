import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserCheck, Building2, AlertCircle, ChevronRight, Leaf } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

type RegistrationStep = 'role' | 'details';

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [step, setStep] = useState<RegistrationStep>('role');
  const [selectedRole, setSelectedRole] = useState<'seller' | 'buyer' | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Common fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [location, setLocation] = useState('');
  const [state, setState] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [language, setLanguage] = useState<'en' | 'ta'>('en');

  // Seller-specific
  const [sellerType, setSellerType] = useState('individual_producer');
  const [craftCategory, setCraftCategory] = useState('');
  const [organizationId, setOrganizationId] = useState('');

  // Buyer-specific
  const [buyerType, setBuyerType] = useState('retailer');
  const [businessName, setBusinessName] = useState('');
  const [intendedCategories, setIntendedCategories] = useState('');

  const INDIAN_STATES = [
    'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
    'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
    'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
    'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand',
    'West Bengal','Delhi','Puducherry','Chandigarh','Lakshadweep','Andaman & Nicobar',
  ];

  const CRAFT_CATEGORIES = [
    'Handloom & Textiles','Pottery & Ceramics','Woodcraft','Metalwork','Leather Goods',
    'Bamboo & Cane','Jewellery','Painting & Art','Stone Craft','Paper Products',
    'Natural Fibre','Embroidery & Needlework','Other',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!agreedToTerms) { setError('Please accept the Terms of Service and Privacy Policy.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (!/^\d{10}$/.test(phone.replace(/\D/g, ''))) { setError('Enter a valid 10-digit Indian phone number.'); return; }

    const payload: any = {
      role: selectedRole,
      full_name: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      password,
      location: location.trim(),
      state,
      preferred_language: language,
    };

    if (selectedRole === 'seller') {
      payload.seller_type = sellerType;
      payload.craft_category = craftCategory;
      if (organizationId) payload.organization_id = organizationId;
    } else {
      payload.buyer_type = buyerType;
      if (businessName) payload.business_name = businessName;
      if (intendedCategories) payload.intended_categories = intendedCategories.split(',').map(s => s.trim());
    }

    setLoading(true);
    try {
      await register(payload);
      navigate(selectedRole === 'seller' ? '/seller' : '/buyer');
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'role') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-xl">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 mb-4">
              <Leaf className="w-8 h-8 text-forest-green" />
              <span className="text-2xl font-display font-bold text-charcoal">AI Market Linkage</span>
            </div>
            <h1 className="text-3xl font-display font-bold text-charcoal mb-2">Create your account</h1>
            <p className="text-charcoal/60">Choose how you want to use the platform</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => { setSelectedRole('seller'); setStep('details'); }}
              className="group p-8 rounded-2xl border-2 border-forest-green/20 bg-white hover:border-forest-green hover:bg-forest-green/5 transition-all text-left shadow-sm hover:shadow-md"
            >
              <div className="w-14 h-14 rounded-2xl bg-forest-green/10 flex items-center justify-center mb-4 group-hover:bg-forest-green/20 transition-colors">
                <UserCheck className="w-7 h-7 text-forest-green" />
              </div>
              <h3 className="text-xl font-bold text-charcoal mb-2">I'm a Seller</h3>
              <p className="text-sm text-charcoal/60 leading-relaxed">
                Artisan, producer group, cooperative, or SHG looking to sell handmade products
              </p>
              <div className="mt-4 flex items-center gap-1 text-forest-green font-semibold text-sm">
                Get started <ChevronRight className="w-4 h-4" />
              </div>
            </button>

            <button
              onClick={() => { setSelectedRole('buyer'); setStep('details'); }}
              className="group p-8 rounded-2xl border-2 border-terracotta/20 bg-white hover:border-terracotta hover:bg-terracotta/5 transition-all text-left shadow-sm hover:shadow-md"
            >
              <div className="w-14 h-14 rounded-2xl bg-terracotta/10 flex items-center justify-center mb-4 group-hover:bg-terracotta/20 transition-colors">
                <Building2 className="w-7 h-7 text-terracotta" />
              </div>
              <h3 className="text-xl font-bold text-charcoal mb-2">I'm a Buyer</h3>
              <p className="text-sm text-charcoal/60 leading-relaxed">
                Retailer, wholesaler, exporter, or business looking to source authentic artisan products
              </p>
              <div className="mt-4 flex items-center gap-1 text-terracotta font-semibold text-sm">
                Get started <ChevronRight className="w-4 h-4" />
              </div>
            </button>
          </div>

          <p className="text-center text-sm text-charcoal/60 mt-8">
            Already have an account?{' '}
            <Link to="/login" className="text-forest-green font-semibold hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold text-charcoal mb-2">
            {selectedRole === 'seller' ? 'Seller Registration' : 'Buyer Registration'}
          </h1>
          <p className="text-charcoal/60">Fill in your details to create your account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Common fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">Full Name / Org Name *</label>
                <input
                  type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                  required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-green/30 focus:border-forest-green text-sm"
                  placeholder="Your full name or organization name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">Email *</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-green/30 focus:border-forest-green text-sm"
                  placeholder="your@email.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">Phone Number *</label>
                <input
                  type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-green/30 focus:border-forest-green text-sm"
                  placeholder="10-digit mobile number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">Preferred Language</label>
                <select
                  value={language} onChange={e => setLanguage(e.target.value as 'en' | 'ta')}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-green/30 focus:border-forest-green text-sm"
                >
                  <option value="en">English</option>
                  <option value="ta">தமிழ் (Tamil)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">District / City *</label>
                <input
                  type="text" value={location} onChange={e => setLocation(e.target.value)}
                  required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-green/30 focus:border-forest-green text-sm"
                  placeholder="e.g. Madurai"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">State *</label>
                <select
                  value={state} onChange={e => setState(e.target.value)} required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-green/30 focus:border-forest-green text-sm"
                >
                  <option value="">Select state</option>
                  {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">Password *</label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  required minLength={8}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-green/30 focus:border-forest-green text-sm"
                  placeholder="Minimum 8 characters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">Confirm Password *</label>
                <input
                  type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-green/30 focus:border-forest-green text-sm"
                  placeholder="Repeat password"
                />
              </div>
            </div>

            {/* Role-specific fields */}
            {selectedRole === 'seller' ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-charcoal mb-1">Seller Type *</label>
                    <select
                      value={sellerType} onChange={e => setSellerType(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-green/30 focus:border-forest-green text-sm"
                    >
                      <option value="individual_producer">Individual Producer</option>
                      <option value="producer_group">Producer Group</option>
                      <option value="self_help_group">Self Help Group (SHG)</option>
                      <option value="cooperative">Cooperative</option>
                      <option value="reseller">Reseller</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-charcoal mb-1">Craft Category *</label>
                    <select
                      value={craftCategory} onChange={e => setCraftCategory(e.target.value)} required
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-green/30 focus:border-forest-green text-sm"
                    >
                      <option value="">Select category</option>
                      {CRAFT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1">Artisan / Organization ID <span className="text-charcoal/40">(optional)</span></label>
                  <input
                    type="text" value={organizationId} onChange={e => setOrganizationId(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-green/30 focus:border-forest-green text-sm"
                    placeholder="GI tag number, DC Handicrafts ID, SHG registration, etc."
                  />
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-charcoal mb-1">Buyer Type *</label>
                    <select
                      value={buyerType} onChange={e => setBuyerType(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-green/30 focus:border-forest-green text-sm"
                    >
                      <option value="individual">Individual</option>
                      <option value="retailer">Retailer</option>
                      <option value="wholesaler">Wholesaler</option>
                      <option value="business">Business</option>
                      <option value="institution">Institution</option>
                      <option value="exporter">Exporter</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-charcoal mb-1">Business Name <span className="text-charcoal/40">(optional)</span></label>
                    <input
                      type="text" value={businessName} onChange={e => setBusinessName(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-green/30 focus:border-forest-green text-sm"
                      placeholder="Your company or shop name"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1">Intended Product Categories <span className="text-charcoal/40">(optional)</span></label>
                  <input
                    type="text" value={intendedCategories} onChange={e => setIntendedCategories(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-green/30 focus:border-forest-green text-sm"
                    placeholder="e.g. Textiles, Pottery, Woodcraft (comma-separated)"
                  />
                </div>
              </>
            )}

            {/* Terms */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)}
                className="mt-1 w-4 h-4 accent-forest-green rounded"
              />
              <span className="text-sm text-charcoal/70">
                I agree to the{' '}
                <Link to="/terms" className="text-forest-green hover:underline font-medium">Terms of Service</Link>
                {' '}and{' '}
                <Link to="/privacy" className="text-forest-green hover:underline font-medium">Privacy Policy</Link>
              </span>
            </label>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep('role')}
                className="flex-1 py-3 border border-gray-200 rounded-xl text-charcoal font-semibold hover:bg-gray-50 transition-colors text-sm"
              >
                ← Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 bg-forest-green text-white rounded-xl font-semibold hover:bg-forest-green/90 transition-colors disabled:opacity-60 text-sm"
              >
                {loading ? 'Creating account…' : 'Create Account'}
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-sm text-charcoal/60 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-forest-green font-semibold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
};
