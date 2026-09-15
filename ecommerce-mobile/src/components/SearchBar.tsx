import React from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SearchBarProps {
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value = '',
  onChangeText,
  placeholder = 'Search products by name...',
}) => {
  const handleClear = () => {
    if (onChangeText) {
      onChangeText('');
    }
  };

  return (
    <View className="px-4 my-3">
      <View className="relative flex-row items-center bg-white border border-gray-200 rounded-xl shadow-sm h-12 px-3">
        {/* Search Icon */}
        <Ionicons
          name="search-outline"
          size={20}
          color="#9ca3af"
          style={styles.searchIcon}
        />

        {/* Native Text Input */}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9ca3af"
          className="flex-1 text-sm text-gray-800 ml-2 h-full"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="never"
        />

        {/* Clear Input Action Button */}
        {Boolean(value) && (
          <Pressable
            onPress={handleClear}
            hitSlop={8}
            className="bg-gray-100 rounded-full w-6 h-6 items-center justify-center ml-2"
            style={({ pressed }) => pressed && styles.pressed}
            accessibilityLabel="Clear search input"
          >
            <Ionicons name="close-outline" size={16} color="#6b7280" />
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  searchIcon: {
    marginLeft: 2,
  },
  pressed: {
    opacity: 0.7,
  },
});

export default SearchBar;