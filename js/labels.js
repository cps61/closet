// Clothing types the app can recognize.
//
// `group` ties a type to the region the clothing segmenter finds on a person,
// so a shirt-shaped region is only ever compared against tops and outerwear.
// `phrase` is what the fashion model's text side was asked to describe; the
// resulting embeddings live in models/label-embeddings.json. After editing this
// list, regenerate that file with tools/embed-labels.html (see README).

export const LABELS = [
  // Upper body
  { id: 't-shirt', name: 'T-shirt', phrase: 'a t-shirt', category: 'tops', group: 'upper' },
  { id: 'shirt', name: 'Shirt', phrase: 'a button-up shirt', category: 'tops', group: 'upper' },
  { id: 'polo', name: 'Polo', phrase: 'a polo shirt', category: 'tops', group: 'upper' },
  { id: 'tank-top', name: 'Tank top', phrase: 'a tank top', category: 'tops', group: 'upper' },
  { id: 'blouse', name: 'Blouse', phrase: 'a blouse', category: 'tops', group: 'upper' },
  { id: 'sweater', name: 'Sweater', phrase: 'a knit sweater', category: 'tops', group: 'upper' },
  { id: 'hoodie', name: 'Hoodie', phrase: 'a hoodie', category: 'tops', group: 'upper' },
  { id: 'sweatshirt', name: 'Sweatshirt', phrase: 'a crewneck sweatshirt', category: 'tops', group: 'upper' },
  { id: 'jacket', name: 'Jacket', phrase: 'a jacket', category: 'outerwear', group: 'upper' },
  { id: 'denim-jacket', name: 'Denim jacket', phrase: 'a denim jacket', category: 'outerwear', group: 'upper' },
  { id: 'leather-jacket', name: 'Leather jacket', phrase: 'a leather jacket', category: 'outerwear', group: 'upper' },
  { id: 'puffer-jacket', name: 'Puffer jacket', phrase: 'a puffer jacket', category: 'outerwear', group: 'upper' },
  { id: 'coat', name: 'Coat', phrase: 'a long coat', category: 'outerwear', group: 'upper' },
  { id: 'blazer', name: 'Blazer', phrase: 'a blazer', category: 'outerwear', group: 'upper' },
  { id: 'vest', name: 'Vest', phrase: 'a vest', category: 'outerwear', group: 'upper' },

  // Lower body
  { id: 'jeans', name: 'Jeans', phrase: 'jeans', category: 'bottoms', group: 'pants' },
  { id: 'pants', name: 'Pants', phrase: 'trousers', category: 'bottoms', group: 'pants' },
  { id: 'chinos', name: 'Chinos', phrase: 'chino pants', category: 'bottoms', group: 'pants' },
  { id: 'cargo-pants', name: 'Cargo pants', phrase: 'cargo pants', category: 'bottoms', group: 'pants' },
  { id: 'sweatpants', name: 'Sweatpants', phrase: 'sweatpants', category: 'bottoms', group: 'pants' },
  { id: 'leggings', name: 'Leggings', phrase: 'leggings', category: 'bottoms', group: 'pants' },
  { id: 'shorts', name: 'Shorts', phrase: 'shorts', category: 'bottoms', group: 'pants' },
  { id: 'skirt', name: 'Skirt', phrase: 'a skirt', category: 'bottoms', group: 'skirt' },

  // One-pieces
  { id: 'dress', name: 'Dress', phrase: 'a dress', category: 'dresses', group: 'dress' },
  { id: 'jumpsuit', name: 'Jumpsuit', phrase: 'a jumpsuit', category: 'dresses', group: 'dress' },

  // Shoes
  { id: 'sneakers', name: 'Sneakers', phrase: 'sneakers', category: 'shoes', group: 'shoes' },
  { id: 'boots', name: 'Boots', phrase: 'boots', category: 'shoes', group: 'shoes' },
  { id: 'dress-shoes', name: 'Dress shoes', phrase: 'leather dress shoes', category: 'shoes', group: 'shoes' },
  { id: 'loafers', name: 'Loafers', phrase: 'loafers', category: 'shoes', group: 'shoes' },
  { id: 'sandals', name: 'Sandals', phrase: 'sandals', category: 'shoes', group: 'shoes' },
  { id: 'heels', name: 'Heels', phrase: 'high heels', category: 'shoes', group: 'shoes' },
  { id: 'slides', name: 'Slides', phrase: 'slide sandals', category: 'shoes', group: 'shoes' },

  // Accessories
  { id: 'cap', name: 'Cap', phrase: 'a baseball cap', category: 'accessories', group: 'hat' },
  { id: 'beanie', name: 'Beanie', phrase: 'a beanie', category: 'accessories', group: 'hat' },
  { id: 'hat', name: 'Hat', phrase: 'a hat', category: 'accessories', group: 'hat' },
  { id: 'backpack', name: 'Backpack', phrase: 'a backpack', category: 'accessories', group: 'bag' },
  { id: 'handbag', name: 'Handbag', phrase: 'a handbag', category: 'accessories', group: 'bag' },
  { id: 'tote-bag', name: 'Tote bag', phrase: 'a tote bag', category: 'accessories', group: 'bag' },
  { id: 'crossbody-bag', name: 'Crossbody bag', phrase: 'a crossbody bag', category: 'accessories', group: 'bag' },
  { id: 'scarf', name: 'Scarf', phrase: 'a scarf', category: 'accessories', group: 'scarf' },
  { id: 'belt', name: 'Belt', phrase: 'a belt', category: 'accessories', group: 'belt' },
  { id: 'sunglasses', name: 'Sunglasses', phrase: 'sunglasses', category: 'accessories', group: 'sunglasses' },
  { id: 'watch', name: 'Watch', phrase: 'a wristwatch', category: 'accessories', group: 'watch' },
];

/** Prompt templates averaged per label (simple prompt ensembling). */
export const PROMPT_TEMPLATES = ['{}', 'a photo of {}', 'a product photo of {}, fashion item'];

export function labelById(id) {
  return LABELS.find((label) => label.id === id);
}
