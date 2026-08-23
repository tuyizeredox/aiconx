import { FastifyInstance, FastifyRequest } from 'fastify';
import axios from 'axios';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { checkAiAccessLimit, getVendorPlan } from '../middleware/subscription';
import { getUserContext, getDiscoveryContext, searchProducts, searchStores, getPlatformContext, formatSystemPrompt } from '../services/aiContext';
import { searchStockImages, searchProductImages, inferSubject } from '../services/imageSearchService';
import { Store } from '../models/Store';
import { Product } from '../models/Product';
import { blockSchema, hexColor, sanitizeStorefrontLinks } from './stores';

// OpenRouter configuration
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = process.env.AI_MODEL || 'anthropic/claude-3-haiku';
const IS_DEV = process.env.NODE_ENV === 'development';

// Helper to check if we should use mock mode
const shouldShowMock = () => {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  // Valid OpenRouter keys usually start with sk-or-v1- and are long
  return !apiKey || apiKey === 'your-openrouter-key' || apiKey.length < 20;
};

// Helper for mock responses
const getMockResponse = (prompt: string): string => {
  const p = prompt.toLowerCase();
  if (p.includes('fashion') || p.includes('clothes')) {
    return "I found some trending fashion items for you! Check out our latest **Oversized Cotton Hoodies** ($45), **Vintage Denim Jackets** ($89), and **Urban Streetwear Tees** ($29).";
  }
  if (p.includes('shipping')) {
    return "Standard shipping on Aicon X takes **3-7 business days**. Many stores offer free shipping on orders over $75.";
  }
  return "I'm currently running in **demo mode** because the AI API key is not configured correctly. However, I can still help you with general information about Aicon X!";
};

// Schemas for input validation
const aiChatSchema = z.object({
  prompt: z.string().min(1),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string()
  })).optional(),
  system_prompt: z.string().optional(),
  max_tokens: z.number().default(1024),
});

const productContentSchema = z.object({
  category: z.string().min(1),
  keyFeatures: z.string().min(1),
});

const sentimentSchema = z.object({
  reviews: z.array(z.object({
    rating: z.number(),
    comment: z.string()
  })).min(1),
});

const translateSchema = z.object({
  texts: z.array(z.string()).min(1),
  targetLang: z.string().min(1),
});

const generateStorefrontSchema = z.object({
  prompt: z.string().min(3).max(4000),
  include_products: z.boolean().optional(),
});

const PRODUCT_CATEGORIES = ['fashion', 'electronics', 'home', 'beauty', 'sports', 'food', 'art', 'books', 'handmade', 'other'] as const;

const proposedProductSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  price: z.number().min(0).max(100_000_000),
  category: z.enum(PRODUCT_CATEGORIES),
  // Not part of the product — a plain-words description of the physical object
  // ("black smartphone") used only to find a matching photo, then dropped.
  image_query: z.string().max(80).optional(),
}).strict();

const STOREFRONT_BLOCK_TYPES = [
  'hero', 'rich_text', 'image_text', 'gallery', 'product_grid',
  'testimonials', 'cta_banner', 'categories', 'contact', 'divider'
];

