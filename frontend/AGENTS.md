# Repository Guidelines

## Project Structure & Module Organization
IQON is a social commerce platform with a decoupled frontend and backend.
- **Frontend (Root)**: React application built with Vite, utilizing Tailwind CSS and Radix UI components. Mobile support is provided via Capacitor.
- **Backend (`backend/`)**: High-performance API built with Fastify and TypeScript, using MongoDB (Mongoose) for data persistence and Socket.io for real-time features.
- **Entities (`entities/`)**: Shared JSON Schema definitions (without extensions) that define core data structures used across the platform.
- **Native (`android/`)**: Android-specific project files for mobile deployment via Capacitor.

## Build, Test, and Development Commands
### Root Commands (Frontend-focused)
- `npm run dev`: Start both frontend and backend development servers concurrently.
- `npm run dev:frontend`: Start the Vite development server.
- `npm run dev:backend`: Start the backend development server from the root.
- `npm run build`: Build the frontend and synchronize with Capacitor.
- `npm run lint`: Run ESLint on the frontend codebase.
- `npm run typecheck`: Run TypeScript compiler check for the frontend.

### Backend Commands (`backend/` directory)
- `npm run dev`: Start the backend server with `tsx watch`.
- `npm run build`: Compile TypeScript to JavaScript.
- `npm run test`: Run the Jest test suite.
- `npm run lint`: Lint the backend code.

## Coding Style & Naming Conventions
- **Frontend**: Follows React functional component patterns. ESLint is configured with `eslint-plugin-react-hooks` and `eslint-plugin-unused-imports`.
- **Backend**: Strict TypeScript implementation. Prettier is used for formatting.
- **Validation**: Zod is heavily used for runtime type safety in both frontend and backend.

## Testing Guidelines
- Backend testing is managed via **Jest**.
- Use `npm test` inside the `backend/` directory to run the full suite.

## Commit & Pull Request Guidelines
- The repository currently uses an informal commit style (e.g., "cc", "cm"). However, for new contributions, descriptive and concise commit messages are preferred.
