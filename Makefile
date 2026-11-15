SHELL := /bin/bash

# --- Docker image (registry) ---
DOCKER_NAMESPACE ?= jagawarga
VERSION ?= 1.0.0
REVISION ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo local)
PLATFORM ?= linux/amd64
PUSH_PLATFORMS ?= linux/amd64,linux/arm64
IMAGE_API = $(DOCKER_NAMESPACE)/api
IMAGE_WEB = $(DOCKER_NAMESPACE)/web
BUILD_ARGS = --build-arg VERSION=$(VERSION) --build-arg REVISION=$(REVISION)

.PHONY: up down db api migrate seed test dev app demo-app web web-build reset verify clean \
	images image-api image-web publish publish-api publish-web prod-up prod-down prod-migrate

up:            ## nyalakan Postgres (+ API via docker)
	docker compose up -d db

down:          ## matikan semua service
	docker compose down

db: up         ## pastikan Postgres siap
	@until docker compose exec -T db pg_isready -U jagawarga -d jagawarga >/dev/null 2>&1; do sleep 1; done
	@echo "db ready"

migrate:       ## jalankan migrasi drizzle
	cd server && bun run db:migrate

seed:          ## isi data demo (idempoten)
	cd server && bun run seed

dev:           ## API mode watch
	cd server && bun run dev

test:          ## test server (butuh db + jagawarga_test)
	cd server && bun run test

app:           ## jalankan Flutter di emulator (hot reload)
	cd app && flutter run

demo-app:      ## emulator + APK debug + buka aplikasi (tanpa hot reload)
	./scripts/demo-app.sh

web:           ## dev server React admin
	cd web && npm run dev

web-build:     ## build produksi React admin
	cd web && npm run build

reset:         ## hapus semua data dev lalu migrasi + seed ulang
	docker compose exec -T db psql -U jagawarga -d jagawarga -c "drop schema if exists public cascade; create schema public;"
	docker compose exec -T db psql -U jagawarga -d jagawarga -c "drop schema if exists drizzle cascade;"
	cd server && bun run db:migrate && bun run seed

verify:        ## verifikasi end-to-end MVP
	./scripts/verify-mvp.sh

# --- Image lokal (dites di mesin ini) ---
images: image-api image-web

image-api:
	docker buildx build --load --platform $(PLATFORM) $(BUILD_ARGS) \
		-t $(IMAGE_API):$(VERSION) -t $(IMAGE_API):latest ./server

image-web:
	docker buildx build --load --platform $(PLATFORM) $(BUILD_ARGS) \
		-t $(IMAGE_WEB):$(VERSION) -t $(IMAGE_WEB):latest \
		-f deploy/Dockerfile.edge .

# --- Publish ke registry (docker login dulu) ---
publish: publish-api publish-web

publish-api:
	docker buildx build --push --platform $(PUSH_PLATFORMS) $(BUILD_ARGS) \
		-t $(IMAGE_API):$(VERSION) -t $(IMAGE_API):latest ./server

publish-web:
	docker buildx build --push --platform $(PUSH_PLATFORMS) $(BUILD_ARGS) \
		-t $(IMAGE_WEB):$(VERSION) -t $(IMAGE_WEB):latest \
		-f deploy/Dockerfile.edge .

# --- Compose produksi (menarik image dari registry) ---
prod-up:
	docker compose -f docker-compose.prod.yml pull
	docker compose -f docker-compose.prod.yml up -d
	docker compose -f docker-compose.prod.yml run --rm api bun src/db/migrate.ts

prod-down:
	docker compose -f docker-compose.prod.yml down

prod-migrate:
	docker compose -f docker-compose.prod.yml run --rm api bun src/db/migrate.ts

clean:
	rm -rf data/media/* server/node_modules app/build web/dist
