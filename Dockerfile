# Farther Prism - Production Dockerfile
FROM node:22-slim AS builder

# Set working directory
WORKDIR /app

# Copy all package files
COPY package*.json ./
COPY client/package*.json ./client/

# Install ALL dependencies (including devDependencies for build)
RUN npm ci
RUN cd client && npm ci

# Copy source code
COPY api/ ./api/
COPY projects/ ./projects/
COPY client/ ./client/

# Build React frontend
RUN cd client && npm run build

# Production stage
FROM node:22-slim

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Create uploads directory
RUN mkdir -p /app/uploads

# Copy built application
COPY api/ ./api/
COPY projects/ ./projects/
COPY --from=builder /app/client/dist ./client/dist

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Start server
CMD ["node", "api/server.js"]
