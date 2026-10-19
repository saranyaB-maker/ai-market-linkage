import React, { useState } from 'react';
import { Package } from 'lucide-react';

/**
 * Resolves any product image string, array, relative or absolute URL into a safe, valid browser URL.
 */
export function getProductImageUrl(img?: any): string {
  if (!img) return '';
  let str = '';
  if (Array.isArray(img)) {
    str = img[0] || '';
  } else if (typeof img === 'string') {
    str = img;
  }
  if (!str) return '';
  
  str = str.trim();
  if (str.startsWith('data:') || str.startsWith('blob:') || str.startsWith('http://') || str.startsWith('https://')) {
    return str;
  }
  // Strip accidental double prefixes like /api/uploads//api/products/images/...
  if (str.includes('/api/products/images/')) {
    const idx = str.indexOf('/api/products/images/');
    return str.substring(idx);
  }
  if (str.startsWith('/api/')) return str;
  if (str.startsWith('/')) return `/api${str}`;
  return `/api/products/images/${str}`;
}

interface ProductImageProps {
  src?: any;
  alt?: string;
  className?: string;
  fallbackIcon?: React.ReactNode;
}

export const ProductImage: React.FC<ProductImageProps> = ({
  src,
  alt = 'Artisan Product',
  className = 'w-full h-full object-cover',
  fallbackIcon,
}) => {
  const [hasError, setHasError] = useState(false);
  const imageUrl = getProductImageUrl(src);

  if (!imageUrl || hasError) {
    return (
      <div className={`flex flex-col items-center justify-center bg-stone-100 text-stone-400 p-3 select-none ${className}`}>
        {fallbackIcon || <Package className="w-8 h-8 text-stone-300 stroke-[1.5]" />}
        <span className="text-[10px] text-stone-400 mt-1 font-medium tracking-wide uppercase">Handmade Craft</span>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      className={className}
      onError={() => setHasError(true)}
      loading="lazy"
    />
  );
};