function buildStorefrontSystemPrompt(
  store: { name: string; category?: string; description?: string },
  prompt: string,
  productCount: number
) {
  return `You are an expert e-commerce web designer. Design a storefront page layout for a vendor as a JSON object.

Return ONLY a JSON object of this exact shape (no markdown, no commentary):
{
  "theme": { "primary_color": "#rrggbb", "accent_color": "#rrggbb" },
  "blocks": [ { "type": "<block type>", "data": { ... type-specific fields ... } } ]${productCount > 0 ? `,
  "products": [ { "title": "...", "description": "...", "price": <number>, "category": "<one of: ${PRODUCT_CATEGORIES.join(', ')}>", "image_query": "..." } ]` : ''}
}

Rules:
- Pick 5 to 8 blocks from this list, in a sensible order, and always start with "hero": ${STOREFRONT_BLOCK_TYPES.join(', ')}.
- Field names per type — hero: headline, subheadline, cta_text, cta_link, height ("compact"|"tall"); rich_text: title, body; image_text: title, body, cta_text, cta_link, image_position ("left"|"right"); gallery: title; product_grid: title, mode ("newest"|"best_selling"|"category"), category, columns ("2"|"3"|"4"); testimonials: title; cta_banner: heading, body, button_text, button_link; categories: title; contact: title, show_social, show_address (booleans); divider: height ("sm"|"md"|"lg").
- Never invent a product_grid "curated" mode or product IDs — you don't know the vendor's real product catalog. Only use "newest", "best_selling", or "category".
- Leave every image_url, background_image_url, video_url, and images field out entirely (or empty) — real photos are sourced separately from a photo library, never invent an image URL yourself.
- Leave every cta_link and button_link field out entirely (or empty string) unless it's a real external URL the vendor mentioned (e.g. their Instagram/WhatsApp). Never invent an internal page path like "/shop", "/about", or "/contact" — those pages do not exist on this platform and the link would 404. An empty cta_link/button_link automatically sends visitors to the store's own product catalog, which is almost always the right behavior anyway.
- Write real, specific, on-brand marketing copy for every text field based on the vendor's request below — never use generic placeholder text like "Lorem ipsum" or "Your headline here".
- Pick theme colors (hex) that suit the store's category and vibe.
${productCount > 0 ? `- Also propose exactly ${productCount} realistic, distinct products this store would actually sell, matching its category/vibe and the vendor's request. Prices are in Rwandan Francs (RWF) — use realistic whole numbers (no decimals) for what each item would really cost in RWF. Do not include an image field on products — photos are sourced separately.
- Every product must have an "image_query": 2 to 5 plain English words naming the physical object a photographer would shoot, so a photo library returns the right picture. Describe the object and its key visible traits, never the brand/model name or marketing words. Examples: "Samsung Galaxy S23 Ultra" -> "black smartphone"; "Kigali Sunrise Arabica Beans 500g" -> "roasted coffee beans bag"; "Amara Silk Wrap Dress" -> "silk wrap dress"; "AirFlow Pro Earbuds" -> "white wireless earbuds".` : '- Do not include a "products" field at all.'}

Store: name="${store.name}", category="${store.category || 'general'}", description="${store.description || 'n/a'}".
Vendor's request: "${prompt}"`;
}

// Fills in real photos for any block whose image field the AI left empty —
// LLMs reliably hallucinate broken image URLs, so photos are always sourced
// here instead of trusted from the model's output.
//
// Block photos are searched by what the store sells (`subjectHint`, derived
// from the vendor's own prompt), not by the AI's marketing copy: a headline
// like "Power in your pocket" is a useless search query and used to return an
// arbitrary photo.
async function fillStorefrontImages(blocks: any[], store: { name: string; category?: string }, subjectHint?: string) {
  const category = store.category || 'other';
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;
    if (!block.data || typeof block.data !== 'object') block.data = {};

    if ((block.type === 'hero' || block.type === 'image_text') && !block.data.image_url) {
      const [url] = await searchStockImages(store.name || '', 1, category, subjectHint);
      block.data.image_url = url || '';
    } else if (block.type === 'gallery' && !(Array.isArray(block.data.images) && block.data.images.length)) {
      block.data.images = await searchStockImages(store.name || '', 6, category, subjectHint);
    }
  }
  return blocks;
}

async function defaultStorefrontTemplate(store: { name: string; category?: string; description?: string }, subjectHint?: string) {
  const category = store.category || 'other';
  const [heroImage] = await searchStockImages(store.name || '', 1, category, subjectHint);
  return {
    theme: { primary_color: '#ea580c', accent_color: '#f97316' },
    blocks: [
      {
        id: randomUUID(), type: 'hero', visible: true, style: {},
        data: { type: 'hero', headline: store.name || 'Welcome to our store', subheadline: store.description || 'Shop our latest picks', image_url: heroImage || '', cta_text: 'Shop now', cta_link: '', height: 'tall' },
      },
      {
        id: randomUUID(), type: 'product_grid', visible: true, style: { padding: 'md', text_align: 'left', width: 'contained' },
        data: { type: 'product_grid', title: 'Featured products', mode: 'newest', columns: '4' },
      },
      {
        id: randomUUID(), type: 'testimonials', visible: true, style: { padding: 'md', text_align: 'left', width: 'contained' },
        data: { type: 'testimonials', title: 'What customers say' },
      },
      {
        id: randomUUID(), type: 'contact', visible: true, style: { padding: 'md', text_align: 'left', width: 'contained' },
        data: { type: 'contact', title: 'Get in touch', show_social: true, show_address: true },
      },
    ],
  };
}

const aiAssistantSchema = z.object({
  message: z.string().optional(),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string()
  })).optional(),
  init: z.boolean().optional(),
  language: z.string().optional(),
});

