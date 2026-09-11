# ==============================================================================
# Backend Service Container (NodeJS 20 / Express / TypeScript)
# ==============================================================================

FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies first for caching
COPY src/backend/package*.json ./
RUN npm install

# Copy source code
COPY src/backend/ ./

# Compile TypeScript to JavaScript in dist/
RUN npm run build

# ==============================================================================
# Production Runtime Stage
# ==============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=5000

COPY src/backend/package*.json ./
RUN npm install --only=production

# Copy compiled files and init db scripts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/db ./db

EXPOSE 5000

CMD ["node", "dist/index.js"]
