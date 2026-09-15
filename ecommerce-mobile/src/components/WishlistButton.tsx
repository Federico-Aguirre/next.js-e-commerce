import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWishlistStore } from '@/store/useWishlistStore';

interface WishlistButtonProps {
  product: {
    id: string | number;
    title: string;
    price: number;
    image: string;
    category?: string;
  };
}

export const WishlistButton: React.FC<WishlistButtonProps> = ({ product }) => {
  const { toggleWishlist, isInWishlist } = useWishlistStore();

  const productIdStr = String(product.id);
  const isFavorite = isInWishlist(productIdStr);

  const handleToggle = () => {
    toggleWishlist({
      ...product,
      id: productIdStr,
    });
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handleToggle}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      className={`p-2.5 rounded-full items-center justify-center shadow-sm ${
        isFavorite
          ? 'bg-rose-50 border border-rose-100'
          : 'bg-white border border-gray-100'
      }`}
      accessibilityLabel={isFavorite ? 'Remove from wishlist' : 'Add to wishlist'}
    >
      <Ionicons
        name={isFavorite ? 'heart' : 'heart-outline'}
        size={20}
        color={isFavorite ? '#f43f5e' : '#9ca3af'}
      />
    </TouchableOpacity>
  );
};

export default WishlistButton;