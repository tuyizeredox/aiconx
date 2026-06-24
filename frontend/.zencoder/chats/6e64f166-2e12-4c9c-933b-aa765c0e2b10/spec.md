# Technical Specification: IQON AI 2.0 (Personal Shopping Assistant & Order Concierge)

## 1. Technical Context
- **Frontend**: React (Vite), Tailwind CSS, Lucide React, Framer Motion, TanStack Query.
- **Backend**: Fastify (TypeScript), Mongoose (MongoDB).
- **AI Provider**: OpenRouter (Model: `anthropic/claude-3-haiku` or similar).

## 2. Implementation Approach
The upgrade transitions from a stateless keyword-filter to a stateful, personalized assistant. Context building will move primarily to the backend to ensure security and reduce client-side overhead.

### 2.1 Backend: Context-Aware AI Endpoint
A new specialized route `POST /ai/assistant` will be added to handle the personalized chat flow.

**Context Retrieval Logic:**
1.  **Identity**: User name and basic profile info.
2.  **Activity**:
    - Last 5 **Wishlist** items (Product titles, prices, categories).
    - Last 5 **Liked Posts** (Captions/Categories of products in those posts).
3.  **Commerce**:
    - Last 3 **Orders** (ID, Status, Total, Item count).
4.  **Inventory**:
    - Fetch 10 **Top Selling** products for "Daily Picks".
    - Fetch 10 **Search Results** if the user query contains product-related keywords.

**Dynamic System Prompt Construction:**
The backend will generate a prompt following this structure:
```text
You are IQON AI, [User's Name]'s personal shopping concierge.
User Context:
- Recently Wishlisted: [Item A, Item B]
- Recent Likes: [Aesthetic/Category preference]
- Recent Orders: [Order #123 (Status: Shipped), Order #456 (Status: Delivered)]

Available Products:
[List of relevant products]

Capabilities:
- If asked about an order, respond with text AND trigger an ORDER_CARD.
- Format actions as: [ACTION: ORDER_CARD, id: ORDER_ID]
```

### 2.2 Frontend: Specialized UI & Proactive UX
The `AIAssistant.jsx` component will be updated to handle the new rich responses.

**Rich Message Handling:**
- **Action Parser**: A regex-based parser to detect `[ACTION: TYPE, id: VALUE]` patterns in AI text.
- **OrderCard Integration**: If `ORDER_CARD` is detected, the assistant will render the `OrderStatusCard.jsx` component inline.
- **Smart Action Chips**: Contextual buttons (e.g., "Where is my last order?", "Show items like my wishlist") will be displayed above the input field.

**Proactive Initialization:**
- On mount, if the conversation is empty, the frontend calls the assistant with a special `INIT` flag to receive personalized "Daily Picks" suggestions.

## 3. Source Code Structure Changes

### 3.1 Backend (`backend/src/`)
- `routes/ai.ts`: Add `POST /assistant` endpoint.
- `services/aiContext.ts` (New): Utility service to fetch and format user data for the prompt.

### 3.2 Frontend (`src/`)
- `pages/AIAssistant.jsx`: Refactor to use the new endpoint and implement the action parser.
- `components/chat/SmartActionChips.jsx` (New): UI for suggested prompts.
- `components/chat/OrderStatusCard.jsx`: Ensure it can be used standalone within the chat flow.

## 4. Data Model & API Changes

### 4.1 New API Endpoint: `POST /ai/assistant`
- **Request Body**:
  ```json
  {
    "message": "string",
    "history": "array",
    "init": "boolean (optional)"
  }
  ```
- **Response Body**:
  ```json
  {
    "reply": "string",
    "actions": [
      { "type": "ORDER_CARD" | "PRODUCT_SUGGESTION", "data": { "id": "string" } }
    ],
    "products": "array (relevant product objects)"
  }
  ```

## 5. Delivery Phases

### Phase 1: Contextual Foundation (Backend)
- Implement `aiContext.ts` service.
- Create `/ai/assistant` endpoint.
- Test prompt generation with mock/real user data.

### Phase 2: Rich Interaction (Frontend)
- Connect `AIAssistant.jsx` to the new endpoint.
- Implement the Action Parser and `OrderCard` rendering.
- Add `SmartActionChips` based on user status (e.g., show "Track Order" only if an active order exists).

### Phase 3: Discovery & Polishing
- Implement "Daily Picks" proactive welcome.
- Refine product search integration in the backend.
- UI/UX polish (transitions, loading states).

## 6. Verification Plan
- **Backend Tests**: Verify context fetching logic doesn't leak sensitive data (e.g., full addresses).
- **Linting**: Ensure all new code adheres to project standards (`npm run lint`).
- **Manual QA**:
    1.  Open chat as a user with a wishlist -> Assistant should mention wishlist items.
    2.  Ask "Where is my order?" -> Assistant should display the `OrderCard`.
    3.  Check "Daily Picks" on fresh chat open.
