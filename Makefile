.PHONY: build test clean run dev

BINARY=lattice
GO=go
GOFLAGS=-v

export PATH := /usr/local/go/bin:$(PATH)

build:
	$(GO) build $(GOFLAGS) -o $(BINARY) ./cmd/lattice

test:
	$(GO) test ./... -v -count=1

test-short:
	$(GO) test ./... -short -count=1

clean:
	rm -f $(BINARY)
	rm -f *.db

run: build
	./$(BINARY)

lint:
	golangci-lint run ./...