// Shared AI handler to avoid fastify.inject and duplication
async function handleAiRequest(params: {
  prompt: string;
  messages?: any[];
  system_prompt?: string;
  max_tokens?: number;
  jsonMode?: boolean;
}) {
  const { prompt, messages = [], system_prompt, max_tokens = 1024, jsonMode = false } = params;

  if (shouldShowMock()) {
    return {
      response: getMockResponse(prompt) + (IS_DEV ? "\n\n(AI DEBUG: Mock Mode Active)" : ""),
      usage: { total_tokens: 0 }
    };
  }

  const formattedMessages = [];
  if (system_prompt) {
    formattedMessages.push({ role: 'system', content: system_prompt });
  }
  messages.forEach(msg => formattedMessages.push(msg));
  formattedMessages.push({ role: 'user', content: prompt });

  try {
    const response = await axios.post(OPENROUTER_URL, {
      model: DEFAULT_MODEL,
      messages: formattedMessages,
      max_tokens,
      response_format: jsonMode ? { type: 'json_object' } : undefined
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
        'X-Title': 'Aicon X Social Commerce',
      },
      timeout: 30000 // 30s timeout
    });

    return {
      response: response.data.choices[0].message.content,
      usage: response.data.usage
    };
  } catch (error: any) {
    const errorMsg = error.response?.data?.error?.message || error.message || 'AI service unavailable';
    throw new Error(errorMsg);
  }
}

