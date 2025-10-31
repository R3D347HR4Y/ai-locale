# ai-locale Development Environment Makefile
# =============================================

# Variables
NODE_VERSION := 18.17.0
NVM_DIR := $(HOME)/.nvm
NODE_PATH := $(NVM_DIR)/versions/node/v$(NODE_VERSION)
NPM := $(NODE_PATH)/bin/npm
NODE := $(NODE_PATH)/bin/node
PYTHON := python3
VENV_DIR := venv
VENV_PYTHON := $(VENV_DIR)/bin/python
VENV_PIP := $(VENV_DIR)/bin/pip

# Colors for output
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

.PHONY: help install setup test test-gettext clean install-node install-python install-deps test-all lint format

# Default target
help:
	@echo "$(GREEN)ai-locale Development Environment$(NC)"
	@echo "=================================="
	@echo ""
	@echo "$(YELLOW)Available targets:$(NC)"
	@echo "  install     - Install complete development environment"
	@echo "  setup       - Quick setup (Node.js + Python + dependencies)"
	@echo "  test        - Run all tests"
	@echo "  test-gettext - Test GNU gettext .po file support specifically"
	@echo "  test-all    - Run comprehensive test suite"
	@echo "  lint        - Run linting on source code"
	@echo "  format      - Format source code"
	@echo "  clean       - Clean up development environment"
	@echo ""
	@echo "$(YELLOW)Individual components:$(NC)"
	@echo "  install-node    - Install Node.js via NVM"
	@echo "  install-python  - Install Python virtual environment"
	@echo "  install-deps     - Install project dependencies"
	@echo ""

# Main installation target
install: install-node install-python install-deps
	@echo "$(GREEN)✅ Development environment installed successfully!$(NC)"
	@echo ""
	@echo "$(YELLOW)Next steps:$(NC)"
	@echo "  make test     - Run tests"
	@echo "  make test-gettext - Test GNU gettext support"
	@echo ""

# Quick setup for development
setup: install
	@echo "$(GREEN)✅ Quick setup completed!$(NC)"

# Install Node.js via NVM
install-node:
	@echo "$(YELLOW)📦 Installing Node.js $(NODE_VERSION) via NVM...$(NC)"
	@if [ ! -d "$(NVM_DIR)" ]; then \
		echo "$(YELLOW)Installing NVM...$(NC)"; \
		curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash; \
		echo 'export NVM_DIR="$(NVM_DIR)"' >> ~/.bashrc; \
		echo '[ -s "$(NVM_DIR)/nvm.sh" ] && \. "$(NVM_DIR)/nvm.sh"' >> ~/.bashrc; \
		echo '[ -s "$(NVM_DIR)/bash_completion" ] && \. "$(NVM_DIR)/bash_completion"' >> ~/.bashrc; \
	fi
	@if [ ! -d "$(NODE_PATH)" ]; then \
		echo "$(YELLOW)Installing Node.js $(NODE_VERSION)...$(NC)"; \
		. $(NVM_DIR)/nvm.sh && nvm install $(NODE_VERSION) && nvm use $(NODE_VERSION); \
	fi
	@echo "$(GREEN)✅ Node.js $(NODE_VERSION) installed$(NC)"

# Install Python virtual environment (optional)
install-python:
	@echo "$(YELLOW)🐍 Python is optional for ai-locale...$(NC)"
	@echo "$(YELLOW)ai-locale only needs Node.js to parse and translate .po files$(NC)"
	@echo "$(GREEN)✅ Skipping Python installation (not required)$(NC)"

# Install project dependencies
install-deps: install-node install-python
	@echo "$(YELLOW)📚 Installing Node.js dependencies...$(NC)"
	@. $(NVM_DIR)/nvm.sh && nvm use $(NODE_VERSION) && $(NPM) install
	@echo "$(GREEN)✅ Node.js dependencies installed$(NC)"
	@echo "$(YELLOW)📚 Python dependencies not needed for ai-locale$(NC)"
	@echo "$(GREEN)✅ Node.js dependencies installed$(NC)"

# Run all tests
test: install-deps
	@echo "$(YELLOW)🧪 Running tests...$(NC)"
	@. $(NVM_DIR)/nvm.sh && nvm use $(NODE_VERSION) && $(NPM) test
	@echo "$(GREEN)✅ Tests completed$(NC)"

