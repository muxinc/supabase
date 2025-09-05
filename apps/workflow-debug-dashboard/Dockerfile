# Development Dockerfile for Next.js
FROM node:20-alpine

WORKDIR /app

# Install dependencies for better compatibility
RUN apk add --no-cache libc6-compat

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Expose Next.js dev server port
EXPOSE 3000

# Run in development mode
CMD ["npm", "run", "dev"]