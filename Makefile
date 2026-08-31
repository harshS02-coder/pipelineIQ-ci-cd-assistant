# Makefile for LLM DevOps Assistant

.PHONY: help install dev prod test lint format clean docker-build docker-up docker-down

help:
	@echo "LLM DevOps Assistant - Available Commands"
	@echo "=========================================="
	@echo "Development:"
	@echo "  make install      - Install dependencies"
	@echo "  make dev          - Start development server"
	@echo "  make test         - Run tests"
	@echo "  make lint         - Run ESLint"
	@echo "  make format       - Format code with Prettier"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-build - Build Docker image"
	@echo "  make docker-up    - Start Docker containers"
	@echo "  make docker-down  - Stop Docker containers"
	@echo "  make docker-logs  - View Docker logs"
	@echo ""
	@echo "Utilities:"
	@echo "  make clean        - Clean up build artifacts"
	@echo "  make db-reset     - Reset database (development)"

install:
	cd backend && npm install

dev:
	cd backend && npm run dev

prod:
	cd backend && npm start

test:
	cd backend && npm test

test-watch:
	cd backend && npm run test:watch

lint:
	cd backend && npm run lint

format:
	cd backend && npm run format

clean:
	rm -rf backend/node_modules
	rm -rf backend/dist
	rm -rf backend/coverage
	find . -name '*.log' -delete

docker-build:
	docker build -t llm-devops-api:latest ./backend

docker-up:
	docker-compose -f backend/docker-compose.yml up -d

docker-down:
	docker-compose -f backend/docker-compose.yml down

docker-logs:
	docker-compose -f backend/docker-compose.yml logs -f

docker-ps:
	docker-compose -f backend/docker-compose.yml ps

db-reset:
	docker-compose -f backend/docker-compose.yml exec mongodb mongosh -u root -p password admin --eval "db.dropDatabase()"

shell:
	docker-compose -f backend/docker-compose.yml exec api sh

health:
	curl http://localhost:3000/health -s | jq .

.env:
	cp backend/.env.example backend/.env
	@echo "✅ Created .env file. Please update with your settings."

setup: install .env docker-build docker-up
	@echo "✅ Setup complete! API available at http://localhost:3000"
