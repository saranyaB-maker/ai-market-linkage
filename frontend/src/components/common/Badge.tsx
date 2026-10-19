import React from 'react';
import { ShieldCheck, AlertCircle, Clock, Store } from 'lucide-react';
import { VerificationStatus, SellerType } from '../../types';
import { useLanguage } from '../../context/LanguageContext';

interface BadgeProps {
  status?: VerificationStatus | string;
  sellerType?: SellerType;
  showText?: boolean;
}

export const VerificationBadge: React.FC<BadgeProps> = ({ status = 'unverified' }) => {
  const { language } = useLanguage();
  const isTa = language === 'ta';

  if (status === 'verified_producer' || status === 'approved') {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs"
        title="Verified Artisan: Direct workshop verification approved by admin."
      >
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        {isTa ? 'சரிபார்க்கப்பட்ட கைவினைஞர்' : 'Verified Artisan'}
      </span>
    );
  }

  if (status === 'verified_group') {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs"
        title="Verified Artisan Group: Registered cooperative or rural self-help group."
      >
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        {isTa ? 'சான்றளிக்கப்பட்ட உற்பத்தியாளர் குழு' : 'Verified Artisan (Group)'}
      </span>
    );
  }

  if (status === 'verified_reseller') {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200"
        title="Reseller Verified: Sells handmade goods sourced from artisans."
      >
        <Store className="w-3.5 h-3.5 text-slate-600 shrink-0" />
        {isTa ? 'சான்றளிக்கப்பட்ட மறுவிற்பனையாளர்' : 'Verified Reseller'}
      </span>
    );
  }

  if (status === 'pending') {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs"
        title="Verification Pending: Application dossier under review by admin."
      >
        <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        {isTa ? 'சரிபார்ப்பு பரிசீலனையில் உள்ளது' : 'Verification Pending'}
      </span>
    );
  }

  if (status === 'needs_more_information' || status === 'rejected') {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50/90 text-amber-900 border border-amber-200 shadow-2xs"
        title="Verification Requires Revision: Evidence update required."
      >
        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        {isTa ? 'சரிபார்க்கப்படாத கைவினைஞர்' : 'Unverified Artisan'}
      </span>
    );
  }

  // Default unverified state (not started, draft, unverified, etc.)
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-900 border border-amber-200/90 shadow-2xs"
      title="Unverified Artisan: Seller has not yet completed administrator verification."
    >
      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
      {isTa ? 'சரிபார்க்கப்படாத கைவினைஞர்' : 'Unverified Artisan'}
    </span>
  );
};
