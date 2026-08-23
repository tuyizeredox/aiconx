import { User } from '../models/User';
import { WishlistItem } from '../models/WishlistItem';
import { Like } from '../models/Like';
import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { Post } from '../models/Post';
import { Announcement } from '../models/Announcement';
import { Store } from '../models/Store';

/**
 * Escape regex special characters so raw user input can be safely used in a RegExp
 */
function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Service to fetch and format user context for the AI prompt
 */
export async function getUserContext(userId: string) {
  const user = await User.findById(userId).lean();
  if (!user) {
    return null;
  }

  const username = user.username.toLowerCase();

  // Fetch last 5 WishlistItems
  const wishlistItems = await WishlistItem.find({ user_username: username })
    .sort({ created_at: -1 })
    .limit(5)
    .lean();

  // Fetch more context for wishlist items (categories)
  const wishlistContext = await Promise.all(wishlistItems.map(async (item) => {
    const product = await Product.findById(item.product_id).select('category').lean();
    return {
      title: item.product_title,
      price: item.product_price,
      category: product?.category || 'other'
    };
  }));

  // Fetch last 5 Likes (posts or products)
  const likes = await Like.find({ 
    user_username: username,
    target_type: { $in: ['post', 'product'] }
  })
    .sort({ created_at: -1 })
    .limit(5)
    .lean();

  // Fetch details for likes to provide better context
  const likesContext = await Promise.all(likes.map(async (like) => {
    if (like.target_type === 'product') {
      const product = await Product.findById(like.target_id).select('title category').lean();
      return product ? `Liked Product: ${product.title} (${product.category})` : null;
    } else if (like.target_type === 'post') {
      const post = await Post.findById(like.target_id).select('content tagged_products').lean();
      if (!post) return null;
      
      let context = `Liked Post: ${post.content.substring(0, 50)}...`;
      if (post.tagged_products?.length > 0) {
        const products = await Product.find({ _id: { $in: post.tagged_products } }).select('category').lean();
        const categories = [...new Set(products.map(p => p.category))];
        if (categories.length > 0) {
          context += ` (Categories: ${categories.join(', ')})`;
        }
      }
      return context;
    }
    return null;
  }));

  // Fetch last 3 Orders
  const orders = await Order.find({ buyer_username: username })
    .sort({ created_at: -1 })
    .limit(3)
    .lean();

  return {
    user: {
      display_name: user.display_name || user.username,
      username: user.username,
      role: user.role,
      verified: user.is_verified
    },
    wishlist: wishlistContext,
    likes: likesContext.filter(Boolean),
    orders: orders.map(order => ({
      id: order._id.toString(),
      status: order.status,
      total: order.total,
      itemCount: order.items.length,
      items: order.items.map(i => i.product_title).join(', ')
    }))
  };
}

/**
 * Fetch platform-wide context like announcements and policies
 */
export async function getPlatformContext() {
  const activeAnnouncements = await Announcement.find({ 
    is_active: true,
    $or: [
      { expires_at: { $exists: false } },
      { expires_at: { $gt: new Date() } }
    ]
  })
    .sort({ created_at: -1 })
    .limit(3)
    .lean();

  const faqs = [
    { q: "How do I track my order?", a: "Go to your Orders page and click on 'Track Order' for any active shipment." },
    { q: "What is the return policy?", a: "Most items can be returned within 14 days of delivery. Check individual store policies for specifics." },
    { q: "How do I become a vendor?", a: "Click 'Sell on Aicon X' in your profile menu to upgrade your account and start selling." },
    { q: "Are my payments secure?", a: "Yes, we use industry-standard encryption and escrow-based buyer protection." }
  ];

  return {
    announcements: activeAnnouncements.map(a => ({ title: a.title, content: a.content })),
    faqs
  };
}

/**
 * Fetch top 10 products for "Daily Picks"
 */
export async function getDiscoveryContext() {
  // Fetch top 10 products by sales_count or rating_avg
  const trendingProducts = await Product.find({ status: 'active' })
    .sort({ sales_count: -1, rating_avg: -1 })
    .limit(10)
    .lean();

  return trendingProducts.map(p => ({
    id: p._id.toString(),
    title: p.title,
    price: p.price,
    category: p.category,
    images: p.images,
    rating: p.rating_avg,
    sales: p.sales_count,
    store: p.store_name,
    vendor: p.vendor_username
  }));
}

