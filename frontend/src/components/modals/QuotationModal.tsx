import React, { useState } from 'react';
import { FileText, X, Check, Clock, CheckCircle2 } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface QuotationModalProps {
  isOpen?: boolean;
  onClose: () => void;
  requirementId?: string;
  buyerId?: string;
  productId?: string;
  productTitle?: string;
  initialQuantity?: number;
  initialPrice?: number;
  onQuotationSubmitted?: () => void;
}

export const QuotationModal: React.FC<QuotationModalProps> = ({
  isOpen = true,
  onClose,
  requirementId,
  buyerId,
  productId,
  productTitle,
  initialQuantity = 100,
  initialPrice = 150,
  onQuotationSubmitted,
}) => {
  const { user: currentUser } = useAuth();
  const [quantity, setQuantity] = useState(initialQuantity);
  const [unitPrice, setUnitPrice] = useState(initialPrice);
  const [leadTimeDays, setLeadTimeDays] = useState(14);
  const [deliveryTerms, setDeliveryTerms] = useState('Ex-workshop with insured surface dispatch');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submittedData, setSubmittedData] = useState<any | null>(null);

  const isBuyerRole = currentUser?.role === 'buyer';

  if (!isOpen) return null;

  const totalValue = round(Number(quantity) * Number(unitPrice), 2);

  function round(val: number, decimals: number) {
    return Number(Math.round(Number(val + 'e' + decimals)) + 'e-' + decimals);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBuyerRole) {
      setError('Buyer accounts cannot submit wholesale quotations. Only registered Artisan Sellers can submit quotations to buyers.');
      return;
    }
    if (quantity <= 0 || unitPrice <= 0) {
      setError('Quantity and unit price must be positive numbers.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await api.submitQuotation({
        requirement_id: requirementId,
        buyer_id: buyerId,
        product_id: productId,
        quantity: Number(quantity),
        unit_price: Number(unitPrice),
        lead_time_days: Number(leadTimeDays),
        delivery_terms: deliveryTerms,
        notes,
      });
      setSubmittedData(res);
      if (onQuotationSubmitted) {
        onQuotationSubmitted();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit quotation.');
    } finally {
      setLoading(false);
    }
  };

  // Success view
  if (submittedData) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-stone-200 text-center animate-in fade-in zoom-in duration-150">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-200">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="font-serif text-xl font-bold text-charcoal-900 mb-2">
            Quotation Submitted Successfully!
          </h3>
          <p className="text-xs sm:text-sm text-stone-600 mb-5">
            Your formal wholesale quotation has been recorded and transmitted to the buyer. You will be notified when the buyer reviews your quotation.
          </p>

          <div className="bg-[#FAF8F5] rounded-2xl p-4 border border-stone-200 text-left text-xs space-y-2 mb-6">
            <div className="flex justify-between border-b border-stone-200 pb-2">
              <span className="text-stone-500">Requirement:</span>
              <span className="font-semibold text-charcoal-900 truncate max-w-[200px]">
                {productTitle || 'Wholesale Requirement'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Quantity:</span>
              <span className="font-semibold text-charcoal-900">{quantity} units</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Unit Price:</span>
              <span className="font-semibold text-charcoal-900">₹{Number(unitPrice).toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-stone-200 pt-2 text-forest-900 font-bold">
              <span>Total Quotation:</span>
              <span>₹{totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-stone-500 text-[11px]">
              <span>Lead Time:</span>
              <span>{leadTimeDays} days dispatch</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-forest-800 text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-forest-900 transition-colors shadow-xs"
          >
            Done & View Status
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-stone-200 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-stone-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-forest-50 text-forest-800 flex items-center justify-center">
              <FileText className="w-5 h-5 text-forest-700" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-charcoal-900">
                Submit Formal Wholesale Quotation
              </h3>
              <p className="text-xs text-stone-500">
                {productTitle ? `For: ${productTitle}` : 'Direct Artisan Offer'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 p-1.5 rounded-lg hover:bg-stone-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isBuyerRole && (
          <div className="mt-4 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-amber-800">
              <Clock className="w-3.5 h-3.5" /> Artisan Seller Action Required
            </div>
            <p>
              You are logged in with a <strong>Buyer</strong> account ({currentUser?.email}). In this marketplace, formal wholesale quotations are submitted by <strong>Artisan Sellers</strong> to buyers.
            </p>
            <p className="text-amber-800 font-medium">
              To submit wholesale quotations, please log in with an Artisan Seller account. If you want custom craft goods as a buyer, create a Bulk Requirement from your Buyer Dashboard.
            </p>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-rose-50 text-rose-800 text-xs rounded-xl border border-rose-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                Quantity (Units) *
              </label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                Unit Price (₹) *
              </label>
              <input
                type="number"
                min="1"
                step="0.5"
                required
                value={unitPrice}
                onChange={(e) => setUnitPrice(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="p-3 bg-forest-50 rounded-xl border border-forest-100 flex items-center justify-between text-xs">
            <span className="font-semibold text-forest-900">Total Quotation Value:</span>
            <span className="text-base font-bold text-forest-950 font-mono">
              ₹{totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-charcoal-700 mb-1">
              Production & Dispatch Lead Time (Days) *
            </label>
            <input
              type="number"
              min="1"
              required
              value={leadTimeDays}
              onChange={(e) => setLeadTimeDays(Math.max(1, Number(e.target.value)))}
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-charcoal-700 mb-1">
              Delivery Terms
            </label>
            <input
              type="text"
              value={deliveryTerms}
              onChange={(e) => setDeliveryTerms(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-charcoal-700 mb-1">
              Artisan Notes / Customization Details
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Free sample piece sent prior to batch production; customized tags included."
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || isBuyerRole}
              className="px-6 py-2.5 rounded-xl bg-forest-800 hover:bg-forest-900 disabled:opacity-50 text-white text-xs font-semibold shadow-md flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              {loading ? 'Submitting...' : 'Send Quotation to Buyer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default QuotationModal;
