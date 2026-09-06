# Multi-stage Dockerfile for Node.js + Express + React/Vite

# Stage 1: Build the React client
FROM node:20-slim AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2: Production runtime
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8000

# Install system dependencies for Playwright headless browser
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Install backend production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Install Playwright browser binary
RUN npx playwright install chromium

# Copy application server code and datasets
COPY server/ ./server/
COPY data/ ./data/

# Copy compiled frontend from Stage 1
COPY --from=client-builder /app/client/dist ./client/dist

# Expose production port
EXPOSE 8000

# Launch Express server
CMD ["node", "server/index.js"]
