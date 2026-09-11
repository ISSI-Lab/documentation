# ==============================================================================
# Stage 1: Build ReactJS Application
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY src/frontend/package*.json ./

# Install dependencies
RUN npm install

# Copy frontend source code
COPY src/frontend/ ./

# Build the production React SPA bundle into /app/dist
RUN npm run build

# ==============================================================================
# Stage 2: Production Nginx Server
# ==============================================================================
FROM nginx:alpine AS runner

# Remove default nginx configurations
RUN rm -rf /etc/nginx/conf.d/*

# Copy custom Nginx configuration
COPY src/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built React static bundle from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
