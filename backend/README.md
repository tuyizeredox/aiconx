# IQON Backend

Backend API for the IQON social commerce platform, built with Fastify, TypeScript, MongoDB, and Socket.io.

## Features

- **Authentication**: JWT-based auth with user registration/login
- **Real-time**: WebSocket support for live messaging, notifications, and live sessions
- **File Uploads**: Cloudinary integration for images and media
- **AI Integration**: Anthropic Claude for LLM features (product generation, sentiment analysis)
- **Payments**: Stripe integration for e-commerce
- **Database**: MongoDB with Mongoose ODM
- **Social Commerce**: Communities, posts, comments, likes, follows
- **Marketplace**: Products, stores, orders, reviews, coupons, affiliate links
- **Live Shopping**: Live sessions with real-time chat
- **Vendor Management**: Subscriptions, shipping zones, withdrawals, store reviews

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user profile
- `PUT /api/auth/me` - Update user profile

### Users
- `GET /api/users` - List users with filtering
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Products & Marketplace
- `GET /api/products` - List products with filtering/sorting
- `POST /api/products` - Create product
- `GET /api/products/:id` - Get product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Social Features
- `GET /api/posts` - List posts
- `POST /api/posts` - Create post
- `GET /api/posts/:id` - Get post
- `PUT /api/posts/:id` - Update post
- `DELETE /api/posts/:id` - Delete post

- `GET /api/communities` - List communities
- `POST /api/communities` - Create community
- `GET /api/communities/:id` - Get community

- `GET /api/comments` - List comments
- `POST /api/comments` - Create comment
- `PUT /api/comments/:id` - Update comment
- `DELETE /api/comments/:id` - Delete comment

### Real-time Features
- `GET /api/messages` - List messages
- `POST /api/messages` - Send message
- `GET /api/live-sessions` - List live sessions
- `POST /api/live-sessions` - Create live session
- `GET /api/live-chat-messages` - List live chat messages

### E-commerce
- `GET /api/orders` - List orders
- `POST /api/orders` - Create order
- `GET /api/orders/:id` - Get order
- `PUT /api/orders/:id` - Update order

- `GET /api/cart` - Get cart items
- `POST /api/cart` - Add to cart
- `PUT /api/cart/:id` - Update cart item
- `DELETE /api/cart/:id` - Remove from cart

- `GET /api/reviews` - List reviews
- `POST /api/reviews` - Create review

### Vendor Features
- `GET /api/stores` - List stores
- `POST /api/stores` - Create store
- `GET /api/stores/:id` - Get store

- `GET /api/coupons` - List coupons
- `POST /api/coupons` - Create coupon

- `GET /api/affiliate-links` - List affiliate links
- `POST /api/affiliate-links` - Create affiliate link

- `GET /api/shipping-zones` - List shipping zones
- `POST /api/shipping-zones` - Create shipping zone

- `GET /api/withdrawals` - List withdrawals
- `POST /api/withdrawals` - Request withdrawal

### User Features
- `GET /api/wishlist` - Get user wishlist
- `POST /api/wishlist` - Add to wishlist
- `DELETE /api/wishlist/:productId` - Remove from wishlist

- `GET /api/stories` - List stories
- `POST /api/stories` - Create story
- `GET /api/stories/:id` - Get story

- `GET /api/follows` - List follows
- `POST /api/follows` - Follow user/store/community
- `DELETE /api/follows/:id` - Unfollow

### Analytics & AI
- `GET /api/sentiment-summaries` - Get product sentiment analysis
- `POST /api/sentiment-summaries` - Create/update sentiment summary

- `GET /api/notifications` - List notifications
- `POST /api/notifications` - Create notification

### Admin Features
- `GET /api/vendor-subscriptions` - List vendor subscriptions
- `POST /api/vendor-subscriptions` - Create subscription
- `PUT /api/vendor-subscriptions/:id` - Update subscription

- `GET /api/store-reviews` - List store reviews
- `POST /api/store-reviews` - Create store review

## Tech Stack

- **Framework**: Fastify (high-performance Node.js framework)
- **Language**: TypeScript
- **Database**: MongoDB with Mongoose
- **Real-time**: Socket.io with Redis adapter
- **File Storage**: Cloudinary
- **AI**: Anthropic SDK
- **Payments**: Stripe
- **Validation**: Zod

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB
- Redis (optional, for scaling)

### Installation

1. Clone the repository
2. Navigate to backend directory: `cd backend`
3. Install dependencies: `npm install`
4. Copy environment file: `cp .env.example .env`
5. Update environment variables in `.env`
6. Start development server: `npm run dev`

### Environment Variables

See `.env.example` for required environment variables.

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run lint` - Lint code

## API Documentation

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `PATCH /api/auth/me` - Update user profile
- `POST /api/auth/logout` - Logout user

### WebSocket Events
- `join-conversation` - Join chat room
- `leave-conversation` - Leave chat room
- `join-live-session` - Join live streaming room
- `leave-live-session` - Leave live streaming room

## Project Structure

```
backend/
├── src/
│   ├── config/          # Database and app configuration
│   ├── models/          # MongoDB schemas
│   ├── routes/          # API route handlers
│   ├── services/        # Business logic services
│   ├── middleware/      # Custom middleware
│   ├── websocket/       # WebSocket handlers
│   └── server.ts        # Main server file
├── package.json
├── tsconfig.json
└── .env.example
```

## Development

### Adding New Entities

1. Create model in `src/models/`
2. Create routes in `src/routes/`
3. Register routes in `src/server.ts`
4. Update WebSocket events if needed

### Database Migrations

MongoDB is schema-less, but use migration scripts for data changes:

```bash
# Create migration script
npm run migrate:create add-user-indexes
```

## Deployment

### Docker

```bash
# Build image
docker build -t iqon-backend .

# Run container
docker run -p 3001:3001 --env-file .env iqon-backend
```

### Production Checklist

- [ ] Set strong JWT secret
- [ ] Configure MongoDB authentication
- [ ] Set up Redis for WebSocket scaling
- [ ] Configure Cloudinary credentials
- [ ] Set up Stripe webhooks
- [ ] Enable HTTPS
- [ ] Set up monitoring and logging
- [ ] Configure rate limiting
- [ ] Set up database backups

## Contributing

1. Follow TypeScript best practices
2. Write tests for new features
3. Update documentation
4. Use conventional commits

## License

MIT