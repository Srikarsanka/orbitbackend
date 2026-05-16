# ORBIT Backend — Node.js + Whiteboard
FROM node:22-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --production

# Copy backend source code
COPY . .

# Install whiteboard dependencies
WORKDIR /app/whiteboard
COPY whiteboard/package.json whiteboard/package-lock.json ./
RUN npm ci --production
WORKDIR /app

# Create required directories
RUN mkdir -p temp uploads whiteboard_data

# Expose the port Cloud Run will send traffic to
EXPOSE 5000

# Set environment variable for Cloud Run
ENV PORT=5000
ENV NODE_ENV=production

# Start the server
CMD ["node", "server.js"]