// Greetings/small talk that should never be treated as a product search, even
// though as bare substrings they coincidentally appear inside common words
// (e.g. "hi" inside "Hiking", "Shirt", "Highlighter").
const CHITCHAT_MESSAGES = new Set([
  'hi', 'hii', 'hiii', 'hello', 'hey', 'yo', 'sup', 'ok', 'okay', 'yes', 'no',
  'thanks', 'thank you', 'thx', 'bye', 'good morning', 'good afternoon',
  'good evening', 'good night', 'how are you', "what's up",
]);

/**
 * Query the database for relevant products based on a search query
 */
export async function searchProducts(query: string) {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 3 || CHITCHAT_MESSAGES.has(trimmed.toLowerCase())) return [];

  // Whole-word match so short/common queries (e.g. "hi") don't spuriously
  // match unrelated products purely because the letters appear mid-word.
  const searchRegex = new RegExp(`\\b${escapeRegex(trimmed)}\\b`, 'i');
  const products = await Product.find({
    status: 'active',
    $or: [
      { title: searchRegex },
      { description: searchRegex },
      { category: searchRegex },
      { tags: searchRegex }
    ]
  })
    .sort({ plan_priority: -1, sales_count: -1 })
    .limit(10)
    .lean();

  return products.map(p => ({
    id: p._id.toString(),
    title: p.title,
    price: p.price,
    category: p.category,
    description: p.description?.substring(0, 100),
    images: p.images,
    store: p.store_name,
    vendor: p.vendor_username
  }));
}

/**
 * Query the database for relevant stores based on a search query
 */
export async function searchStores(query: string) {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 3 || CHITCHAT_MESSAGES.has(trimmed.toLowerCase())) return [];

  const searchRegex = new RegExp(`\\b${escapeRegex(trimmed)}\\b`, 'i');
  const stores = await Store.find({
    status: 'active',
    $or: [
      { name: searchRegex },
      { description: searchRegex },
      { category: searchRegex }
    ]
  })
    .sort({ rating_avg: -1, follower_count: -1 })
    .limit(5)
    .lean();

  return stores.map(s => ({
    id: s._id.toString(),
    name: s.name,
    category: s.category,
    description: s.description?.substring(0, 100),
    rating: s.rating_avg,
    followers: s.follower_count,
    verified: s.is_verified,
    owner: s.owner_username
  }));
}

/**
 * Construct the master system prompt for the AI
 */
