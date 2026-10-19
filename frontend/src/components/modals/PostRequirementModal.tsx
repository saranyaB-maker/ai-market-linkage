import React, { useState } from 'react';
import { PackageSearch, X, Check, MapPin, Calendar, Layers } from 'lucide-react';
import api from '../../services/api';

interface PostRequirementModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onRequirementCreated?: (reqId: string) => void;
}

export const PostRequirementModal: React.FC<PostRequirementModalProps> = ({
  isOpen = true,
  onClose,
  onRequirementCreated,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Handloom & Textiles');
  const [unit, setUnit] = useState('piece');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState(200);
  const [targetUnitPrice, setTargetUnitPrice] = useState<number | ''>(150);
  const [maxBudget, setMaxBudget] = useState<number | ''>(30000);
  const [destinationCity, setDestinationCity] = useState('Chennai');
  const [destinationState, setDestinationState] = useState('Tamil Nadu');
  const [leadTimeDays, setLeadTimeDays] = useState(25);
  const [qualitySpecs, setQualitySpecs] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !category || quantity <= 0) {
      setError('Title, category, and a positive quantity are required.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = {
        title,
        category,
        unit,
        description,
        quantity: Number(quantity),
        target_unit_price: targetUnitPrice ? Number(targetUnitPrice) : undefined,
        max_budget: maxBudget ? Number(maxBudget) : undefined,
        destination_city: destinationCity,
        destination_state: destinationState,
        max_lead_time_days: Number(leadTimeDays),
        quality_specifications: qualitySpecs,
      };
      const res = await api.createRequirement(data);
      if (onRequirementCreated) {
        onRequirementCreated(res.requirement_id);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to post requirement.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-stone-200 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-stone-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-terracotta-50 text-terracotta-800 flex items-center justify-center">
              <PackageSearch className="w-5 h-5 text-terracotta-700" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-charcoal-900">
                Post Bulk Purchase Requirement
              </h3>
              <p className="text-xs text-stone-500">
                Broadcast your wholesale need to verified rural artisan clusters.
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

        {error && (
          <div className="mt-4 p-3 bg-rose-50 text-rose-800 text-xs rounded-xl border border-rose-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-charcoal-700 mb-1">
              Requirement Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Bulk Procurement of 500 Handloom Cotton Gift Shawls"
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                Craft Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none bg-white"
              >
                <option value="Handloom & Textiles">Handloom & Textiles</option>
                <option value="Pottery & Terracotta">Pottery & Terracotta</option>
                <option value="Jute & Natural Fiber Crafts">Jute & Natural Fiber Crafts</option>
                <option value="Woodwork & Carving">Woodwork & Carving</option>
                <option value="Metal & Bell Metal Crafts">Metal & Bell Metal Crafts</option>
                <option value="Bamboo & Cane Crafts">Bamboo & Cane Crafts</option>
                <option value="Stone & Marble Carving">Stone & Marble Carving</option>
                <option value="Handmade Paper & Leather">Handmade Paper & Leather</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                  Quantity *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={quantity}
                  onChange={(e) => {
                    const q = Number(e.target.value);
                    setQuantity(q);
                    if (targetUnitPrice) {
                      setMaxBudget(q * Number(targetUnitPrice));
                    }
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                  Unit *
                </label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none bg-white"
                >
                  <option value="piece">Piece</option>
                  <option value="set">Set</option>
                  <option value="meter">Meter</option>
                  <option value="kg">Kg</option>
                  <option value="pair">Pair</option>
                  <option value="dozen">Dozen</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                Target Unit Price (₹ / {unit})
              </label>
              <input
                type="number"
                min="0"
                value={targetUnitPrice}
                onChange={(e) => {
                  const p = e.target.value ? Number(e.target.value) : '';
                  setTargetUnitPrice(p);
                  if (typeof p === 'number' && quantity) {
                    setMaxBudget(p * quantity);
                  }
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                Max Total Budget (₹)
              </label>
              <input
                type="number"
                min="0"
                value={maxBudget}
                onChange={(e) => setMaxBudget(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                Delivery Destination City
              </label>
              <input
                type="text"
                value={destinationCity}
                onChange={(e) => setDestinationCity(e.target.value)}
                placeholder="e.g. Chennai, Bangalore, Mumbai"
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                Max Allowed Lead Time (Days)
              </label>
              <input
                type="number"
                min="1"
                value={leadTimeDays}
                onChange={(e) => setLeadTimeDays(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-charcoal-700 mb-1">
              Quality Specifications & Material Requirements
            </label>
            <textarea
              rows={2}
              value={qualitySpecs}
              onChange={(e) => setQualitySpecs(e.target.value)}
              placeholder="e.g. AZO-free dye, double edge hems, custom logo tag packaging required..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-forest-800 hover:bg-forest-900 text-white text-xs font-semibold shadow-md flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              {loading ? 'Posting Requirement...' : 'Post & Match Verified Suppliers'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
