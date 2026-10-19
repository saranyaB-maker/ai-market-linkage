import React, { useState, useEffect } from 'react';
import {
  Users, Package, ShieldCheck, AlertTriangle, TrendingUp,
  Clock, CheckCircle, XCircle, Search, RefreshCw, Eye,
  BarChart3, FileText, ShoppingCart, Flag, X, Video, Download, ExternalLink, Calendar, MapPin, Award
} from 'lucide-react';
import api from '../../services/api';

export const AdminDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [pendingVerifications, setPendingVerifications] = useState<any[]>([]);
  const [duplicateFlags, setDuplicateFlags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'verification' | 'products' | 'analytics'>('overview');
  const [userSearch, setUserSearch] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  // Dossier Inspection & Rejection Modal State
  const [inspectModalUser, setInspectModalUser] = useState<{ id: string; name: string } | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [dossierData, setDossierData] = useState<any>(null);
  const [rejectModalUser, setRejectModalUser] = useState<{ id: string; name: string } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processingReview, setProcessingReview] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [metricsRes, usersRes, verRes, dupRes] = await Promise.allSettled([
        api.getAdminMetrics(),
        api.adminListUsers({ limit: 20 }),
        api.adminPendingVerifications(),
        api.adminDuplicateFlags(),
      ]);

      if (metricsRes.status === 'fulfilled') setMetrics(metricsRes.value);
      if (usersRes.status === 'fulfilled') setUsers(usersRes.value?.users || []);
      if (verRes.status === 'fulfilled') setPendingVerifications(verRes.value?.pending || []);
      if (dupRes.status === 'fulfilled') setDuplicateFlags(dupRes.value?.flags || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const openInspectDossier = async (userId: string, name: string) => {
    setInspectModalUser({ id: userId, name });
    setDossierLoading(true);
    try {
      const res = await api.getVerificationApplication(userId);
      setDossierData(res);
    } catch (err: any) {
      setActionMsg(`Failed to load dossier: ${err.message}`);
    } finally {
      setDossierLoading(false);
    }
  };

  const openRejectModal = (userId: string, name: string) => {
    setRejectModalUser({ id: userId, name });
    setRejectionReason('');
  };

  const handleConfirmReject = async () => {
    if (!rejectModalUser) return;
    if (!rejectionReason.trim()) {
      setActionMsg('Rejection reason is required so the artisan can correct their application.');
      return;
    }
    setProcessingReview(true);
    try {
      await api.adminReviewVerification({
        user_id: rejectModalUser.id,
        decision: 'rejected',
        reason: rejectionReason.trim()
      });
      setActionMsg(`Application for ${rejectModalUser.name} rejected with feedback.`);
      setRejectModalUser(null);
      setInspectModalUser(null);
      setTimeout(() => setActionMsg(''), 4000);
      loadData();
    } catch (err: any) {
      setActionMsg(`Error rejecting application: ${err.message}`);
    } finally {
      setProcessingReview(false);
    }
  };

  const handleApproveFromDossier = async (userId: string, name: string) => {
    setProcessingReview(true);
    try {
      await api.adminReviewVerification({
        user_id: userId,
        decision: 'verified_producer',
        reason: 'Craft dossier and workshop verification evidence verified and approved by admin.'
      });
      setActionMsg(`Artisan ${name} successfully verified!`);
      setInspectModalUser(null);
      setTimeout(() => setActionMsg(''), 4000);
      loadData();
    } catch (err: any) {
      setActionMsg(`Error approving application: ${err.message}`);
    } finally {
      setProcessingReview(false);
    }
  };

  const handleVerification = async (userId: string, decision: 'verified_producer' | 'rejected', userName?: string) => {
    if (decision === 'rejected') {
      openRejectModal(userId, userName || 'Artisan');
      return;
    }
    try {
      await api.adminReviewVerification({
        user_id: userId,
        decision,
        reason: 'Evidence accepted and artisan verified by admin.'
      });
      setActionMsg(`User verified successfully`);
      setTimeout(() => setActionMsg(''), 3000);
      loadData();
    } catch (e: any) {
      setActionMsg(`Error: ${e.message}`);
    }
  };

  const handleSuspend = async (userId: string, suspend: boolean) => {
    try {
      await api.adminUpdateUser(userId, { status: suspend ? 'suspended' : 'active' });
      setActionMsg(`User ${suspend ? 'suspended' : 'reinstated'}`);
      setTimeout(() => setActionMsg(''), 3000);
      loadData();
    } catch (e: any) {
      setActionMsg(`Error: ${e.message}`);
    }
  };

  const filteredUsers = users.filter(u =>
    !userSearch || u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const statCards = metrics ? [
    { label: 'Total Users', value: (metrics.sellers || 0) + (metrics.buyers || 0) + (metrics.admins || 0), icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Active Products', value: metrics.active_products || 0, icon: Package, color: 'text-forest-green', bg: 'bg-forest-green/10' },
    { label: 'Pending Verifications', value: metrics.pending_verifications || 0, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Duplicate Flags', value: metrics.suspected_duplicates || 0, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Total Orders', value: metrics.total_orders || 0, icon: ShoppingCart, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Open Disputes', value: metrics.open_disputes || 0, icon: Flag, color: 'text-orange-600', bg: 'bg-orange-50' },
  ] : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-forest-green border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-charcoal/60">Loading admin dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-display font-bold text-charcoal">Admin Dashboard</h1>
          <p className="text-charcoal/60 mt-1">Platform administration and moderation</p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-charcoal/70 hover:bg-gray-50 transition-colors text-sm"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {actionMsg && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-medium">
          ✓ {actionMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-8 w-fit overflow-x-auto">
        {(['overview', 'users', 'verification', 'products', 'analytics'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize whitespace-nowrap transition-all ${
              activeTab === tab ? 'bg-white text-charcoal shadow-sm' : 'text-charcoal/60 hover:text-charcoal'
            }`}
          >
            {tab === 'verification' ? 'Verifications' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === 'verification' && pendingVerifications.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-amber-500 text-white text-xs rounded-full">{pendingVerifications.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 'overview' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
            {statCards.map(s => (
              <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                </div>
                <p className="text-xl font-bold text-charcoal">{s.value}</p>
                <p className="text-xs text-charcoal/60 mt-0.5 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="font-bold text-charcoal mb-4">User Breakdown</h2>
              <div className="space-y-3">
                {[
                  { label: 'Sellers', value: metrics?.sellers || 0, color: 'bg-forest-green' },
                  { label: 'Buyers', value: metrics?.buyers || 0, color: 'bg-terracotta' },
                  { label: 'Admins', value: metrics?.admins || 0, color: 'bg-gold' },
                ].map(item => {
                  const total = (metrics?.sellers || 0) + (metrics?.buyers || 0) + (metrics?.admins || 0) || 1;
                  return (
                    <div key={item.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-charcoal/70">{item.label}</span>
                        <span className="font-semibold text-charcoal">{item.value}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${(item.value / total) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="font-bold text-charcoal mb-4">Pending Actions</h2>
              <div className="space-y-3">
                {pendingVerifications.length === 0 && duplicateFlags.length === 0 ? (
                  <div className="flex items-center gap-2 text-emerald-600 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    <span>No pending actions. All clear!</span>
                  </div>
                ) : (
                  <>
                    {pendingVerifications.length > 0 && (
                      <button
                        onClick={() => setActiveTab('verification')}
                        className="w-full flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-amber-600" />
                          <span className="text-sm text-amber-800 font-medium">{pendingVerifications.length} verifications pending</span>
                        </div>
                        <span className="text-amber-600 text-sm">Review →</span>
                      </button>
                    )}
                    {duplicateFlags.length > 0 && (
                      <button
                        onClick={() => setActiveTab('products')}
                        className="w-full flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-600" />
                          <span className="text-sm text-red-800 font-medium">{duplicateFlags.length} duplicate image flags</span>
                        </div>
                        <span className="text-red-600 text-sm">Review →</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal/40" />
              <input
                type="text"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-green/30 text-sm"
              />
            </div>
            <span className="text-sm text-charcoal/60 whitespace-nowrap">{filteredUsers.length} users</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-2 text-xs font-semibold text-charcoal/50 uppercase tracking-wide">User</th>
                  <th className="text-left py-3 px-2 text-xs font-semibold text-charcoal/50 uppercase tracking-wide">Role</th>
                  <th className="text-left py-3 px-2 text-xs font-semibold text-charcoal/50 uppercase tracking-wide">Status</th>
                  <th className="text-left py-3 px-2 text-xs font-semibold text-charcoal/50 uppercase tracking-wide">Verification</th>
                  <th className="text-right py-3 px-2 text-xs font-semibold text-charcoal/50 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredUsers.map((u: any) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-2">
                      <p className="font-medium text-charcoal">{u.full_name}</p>
                      <p className="text-xs text-charcoal/50">{u.email}</p>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.role === 'admin' ? 'bg-purple-50 text-purple-700' :
                        u.role === 'seller' ? 'bg-forest-green/10 text-forest-green' :
                        'bg-blue-50 text-blue-700'
                      }`}>{u.role}</span>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                      }`}>{u.status || 'active'}</span>
                    </td>
                    <td className="py-3 px-2">
                      <span className="text-xs text-charcoal/60">{u.verification_status?.replace('_', ' ') || '—'}</span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      {u.role !== 'admin' && (
                        <button
                          onClick={() => handleSuspend(u.id, u.status !== 'suspended')}
                          className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
                            u.status === 'suspended'
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-red-50 text-red-700 hover:bg-red-100'
                          }`}
                        >
                          {u.status === 'suspended' ? 'Reinstate' : 'Suspend'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Verification Tab */}
      {activeTab === 'verification' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-bold text-charcoal text-lg mb-6">
            Pending Verifications ({pendingVerifications.length})
          </h2>
          {pendingVerifications.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <p className="font-semibold text-charcoal">All verifications reviewed!</p>
              <p className="text-sm text-charcoal/60 mt-1">No pending verification requests at this time.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {pendingVerifications.map((v: any) => {
                const displayName = v.full_name || v.seller_name || 'Artisan Seller';
                return (
                  <div key={v.user_id} className="py-5">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-charcoal">{displayName}</p>
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">Pending Review</span>
                        </div>
                        <p className="text-sm text-charcoal/60 mt-0.5">{v.email} · {v.seller_type?.replace('_', ' ') || 'Artisan'}</p>
                        {v.notes && <p className="text-sm text-charcoal/70 mt-2 bg-gray-50 rounded-lg p-2">{v.notes}</p>}
                        <div className="flex items-center gap-3 text-xs text-charcoal/50 mt-2">
                          {v.evidence_count !== undefined && (
                            <span>{v.evidence_count} evidence file(s) submitted</span>
                          )}
                          {v.submitted_at && (
                            <span>Submitted: {new Date(v.submitted_at).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
                        <button
                          onClick={() => openInspectDossier(v.user_id, displayName)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-forest-green/10 text-forest-green rounded-xl text-sm font-medium hover:bg-forest-green/20 transition-colors"
                        >
                          <Eye className="w-4 h-4" /> Inspect Dossier & Video
                        </button>
                        <button
                          onClick={() => handleVerification(v.user_id, 'verified_producer', displayName)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-medium hover:bg-emerald-100 transition-colors"
                        >
                          <CheckCircle className="w-4 h-4" /> Approve
                        </button>
                        <button
                          onClick={() => handleVerification(v.user_id, 'rejected', displayName)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors"
                        >
                          <XCircle className="w-4 h-4" /> Reject
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Products / Duplicate Flags Tab */}
      {activeTab === 'products' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-bold text-charcoal text-lg mb-6">
            Duplicate Image Flags ({duplicateFlags.length})
          </h2>
          {duplicateFlags.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <p className="font-semibold text-charcoal">No duplicate flags</p>
              <p className="text-sm text-charcoal/60 mt-1">The AI duplicate detector has not flagged any suspicious product images.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {duplicateFlags.map((flag: any, i: number) => (
                <div key={i} className="py-4">
                  <div className="flex items-start gap-4">
                    <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="font-semibold text-charcoal text-sm">
                        Product: {flag.product_title || flag.product_id}
                      </p>
                      <p className="text-xs text-charcoal/60 mt-0.5">
                        Similarity: {flag.similarity_score ? `${(flag.similarity_score * 100).toFixed(1)}%` : 'High'} ·
                        Matched with: {flag.matched_title || flag.matched_id}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-1 bg-amber-50 text-amber-700 rounded-full font-medium">Review needed</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-bold text-charcoal mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-forest-green" /> Platform Summary
            </h2>
            <div className="space-y-4">
              {[
                { label: 'Total Sellers', value: metrics?.sellers || 0 },
                { label: 'Total Buyers', value: metrics?.buyers || 0 },
                { label: 'Active Listings', value: metrics?.active_products || 0 },
                { label: 'Verified Producers', value: metrics?.verified_producers || 0 },
                { label: 'Total Orders', value: metrics?.total_orders || 0 },
                { label: 'Open Requirements', value: metrics?.open_requirements || 0 },
              ].map(item => (
                <div key={item.label} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-charcoal/70">{item.label}</span>
                  <span className="font-bold text-charcoal">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-bold text-charcoal mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-terracotta" /> Verification Breakdown
            </h2>
            <div className="space-y-3">
              {[
                { label: 'Unverified', value: metrics?.unverified || 0, color: 'bg-gray-300' },
                { label: 'Pending Review', value: metrics?.pending_verifications || 0, color: 'bg-amber-400' },
                { label: 'Verified Producers', value: metrics?.verified_producers || 0, color: 'bg-emerald-500' },
                { label: 'Verified Groups', value: metrics?.verified_groups || 0, color: 'bg-forest-green' },
                { label: 'Verified Resellers', value: metrics?.verified_resellers || 0, color: 'bg-blue-500' },
              ].map(item => {
                const total = Math.max(metrics?.sellers || 1, 1);
                return (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-charcoal/70">{item.label}</span>
                      <span className="font-semibold text-charcoal">{item.value}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full`} style={{ width: `${Math.min((item.value / total) * 100, 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {/* Dossier Inspection Modal */}
      {inspectModalUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-6">
              <div>
                <h3 className="text-xl font-display font-bold text-charcoal flex items-center gap-2">
                  <ShieldCheck className="w-6 h-6 text-forest-green" />
                  Verification Dossier: {inspectModalUser.name}
                </h3>
                <p className="text-sm text-charcoal/60 mt-0.5">Comprehensive audit of artisan identity, workshop, and craft authenticity</p>
              </div>
              <button
                onClick={() => setInspectModalUser(null)}
                className="p-2 text-charcoal/40 hover:text-charcoal hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {dossierLoading ? (
              <div className="py-16 text-center">
                <div className="w-10 h-10 border-4 border-forest-green border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-charcoal/60">Fetching seller dossier & evidence files...</p>
              </div>
            ) : !dossierData ? (
              <div className="py-12 text-center text-charcoal/60">
                <p>Could not load verification dossier data.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Step 1 Profile Summary */}
                <div className="bg-sand-light/50 border border-sand rounded-2xl p-5">
                  <h4 className="font-bold text-charcoal text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Award className="w-4 h-4 text-forest-green" /> Step 1: Artisan Profile
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-charcoal/50 text-xs">Full Legal / Artisan Name:</span>
                      <p className="font-medium text-charcoal">
                        {dossierData.application?.step_1_profile?.full_name || dossierData.seller_profile?.full_name || dossierData.user?.full_name || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-charcoal/50 text-xs">Craft Category:</span>
                      <p className="font-medium text-charcoal capitalize">
                        {dossierData.application?.step_1_profile?.craft_category || dossierData.seller_profile?.craft_category || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-charcoal/50 text-xs">Years of Experience:</span>
                      <p className="font-medium text-charcoal">
                        {dossierData.application?.step_1_profile?.years_experience || dossierData.seller_profile?.years_of_experience || 'N/A'} years
                      </p>
                    </div>
                    <div>
                      <span className="text-charcoal/50 text-xs">Location / State:</span>
                      <p className="font-medium text-charcoal flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-terracotta" />
                        {dossierData.application?.step_1_profile?.state || dossierData.seller_profile?.state || 'India'}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-charcoal/50 text-xs">Workshop / Production Facility Details:</span>
                      <p className="text-charcoal/80 bg-white p-3 rounded-xl border border-gray-100 mt-1">
                        {dossierData.application?.step_1_profile?.workshop_details || dossierData.seller_profile?.bio || 'No workshop details provided.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Step 2 Supporting Documents */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  <h4 className="font-bold text-charcoal text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-terracotta" /> Step 2: Identity & Producer Documents
                  </h4>
                  {(!dossierData.evidence || dossierData.evidence.filter((e: any) => e.evidence_type !== 'craft_video').length === 0) ? (
                    <p className="text-sm text-charcoal/50 italic">No supporting identity documents submitted.</p>
                  ) : (
                    <div className="space-y-2">
                      {dossierData.evidence
                        .filter((e: any) => e.evidence_type !== 'craft_video')
                        .map((doc: any) => (
                          <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-xl">
                            <div className="flex items-center gap-3">
                              <FileText className="w-5 h-5 text-forest-green shrink-0" />
                              <div>
                                <p className="text-sm font-medium text-charcoal">{doc.original_filename || 'Evidence File'}</p>
                                <div className="flex items-center gap-2 text-xs text-charcoal/50 mt-0.5">
                                  <span className="px-2 py-0.5 bg-gray-200 text-charcoal/70 rounded capitalize">
                                    {doc.evidence_type?.replace(/_/g, ' ') || 'Document'}
                                  </span>
                                  {doc.file_size && <span>{(doc.file_size / 1024).toFixed(0)} KB</span>}
                                  {doc.created_at && <span>{new Date(doc.created_at).toLocaleDateString()}</span>}
                                </div>
                              </div>
                            </div>
                            <a
                              href={doc.file_url || `/api/verification/evidence/${doc.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-charcoal text-xs font-medium rounded-lg hover:bg-gray-100 transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" /> View / Download
                            </a>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Step 3 Craft-Proof Video */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  <h4 className="font-bold text-charcoal text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Video className="w-4 h-4 text-forest-green" /> Step 3: Craft Authenticity Video
                  </h4>
                  {(() => {
                    const videoEvidence = dossierData.evidence?.find((e: any) => e.evidence_type === 'craft_video');
                    const videoUrl = videoEvidence?.file_url || (videoEvidence ? `/api/verification/evidence/${videoEvidence.id}` : null);
                    if (!videoUrl) {
                      return (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
                          <p className="font-medium">⚠️ No craft video submitted.</p>
                          <p className="text-xs text-amber-700 mt-1">Authentic craft proof requires a recorded or uploaded video of hand-making.</p>
                        </div>
                      );
                    }
                    return (
                      <div>
                        <div className="rounded-xl overflow-hidden bg-black shadow-inner border border-gray-800">
                          <video
                            controls
                            className="w-full max-h-72 object-contain"
                            src={videoUrl}
                          >
                            Your browser does not support HTML5 video streaming.
                          </video>
                        </div>
                        <div className="flex items-center justify-between text-xs text-charcoal/60 mt-2 px-1">
                          <span>{videoEvidence?.original_filename || 'Craft-proof video'}</span>
                          <a
                            href={videoUrl}
                            download
                            className="flex items-center gap-1 text-forest-green hover:underline font-medium"
                          >
                            <Download className="w-3.5 h-3.5" /> Download Original Video
                          </a>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Actions Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <button
                    onClick={() => setInspectModalUser(null)}
                    className="px-4 py-2 text-sm text-charcoal/70 hover:text-charcoal border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Close Dossier
                  </button>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => openRejectModal(inspectModalUser.id, inspectModalUser.name)}
                      disabled={processingReview}
                      className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" /> Reject with Feedback
                    </button>
                    <button
                      onClick={() => handleApproveFromDossier(inspectModalUser.id, inspectModalUser.name)}
                      disabled={processingReview}
                      className="flex items-center gap-2 px-5 py-2 bg-forest-green text-white hover:bg-forest-green/90 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4" /> Approve as Verified Producer
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {rejectModalUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <h3 className="text-lg font-bold text-charcoal flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Reject Verification Application
              </h3>
              <button
                onClick={() => setRejectModalUser(null)}
                className="p-1.5 text-charcoal/40 hover:text-charcoal hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-charcoal/70 mb-3">
              Artisan: <strong className="text-charcoal">{rejectModalUser.name}</strong>
            </p>
            <p className="text-xs text-charcoal/60 mb-3">
              Provide specific, actionable reasons why this verification application cannot be approved. The artisan will see this message in their dashboard and will be able to resubmit.
            </p>

            {/* Quick Reason Presets */}
            <div className="mb-4">
              <span className="text-xs font-semibold text-charcoal/60 uppercase tracking-wider block mb-2">
                Quick Selection:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Craft video does not show hand-making process clearly',
                  'Identity document is illegible or expired',
                  'Workshop proof is missing or incomplete',
                  'Craft technique does not meet authentic artisan criteria',
                  'Missing government-issued artisan card or cooperative registration'
                ].map((reason, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setRejectionReason(reason)}
                    className="text-xs px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-charcoal/80 rounded-lg transition-colors text-left"
                  >
                    + {reason}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="text-xs font-semibold text-charcoal/70 block mb-1">
                Detailed Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="Explain the specific issue with the documents, video, or profile..."
                rows={4}
                className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400 text-sm"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setRejectModalUser(null)}
                disabled={processingReview}
                className="px-4 py-2 border border-gray-200 text-charcoal/70 rounded-xl text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={!rejectionReason.trim() || processingReview}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {processingReview ? 'Submitting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
