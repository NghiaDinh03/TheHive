# Backend Makefile (Phase 1)
APP            := thehive-platform-backend
APP_VERSION    ?= 0.4.0-migration
VERSION        ?= $(APP_VERSION)
GIT_SHA        ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo unknown)
BUILD_TIME     ?= $(shell date -u +%Y-%m-%dT%H:%M:%SZ)
LDFLAGS        := -s -w \
                  -X github.com/thehive-platform/backend/internal/version.AppVersion=$(APP_VERSION) \
                  -X github.com/thehive-platform/backend/internal/version.GitSHA=$(GIT_SHA) \
                  -X github.com/thehive-platform/backend/internal/version.BuildTime=$(BUILD_TIME)

.PHONY: tidy build run test lint vet fmt docker docker-run

tidy:
	go mod tidy

fmt:
	gofmt -s -w .

vet:
	go vet ./...

lint: vet
	@command -v golangci-lint >/dev/null 2>&1 && golangci-lint run ./... || echo "golangci-lint not installed, skipping"

build:
	CGO_ENABLED=0 go build -trimpath -ldflags="$(LDFLAGS)" -o bin/server ./cmd/server

run: build
	./bin/server

test:
	go test ./... -race -count=1

docker:
	docker build \
	  --build-arg APP_VERSION=$(APP_VERSION) \
	  --build-arg GIT_SHA=$(GIT_SHA) \
	  --build-arg BUILD_TIME=$(BUILD_TIME) \
	  -t $(APP):$(APP_VERSION) \
	  -t $(APP):latest .

docker-run:
	docker run --rm -p 8080:8080 --env-file ../deploy/.env.example $(APP):$(APP_VERSION)
