.PHONY: install format lint test clean run help dev-install ts-compile ts-watch ts-clean

# Variables
PYTHON = python
POETRY = poetry
RUFF = ruff
CLASP = clasp

# Default target
help:
	@echo "Available commands:"
	@echo "  install     - Install dependencies using Poetry"
	@echo "  dev-install - Install development dependencies"
	@echo "  format      - Format code using ruff"
	@echo "  lint        - Lint code using ruff"
	@echo "  lint-fix    - Lint and fix code using ruff"
	@echo "  test        - Run tests"
	@echo "  clean       - Clean up generated files"
	@echo "  run         - Run the server"
	@echo "  build       - Build the project"
	@echo "  docker-build - Build Docker image"
	@echo "  docker-run  - Run Docker container"
	@echo ""
	@echo "Clasp commands (Google Apps Script):"
	@echo "  clasp-login  - Login to Google Apps Script"
	@echo "  clasp-create - Create new Apps Script project"
	@echo "  clasp-push   - Push code to Apps Script"
	@echo "  clasp-pull   - Pull code from Apps Script"
	@echo "  clasp-deploy - Deploy Apps Script"
	@echo "  clasp-open   - Open Apps Script in browser"
	@echo "  clasp-list   - List Apps Script projects"
	@echo "  clasp-clone  - Clone existing Apps Script"
	@echo "  clasp-watch  - Watch and auto-push changes"
	@echo ""
	@echo "TypeScript commands:"
	@echo "  ts-compile   - Compile TypeScript to JavaScript"
	@echo "  ts-watch     - Watch TypeScript files and auto-compile"
	@echo "  ts-clean     - Clean compiled JavaScript files"

# Install dependencies
install:
	$(POETRY) install --no-dev

# Install development dependencies
dev-install:
	$(POETRY) install

# Format code
format:
	$(POETRY) run ruff format .

# Lint code
lint:
	$(POETRY) run ruff check .

# Lint and fix code
lint-fix:
	$(POETRY) run ruff check --fix .

# Run tests
test:
	$(POETRY) run python -m pytest test_cli.py -v

# Clean up generated files
clean:
	find . -type f -name "*.pyc" -delete
	find . -type d -name "__pycache__" -delete
	find . -type d -name "*.egg-info" -exec rm -rf {} +
	find . -type f -name "*.log" -delete
	rm -rf .pytest_cache/
	rm -rf .coverage
	rm -rf htmlcov/
	rm -rf dist/
	rm -rf build/

# Run the server
run:
	$(POETRY) run python server.py

# Run with uvicorn (alternative)
run-uvicorn:
	$(POETRY) run uvicorn server:app --reload --host 127.0.0.1 --port 8000

# Build the project
build:
	$(POETRY) build

# Docker commands
docker-build:
	docker build -t nolang-bot .

docker-run:
	docker-compose up

docker-down:
	docker-compose down

# Development workflow
dev: dev-install format lint-fix test

# CI workflow
ci: install lint test

# Full check before commit
check: format lint test
	@echo "All checks passed!"

# Setup project (initial setup)
setup:
	@echo "Setting up NoLang Bot..."
	@if [ ! -f "sa.json" ]; then \
		echo "Warning: sa.json not found. Using sample data."; \
	fi
	$(POETRY) run python embed.py
	@echo "Setup complete! Run 'make run' to start the server."

# Clasp commands (Google Apps Script)
clasp-login:
	npx $(CLASP) login

clasp-create:
	npx $(CLASP) create --type standalone

clasp-push:
	npx $(CLASP) push

clasp-pull:
	npx $(CLASP) pull

clasp-deploy:
	npx $(CLASP) deploy

clasp-open:
	npx $(CLASP) open

clasp-list:
	npx $(CLASP) list

clasp-clone:
	npx $(CLASP) clone

clasp-watch:
	npx $(CLASP) push --watch

# TypeScript commands
ts-compile:
	npx tsc --target es2015 --module commonjs

ts-watch:
	npx tsc --target es2015 --module commonjs --watch

ts-clean:
	rm -rf js/*.js js/*.d.ts js/*.js.map 