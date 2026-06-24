# Product Requirements Document: IQON AI 2.0

## 1. Executive Summary
**IQON AI 2.0** aims to transform the existing AI Assistant from a basic chat interface into a comprehensive **Personal Shopping Assistant and Order Concierge**. By integrating user-specific data (order history, wishlist, likes) and providing proactive discovery features, IQON AI will offer a "premium" social commerce experience that drives engagement and simplifies post-purchase inquiries.

## 2. Problem Statement
The current IQON AI (AIAssistant.jsx) is limited to:
- Local keyword filtering of the top 50 products.
- Static system prompts that do not account for the user's identity or preferences.
- Lack of integration with order management, forcing users to navigate to separate pages for status updates.

## 3. Goals & Objectives
- **Increase Personalization**: Provide recommendations based on actual user activity.
- **Reduce Support Overhead**: Enable the AI to handle common questions about order status and policies.
- **Enhance Discovery**: Surface trending and relevant products proactively.
- **Improve UI/UX**: Introduce specialized components for non-textual responses (e.g., Order Cards).

## 4. Key Features

### 4.1. Personalized User Context
- **Requirement**: The AI should be aware of the user's name, recently wishlisted items, and liked posts.
- **Benefit**: AI can say "Hi [Name], I noticed you liked that Vintage Denim Jacket. Here are some boots that would look great with it!"

### 4.2. Order Concierge Integration
- **Requirement**: Integration with `ordersAPI` to allow users to ask about their order status (e.g., "Where is my last order?").
- **Benefit**: Immediate answers for the most common user query.

### 4.3. Proactive "Daily Picks"
- **Requirement**: When the chat is opened, the AI suggests 3-5 products based on trending categories or user interests before the first message is sent.
- **Benefit**: Reduces the "blank slate" problem and encourages immediate interaction.

### 4.4. Enhanced Product Matching
- **Requirement**: Implement a backend-assisted search that can query the entire database for products, including descriptions, categories, and tags.
- **Benefit**: High-quality recommendations that match user intent across the entire catalog.

### 4.5. Specialized UI Components
- **Requirement**:
    - **Order Card**: Displays status, full item list (with images/prices), total amount, and a "Track" button with tracking URL.
    - **Smart Action Chips**: Contextual buttons like "Track My Package", "Similar to Wishlist", "Latest Deals".

## 5. User Stories
- **Shopper**: "As a frequent shopper, I want to ask the AI for an update on my delivery so I don't have to search through my email or order history."
- **Social User**: "As a social user, I want the AI to recommend products that match the aesthetic of the posts I've liked."
- **New User**: "As a new user, I want the AI to show me the most popular items in the electronics category under $200."

## 6. Functional Requirements
- **FR1**: Fetch `currentUser`, `wishlist`, and `recentOrders` before initializing the AI context.
- **FR2**: Update the system prompt dynamically with the fetched user data.
- **FR3**: Implement a "Tool-like" logic where the AI can "call" for order info (simulated via prompt engineering or explicit API triggers).
- **FR4**: Add `OrderCard` component to the chat message display logic.

## 7. Technical Constraints & Security
- **Privacy**: No sensitive data (passwords, full addresses, payment details) should be sent to the AI provider (OpenRouter/Anthropic).
- **Performance**: Limit the size of the product context sent in the prompt to avoid high latency and token costs.
- **Compatibility**: Must work within the existing Fastify/React/Vite architecture.

## 8. Success Metrics
- **Engagement**: Increase in messages sent per session.
- **Conversion**: Higher "Add to Cart" rate from within the AI chat.
- **Utility**: Percentage of order-related queries resolved by the AI.
