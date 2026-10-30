import { Category, Product } from '../types';

/**
 * Checks whether a product matches a given category slug, ID, or filter.
 * Ensures foolproof matching whether products have category_id (UUID) or category_slug.
 */
export function isProductMatchingCategory(
  product: Product,
  categoryFilter: string | null | undefined,
  categories: Category[] = []
): boolean {
  if (!categoryFilter || categoryFilter === 'all') {
    return true;
  }

  const cleanFilter = categoryFilter.trim().toLowerCase();

  // 1. Direct match on product.category_id or product.category_slug
  if (product.category_id && product.category_id === categoryFilter) return true;
  if (product.category_slug && product.category_slug === categoryFilter) return true;
  if (product.category_slug && product.category_slug.toLowerCase() === cleanFilter) return true;

  // 2. Lookup the category that corresponds to categoryFilter (by id, slug, or name)
  const targetCategory = categories.find(
    (c) =>
      c.id === categoryFilter ||
      c.slug === categoryFilter ||
      c.slug.toLowerCase() === cleanFilter ||
      c.name.toLowerCase() === cleanFilter ||
      (c.name_bn && c.name_bn.toLowerCase() === cleanFilter)
  );

  if (targetCategory) {
    if (product.category_id && product.category_id === targetCategory.id) return true;
    if (
      product.category_slug &&
      product.category_slug.toLowerCase() === targetCategory.slug.toLowerCase()
    ) {
      return true;
    }
  }

  // 3. Lookup the product's category from categories list by product.category_id
  if (product.category_id) {
    const prodCategory = categories.find((c) => c.id === product.category_id);
    if (prodCategory) {
      if (
        prodCategory.id === categoryFilter ||
        prodCategory.slug === categoryFilter ||
        prodCategory.slug.toLowerCase() === cleanFilter ||
        prodCategory.name.toLowerCase() === cleanFilter ||
        (prodCategory.name_bn && prodCategory.name_bn.toLowerCase() === cleanFilter)
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Populates each product with its category_slug and normalized category_id from the categories list
 */
export function enrichProductsWithCategories(
  products: Product[],
  categories: Category[]
): Product[] {
  if (!products || products.length === 0) return [];
  if (!categories || categories.length === 0) return products;

  return products.map((p) => {
    const matched = categories.find(
      (c) =>
        c.id === p.category_id ||
        (p.category_slug && c.slug.toLowerCase() === p.category_slug.toLowerCase()) ||
        c.name.toLowerCase() === (p.category_slug || '').toLowerCase()
    );

    return {
      ...p,
      category_id: matched ? matched.id : p.category_id,
      category_slug: matched ? matched.slug : p.category_slug || '',
    };
  });
}
