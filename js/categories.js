export const CATEGORIES = [
  { id: 'tops', label: 'Tops' },
  { id: 'bottoms', label: 'Bottoms' },
  { id: 'dresses', label: 'Dresses' },
  { id: 'outerwear', label: 'Outerwear' },
  { id: 'shoes', label: 'Shoes' },
  { id: 'accessories', label: 'Accessories' },
];

/** Starting stack order on the outfit canvas. Higher sits on top. */
export const DEFAULT_Z_INDEX = { shoes: 0, bottoms: 1, tops: 2, dresses: 2, outerwear: 3, accessories: 4 };

export function categoryLabel(id) {
  return CATEGORIES.find((c) => c.id === id)?.label ?? 'Item';
}

export function displayName(item) {
  return item.name || categoryLabel(item.category);
}
