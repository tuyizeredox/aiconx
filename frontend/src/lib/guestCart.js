import { cartAPI } from "@/api/apiClient";

const GUEST_CART_KEY = "guest_cart";

export function getGuestCart() {
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveGuestCart(items) {
  localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
  // Same-tab listeners (e.g. the header cart badge) can't rely on the native
  // 'storage' event, which only fires in *other* tabs — so notify explicitly.
  window.dispatchEvent(new Event("guestcart:updated"));
}

export function getGuestCartCount() {
  return getGuestCart().reduce((sum, item) => sum + (item.quantity || 1), 0);
}

function normalizeOptions(options) {
  return [...(options || [])]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((o) => `${o.name}:${o.value}`)
    .join("|");
}

function sameVariant(a, b) {
  return (
    (a.selected_color || "") === (b.selected_color || "") &&
    (a.selected_size || "") === (b.selected_size || "") &&
    (a.selected_image || "") === (b.selected_image || "") &&
    normalizeOptions(a.selected_options) === normalizeOptions(b.selected_options)
  );
}

// Returns { items, alreadyInCart } — alreadyInCart is true when this exact product +
// color/size/options/image combo was already in the cart, in which case the quantity
// is left untouched so the caller can point the buyer at the cart to change it there.
export function addToGuestCart(item) {
  const items = getGuestCart();
  const existing = items.find((i) => i.product_id === item.product_id && sameVariant(i, item));
  if (existing) {
    saveGuestCart(items);
    return { items, alreadyInCart: true };
  }
  items.push({ ...item, quantity: item.quantity || 1 });
  saveGuestCart(items);
  return { items, alreadyInCart: false };
}

export function updateGuestCartQty(productId, quantity) {
  const items = getGuestCart()
    .map((i) => (i.product_id === productId ? { ...i, quantity } : i))
    .filter((i) => i.quantity > 0);
  saveGuestCart(items);
  return items;
}

export function removeFromGuestCart(productId) {
  const items = getGuestCart().filter((i) => i.product_id !== productId);
  saveGuestCart(items);
  return items;
}

export function clearGuestCart() {
  localStorage.removeItem(GUEST_CART_KEY);
  window.dispatchEvent(new Event("guestcart:updated"));
}

// Best-effort merge — skips items that fail (e.g. product no longer available)
// rather than blocking the login/register flow that triggered it.
export async function mergeGuestCartToServer() {
  const items = getGuestCart();
  if (items.length === 0) return;
  for (const item of items) {
    try {
      await cartAPI.add({
        product_id: item.product_id,
        quantity: item.quantity,
        selected_color: item.selected_color,
        selected_size: item.selected_size,
        selected_options: item.selected_options,
        selected_image: item.selected_image,
      });
    } catch (err) {
      console.error("Failed to merge guest cart item", item.product_id, err);
    }
  }
  clearGuestCart();
}
