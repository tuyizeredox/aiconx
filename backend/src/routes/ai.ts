import { FastifyInstance, FastifyRequest } from 'fastify';
import axios from 'axios';
import { z } from 'zod';
import { checkAiAccessLimit } from '../middleware/subscription';
import { getUserContext, getDiscoveryContext, searchProducts, searchStores, getPlatformContext, formatSystemPrompt } from '../services/aiContext';

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
        system_prompt: systemPrompt
      });

      // 6. Parse Actions from AI response
      // Example: [ACTION: ORDER_CARD, id: ORDER_ID]
      const actions: any[] = [];
      const actionRegex = /\[ACTION:\s*([^,\]]+)(?:,\s*id:\s*([^\]]+))?\]/g;
      let match;

      while ((match = actionRegex.exec(result.response)) !== null) {
        actions.push({
          type: match[1].trim(),
          data: match[2] ? { id: match[2].trim() } : {}
        });
      }

      // Strip internal action tags and any leaked internal IDs before showing
      // the reply to the user — these are for system use only.
      const cleanReply = result.response
        .replace(actionRegex, '')
        .replace(/\[ID:\s*[^\]]+\]/gi, '')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();

      return {
        reply: cleanReply,
        actions,
        products: searchContext.length > 0 ? searchContext : discoveryContext.slice(0, 5)
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
