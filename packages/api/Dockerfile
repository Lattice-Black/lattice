FROM node:21-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies (includes @lattice.black/core from npm)
RUN yarn install --production

# Copy built application
COPY dist ./dist
COPY prisma ./prisma

# Generate Prisma client
RUN npx prisma generate

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/health || exit 1

# Start application
CMD ["node", "--enable-source-maps", "dist/index.js"]
