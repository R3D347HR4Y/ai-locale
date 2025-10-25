#!/bin/bash

# ai-locale Development Environment Installer
# ===========================================

set -e  # Exit on any error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NODE_VERSION="18.17.0"
NVM_DIR="$HOME/.nvm"
VENV_DIR="venv"

echo -e "${BLUE}🚀 ai-locale Development Environment Installer${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}📦 $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if running on supported system
check_system() {
    print_info "Checking system requirements..."
    
    if ! command -v curl &> /dev/null; then
        print_error "curl is required but not installed"
        exit 1
    fi
    
    if ! command -v python3 &> /dev/null; then
        print_error "python3 is required but not installed"
        exit 1
    fi
    
    print_status "System requirements met"
}

# Install NVM and Node.js
install_node() {
    print_info "Installing Node.js $NODE_VERSION via NVM..."
    
    # Install NVM if not present
    if [ ! -d "$NVM_DIR" ]; then
        print_info "Installing NVM..."
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
        
        # Add NVM to shell profile
        echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.bashrc
        echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"' >> ~/.bashrc
        echo '[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"' >> ~/.bashrc
        
        # Source NVM for current session
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    fi
    
    # Install and use Node.js
    source ~/.bashrc 2>/dev/null || true
    if [ -s "$NVM_DIR/nvm.sh" ]; then
        source "$NVM_DIR/nvm.sh"
        nvm install $NODE_VERSION
        nvm use $NODE_VERSION
        nvm alias default $NODE_VERSION
    fi
    
    print_status "Node.js $NODE_VERSION installed"
}

# Install Python virtual environment (optional, for Python development only)
install_python() {
    print_info "Python environment is optional for ai-locale..."
    print_info "ai-locale only needs Node.js to parse and translate .po files"
    print_status "Skipping Python installation (not required)"
}

# Install project dependencies
install_dependencies() {
    print_info "Installing project dependencies..."
    
    # Source NVM and install Node.js dependencies
    if [ -s "$NVM_DIR/nvm.sh" ]; then
        source "$NVM_DIR/nvm.sh"
        nvm use $NODE_VERSION
        npm install
    else
        print_error "NVM not found, cannot install Node.js dependencies"
        exit 1
    fi
    
    print_status "Node.js dependencies installed"
}

# Create test files
create_test_files() {
    print_info "Creating test files..."
    
    # Create test directories
    mkdir -p test-batch/en test-batch/fr
    
    # Create English GNU gettext .po file
    cat > test-batch/en/messages.po << 'EOF'
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\n"
"Content-Transfer-Encoding: 8bit\n"
"Language: en\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\n"

msgid "Welcome"
msgstr "Welcome"

msgid "Hello %(name)s"
msgstr "Hello %(name)s"

msgid "Save"
msgstr "Save"

msgid "Cancel"
msgstr "Cancel"

msgid "Error occurred"
msgstr "Error occurred"
EOF

    # Create French GNU gettext .po file
    cat > test-batch/fr/messages.po << 'EOF'
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\n"
"Content-Transfer-Encoding: 8bit\n"
"Language: fr\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\n"

msgid "Welcome"
msgstr "Bienvenue"

msgid "Hello %(name)s"
msgstr "Bonjour %(name)s"

msgid "Save"
msgstr "Enregistrer"

msgid "Cancel"
msgstr "Annuler"

msgid "Error occurred"
msgstr "Une erreur s'est produite"
EOF

    print_status "Test files created"
}

# Run tests
run_tests() {
    print_info "Running GNU gettext support tests..."
    
    # Source NVM and run tests
    if [ -s "$NVM_DIR/nvm.sh" ]; then
        source "$NVM_DIR/nvm.sh"
        nvm use $NODE_VERSION
        
        # Run the GNU gettext test using the integrated test runner
        node tests/run-format-test.js gettext
        
        print_status "GNU gettext support tests completed"
    else
        print_error "NVM not found, cannot run tests"
        exit 1
    fi
}

# Main installation process
main() {
    echo -e "${BLUE}Starting installation...${NC}"
    echo ""
    
    check_system
    install_node
    install_python
    install_dependencies
    create_test_files
    run_tests
    
    echo ""
    echo -e "${GREEN}🎉 Installation completed successfully!${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "  make test-gettext - Test GNU gettext support specifically"
    echo "  make test-all     - Run comprehensive test suite"
    echo "  make dev          - Start development environment"
    echo ""
    echo -e "${YELLOW}CLI usage examples:${NC}"
    echo "  source ~/.nvm/nvm.sh && nvm use $NODE_VERSION && node src/cli.js validate 'test-batch/#locale/messages.po' --source en"
    echo "  source ~/.nvm/nvm.sh && nvm use $NODE_VERSION && node src/cli.js stats 'test-batch/#locale/messages.po'"
    echo ""
    echo -e "${GREEN}Happy coding! 🚀${NC}"
}

# Run main function
main "$@"
