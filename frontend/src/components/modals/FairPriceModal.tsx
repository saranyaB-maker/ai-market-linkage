import React, { useState } from 'react';
import { Calculator, X, AlertTriangle, TrendingUp, DollarSign, CheckCircle2 } from 'lucide-react';
import api from '../../services/api';

interface FairPriceModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onApplyPrice?: (suggestedPrice: number) => void;
  initialUnits?: number;
}

export const FairPriceModal: React.FC<FairPriceModalProps> = ({
  isOpen = true,
  onClose,
  onApplyPrice,
  initialUnits = 50,
}) => {
  const [rawMaterials, setRawMaterials] = useState(2500);
  const [laborCost, setLaborCost] = useState(2000);
  const [packagingCost, setPackagingCost] = useState(300);
  const [overheadCost, setOverheadCost] = useState(500);
  const [transportCost, setTransportCost] = useState(400);
  const [otherCosts, setOtherCosts] = useState(0);
  const [units, setUnits] = useState(initialUnits);
  const [marginPct, setMarginPct] = useState(25); // 25%

  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleCalculate = async () => {
    setLoading(true);
    setError('');
    try {
      const data = {
        raw_materials_cost: Number(rawMaterials),
        labor_cost: Number(laborCost),
        packaging_cost: Number(packagingCost),
        overhead_cost: Number(overheadCost),
        transport_cost: Number(transportCost),
        other_costs: Number(otherCosts),
        saleable_units: Number(units),
        target_gross_margin: Number(marginPct) / 100,
      };
      const res = await api.calculateFairPrice(data);
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Calculation error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-stone-200 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-forest-50 text-forest-800 flex items-center justify-center">
              <Calculator className="w-5 h-5 text-forest-700" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-charcoal-900">
                Artisan Fair-Price Recommendation Engine
              </h3>
              <p className="text-xs text-stone-500">
                Formula-based sustainable pricing protecting genuine artisan wages.
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

        {/* Input Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          <div>
            <label className="block text-xs font-semibold text-charcoal-700 mb-1">
              Raw Materials Cost (₹)
            </label>
            <input
              type="number"
              min="0"
              value={rawMaterials}
              onChange={(e) => setRawMaterials(Math.max(0, Number(e.target.value)))}
              className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-charcoal-700 mb-1">
              Artisan Labor Wages (₹)
            </label>
            <input
              type="number"
              min="0"
              value={laborCost}
              onChange={(e) => setLaborCost(Math.max(0, Number(e.target.value)))}
              className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-charcoal-700 mb-1">
              Packaging & Labeling (₹)
            </label>
            <input
              type="number"
              min="0"
              value={packagingCost}
              onChange={(e) => setPackagingCost(Math.max(0, Number(e.target.value)))}
              className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-charcoal-700 mb-1">
              Workshop Overhead & Tools (₹)
            </label>
            <input
              type="number"
              min="0"
              value={overheadCost}
              onChange={(e) => setOverheadCost(Math.max(0, Number(e.target.value)))}
              className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-charcoal-700 mb-1">
              Local Transport & Logistics (₹)
            </label>
            <input
              type="number"
              min="0"
              value={transportCost}
              onChange={(e) => setTransportCost(Math.max(0, Number(e.target.value)))}
              className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-charcoal-700 mb-1">
              Batch Saleable Units (Pieces)
            </label>
            <input
              type="number"
              min="1"
              value={units}
              onChange={(e) => setUnits(Math.max(1, Number(e.target.value)))}
              className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Target Gross Margin Slider */}
        <div className="mt-5 p-4 bg-[#FAF7F0] rounded-2xl border border-[#EAE3D2]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-charcoal-800">
              Desired Artisan Gross Margin: <strong className="text-forest-800 text-sm">{marginPct}%</strong>
            </span>
            <span className="text-[11px] text-stone-500">Sustainable craft range: 20% - 35%</span>
          </div>
          <input
            type="range"
            min="5"
            max="60"
            value={marginPct}
            onChange={(e) => setMarginPct(Number(e.target.value))}
            className="w-full accent-forest-700 cursor-pointer"
          />
        </div>

        {/* Calculate Button */}
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={handleCalculate}
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-forest-800 hover:bg-forest-900 text-white text-xs font-semibold shadow-md transition-all flex items-center gap-2"
          >
            <Calculator className="w-4 h-4" />
            {loading ? 'Calculating...' : 'Calculate Sustainable Price'}
          </button>
        </div>

        {/* Results Section */}
        {result && result.summary && (
          <div className="mt-6 pt-6 border-t border-stone-200 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200">
                <span className="text-[11px] text-stone-500 block">Unit Cost</span>
                <span className="text-base font-bold text-charcoal-800 font-mono">
                  ₹{result.summary.unit_cost}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                <span className="text-[11px] text-emerald-700 block">Suggested Price</span>
                <span className="text-base font-bold text-emerald-900 font-mono">
                  ₹{result.summary.suggested_unit_price}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200">
                <span className="text-[11px] text-amber-700 block">Estimated Profit</span>
                <span className="text-base font-bold text-amber-900 font-mono">
                  ₹{result.summary.estimated_gross_profit}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-purple-50 border border-purple-200">
                <span className="text-[11px] text-purple-700 block">Total Batch Value</span>
                <span className="text-base font-bold text-purple-900 font-mono">
                  ₹{result.summary.total_estimated_order_value}
                </span>
              </div>
            </div>

            {/* Volume tiers */}
            {result.volume_tiers && (
              <div className="bg-white p-4 rounded-2xl border border-stone-200">
                <h4 className="text-xs font-semibold text-charcoal-800 mb-2 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-forest-700" />
                  Recommended Wholesale Volume Tiers:
                </h4>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {result.volume_tiers.map((t: any, idx: number) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-stone-50 border border-stone-200">
                      <span className="font-semibold block text-charcoal-800">{t.tier_label}</span>
                      <span className="text-stone-500 block text-[10px]">{t.min_units}+ units ({t.discount_pct}% off)</span>
                      <span className="font-bold text-forest-900 font-mono mt-1 block">₹{t.unit_price}/unit</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {result.warnings && result.warnings.length > 0 && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <ul className="list-disc pl-4 space-y-1">
                  {result.warnings.map((w: string, i: number) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Apply Price Button */}
            {onApplyPrice && (
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onApplyPrice(result.summary.suggested_unit_price);
                    onClose();
                  }}
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Apply ₹{result.summary.suggested_unit_price} to Product Price
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
