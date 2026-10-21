import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Sparkles, Bell, MessageSquare, User, LogOut, 
  Menu, X, ShieldCheck, ShoppingCart
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useCart } from '../../context/CartContext';
import { NotificationItem, UserRole } from '../../types';
import api from '../../services/api';

export const Navbar: React.FC = () => {
  const { user, logout, quickDemoLogin } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { totalItems } = useCart();
  const navigate = useNavigate();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await api.getNotifications();
      setNotifications(res.notifications);
      setUnreadCount(res.unread_count);
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const handleDemoSwitch = async (role: UserRole) => {
    if (user && !user.email.endsWith('@marketlink.local')) {
      const confirmSwitch = window.confirm(
        `You are currently logged in as "${user.full_name}" (${user.email}). Switching to a demo role will log you out of your current account. Do you wish to continue?`
      );
      if (!confirmSwitch) return;
    }
    try {
      await quickDemoLogin(role);
      if (role === 'admin') navigate('/admin');
      else if (role === 'seller') navigate('/seller');
      else if (role === 'buyer') navigate('/buyer');
    } catch (err: any) {
      alert(`Demo login error: ${err.message}. Please ensure backend is running and seeded.`);
    }
  };

  const getDashboardPath = () => {
    if (!user) return '/login';
    if (user.role === 'admin') return '/admin';
    if (user.role === 'seller') return '/seller';
    return '/buyer';
  };

  return (
    <header className="sticky top-0 z-40 bg-[#F6F0E5]/95 backdrop-blur-md border-b border-[#E5DAC8] shadow-xs">
      {/* Top micro-bar: Demo Accounts & User Session */}
      <div className="bg-[#EFE7D8] px-3 sm:px-4 py-1 sm:py-1.5 border-b border-[#E0D5BE] text-xs text-charcoal-700">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
          {/* Demo shortcuts */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto py-0.5 no-scrollbar">
            <span className="font-semibold text-forest-900 flex items-center gap-1 shrink-0 text-[11px] sm:text-xs">
              <Sparkles className="w-3.5 h-3.5 text-terracotta-600" />
              <span className="hidden sm:inline">{t('demoRoles')}:</span>
              <span className="sm:hidden">Demo:</span>
            </span>
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => handleDemoSwitch('admin')}
                className={`px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-medium transition-all cursor-pointer ${
                  user?.role === 'admin' 
                    ? 'bg-purple-800 text-white shadow-xs' 
                    : 'bg-white hover:bg-purple-100 text-purple-900 border border-purple-200'
                }`}
                title="Login as Administrator (admin@marketlink.local)"
              >
                {t('demoAdmin')}
              </button>
              <button
                type="button"
                onClick={() => handleDemoSwitch('seller')}
                className={`px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-medium transition-all cursor-pointer ${
                  user?.role === 'seller' 
                    ? 'bg-forest-800 text-white shadow-xs' 
                    : 'bg-white hover:bg-forest-100 text-forest-900 border border-forest-200'
                }`}
                title="Login as Artisan Producer: Ramanathan Natarajan (seller@marketlink.local)"
              >
                {t('demoSeller')}
              </button>
              <button
                type="button"
                onClick={() => handleDemoSwitch('buyer')}
                className={`px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-medium transition-all cursor-pointer ${
                  user?.role === 'buyer' 
                    ? 'bg-terracotta-700 text-white shadow-xs' 
                    : 'bg-white hover:bg-terracotta-100 text-terracotta-900 border border-terracotta-200'
                }`}
                title="Login as Wholesale Buyer: Anita Venkatesh (buyer@marketlink.local)"
              >
                {t('demoBuyer')}
              </button>
            </div>
          </div>

          {/* User authentication status & quick sign in/out */}
          <div className="flex items-center gap-2 shrink-0">
            {user ? (
              <div className="flex items-center gap-1.5 sm:gap-2 text-[11px]">
                <span className="text-stone-600 truncate max-w-[130px] sm:max-w-none">
                  {t('loggedInAs')} <strong className="text-forest-900 font-semibold">{user.full_name?.split(' ')[0]}</strong>
                </span>
                <button
                  type="button"
                  onClick={logout}
                  className="text-rose-700 hover:text-rose-900 hover:underline font-semibold text-[11px] ml-0.5 cursor-pointer"
                  title="Sign out of current account"
                >
                  ({t('navLogout')})
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[11px]">
                <Link to="/login" className="text-forest-900 font-bold hover:underline">
                  {t('navLogin')}
                </Link>
                <span className="text-stone-300">|</span>
                <Link to="/register" className="text-terracotta-700 font-bold hover:underline">
                  {t('navRegister')}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="w-10 h-10 rounded-xl bg-forest-800 text-cream-100 flex items-center justify-center shadow-md group-hover:bg-forest-900 transition-colors shrink-0">
            <ShieldCheck className="w-6 h-6 text-gold-400" />
          </div>
          <div>
            <span className="font-serif text-xl font-bold tracking-tight text-forest-950 block leading-tight">
              {t('brandName')}
            </span>
            <span className="text-[10px] uppercase font-semibold tracking-wider text-terracotta-700 block">
              {t('ruralArtisanDirect')}
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden xl:flex items-center gap-4 2xl:gap-6 text-sm font-medium text-charcoal-700">
          <Link to="/marketplace" className="hover:text-forest-800 transition-colors whitespace-nowrap">
            {t('navMarketplace')}
          </Link>
          <Link to="/requirements" className="hover:text-forest-800 transition-colors whitespace-nowrap">
            {t('navBulkRequirements')}
          </Link>
          <Link to="/verification-policy" className="hover:text-forest-800 transition-colors whitespace-nowrap">
            {t('navArtisans')}
          </Link>

          {/* Role specific primary links */}
          {user?.role === 'seller' && (
            <>
              <Link to="/seller" className="hover:text-forest-800 text-forest-900 font-semibold transition-colors whitespace-nowrap">
                {t('navSellerDashboard')}
              </Link>
              <Link to="/seller/verification" className="hover:text-amber-900 text-amber-800 font-medium transition-colors whitespace-nowrap">
                {t('navVerification')}
              </Link>
            </>
          )}

          {user?.role === 'buyer' && (
            <Link to="/buyer" className="hover:text-terracotta-800 text-terracotta-900 font-semibold transition-colors whitespace-nowrap">
              {t('navBuyerDashboard')}
            </Link>
          )}

          {user?.role === 'admin' && (
            <Link to="/admin" className="hover:text-purple-800 text-purple-900 font-semibold transition-colors whitespace-nowrap">
              {t('navAdminConsole')}
            </Link>
          )}

          <Link to="/about" className="hover:text-forest-800 transition-colors whitespace-nowrap">
            {t('navAbout')}
          </Link>
        </nav>

        {/* Right-Side Action Group */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Language Selector */}
          <div className="flex items-center bg-stone-100/90 border border-stone-200/90 rounded-xl p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`px-2 py-1 rounded-lg transition-all text-xs cursor-pointer ${
                language === 'en'
                  ? 'bg-white text-forest-900 font-bold shadow-xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
              title="English"
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLanguage('ta')}
              className={`px-2 py-1 rounded-lg transition-all text-xs cursor-pointer ${
                language === 'ta'
                  ? 'bg-white text-forest-900 font-bold shadow-xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
              title="தமிழ்"
            >
              தமிழ்
            </button>
          </div>

          {/* Shopping Cart Link */}
          <Link
            to="/cart"
            className="h-9 w-9 rounded-xl text-stone-600 hover:text-forest-900 hover:bg-[#EFE9DD] flex items-center justify-center transition-all relative border border-transparent hover:border-stone-200"
            title="Shopping Cart"
          >
            <ShoppingCart className="w-4 h-4" />
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full bg-forest-800 text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                {totalItems}
              </span>
            )}
          </Link>

          {/* Desktop/Tablet Action Buttons */}
          {user ? (
            <div className="hidden sm:flex items-center gap-1.5">
              {/* Notification Bell */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="h-9 w-9 rounded-xl text-stone-600 hover:text-forest-900 hover:bg-[#EFE9DD] flex items-center justify-center transition-all relative border border-transparent hover:border-stone-200"
                  title="Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-terracotta-600 ring-2 ring-white"></span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-stone-200 p-4 z-50">
                    <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                      <h4 className="font-semibold text-sm text-charcoal-900">Notifications</h4>
                      <button
                        type="button"
                        onClick={async () => {
                          await api.markAllNotificationsRead();
                          setUnreadCount(0);
                        }}
                        className="text-xs text-forest-700 hover:underline"
                      >
                        Mark all as read
                      </button>
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-stone-100 mt-2">
                      {notifications.length === 0 ? (
                        <p className="text-xs text-stone-400 py-4 text-center">No notifications yet.</p>
                      ) : (
                        notifications.map((n) => (
                          <div key={n.id} className={`py-2.5 px-2 rounded-lg text-xs ${n.read ? 'opacity-70' : 'bg-forest-50/50'}`}>
                            <p className="font-semibold text-charcoal-900">{n.title}</p>
                            <p className="text-stone-600 mt-0.5">{n.message}</p>
                            <span className="text-[10px] text-stone-400 mt-1 block">
                              {new Date(n.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Messages Link */}
              <Link
                to="/messages"
                className="h-9 w-9 rounded-xl text-stone-600 hover:text-forest-900 hover:bg-[#EFE9DD] flex items-center justify-center transition-all border border-transparent hover:border-stone-200"
                title={t('navMessages')}
              >
                <MessageSquare className="w-4 h-4" />
              </Link>

              {/* Dashboard CTA */}
              <Link
                to={getDashboardPath()}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-forest-800 text-white text-xs font-semibold hover:bg-forest-900 shadow-xs transition-all whitespace-nowrap"
                title="Go to Dashboard"
              >
                <User className="w-3.5 h-3.5 text-gold-300" />
                <span>{user.full_name?.split(' ')[0] || t('navDashboard')}</span>
              </Link>

              {/* Logout button */}
              <button
                type="button"
                onClick={logout}
                className="h-9 w-9 rounded-xl text-stone-500 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-all border border-transparent hover:border-rose-200 cursor-pointer"
                title={t('navLogout')}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Link
                to="/login"
                className="h-9 px-3.5 inline-flex items-center justify-center text-xs font-semibold text-forest-900 hover:bg-[#EFE9DD] rounded-xl transition-all border border-transparent hover:border-stone-200 whitespace-nowrap"
              >
                {t('navLogin')}
              </Link>
              <Link
                to="/register"
                className="h-9 px-4 inline-flex items-center justify-center text-xs font-semibold bg-forest-800 text-white rounded-xl hover:bg-forest-900 shadow-xs transition-all whitespace-nowrap"
              >
                {t('navRegister')}
              </Link>
            </div>
          )}

          {/* Mobile hamburger button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="xl:hidden h-9 w-9 rounded-xl text-stone-700 bg-stone-100/90 hover:bg-[#EFE9DD] flex items-center justify-center shrink-0 border border-stone-200 cursor-pointer"
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-forest-950" /> : <Menu className="w-5 h-5 text-forest-950" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="xl:hidden bg-white border-b border-stone-200 px-4 pt-3 pb-6 space-y-4 shadow-xl">
          {/* User Account Section inside Mobile Drawer */}
          {user ? (
            <div className="bg-[#FAF6EE] p-3.5 rounded-2xl border border-[#E5DAC8] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-forest-800 text-gold-300 flex items-center justify-center font-bold text-sm shadow-xs">
                    {user.full_name?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-charcoal-900 leading-tight">
                      {user.full_name}
                    </div>
                    <div className="text-[10px] text-stone-500 flex items-center gap-1.5 mt-0.5">
                      <span className="capitalize font-semibold text-forest-800 bg-forest-100/70 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide">
                        {user.role}
                      </span>
                      <span className="truncate max-w-[130px]">{user.email}</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{t('navLogout')}</span>
                </button>
              </div>

              {/* Mobile Quick Action Buttons */}
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                <Link
                  to={getDashboardPath()}
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2 px-2 rounded-xl bg-forest-800 text-white text-[11px] font-semibold text-center flex items-center justify-center gap-1 shadow-xs"
                >
                  <User className="w-3 h-3 text-gold-300" />
                  <span>Dashboard</span>
                </Link>
                <Link
                  to="/messages"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2 px-2 rounded-xl bg-white border border-stone-200 text-charcoal-800 text-[11px] font-semibold text-center flex items-center justify-center gap-1"
                >
                  <MessageSquare className="w-3 h-3 text-forest-700" />
                  <span>Messages</span>
                </Link>
                <Link
                  to="/cart"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2 px-2 rounded-xl bg-white border border-stone-200 text-charcoal-800 text-[11px] font-semibold text-center flex items-center justify-center gap-1"
                >
                  <ShoppingCart className="w-3 h-3 text-forest-700" />
                  <span>Cart ({totalItems})</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-[#FAF6EE] p-3.5 rounded-2xl border border-[#E5DAC8] space-y-2">
              <p className="text-xs text-charcoal-700 font-medium">
                Sign in to manage your artisan store or wholesale orders:
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2.5 px-3 rounded-xl bg-white hover:bg-stone-50 text-forest-900 border border-[#D5CABB] font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <User className="w-3.5 h-3.5 text-terracotta-600" />
                  <span>{t('navLogin')}</span>
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2.5 px-3 rounded-xl bg-forest-800 hover:bg-forest-900 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <span>{t('navRegister')}</span>
                </Link>
              </div>
            </div>
          )}

          {/* Navigation Links */}
          <div className="divide-y divide-stone-100 py-1">
            <Link
              to="/marketplace"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2.5 text-sm font-semibold text-charcoal-800 hover:text-forest-800"
            >
              {t('navMarketplace')}
            </Link>
            <Link
              to="/requirements"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2.5 text-sm font-semibold text-charcoal-800 hover:text-forest-800"
            >
              {t('navBulkRequirements')}
            </Link>
            <Link
              to="/verification-policy"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2.5 text-sm font-semibold text-charcoal-800 hover:text-forest-800"
            >
              {t('navArtisans')}
            </Link>

            {/* Role specific mobile links */}
            {user?.role === 'seller' && (
              <div className="bg-[#FAF8F5] p-3 my-2 rounded-xl border border-stone-200 space-y-2">
                <Link
                  to="/seller"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-1.5 px-3 text-sm font-semibold text-charcoal-900 hover:text-forest-800"
                >
                  {t('navSellerDashboard')}
                </Link>
                <Link
                  to="/seller/verification"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-1.5 px-3 text-sm font-medium text-amber-800 hover:text-amber-900"
                >
                  {t('navVerification')}
                </Link>
              </div>
            )}

            {user?.role === 'buyer' && (
              <Link
                to="/buyer"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2.5 text-sm font-semibold text-terracotta-800"
              >
                {t('navBuyerDashboard')}
              </Link>
            )}

            {user?.role === 'admin' && (
              <Link
                to="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2.5 text-sm font-semibold text-purple-800"
              >
                {t('navAdminConsole')}
              </Link>
            )}

            <Link
              to="/about"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2.5 text-sm font-medium text-charcoal-800 hover:text-forest-800"
            >
              {t('navAbout')}
            </Link>
          </div>

          {/* Quick Demo Switcher inside mobile menu */}
          <div className="pt-2 border-t border-stone-200">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-2">
              {t('demoRoles')} (1-Click Test):
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  handleDemoSwitch('admin');
                  setMobileMenuOpen(false);
                }}
                className="py-1.5 px-2 rounded-lg bg-purple-50 text-purple-900 border border-purple-200 text-[11px] font-semibold text-center cursor-pointer"
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => {
                  handleDemoSwitch('seller');
                  setMobileMenuOpen(false);
                }}
                className="py-1.5 px-2 rounded-lg bg-forest-50 text-forest-900 border border-forest-200 text-[11px] font-semibold text-center cursor-pointer"
              >
                Ramanathan
              </button>
              <button
                type="button"
                onClick={() => {
                  handleDemoSwitch('buyer');
                  setMobileMenuOpen(false);
                }}
                className="py-1.5 px-2 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 text-[11px] font-semibold text-center cursor-pointer"
              >
                Anita
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
