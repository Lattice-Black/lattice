# Stage 1: Build frontend (placeholder)
FROM node:20-alpine AS frontend
WORKDIR /app
# Placeholder: create empty index.html for now
RUN mkdir -p /app/dist && echo '<!DOCTYPE html><html><head><title>Lattice</title></head><body><h1>Lattice Status Page</h1></body></html>' > /app/dist/index.html

# Stage 2: Build Go binary
FROM golang:1.22-bookworm AS builder

WORKDIR /src

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

# Copy frontend build
COPY --from=frontend /app/dist ./web/app/dist

# Build with CGO enabled for go-sqlite3
RUN CGO_ENABLED=1 GOOS=linux go build -ldflags="-s -w" -o /lattice ./cmd/lattice

# Stage 3: Minimal runtime image
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -r -u 1000 -s /bin/false lattice

# Create data directory
RUN mkdir -p /data && chown lattice:lattice /data

# Copy binary from builder
COPY --from=builder /lattice /lattice

# Copy migrations if needed
COPY --from=builder /src/migrations /migrations

# Set ownership
RUN chown lattice:lattice /lattice

USER lattice

WORKDIR /

EXPOSE 8080

VOLUME ["/data"]

ENV LATTICE_DB_PATH=/data/lattice.db

CMD ["/lattice"]
