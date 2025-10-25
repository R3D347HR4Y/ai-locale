# 🚀 ai-locale Development Environment

Guide for setting up and using the **ai-locale** development environment.

## 📋 Prerequisites

- **Linux/macOS** (tested on WSL2)
- **curl** (for installing NVM)
- **Git** (for cloning the project)

## 🛠️ Quick Installation

### Option 1: Automatic Installation (Recommended)

```bash
# Make script executable and run installation
chmod +x install-dev.sh
./install-dev.sh
```

### Option 2: Manual Installation with Make

```bash
# Complete installation
make install

# Or quick setup
make setup
```

## 🎯 Available Commands

### Installation and Configuration

```bash
make help          # Show complete help
make install        # Complete installation (Node.js + dependencies)
make setup          # Quick setup
make clean          # Clean environment
```

### Testing

```bash
make test           # Run all tests
make test-gettext   # Test GNU gettext support specifically
make test-all       # Complete test suite
```

### Development

```bash
make dev            # Start development environment
make lint           # Check code quality
make format         # Format source code
```

## 🧪 Testing

### Automatic Testing

```bash
# Run all tests
make test

# Run specific format tests
node tests/run-format-test.js <format>

# Run comprehensive test suite
make test-all
```

### Test Coverage

- ✅ **Format parsing** - Reading all supported file formats
- ✅ **Content generation** - Creating valid files for all formats
- ✅ **Round-trip testing** - Parse → Generate → Parse
- ✅ **Multi-language support** - Managing multiple languages
- ✅ **CLI integration** - Compatibility with command-line interface

## 📁 Project Structure

```
ai-locale/
├── src/
│   ├── cli.js                 # Main CLI interface
│   ├── services/              # Translation services
│   └── utils/
│       └── fileParser.js      # Parsers for all formats
├── test-batch/               # Test files
│   ├── en/
│   │   └── messages.json     # JSON test
│   └── fr/
│       └── messages.json     # JSON test
├── tests/
│   ├── fixtures/             # Test fixtures
│   └── formats/              # Format-specific tests
├── Makefile                  # Development commands
├── install-dev.sh           # Automatic installation script
└── DEV.md                   # This guide
```

## 🔧 Supported Formats

| Format | Extension | Parser | Generator | Status |
|--------|-----------|--------|------------|--------|
| iOS .strings | `.strings` | ✅ | ✅ | Stable |
| Android XML | `.xml` | ✅ | ✅ | Stable |
| JSON | `.json` | ✅ | ✅ | Stable |
| TypeScript/JS | `.ts`, `.js` | ✅ | ✅ | Stable |
| **GNU gettext .po** | **`.po`** | **✅** | **✅** | **New!** |

## 🚀 Development Workflow

### 1. Initial Setup

```bash
# Clone the project
git clone <repository-url>
cd ai-locale

# Automatic installation
./install-dev.sh
```

### 2. Development

```bash
# Start development environment
make dev

# Test modifications
make test-gettext

# Check code quality
make lint
```

### 3. Testing and Validation

```bash
# Complete tests
make test-all

# Specific format test
node tests/run-format-test.js <format>

# CLI test
source ~/.nvm/nvm.sh && nvm use 18.17.0 && node src/cli.js validate "test-batch/#locale/messages.json" --source en
```

## 🐛 Troubleshooting

### Common Issues

1. **Node.js not found**
   ```bash
   source ~/.nvm/nvm.sh
   nvm use 18.17.0
   ```

2. **Permission denied**
   ```bash
   chmod +x install-dev.sh
   chmod +x tests/run-format-test.js
   ```

3. **Missing dependencies**
   ```bash
   make clean
   make install
   ```

### Debug Logs

```bash
# Verbose mode for tests
NODE_ENV=development node tests/run-format-test.js <format>

# CLI debug
node src/cli.js validate "test-batch/#locale/messages.json" --source en --verbose
```

## 📚 Resources

- [ai-locale Documentation](../README.md)
- [Node.js Documentation](https://nodejs.org/docs/)
- [NVM Documentation](https://github.com/nvm-sh/nvm)

## 🤝 Contributing

1. Fork the project
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit changes (`git commit -am 'Add your feature'`)
4. Push to branch (`git push origin feature/your-feature`)
5. Create a Pull Request

## 📄 License

MIT License - see [LICENSE](../LICENSE) file for details.

---

**🎉 Congratulations!** You now have a complete development environment for **ai-locale**!