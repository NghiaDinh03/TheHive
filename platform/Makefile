# TheHive Platform — top-level orchestrator (Phase 1)
SHELL          := /bin/sh
APP_VERSION    ?= 0.4.0-migration
VERSION        ?= $(APP_VERSION)
GIT_SHA        ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo local)
BUILD_TIME     ?= $(shell date -u +%Y-%m-%dT%H:%M:%SZ)

REGISTRY       ?= docker.io
IMAGE_NS       ?= thehiveplatform
BACKEND_IMG    := $(REGISTRY)/$(IMAGE_NS)/backend
FRONTEND_IMG   := $(REGISTRY)/$(IMAGE_NS)/frontend

COMPOSE        := docker compose -f deploy/docker-compose.yml --env-file deploy/.env

.PHONY: help env up down restart logs ps build build-backend build-frontend \
	tag push pull clean status validate-release backend-shell frontend-shell db-shell mq-shell

help:
	@echo "TheHive Platform commands"
	@echo "  make env                Copy .env.example to .env if missing"
	@echo "  make up                 docker compose up -d (build if needed)"
	@echo "  make down               docker compose down"
	@echo "  make restart            Restart all services"
	@echo "  make logs               Follow all logs"
	@echo "  make ps                 docker compose ps"
	@echo "  make status             curl /readyz on backend"
	@echo "  make build              Build backend + frontend images"
	@echo "  make build-backend      Build backend image only"
	@echo "  make build-frontend     Build frontend image only"
	@echo "  make tag                Tag :latest in addition to :$(APP_VERSION)"
	@echo "  make push               Push :$(APP_VERSION) and :$(APP_VERSION)-$(GIT_SHA) to $(REGISTRY)"
	@echo "  make pull               docker compose pull"
	@echo "  make validate-release   Validate APP_VERSION release class and docs wording"
	@echo "  make clean              docker compose down -v + prune dangling images"
	@echo "  make backend-shell      Exec sh in backend container"
	@echo "  make frontend-shell     Exec sh in frontend container"
	@echo "  make db-shell           psql into postgres"
	@echo "  make mq-shell           rabbitmqctl status"

env:
	@if [ ! -f deploy/.env ]; then \
		cp deploy/.env.example deploy/.env; \
		echo "Created deploy/.env from .env.example"; \
	else \
		echo "deploy/.env already exists"; \
	fi

up: env
	APP_VERSION=$(APP_VERSION) GIT_SHA=$(GIT_SHA) BUILD_TIME=$(BUILD_TIME) $(COMPOSE) up -d --build

down:
	$(COMPOSE) down

restart:
	$(COMPOSE) restart

logs:
	$(COMPOSE) logs -f --tail=200

ps:
	$(COMPOSE) ps

status:
	@echo "Backend /readyz:"
	@curl -fsS http://localhost:8080/readyz | sed 's/^/  /' || echo "  not ready"
	@echo "Backend /api/v1/status:"
	@curl -fsS http://localhost:8080/api/v1/status | sed 's/^/  /' || true
	@echo "Frontend /api/healthz:"
	@curl -fsS http://localhost:3000/api/healthz | sed 's/^/  /' || true

build: build-backend build-frontend

build-backend:
	docker build \
	  --build-arg APP_VERSION=$(APP_VERSION) \
	  --build-arg GIT_SHA=$(GIT_SHA) \
	  --build-arg BUILD_TIME=$(BUILD_TIME) \
	  -t $(BACKEND_IMG):$(APP_VERSION) \
	  -t $(BACKEND_IMG):$(APP_VERSION)-$(GIT_SHA) \
	  backend

build-frontend:
	docker build \
	  --build-arg APP_VERSION=$(APP_VERSION) \
	  --build-arg GIT_SHA=$(GIT_SHA) \
	  --build-arg BUILD_TIME=$(BUILD_TIME) \
	  -t $(FRONTEND_IMG):$(APP_VERSION) \
	  -t $(FRONTEND_IMG):$(APP_VERSION)-$(GIT_SHA) \
	  frontend

tag:
	docker tag $(BACKEND_IMG):$(APP_VERSION)  $(BACKEND_IMG):latest
	docker tag $(FRONTEND_IMG):$(APP_VERSION) $(FRONTEND_IMG):latest

push:
	docker push $(BACKEND_IMG):$(APP_VERSION)
	docker push $(BACKEND_IMG):$(APP_VERSION)-$(GIT_SHA)
	docker push $(FRONTEND_IMG):$(APP_VERSION)
	docker push $(FRONTEND_IMG):$(APP_VERSION)-$(GIT_SHA)

validate-release:
	@case "$(APP_VERSION)" in \
		0.*-migration) expected="migration-build" ;; \
		1.0.0-rc.*|v1.0.0-rc.*) expected="release-candidate" ;; \
		v*) expected="product-release" ;; \
		*) expected="development" ;; \
	esac; \
	python scripts/validate-release.py --root .. --app-version "$(APP_VERSION)" --expected-release-class "$$expected"

pull:
	$(COMPOSE) pull

clean:
	$(COMPOSE) down -v --remove-orphans
	docker image prune -f

backend-shell:
	$(COMPOSE) exec backend sh

frontend-shell:
	$(COMPOSE) exec frontend sh

db-shell:
	$(COMPOSE) exec postgres psql -U thehive -d thehive

mq-shell:
	$(COMPOSE) exec rabbitmq rabbitmqctl status
