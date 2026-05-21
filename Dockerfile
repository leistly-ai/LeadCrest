# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --production

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/firebase-applet-config.json ./
COPY --from=builder /app/firebase-blueprint.json ./

# Install tsx for running TypeScript server
RUN npm install -g tsx

# Expose port (Cloud Run will inject PORT env var)
ENV PORT=8080
EXPOSE 8080

# Start the server
CMD ["npx", "tsx", "server.ts"]
