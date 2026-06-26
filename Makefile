.PHONY: build test clean run dev build-site build-app build-admin build-go build-hosted dev-site dev-app dev-admin

BINARY=lattice
GO=go
GOFLAGS=-v

export PATH := /usr/local/go/bin:$(PATH)

build: build-site build-app build-go

build-site:
	cd web/site && npm install && npm run build
	mkdir -p internal/web/site
	cp -r web/site/dist/. internal/web/site/

build-app:
	cd web/app && npm install && npm run build
	mkdir -p internal/web/app
	cp -r web/app/dist/. internal/web/app/

build-admin:
	cd web/admin && npm install && npm run build

build-go:
	CGO_ENABLED=1 $(GO) build $(GOFLAGS) -o $(BINARY) ./cmd/lattice

build-hosted: build-admin
	CGO_ENABLED=1 $(GO) build $(GOFLAGS) -o hosted ./cmd/hosted

test:
	$(GO) test ./... -v -count=1

test-short:
	$(GO) test ./... -short -count=1

clean:
	rm -f $(BINARY) hosted
	rm -f *.db
	rm -rf internal/web/site
	rm -rf internal/web/app
	rm -rf web/admin/dist

run: build
	./$(BINARY)

lint:
	golangci-lint run ./...

dev-site:
	cd web/site && npm run dev

dev-app:
	cd web/app && npm run dev

dev-admin:
	cd web/admin && npm run dev