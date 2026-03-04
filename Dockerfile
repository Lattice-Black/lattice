# Stage 1: Build marketing site
FROM node:20-alpine AS site-builder
WORKDIR /web/site
COPY web/site/package*.json ./
RUN npm ci
COPY web/site/ ./
RUN npm run build

# Stage 2: Build admin/status app
FROM node:20-alpine AS app-builder
WORKDIR /web/app
COPY web/app/package*.json ./
RUN npm ci
COPY web/app/ ./
RUN npm run build

# Stage 3: Build Go binary
FROM golang:1.22-bookworm AS go-builder

WORKDIR /build

# Install build dependencies for CGO (sqlite3)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libc6-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy go mod files first for better caching
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Copy frontend builds into internal/web for embedding
COPY --from=site-builder /web/site/dist internal/web/site/
COPY --from=app-builder /web/app/dist internal/web/app/

# Build with CGO enabled for go-sqlite3
RUN CGO_ENABLED=1 go build -ldflags="-s -w" -o lattice ./cmd/lattice

# Stage 4: Minimal runtime image
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -r -u 1000 -s /bin/false lattice

# Create data directory
RUN mkdir -p /data && chown lattice:lattice /data

WORKDIR /app

# Copy binary from builder
COPY --from=go-builder /build/lattice .

# Copy migrations if needed
COPY --from=go-builder /build/migrations ./migrations

# Set ownership
RUN chown -R lattice:lattice /app

USER lattice

EXPOSE 8080

VOLUME ["/data"]

ENV LATTICE_DB_PATH=/data/lattice.db

CMD ["./lattice"]
