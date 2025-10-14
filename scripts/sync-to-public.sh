#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
PRIVATE_REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PUBLIC_REPO_DIR="${PUBLIC_REPO_DIR:-/Users/cwolff/Code/lattice-plugins}"
PLUGINS=("core" "plugin-express" "plugin-nextjs")

echo -e "${BLUE}🔄 Syncing Lattice plugins to public repository${NC}"
echo ""

# Check if public repo exists
if [ ! -d "$PUBLIC_REPO_DIR" ]; then
    echo -e "${RED}❌ Public repository not found at: $PUBLIC_REPO_DIR${NC}"
    echo "Cloning lattice-plugins..."
    cd "$(dirname "$PUBLIC_REPO_DIR")"
    git clone git@github.com:Lattice-Black/lattice-plugins.git
    cd "$PUBLIC_REPO_DIR"
else
    echo -e "${GREEN}✓ Found public repository at: $PUBLIC_REPO_DIR${NC}"
fi

# Navigate to public repo
cd "$PUBLIC_REPO_DIR"

# Ensure we're on main branch and up to date
echo ""
echo "Updating public repository..."
git checkout main
git pull origin main

# Sync each plugin package
echo ""
for plugin in "${PLUGINS[@]}"; do
    echo -e "${BLUE}Syncing $plugin...${NC}"

    SOURCE_DIR="$PRIVATE_REPO_DIR/packages/$plugin"
    TARGET_DIR="$PUBLIC_REPO_DIR/packages/$plugin"

    if [ ! -d "$SOURCE_DIR" ]; then
        echo -e "${RED}⚠️  Source directory not found: $SOURCE_DIR${NC}"
        continue
    fi

    # Create target directory if it doesn't exist
    mkdir -p "$TARGET_DIR"

    # Sync files (excluding node_modules and dist)
    rsync -av --delete \
        --exclude 'node_modules' \
        --exclude 'dist' \
        --exclude '.turbo' \
        --exclude '*.log' \
        "$SOURCE_DIR/" "$TARGET_DIR/"

    echo -e "${GREEN}✓ Synced $plugin${NC}"
done

# Sync root files
echo ""
echo -e "${BLUE}Syncing root configuration files...${NC}"
rsync -av \
    "$PRIVATE_REPO_DIR/.github/workflows/publish-plugins.yml" \
    "$PUBLIC_REPO_DIR/.github/workflows/publish-plugins.yml"

# Check if there are changes
if [ -z "$(git status --porcelain)" ]; then
    echo ""
    echo -e "${GREEN}✓ No changes to sync${NC}"
    exit 0
fi

# Show changes
echo ""
echo -e "${BLUE}Changes to be committed:${NC}"
git status --short

# Commit and push
echo ""
read -p "Do you want to commit and push these changes? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Get commit message from latest commit in private repo
    cd "$PRIVATE_REPO_DIR"
    LAST_COMMIT_MSG=$(git log -1 --pretty=%B)

    cd "$PUBLIC_REPO_DIR"
    git add -A
    git commit -m "Sync from private repo: $LAST_COMMIT_MSG"
    git push origin main

    echo ""
    echo -e "${GREEN}✅ Successfully synced to public repository${NC}"
    echo -e "${GREEN}🌐 View at: https://github.com/Lattice-Black/lattice-plugins${NC}"
else
    echo ""
    echo -e "${BLUE}Changes staged but not committed${NC}"
    echo "You can commit manually with:"
    echo "  cd $PUBLIC_REPO_DIR"
    echo "  git commit -m 'Your message'"
    echo "  git push origin main"
fi