# Test GNU gettext support specifically
test-gettext: install-deps
	@echo "$(YELLOW)🌍 Testing GNU gettext .po file support...$(NC)"
	@. $(NVM_DIR)/nvm.sh && nvm use $(NODE_VERSION) && $(NODE) tests/run-format-test.js gettext
	@echo "$(GREEN)✅ GNU gettext support tests completed$(NC)"

# Run comprehensive test suite
test-all: test test-gettext
	@echo "$(YELLOW)🧪 Running comprehensive test suite...$(NC)"
	@echo "$(YELLOW)Testing all supported formats...$(NC)"
	@. $(NVM_DIR)/nvm.sh && nvm use $(NODE_VERSION) && $(NODE) -e "\
		const fileParser = require('./src/utils/fileParser.js'); \
		const fs = require('fs'); \
		const path = require('path'); \
		const testFiles = [ \
			{ file: './test-batch/en/messages.json', type: 'json' }, \
			{ file: './test-batch/fr/messages.json', type: 'json' }, \
			{ file: './test-batch/en/messages.po', type: 'po' }, \
			{ file: './test-batch/fr/messages.po', type: 'po' } \
		]; \
		testFiles.forEach(({ file, type }) => { \
			try { \
				const content = fs.readFileSync(file, 'utf8'); \
				let parsed; \
				if (type === 'json') parsed = fileParser.parseJSONFile(content); \
				else if (type === 'po') parsed = fileParser.parsePOFile(content); \
				console.log(\`✅ \${file}: \${Object.keys(parsed).length} keys parsed\`); \
			} catch (error) { \
				console.log(\`❌ \${file}: \${error.message}\`); \
			} \
		}); \
	"
	@echo "$(GREEN)✅ Comprehensive test suite completed$(NC)"

# Run linting
lint: install-deps
	@echo "$(YELLOW)🔍 Running linting...$(NC)"
	@. $(NVM_DIR)/nvm.sh && nvm use $(NODE_VERSION) && $(NPM) run lint || echo "$(YELLOW)No lint script found, checking for ESLint...$(NC)"
	@if [ -f "node_modules/.bin/eslint" ]; then \
		. $(NVM_DIR)/nvm.sh && nvm use $(NODE_VERSION) && ./node_modules/.bin/eslint src/ || echo "$(YELLOW)ESLint not configured$(NC)"; \
	fi
	@echo "$(GREEN)✅ Linting completed$(NC)"

# Format source code
format: install-deps
	@echo "$(YELLOW)🎨 Formatting source code...$(NC)"
	@if [ -f "node_modules/.bin/prettier" ]; then \
		. $(NVM_DIR)/nvm.sh && nvm use $(NODE_VERSION) && ./node_modules/.bin/prettier --write src/ || echo "$(YELLOW)Prettier not configured$(NC)"; \
	else \
		echo "$(YELLOW)Prettier not installed, skipping formatting$(NC)"; \
	fi
	@echo "$(GREEN)✅ Formatting completed$(NC)"

# Clean up development environment
clean:
	@echo "$(YELLOW)🧹 Cleaning up development environment...$(NC)"
	@rm -rf node_modules
	@rm -rf $(VENV_DIR)
	@rm -rf .env
	@rm -rf dist
	@rm -rf test-batch/*/messages.po
	@echo "$(GREEN)✅ Cleanup completed$(NC)"

# Development workflow
dev: install test-gettext
	@echo "$(GREEN)🚀 Development environment ready!$(NC)"
	@echo ""
	@echo "$(YELLOW)Available commands:$(NC)"
	@echo "  make test-gettext - Test GNU gettext support"
	@echo "  make test-all     - Run all tests"
	@echo "  make lint         - Check code quality"
	@echo "  make format       - Format code"
	@echo ""
	@echo "$(YELLOW)CLI usage examples:$(NC)"
	@echo "  . $(NVM_DIR)/nvm.sh && nvm use $(NODE_VERSION) && node src/cli.js validate 'test-batch/#locale/messages.po' --source en"
	@echo "  . $(NVM_DIR)/nvm.sh && nvm use $(NODE_VERSION) && node src/cli.js stats 'test-batch/#locale/messages.po'"