export async function aiRoutes(fastify: FastifyInstance) {
  // Health check (auth required to avoid leaking config details)
  fastify.get('/health', {
    preHandler: [fastify.authenticate],
  }, async () => {
    return { 
      status: 'ok', 
      provider: 'openrouter',
      mock_mode: shouldShowMock(),
    };
  });

  // Main chat/invoke endpoint
  fastify.post('/chat', {
    preHandler: [fastify.authenticate, checkAiAccessLimit],
  }, async (request, reply) => {
    try {
      const body = aiChatSchema.parse(request.body);
      return await handleAiRequest(body);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid input', details: error.errors });
      }
      fastify.log.error(error);
      return {
        response: getMockResponse((request.body as any)?.prompt || '') + (IS_DEV ? `\n\n(AI ERROR: Service unavailable)` : ""),
        usage: { total_tokens: 0 }
      };
    }
  });

  // Assistant endpoint for rich interaction
  fastify.post('/assistant', {
    preHandler: [fastify.authenticate, checkAiAccessLimit],
  }, async (request, reply) => {
    try {
      const body = aiAssistantSchema.parse(request.body);
      const userId = (request.user as any)._id;

      // 1. Fetch User Context
      const userContext = await getUserContext(userId);

      // 2. Fetch Discovery Context (for "Daily Picks" or general trending)
      const discoveryContext = await getDiscoveryContext();

      // 3. Fetch Platform Context (Announcements & FAQs)
      const platformContext = await getPlatformContext();

      // 4. Search for relevant products and stores if a message is provided
      let searchContext: any[] = [];
      let storeContext: any[] = [];
      if (body.message && !body.init) {
        searchContext = await searchProducts(body.message);
        storeContext = await searchStores(body.message);
      }

      // 5. Format System Prompt
      const systemPrompt = formatSystemPrompt(userContext, discoveryContext, searchContext, platformContext, storeContext, body.language);

      // 5. Call AI
      const userPrompt = body.message || (body.init ? "Hello! Introduce yourself as my Aicon X personal shopping assistant and show me some daily picks based on my interests or what's trending." : "");
      
      const result = await handleAiRequest({
        prompt: userPrompt,
        messages: body.history,
        system_prompt: systemPrompt,
        max_tokens: 300
      });

      // 6. Parse Actions from AI response
      // Example: [ACTION: ORDER_CARD, id: ORDER_ID]
      const actions: any[] = [];
      const actionRegex = /\[ACTION:\s*([^,\]]+)(?:,\s*id:\s*([^\]]+))?\]/g;
      let match;

      let recommendedIds: string[] = [];
      while ((match = actionRegex.exec(result.response)) !== null) {
        const type = match[1].trim();
        const idValue = match[2]?.trim();
        if (type === 'PRODUCTS') {
          // Not a UI action on its own — it's how the model tells us which of
          // the products it actually named in the reply text.
          if (idValue) recommendedIds = idValue.split('|').map(id => id.trim()).filter(Boolean);
          continue;
        }
        actions.push({ type, data: idValue ? { id: idValue } : {} });
      }

      // Strip internal action tags and any leaked internal IDs before showing
      // the reply to the user — these are for system use only.
      const cleanReply = result.response
        .replace(actionRegex, '')
        .replace(/\[ID:\s*[^\]]+\]/gi, '')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();

      // Only attach product cards for products the model actually named in its
      // reply (per the [ACTION: PRODUCTS, id: ...] tag), so the "Recommended
      // for you" widget always matches what the text says — never a generic
      // fallback shown regardless of what was actually discussed.
      const candidateProducts = searchContext.length > 0 ? searchContext : discoveryContext;
      const productsById = new Map(candidateProducts.map((p: any) => [p.id, p]));
      const products = recommendedIds
        .map(id => productsById.get(id))
        .filter((p): p is typeof candidateProducts[number] => Boolean(p));

      return {
        reply: cleanReply,
        actions,
        products
      };
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid input', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Assistant failed', message: error.message });
    }
  });

  // Legacy invoke support - now uses the shared handler
  fastify.post('/invoke', {
    preHandler: [fastify.authenticate, checkAiAccessLimit],
  }, async (request, reply) => {
    try {
      const body = aiChatSchema.parse(request.body);
      return await handleAiRequest(body);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid input', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'AI Invoke failed' });
    }
  });

  // Generate product content
  fastify.post('/generate-product-content', {
    preHandler: [fastify.authenticate, checkAiAccessLimit],
  }, async (request, reply) => {
    try {
      const { category, keyFeatures } = productContentSchema.parse(request.body);
      const prompt = `Generate a product title, description, and 5 SEO tags for a "${category}" product with these features: ${keyFeatures}. Return ONLY a JSON object with: title, description, tags (array), seo_title.`;

      const result = await handleAiRequest({
        prompt,
        system_prompt: 'You are an expert e-commerce copywriter. Return ONLY valid JSON.',
        jsonMode: true
      });

      try {
        return JSON.parse(result.response);
      } catch (e) {
        fastify.log.error({ response: result.response }, 'Failed to parse AI response as JSON');
        return { title: 'Product', description: 'Description', tags: [], seo_title: 'Product' };
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) return reply.code(400).send({ error: error.errors });
      return { title: 'Product', description: 'Description', tags: [], seo_title: 'Product' };
    }
  });

  // Generate a full storefront draft (theme + blocks) from a prompt — Pro/Elite only.
  // The vendor previews and edits the result in the builder; nothing is saved here.
  fastify.post('/generate-storefront', {
    preHandler: [fastify.authenticate, checkAiAccessLimit],
  }, async (request, reply) => {
    try {
      const { prompt, include_products } = generateStorefrontSchema.parse(request.body);
      const user = request.user as any;

      const { plan, limits } = await getVendorPlan(user.username, request);
      if (!limits.custom_storefront) {
        return reply.code(403).send({
          error: 'Subscription feature restricted',
          message: `The AI storefront generator is not available on the ${plan} plan. Please upgrade to Pro or Elite.`,
        });
      }

      const store = await Store.findOne({ owner_username: user.username.toLowerCase() }).lean();
      if (!store) {
        return reply.code(404).send({ error: 'Create your store before generating a storefront.' });
      }

      // Products can only be proposed if the store could actually save them —
      // matches the same checkStoreVerified + product-count gate the real
      // POST /products endpoint enforces, checked again here defensively.
      let productCount = 0;
      if (include_products && store.verification_status === 'approved') {
        const existingCount = await Product.countDocuments({
          vendor_username: user.username.toLowerCase(),
          status: { $ne: 'archived' },
        });
        const roomLeft = limits.products === Infinity ? 6 : Math.max(0, limits.products - existingCount);
        productCount = Math.min(6, roomLeft);
      }

      const result = await handleAiRequest({
        prompt: 'Generate the storefront layout now.',
        system_prompt: buildStorefrontSystemPrompt(store, prompt, productCount),
        jsonMode: true,
        max_tokens: productCount > 0 ? 3200 : 2500,
      });

      let generated: any = null;
      try {
        generated = JSON.parse(result.response);
      } catch (e) {
        fastify.log.error({ response: result.response }, 'Failed to parse AI storefront response as JSON');
      }

      // What the vendor asked for ("build a smartphone store") describes the
      // subject far better than the store's coarse category ("electronics"),
      // so it drives the layout photo search.
      const subjectHint = inferSubject(`${prompt} ${store.description || ''}`, store.category) || undefined;

      const rawBlocks = Array.isArray(generated?.blocks) ? generated.blocks : [];
      const withImages = sanitizeStorefrontLinks(await fillStorefrontImages(rawBlocks, store, subjectHint));

      // Validate each block independently so one malformed block (an off-schema
      // field name, a stray key, etc.) doesn't discard an otherwise-good draft.
      const validBlocks: any[] = [];
      for (const b of withImages) {
        if (!b?.type) continue;
        const candidate = {
          id: randomUUID(),
          type: b.type,
          visible: true,
          style: {},
          data: { ...(b.data || {}), type: b.type },
        };
        const parsedBlock = blockSchema.safeParse(candidate);
        if (parsedBlock.success) validBlocks.push(parsedBlock.data);
      }

      // Products are proposals only — nothing is written to the DB here. The
      // vendor reviews them client-side and the frontend calls the real
      // (already plan/verification-gated) POST /products for each one it
      // wants to keep.
      const products: any[] = [];
      if (productCount > 0 && Array.isArray(generated?.products)) {
        const proposed: any[] = [];
        for (const p of generated.products.slice(0, productCount)) {
          const parsedProduct = proposedProductSchema.safeParse({
            title: p?.title,
            description: p?.description,
            price: typeof p?.price === 'number' ? Math.round(p.price) : p?.price,
            category: p?.category,
            image_query: typeof p?.image_query === 'string' ? p.image_query : undefined,
          });
          if (parsedProduct.success) proposed.push(parsedProduct.data);
        }

        // Each product gets a ranked list of matching photos rather than a
        // single URL, so products that fall back to the same broad query
        // ("smartphone") don't all end up showing the identical picture.
        const candidateLists = await Promise.all(
          proposed.map((p) => searchProductImages(p.title, p.category, p.image_query))
        );

        const usedImages = new Set<string>();
        proposed.forEach((p, i) => {
          const candidates = candidateLists[i] || [];
          const picked = candidates.find((url) => !usedImages.has(url)) || candidates[0] || '';
          if (picked) usedImages.add(picked);
          const { image_query, ...product } = p;
          products.push({ ...product, image_url: picked });
        });
      }

      if (validBlocks.length > 0) {
        const themeSchema = z.object({ primary_color: hexColor.optional(), accent_color: hexColor.optional() }).strict();
        const themeResult = themeSchema.safeParse(generated?.theme || {});
        return {
          theme: themeResult.success ? themeResult.data : {},
          blocks: validBlocks.slice(0, 30),
          products,
        };
      }

      fastify.log.error({ response: result.response }, 'AI storefront generation produced no valid blocks, using fallback template');
      const fallback = await defaultStorefrontTemplate(store, subjectHint);
      return { ...fallback, products };
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid input', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to generate storefront', message: error.message });
    }
  });

  // Sentiment Analysis
  fastify.post('/generate-sentiment-summary', {
    preHandler: [fastify.authenticate, checkAiAccessLimit],
  }, async (request, reply) => {
    try {
      const { reviews } = sentimentSchema.parse(request.body);
      const reviewsText = reviews.map((r: any) => `Rating: ${r.rating}, Comment: ${r.comment}`).join('\n');
      
      const result = await handleAiRequest({
        prompt: `Analyze reviews and return JSON: overall_sentiment, sentiment_score (0-100), summary_text, pros (array), cons (array). \nReviews:\n${reviewsText}`,
        system_prompt: 'You are a professional analyst. Return ONLY valid JSON.',
        jsonMode: true
      });

      try {
        return JSON.parse(result.response);
      } catch (e) {
        fastify.log.error({ response: result.response }, 'Failed to parse sentiment JSON');
        return { overall_sentiment: 'neutral', sentiment_score: 50, summary_text: 'Analysis failed', pros: [], cons: [] };
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) return reply.code(400).send({ error: error.errors });
      return { overall_sentiment: 'neutral', sentiment_score: 50, summary_text: 'No data', pros: [], cons: [] };
    }
  });

  // Translation
  fastify.post('/translate', {
    preHandler: [fastify.authenticateOptional], // Allow guests to translate for basic UI localization
  }, async (request, reply) => {
    try {
      const { texts, targetLang } = translateSchema.parse(request.body);
      const result = await handleAiRequest({
        prompt: `Translate to ${targetLang}. Return ONLY a JSON array of strings: ${JSON.stringify(texts)}`,
        system_prompt: 'You are a professional translator. Return ONLY a valid JSON array of strings.',
        jsonMode: true
      });

      try {
        const translations = JSON.parse(result.response);
        return Array.isArray(translations) ? { translations } : { translations: texts };
      } catch (e) {
        fastify.log.error({ response: result.response }, 'Failed to parse translation JSON');
        return { translations: texts };
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) return reply.code(400).send({ error: error.errors });
      return { translations: (request.body as any).texts || [] };
    }
  });
}
