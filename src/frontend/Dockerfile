# ==============================================================================
# Frontend Service Container (Multi-Stage Build)
# ==============================================================================

# Development stage with hot-reloading
FROM node:20-alpine AS development

WORKDIR /app

# Install dependencies before copying source for Docker layer caching
COPY src/frontend/package*.json ./
RUN npm install --no-audit --prefer-offline 2>/dev/null || true

# Copy source code
COPY src/frontend/ .

ENV PORT=3000
EXPOSE 3000

# Default command for development (overridden if npm scripts present)
CMD ["sh", "-c", "if [ -f package.json ]; then npm run dev -- --host 0.0.0.0 --port 3000; else echo 'Frontend placeholder running on port 3000' && nc -lk -p 3000; fi"]

# Production stage
FROM nginx:alpine AS production
COPY --from=development /app/dist /usr/share/nginx/html 2>/dev/null || true
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
