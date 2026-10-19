import React, { useState } from 'react';
import { X, Save, AlertCircle, CheckCircle2, Image as ImageIcon, Upload, Package, ShieldAlert } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import api from '../../services/api';
import { ProductImage } from '../common/ProductImage';

interface EditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: any;
  onSuccess: (updatedProduct: any) => void;
}

const CRAFT_CATEGORIES = [
  'Household Goods, Water Jugs & Pitchers',
  'Pottery & Ceramics',
  'Pottery & Terracotta',
  'Handloom & Textiles',
  'Bags & Natural Fiber Crafts',
  'Jute & Natural Fiber Crafts',
  'Woodwork & Carving',
  'Metal & Bell Metal Crafts',
  'Jewellery & Beadwork',
  'Bamboo & Cane Crafts',
  'Stone & Marble Carving',
  'Handmade Paper & Leather',
  'Painting & Folk Art',
  'Other Traditional Crafts'
];

const COMMON_UNITS = [
  'piece',
  'set',
  'meter',
  'kg',
  'pair',
  'dozen',
  'box'
];

export const EditProductModal: React.FC<EditProductModalProps> = ({
  isOpen,
  onClose,
  product,
  onSuccess,
}) => {
  if (!isOpen || !product) return null;

  const { language, t } = useLanguage();

  const [title, setTitle] = useState<string>(product.canonical_title || product.title || '');
  const [category, setCategory] = useState<string>(product.canonical_category || product.category || CRAFT_CATEGORIES[0]);
  const [description, setDescription] = useState<string>(product.description || '');
  const [materials, setMaterials] = useState<string>(
    Array.isArray(product.materials) ? product.materials.join(', ') : (product.materials || '')
  );
  const [dimensions, setDimensions] = useState<string>(product.dimensions || '');
  const [productionMethod, setProductionMethod] = useState<string>(product.production_method || 'Handcrafted');
  const [pricePerUnit, setPricePerUnit] = useState<number | string>(product.price_per_unit || '');
  const [unit, setUnit] = useState<string>(product.unit || 'piece');
  const [stockQuantity, setStockQuantity] = useState<number | string>(
    product.stock_quantity !== undefined ? product.stock_quantity : ''
  );
  const [moq, setMoq] = useState<number | string>(product.moq !== undefined ? product.moq : 1);
  const [monthlyCapacity, setMonthlyCapacity] = useState<number | string>(
    product.monthly_capacity !== undefined ? product.monthly_capacity : 100
  );
  const [leadTimeDays, setLeadTimeDays] = useState<number | string>(
    product.lead_time_days !== undefined ? product.lead_time_days : 14
  );
  const [isPublished, setIsPublished] = useState<boolean>(product.is_published ?? true);

  // Images state
  const [images, setImages] = useState<string[]>(product.images || []);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Status & Error
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const numStock = Number(stockQuantity) || 0;
  const numMoq = Number(moq) || 1;
  const isMoqAboveStock = numStock > 0 && numMoq > numStock;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setUploadingImage(true);
    setErrorMsg('');
    try {
      const res = await api.uploadProductImage(file);
      if (res.image_url) {
        setImages([res.image_url, ...images]);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to upload new image.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setImages(images.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!title.trim()) {
      setErrorMsg(language === 'ta' ? 'தயாரிப்பு தலைப்பு தேவை.' : 'Product title is required.');
      return;
    }
    if (!category) {
      setErrorMsg(language === 'ta' ? 'தயாரிப்பு வகை தேவை.' : 'Craft category is required.');
      return;
    }
    if (!description.trim()) {
      setErrorMsg(language === 'ta' ? 'தயாரிப்பு விவரம் தேவை.' : 'Description is required.');
      return;
    }

    const priceNum = parseFloat(String(pricePerUnit));
    if (isNaN(priceNum) || priceNum <= 0) {
      setErrorMsg(language === 'ta' ? 'விலை 0-ஐ விட அதிகமாக இருக்க வேண்டும்.' : 'Price must be greater than zero.');
      return;
    }

    const stockNum = parseInt(String(stockQuantity), 10);
    if (isNaN(stockNum) || stockNum < 0) {
      setErrorMsg(language === 'ta' ? 'கையிருப்பு அளவு எதிர்மறையாக இருக்க முடியாது.' : 'Stock quantity cannot be negative.');
      return;
    }

    const moqNum = parseInt(String(moq), 10);
    if (isNaN(moqNum) || moqNum < 1) {
      setErrorMsg(language === 'ta' ? 'குறைந்தபட்ச அளவு குறைந்தது 1 ஆக இருக்க வேண்டும்.' : 'Minimum order quantity must be at least 1.');
      return;
    }

    const capacityNum = parseInt(String(monthlyCapacity), 10);
    const leadTimeNum = parseInt(String(leadTimeDays), 10);

    const payload = {
      title: title.trim(),
      category: category.trim(),
      description: description.trim(),
      materials: materials.trim(),
      dimensions: dimensions.trim(),
      production_method: productionMethod.trim(),
      price_per_unit: priceNum,
      unit: unit.trim(),
      stock_quantity: stockNum,
      moq: moqNum,
      monthly_capacity: capacityNum > 0 ? capacityNum : 100,
      lead_time_days: leadTimeNum > 0 ? leadTimeNum : 14,
      images: images.length > 0 ? images : product.images,
      is_published: isPublished
    };

    setSaving(true);
    try {
      const res = await api.updateProduct(product.id, payload);
      setSuccessMsg(language === 'ta' ? 'தயாரிப்பு வெற்றிகரமாக புதுப்பிக்கப்பட்டது!' : 'Product listing updated successfully!');
      setTimeout(() => {
        onSuccess(res.product || { ...product, ...payload });
        onClose();
      }, 800);
    } catch (err: any) {
      setErrorMsg(err.message || (language === 'ta' ? 'புதுப்பிப்பதில் தோல்வி.' : 'Failed to update product.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-stone-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 bg-[#FCFAF6] border-b border-stone-200 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-forest-800">
              {language === 'ta' ? 'கைவினைஞர் விற்பனையாளர் கட்டுப்பாடு' : 'Artisan Seller Control'}
            </span>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-charcoal-900 mt-0.5">
              {language === 'ta' ? 'தயாரிப்பு விவரங்களைத் திருத்து' : 'Edit Product Listing'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          
          {errorMsg && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Stock vs MOQ Notice / Warning */}
          {isMoqAboveStock && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold">
                  {language === 'ta' ? 'கையிருப்பு மற்றும் குறைந்தபட்ச அளவு எச்சரிக்கை' : 'Stock vs Minimum Order Quantity Notice'}
                </strong>
                <p className="mt-0.5 text-amber-800">
                  {language === 'ta'
                    ? `குறைந்தபட்ச ஆர்டர் அளவு (${numMoq}) தற்போதுள்ள மொத்த கையிருப்பை (${numStock}) விட அதிகமாக உள்ளது. உடனடி நேரடி வாங்குதல் முடக்கப்படும்; வாங்குவோர் எதிர்கால உற்பத்திக்கு மட்டுமே மொத்த விலைக் கோரிக்கையை சமர்ப்பிக்க முடியும்.`
                    : `Minimum order quantity (${numMoq}) exceeds available stock (${numStock}). Immediate retail direct purchase will be disabled until stock is restocked. Wholesale production quotation inquiries will remain open.`}
                </p>
              </div>
            </div>
          )}

          {/* Product Title */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-charcoal-800 mb-1.5">
              {language === 'ta' ? 'தயாரிப்பு பெயர் *' : 'Product Title *'}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-hidden focus:border-forest-700 bg-white"
            />
          </div>

          {/* Category & Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-charcoal-800 mb-1.5">
                {language === 'ta' ? 'கைவினை வகை *' : 'Craft Category *'}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-hidden focus:border-forest-700 bg-white"
              >
                {CRAFT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-charcoal-800 mb-1.5">
                {language === 'ta' ? 'அலகு *' : 'Unit *'}
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-hidden focus:border-forest-700 bg-white"
              >
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Price, Stock & MOQ */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-[#FCFAF6] border border-[#EDE5D6]">
            <div>
              <label className="block text-xs font-bold text-forest-950 mb-1">
                {language === 'ta' ? 'ஒரு அலகு விலை (₹) *' : 'Price per Unit (₹) *'}
              </label>
              <input
                type="number"
                min="1"
                step="0.5"
                value={pricePerUnit}
                onChange={(e) => setPricePerUnit(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-stone-300 font-mono font-bold text-sm bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-forest-950 mb-1">
                {language === 'ta' ? 'தற்போதுள்ள கையிருப்பு *' : 'Available Stock *'}
              </label>
              <input
                type="number"
                min="0"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-stone-300 font-mono font-bold text-sm bg-white"
              />
              <span className="text-[10px] text-stone-500 mt-0.5 block">
                {numStock === 0 ? (language === 'ta' ? 'கையிருப்பில் இல்லை' : 'Out of stock') : `${numStock} ${unit}`}
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-forest-950 mb-1">
                {language === 'ta' ? 'குறைந்தபட்ச அளவு (MOQ) *' : 'Min Order Qty (MOQ) *'}
              </label>
              <input
                type="number"
                min="1"
                value={moq}
                onChange={(e) => setMoq(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-stone-300 font-mono font-bold text-sm bg-white"
              />
              <span className="text-[10px] text-stone-500 mt-0.5 block">
                {language === 'ta' ? 'குறைந்தபட்ச கொள்முதல்' : 'Minimum order'}
              </span>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-charcoal-800 mb-1.5">
              {language === 'ta' ? 'கைவினை தயாரிப்பு விவரம் *' : 'Artisan Description *'}
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-hidden focus:border-forest-700 bg-white"
            />
          </div>

          {/* Technical Specifications */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-charcoal-800 mb-1.5">
                {language === 'ta' ? 'மூலப்பொருட்கள்' : 'Materials Used'}
              </label>
              <input
                type="text"
                value={materials}
                onChange={(e) => setMaterials(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-sm bg-white"
                placeholder="e.g. Natural Terracotta Clay"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-charcoal-800 mb-1.5">
                {language === 'ta' ? 'உற்பத்தி முறை' : 'Production Technique'}
              </label>
              <input
                type="text"
                value={productionMethod}
                onChange={(e) => setProductionMethod(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-sm bg-white"
                placeholder="e.g. Traditional Potter's Wheel"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-charcoal-800 mb-1.5">
                {language === 'ta' ? 'அளவுகள் / பரிமாணங்கள்' : 'Dimensions'}
              </label>
              <input
                type="text"
                value={dimensions}
                onChange={(e) => setDimensions(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-sm bg-white"
                placeholder="e.g. 11 inches height, 5 Litres"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-charcoal-800 mb-1.5">
                {language === 'ta' ? 'உற்பத்தி கால அவகாசம் (நாட்கள்)' : 'Lead Time (Days)'}
              </label>
              <input
                type="number"
                min="1"
                value={leadTimeDays}
                onChange={(e) => setLeadTimeDays(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-sm bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-charcoal-800 mb-1.5">
                {language === 'ta' ? 'மாதாந்திர உற்பத்தி திறன்' : 'Monthly Production Capacity'}
              </label>
              <input
                type="number"
                min="1"
                value={monthlyCapacity}
                onChange={(e) => setMonthlyCapacity(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-sm bg-white"
              />
            </div>

            <div className="flex items-center gap-3 pt-6">
              <input
                type="checkbox"
                id="is_published_chk"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="w-4 h-4 rounded text-forest-800 border-stone-300 focus:ring-forest-700"
              />
              <label htmlFor="is_published_chk" className="text-xs font-bold text-charcoal-800 cursor-pointer">
                {language === 'ta' ? 'சந்தையில் நேரடியாக வெளியிடவும் (செயலில்)' : 'Publish to Marketplace (Active Listing)'}
              </label>
            </div>
          </div>

          {/* Product Images */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-charcoal-800 mb-1.5">
              {language === 'ta' ? 'தயாரிப்பு புகைப்படங்கள்' : 'Product Images'}
            </label>
            <div className="flex items-center gap-3 overflow-x-auto pb-2">
              {images.map((img, idx) => (
                <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-stone-300 shrink-0 group">
                  <ProductImage src={img} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(idx)}
                    className="absolute top-1 right-1 p-1 bg-black/70 hover:bg-rose-600 text-white rounded-md text-[10px] transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              <label className="w-20 h-20 rounded-xl border-2 border-dashed border-stone-300 hover:border-forest-700 flex flex-col items-center justify-center cursor-pointer transition-colors shrink-0 bg-stone-50">
                <Upload className="w-5 h-5 text-stone-400 mb-1" />
                <span className="text-[10px] text-stone-500 font-medium">
                  {uploadingImage ? '...' : (language === 'ta' ? 'சேர்' : 'Add')}
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                />
              </label>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-stone-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-stone-300 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors"
            >
              {language === 'ta' ? 'ரத்துசெய்' : 'Cancel'}
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-forest-800 hover:bg-forest-900 disabled:bg-stone-300 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving
                ? (language === 'ta' ? 'சேமிக்கிறது...' : 'Saving Changes...')
                : (language === 'ta' ? 'மாற்றங்களைச் சேமி' : 'Save Changes')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
