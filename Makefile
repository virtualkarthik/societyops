.PHONY: up down migrate seed logs test shell-backend shell-db lint

up:
	docker compose up -d --build

down:
	docker compose down

migrate:
	docker compose exec societyops-backend alembic upgrade head

seed:
	docker compose exec societyops-backend python seed.py

logs:
	docker compose logs -f

logs-backend:
	docker compose logs -f societyops-backend

logs-frontend:
	docker compose logs -f societyops-frontend

test:
	docker compose exec societyops-backend pytest -v

shell-backend:
	docker compose exec societyops-backend bash

shell-db:
	docker compose exec societyops-db psql -U societyops societyops

# For local dev without Docker
dev-backend:
	cd backend && uvicorn app.main:app --reload --port 8000

dev-frontend:
	cd frontend && npm run dev

lint-backend:
	cd backend && ruff check app/ && mypy app/

lint-frontend:
	cd frontend && npm run typecheck
