#!/bin/bash

# Branch Cleanup Script
# Deletes all stale branches that add back removed over-engineering

set -e

echo "========================================"
echo "Branch Cleanup Script"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}⚠️  WARNING: This will delete 5 branches${NC}"
echo ""
echo "Branches to be deleted:"
echo "  1. claude/plugin-submission-review-011CUqaF5euiENzD68rsBQyo (already merged)"
echo "  2. claude/review-pr-comments-slack-plugin-011CUqG2WqGxnDJuYg3Dhc5i (adds back bloat)"
echo "  3. cleanup/remove-js-cruft (adds 10k lines of bloat)"
echo "  4. codex/fix-issue-with-slack-formatter (adds 17k lines of bloat)"
echo "  5. codex/implement-suggestions-from-pr-review (adds 2k lines of bloat)"
echo ""
echo -e "${GREEN}Branch to keep:${NC}"
echo "  • claude/version-bump-1.1.3-011CUqaF5euiENzD68rsBQyo (needs to be merged)"
echo ""

read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo -e "${RED}Aborted.${NC}"
    exit 1
fi

echo ""
echo "Starting cleanup..."
echo ""

# Array of branches to delete
branches=(
    "claude/plugin-submission-review-011CUqaF5euiENzD68rsBQyo"
    "claude/review-pr-comments-slack-plugin-011CUqG2WqGxnDJuYg3Dhc5i"
    "cleanup/remove-js-cruft"
    "codex/fix-issue-with-slack-formatter"
    "codex/implement-suggestions-from-pr-review"
)

# Delete local branches
echo "Step 1: Deleting local branches..."
for branch in "${branches[@]}"; do
    if git show-ref --verify --quiet refs/heads/$branch; then
        echo -e "  ${GREEN}✓${NC} Deleting local: $branch"
        git branch -D $branch 2>/dev/null || echo -e "    ${YELLOW}(already deleted)${NC}"
    else
        echo -e "  ${YELLOW}○${NC} Local branch not found: $branch"
    fi
done

echo ""
echo "Step 2: Deleting remote branches..."
for branch in "${branches[@]}"; do
    if git ls-remote --exit-code --heads origin $branch >/dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} Deleting remote: $branch"
        git push origin --delete $branch 2>/dev/null || echo -e "    ${YELLOW}(already deleted or no permission)${NC}"
    else
        echo -e "  ${YELLOW}○${NC} Remote branch not found: $branch"
    fi
done

echo ""
echo "Step 3: Pruning stale tracking branches..."
git fetch --all --prune

echo ""
echo "========================================"
echo -e "${GREEN}✅ Cleanup Complete!${NC}"
echo "========================================"
echo ""
echo "Remaining branches:"
git branch -a | grep -E '(main|version-bump)' || true

echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Create PR for claude/version-bump-1.1.3-011CUqaF5euiENzD68rsBQyo"
echo "  2. Merge to main"
echo "  3. Create tag v1.1.3"
echo "  4. Create GitHub release"
echo ""
