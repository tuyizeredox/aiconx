# Full SDD workflow

## Workflow Steps

### [x] Step: Requirements

Create a Product Requirements Document (PRD) based on the feature description.

1. Review existing codebase to understand current architecture and patterns
2. Analyze the feature definition and identify unclear aspects
3. Ask the user for clarifications on aspects that significantly impact scope or user experience
4. Make reasonable decisions for minor details based on context and conventions
5. If user can't clarify, make a decision, state the assumption, and continue

Save the PRD to `d:\projects\vetora\.zencoder\chats\6e64f166-2e12-4c9c-933b-aa765c0e2b10/requirements.md`.

**Stop here.** Present the PRD to the user and wait for their confirmation before proceeding.

### [x] Step: Technical Specification

Create a technical specification based on the PRD in `d:\projects\vetora\.zencoder\chats\6e64f166-2e12-4c9c-933b-aa765c0e2b10/requirements.md`.

1. Review existing codebase architecture and identify reusable components
2. Define the implementation approach

Save to `d:\projects\vetora\.zencoder\chats\6e64f166-2e12-4c9c-933b-aa765c0e2b10/spec.md` with:

- Technical context (language, dependencies)
- Implementation approach referencing existing code patterns
- Source code structure changes
- Data model / API / interface changes
- Delivery phases (incremental, testable milestones)
- Verification approach using project lint/test commands

**Stop here.** Present the technical specification to the user and wait for their confirmation before proceeding.

### [x] Step: Planning

Create a detailed implementation plan based on `d:\projects\vetora\.zencoder\chats\6e64f166-2e12-4c9c-933b-aa765c0e2b10/spec.md`.

1. Break down the work into concrete tasks
2. Each task should reference relevant contracts and include verification steps
3. Replace the Implementation step below with the planned tasks

Rule of thumb for step size: each step should represent a coherent unit of work (e.g., implement a component, add an API endpoint, write tests for a module). Avoid steps that are too granular (single function) or too broad (entire feature).

If the feature is trivial and doesn't warrant full specification, update this workflow to remove unnecessary steps and explain the reasoning to the user.

Save to `d:\projects\vetora\.zencoder\chats\6e64f166-2e12-4c9c-933b-aa765c0e2b10/plan.md`.

**Stop here.** Present the implementation plan to the user and wait for their confirmation before proceeding.

### [x] Step: Implementation

#### Phase 1: Backend Foundation (Context & API)

1. [x] **Implement `backend/src/services/aiContext.ts`**
   - Create a service to fetch and format user context for the AI prompt.
   - **Functions**:
     - `getUserContext(userId)`: Fetch profile, last 5 `WishlistItem`, last 5 `Like` (posts), and last 3 `Order`.
     - `getDiscoveryContext()`: Fetch top 10 products by `sales_count` or `rating_avg`.
     - `searchProducts(query)`: Query the database for 10 relevant products.
     - `formatSystemPrompt(userContext, discoveryContext, searchContext)`: Construct the master prompt for OpenRouter.
   - **Verification**: Run `npm run lint` in the `backend/` directory and verify logic with a test script.

2. [x] **Add `POST /ai/assistant` to `backend/src/routes/ai.ts`**
   - Add a new route `POST /assistant` with authentication.
   - **Logic**:
     - If `init` flag is true, use `getDiscoveryContext` to generate "Daily Picks".
     - Use `aiContext.ts` to build the personalized prompt.
     - call OpenRouter (`anthropic/claude-3-haiku`) to get the response.
     - Parse the response for actions (e.g., `[ACTION: ORDER_CARD, id: ORDER_ID]`).
     - Return structured JSON: `{ reply: string, actions: Array, products: Array }`.
   - **Verification**: Test the endpoint with `curl` to ensure it returns structured AI responses and parsed actions.

#### Phase 2: Frontend Rich Interaction (Rich UI & Proactive UX)

3. [x] **Refactor `src/pages/AIAssistant.jsx`**
   - Update `sendMessage` to call `POST /ai/assistant` and handle structured responses.
   - **Proactive Initialization**: On component mount, if the chat is empty, call the assistant with `init: true` to receive "Daily Picks" suggestions.
   - **Action Handling**: Update `ChatMessage` to detect `ORDER_CARD` actions and render the existing `OrderStatusCard.jsx` inline.
   - **Verification**: Open the chat and verify the "Daily Picks" greeting and order status rendering.

4. [x] **Create `src/components/chat/SmartActionChips.jsx`**
   - Implement a component for contextual buttons (e.g., "Where is my last order?", "Show items like my wishlist").
   - Integrate it into `AIAssistant.jsx` above the input area.
   - **Verification**: Verify chips appear dynamically and trigger the correct AI responses when clicked.

#### Phase 3: Cleanup & Refinement

5. [x] **Remove Legacy AI Logic**
   - Remove the local `findRelevantProducts` function from `AIAssistant.jsx`.
   - Remove client-side system prompt construction.
   - **Verification**: Ensure the chat still functions correctly using only the backend-provided context.

6. [x] **Final Verification**
   - Run `npm run lint` and `npm run typecheck` across both frontend and backend.
   - Perform manual QA on the 3 core user stories:
     1. "Where is my last order?" (Verify `OrderCard` rendering).
     2. "What should I buy?" (Verify wishlist/likes-based personalization).
     3. "Show me trending items" (Verify Daily Picks).
