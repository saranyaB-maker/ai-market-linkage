import React from 'react';
import { AddProductModal } from './AddProductModal';

interface SmartCatalogModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onCatalogGenerated?: (data: any) => void;
  onSuccess?: (product?: any) => void;
}

export const SmartCatalogModal: React.FC<SmartCatalogModalProps> = ({
  isOpen = true,
  onClose,
  onCatalogGenerated,
  onSuccess,
}) => {
  if (!isOpen) return null;

  return (
    <AddProductModal
      isOpen={isOpen}
      onClose={onClose}
      onSuccess={(prod) => {
        if (onSuccess) onSuccess(prod);
        if (onCatalogGenerated && prod) {
          onCatalogGenerated({
            title: prod.title,
            category: prod.category,
            materials: prod.materials,
            description: prod.description,
            production_method: prod.production_method,
            price_per_unit: prod.price_per_unit,
            image_url: prod.images?.[0],
            primary_image_hash: prod.primary_image_hash,
          });
        }
      }}
    />
  );
};

export default SmartCatalogModal;