export function formatSystemPrompt(
  userContext: any,
  discoveryContext: any[],
  searchContext: any[] = [],
  platformContext: any = null,
  storeContext: any[] = [],
  language?: string
) {
  const userName = userContext?.user?.display_name || 'there';

  let prompt = `You are Aicon AI, ${userName}'s personal shopping concierge and order assistant.
Your goal is to provide a premium, helpful, and personalized shopping experience.

`;

  if (language && language !== 'en') {
    prompt += `LANGUAGE: Reply in the language with code "${language}", regardless of what language the rest of this prompt is written in.\n\n`;
  }

  if (userContext) {
    prompt += `USER CONTEXT:
- Name: ${userName}
- Role: ${userContext.user?.role || 'user'}
- Status: ${userContext.user?.verified ? 'Verified' : 'Unverified'}
`;
    if (userContext.wishlist?.length > 0) {
      prompt += `- Recently Wishlisted: ${userContext.wishlist.map((i: any) => `${i.title} ($${i.price})`).join(', ')}\n`;
    }
    if (userContext.likes?.length > 0) {
      prompt += `- Recent Interests: ${userContext.likes.join('; ')}\n`;
    }
    if (userContext.orders?.length > 0) {
      prompt += `- Recent Orders:\n${userContext.orders.map((o: any) => `  * Order #${o.id}: Status: ${o.status}, Total: $${o.total}, Items: ${o.items}`).join('\n')}\n`;
    }
    prompt += '\n';
  }

  if (platformContext) {
    if (platformContext.announcements?.length > 0) {
      prompt += `PLATFORM ANNOUNCEMENTS:
${platformContext.announcements.map((a: any) => `- ${a.title}: ${a.content}`).join('\n')}

`;
    }
    prompt += `PLATFORM HELP & POLICIES (FAQs):
${platformContext.faqs.map((f: any) => `Q: ${f.q}\nA: ${f.a}`).join('\n')}

`;
  }

  if (storeContext?.length > 0) {
    prompt += `RELEVANT STORES:
${storeContext.map((s: any) => `- ${s.name} (${s.category}) - ${s.rating} stars, ${s.followers} followers. [Owner: ${s.owner}]`).join('\n')}

`;
  }

  const productsToShow = searchContext.length > 0 ? searchContext : discoveryContext;
  if (productsToShow?.length > 0) {
    prompt += `AVAILABLE PRODUCTS TO RECOMMEND:
${productsToShow.map((p: any) => `- [ID: ${p.id}] ${p.title} - $${p.price} (${p.category}) [Sold by: ${p.store || p.vendor}]`).join('\n')}

`;
  }

  prompt += `CAPABILITIES & GUIDELINES:
1. PERSONALIZATION: Use the user's context to make relevant recommendations. If they liked denim, suggest matching items.
2. ORDER CONCIERGE: If asked about an order, look ONLY at the "Recent Orders" list under USER CONTEXT above.
   - If it contains a matching order, state its real status/total/items from that list and trigger an ORDER_CARD action with its real ID.
   - If USER CONTEXT has no "Recent Orders" line, or none match what was asked, say plainly that you don't see any orders (e.g. "I don't see any recent orders on your account.") and suggest checking the Orders page. NEVER invent an order number, date, status, or ETA that isn't in the context — fabricating order details is strictly forbidden even to sound helpful.
3. ACTIONS: You can trigger specialized UI components using this format at the end of your message: [ACTION: TYPE, id: VALUE]
   - For orders: [ACTION: ORDER_CARD, id: ORDER_ID]
   - For products: if your reply names one or more specific products from AVAILABLE PRODUCTS TO RECOMMEND, end the message with [ACTION: PRODUCTS, id: ID1|ID2|ID3] listing exactly the IDs of the products you named, in the order you named them, using the real [ID: ...] values from that section. Omit this action entirely if your reply doesn't name any specific products (e.g. a greeting, a policy answer, or "I don't have that information") — never include it just because products were available in context.
4. DISCOVERY: If it's a new conversation or the user asks "what's new", show the available products.
5. SUPPORT: Use the PLATFORM HELP section to answer common questions about tracking, returns, and payments.
6. STORES: If a user asks for a specific store or category, use the RELEVANT STORES context to help them find vendors.
7. NO INTERNAL DATA: The bracketed [ID: ...] values and order/product identifiers in this context are for your internal matching only. NEVER print an ID, database key, or the literal "[ID:" / "[ACTION:" text in your visible reply — refer to products and orders only by their name, title, or order status.
8. TONE MATCHES INPUT: Match the length and energy of your reply to the user's message. A short greeting like "Hello" or "Hi" gets a short, warm, professional reply back (e.g. "Hello! What can I help you with today?") — do NOT dump product recommendations, daily picks, or a long introduction unless the user actually asked for something or this is the very first message of a brand new conversation.
9. NEVER FABRICATE: Only state facts (order numbers, dates, statuses, prices, product/store names, totals) that literally appear in the context sections above. If the information needed to answer isn't present in the context, say you don't have that information instead of guessing or inventing plausible-sounding details.

STYLE — BE SHORT AND ACCURATE, ALWAYS:
- Default to 2-4 sentences total. Never write multi-paragraph replies.
- When listing products, give ONLY name and price per item (e.g. "- Classic Black Jeans — $45"). No marketing copy, no adjective-stacked descriptions, no "perfect for..." filler. One short optional line can follow the list if it adds real value.
- List at most 3 products unless the user explicitly asks for more.
- Never repeat information already visible in the product context back to the user in longer form — point at it briefly instead.
- Use at most one emoji per message, and only if it fits naturally. Do not decorate every line with emojis.
- Do not restate the question, explain your reasoning, or add closing filler like "let me know if you need anything else!" unless it's genuinely useful.

Remember: Never share sensitive user data like full addresses or payment details.`;

  return prompt;
}


