#!/bin/bash
# Build & Deploy Script for Obsidian Slack Formatter Plugin

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ** IMPORTANT: Set your Obsidian vault plugin directory here **
PLUGIN_DIR="$HOME/Documents/Alex's Messy Mind/.obsidian/plugins/obsidian-slack-formatter"

# Project directory (should be correct if running from project root)
PROJECT_DIR="$(pwd)"

# Function to check the last command status
check_status() {
    if [ $? -ne 0 ]; then
        echo -e "${RED}$1 failed${NC}"
        exit 1
    else
        echo -e "${GREEN}$1 completed successfully${NC}"
    fi
}

# Function to ensure directory exists
ensure_dir_exists() {
    if [ ! -d "$1" ]; then
        echo -e "${YELLOW}Creating directory: $1${NC}"
        mkdir -p "$1"
    fi
}

# Main script
echo -e "${BLUE}=== Obsidian Slack Formatter Build & Deploy Script ===${NC}"
echo "Plugin will be installed to: ${PLUGIN_DIR}"

# Navigate to project directory
cd "$PROJECT_DIR" || { echo -e "${RED}Cannot navigate to $PROJECT_DIR${NC}"; exit 1; }

# Clean install
echo -e "${BLUE}Step 1: Clean installation of dependencies${NC}"
echo "Removing node_modules and package-lock.json..."
rm -rf node_modules package-lock.json
check_status "Clean removal"

echo "Installing dependencies..."
npm install
check_status "Dependency installation"

# Build the project
echo -e "${BLUE}Step 2: Building the project${NC}"
npm run build
check_status "Build"

# Ensure target directory exists
echo -e "${BLUE}Step 3: Preparing target directory${NC}"
ensure_dir_exists "$PLUGIN_DIR"

# Deploy files
echo -e "${BLUE}Step 4: Deploying files to plugin directory${NC}"

# Copy files to plugin directory
echo "Copying main.js..."
cp main.js "$PLUGIN_DIR/"
check_status "Copying main.js"

echo "Copying manifest.json..."
cp manifest.json "$PLUGIN_DIR/"
check_status "Copying manifest.json"

echo "Copying styles.css..."
cp styles.css "$PLUGIN_DIR/"
check_status "Copying styles.css"

echo -e "${GREEN}✓ Plugin successfully built and deployed to: $PLUGIN_DIR${NC}"
echo -e "${YELLOW}Note: Restart Obsidian or reload the plugin to see changes.${NC}"
