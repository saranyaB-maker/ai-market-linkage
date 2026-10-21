import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/common/Navbar';
import { Footer } from './components/common/Footer';
import { useAuth } from './context/AuthContext';

// Public pages
import { LandingPage } from './pages/public/LandingPage';
import { MarketplacePage } from './pages/public/MarketplacePage';
import { ProductDetailPage } from './pages/public/ProductDetailPage';
import { CartPage } from './pages/public/CartPage';
import { CheckoutPage } from './pages/public/CheckoutPage';
import { AboutPage, VerificationPolicyPage, PrivacyPage, TermsPage, HelpFaqPage } from './pages/public/PoliciesPages';
import { RequirementsPage } from './pages/public/RequirementsPage';

// Auth pages
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';

// Role dashboards
import { SellerDashboard } from './pages/seller/SellerDashboard';
import { ArtisanVerificationPage } from './pages/seller/ArtisanVerificationPage';
import { BuyerDashboard } from './pages/buyer/BuyerDashboard';
import { AdminDashboard } from './pages/admin/AdminDashboard';

// Messages
import { MessagesPage } from './pages/messages/MessagesPage';

// ── Error Boundary ─────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5] p-8">
          <div className="max-w-xl w-full bg-white rounded-2xl border border-red-200 shadow-sm p-8">
            <h1 className="text-xl font-bold text-red-700 mb-2">Something went wrong</h1>
            <p className="text-sm text-gray-600 mb-4">The application encountered an error. Check the browser console for details.</p>
            <pre className="text-xs bg-red-50 border border-red-100 rounded-xl p-4 overflow-auto text-red-800 whitespace-pre-wrap">
              {this.state.error?.message}
              {'\n\n'}
              {this.state.error?.stack?.split('\n').slice(0, 8).join('\n')}
            </pre>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/'; }}
              className="mt-4 px-5 py-2 bg-[#1D452B] text-white rounded-xl text-sm font-medium hover:bg-[#173723] transition-colors"
            >
              Go to Home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Protected route wrapper ────────────────────────────────────────────────
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  allowedRoles?: string[];
}> = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#1D452B] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

// ── Layouts ───────────────────────────────────────────────────────────────
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen flex flex-col bg-warm-canvas text-charcoal-900">
    <Navbar />
    <main className="flex-1">{children}</main>
    <Footer />
  </div>
);

const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen flex flex-col bg-[#F6F1E8] text-charcoal-900">
    <Navbar />
    <main className="flex-1">{children}</main>
  </div>
);

// ── App ───────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Layout><LandingPage /></Layout>} />
        <Route path="/marketplace" element={<Layout><MarketplacePage /></Layout>} />
        <Route path="/products/:id" element={<Layout><ProductDetailPage /></Layout>} />
        <Route path="/cart" element={<Layout><CartPage /></Layout>} />
        <Route path="/checkout" element={<Layout><CheckoutPage /></Layout>} />
        <Route path="/requirements" element={<Layout><RequirementsPage /></Layout>} />
        <Route path="/about" element={<Layout><AboutPage /></Layout>} />
        <Route path="/verification-policy" element={<Layout><VerificationPolicyPage /></Layout>} />
        <Route path="/privacy" element={<Layout><PrivacyPage /></Layout>} />
        <Route path="/terms" element={<Layout><TermsPage /></Layout>} />
        <Route path="/help" element={<Layout><HelpFaqPage /></Layout>} />

        {/* Auth */}
        <Route path="/login" element={<Layout><LoginPage /></Layout>} />
        <Route path="/register" element={<Layout><RegisterPage /></Layout>} />

        {/* Protected dashboards */}
        <Route path="/seller/verification" element={
          <ProtectedRoute allowedRoles={['seller']}>
            <DashboardLayout><ArtisanVerificationPage /></DashboardLayout>
          </ProtectedRoute>
        } />
        <Route path="/seller/*" element={
          <ProtectedRoute allowedRoles={['seller']}>
            <DashboardLayout><SellerDashboard /></DashboardLayout>
          </ProtectedRoute>
        } />
        <Route path="/buyer/*" element={
          <ProtectedRoute allowedRoles={['buyer']}>
            <DashboardLayout><BuyerDashboard /></DashboardLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/*" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <DashboardLayout><AdminDashboard /></DashboardLayout>
          </ProtectedRoute>
        } />
        <Route path="/messages" element={
          <ProtectedRoute>
            <DashboardLayout><MessagesPage /></DashboardLayout>
          </ProtectedRoute>
        } />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
