.PHONY: install format lint test clean help dev-install ts-compile ts-watch ts-clean

# Variables
PYTHON = python
POETRY = poetry
RUFF = ruff
CLASP_PROJECT ?= form
CLASP_DIR := clasp/$(CLASP_PROJECT)

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
	$(POETRY) run python -m pytest -v

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

# Clasp commands (Google Apps Script)
clasp-login:
	npx clasp login

clasp-push:
	cd $(CLASP_DIR) && npx clasp push
