# 🚀 Rogue Campus Monorepo

Welcome to the **Rogue** campus social & micro-hangout platform monorepo.

## 📦 Project Structure

- `apps/web`: Next.js 16 (React 19, TailwindCSS, Socket.io client) web application
- `apps/api`: Express.js + Socket.io Node.js API server (PostgreSQL & in-memory fallback)
- `packages/shared`: Shared TypeScript types & interfaces across frontend and backend

## 🚀 Quick Start

### 1. Installation
```bash
npm install
```

### 2. Running Development Mode
Runs both API backend and Next.js frontend concurrently:
```bash
npm run dev
```

- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:3001](http://localhost:3001)

### 3. Production Build
```bash
npm run build
```

### 4. Running Production Servers
```bash
# Start API Server
npm run start:api

# Start Web Application
npm run start:web
```

## 🌐 Environment Variables

Check `.env.example` inside `apps/api/.env.example` and `apps/web/.env.example` for details on configuring production URLs, database connections, and Google OAuth credentials.
