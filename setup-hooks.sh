#!/bin/bash

# Setup script for lean CI/CD git hooks
# One-time setup to enable local pre-commit validation
# Part of dual-layer CI strategy for cost-effective development

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Setting up lean CI/CD git hooks...${NC}"

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Not in a git repository${NC}"
    echo -e "${YELLOW}💡 Make sure you're in the root of your git project${NC}"
    exit 1
fi

# Check if .githooks directory exists
if [ ! -d ".githooks" ]; then
    echo -e "${RED}❌ Error: .githooks directory not found${NC}"
    echo -e "${YELLOW}💡 Make sure .githooks directory exists with pre-commit hook${NC}"
    exit 1
fi

# Check if pre-commit hook exists
if [ ! -f ".githooks/pre-commit" ]; then
    echo -e "${RED}❌ Error: .githooks/pre-commit not found${NC}"
    echo -e "${YELLOW}💡 Make sure pre-commit hook exists in .githooks directory${NC}"
    exit 1
fi

# Make sure pre-commit hook is executable
chmod +x .githooks/pre-commit
echo -e "${GREEN}✅ Made pre-commit hook executable${NC}"

# Configure git to use .githooks directory
echo -e "${BLUE}📝 Configuring git hooks path...${NC}"
git config core.hooksPath .githooks

# Verify the configuration
HOOKS_PATH=$(git config core.hooksPath)
if [ "$HOOKS_PATH" = ".githooks" ]; then
    echo -e "${GREEN}✅ Git hooks path configured successfully${NC}"
else
    echo -e "${RED}❌ Failed to configure git hooks path${NC}"
    exit 1
fi

# Test the pre-commit hook
echo -e "${BLUE}🧪 Testing pre-commit hook...${NC}"
if [ -x ".githooks/pre-commit" ]; then
    echo -e "${GREEN}✅ Pre-commit hook is executable${NC}"
else
    echo -e "${RED}❌ Pre-commit hook is not executable${NC}"
    exit 1
fi

# Check for required dependencies
echo -e "${BLUE}🔍 Checking dependencies...${NC}"

# Check for Node.js and npm
if command -v node &> /dev/null && command -v npm &> /dev/null; then
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✅ Node.js ${NODE_VERSION} and npm ${NPM_VERSION} found${NC}"
else
    echo -e "${YELLOW}⚠️  Node.js/npm not found - some checks may be skipped${NC}"
fi

# Check for package.json
if [ -f "package.json" ]; then
    echo -e "${GREEN}✅ package.json found${NC}"
    
    # Check if Prettier is available
    if npm list prettier &> /dev/null || npm list --global prettier &> /dev/null; then
        echo -e "${GREEN}✅ Prettier is available${NC}"
    else
        echo -e "${YELLOW}⚠️  Prettier not found - consider adding it for code formatting${NC}"
        echo -e "${YELLOW}💡 Run: npm install --save-dev prettier${NC}"
    fi
    
    # Check for TypeScript
    if [ -f "tsconfig.json" ]; then
        echo -e "${GREEN}✅ TypeScript configuration found${NC}"
    else
        echo -e "${YELLOW}ℹ️  No TypeScript configuration found${NC}"
    fi
    
    # Check for ESLint
    if [ -f ".eslintrc.js" ] || [ -f ".eslintrc.json" ] || [ -f "eslint.config.js" ]; then
        echo -e "${GREEN}✅ ESLint configuration found${NC}"
    else
        echo -e "${YELLOW}ℹ️  No ESLint configuration found${NC}"
    fi
    
else
    echo -e "${YELLOW}ℹ️  No package.json found${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Git hooks setup completed successfully!${NC}"
echo ""
echo -e "${BLUE}📋 What happens now:${NC}"
echo -e "  • Pre-commit hook will run automatically before each commit"
echo -e "  • It checks code formatting, TypeScript compilation, and runs quick tests"
echo -e "  • Failed checks will prevent commits (keeping your git history clean)"
echo -e "  • This saves GitHub Actions minutes by catching issues locally"
echo ""
echo -e "${BLUE}💡 Pro tips:${NC}"
echo -e "  • Add 'test:quick' script to package.json for faster pre-commit tests"
echo -e "  • Run 'npm run format' to fix formatting issues automatically"
echo -e "  • Use 'git commit --no-verify' to skip hooks in emergencies"
echo ""
echo -e "${BLUE}🔄 To disable hooks later:${NC}"
echo -e "  git config --unset core.hooksPath"
echo ""
echo -e "${GREEN}Happy coding! 🚀${NC}"