# Repository Cleanup Plan

## Audit Results

### Files to Delete (Local Only - Never Committed)

#### Debug Files (Root Level)
- `debug-boundary-detection.ts`
- `debug-clay-detection.js`
- `debug-clay-differentiation.js`
- `debug-clay-parsing.js`
- `debug-clay-regression.cjs`
- `debug-exact-test.js`
- `debug-message-count.cjs`
- `debug-owen-boundary-test.js`
- `debug-owen-splitting.js`
- `debug-section-header.js`
- `debug-simple-clay.js`
- `debug-timestamp-boundaries.js`

#### Test Files (Root Level)
- `clay-formatting-verification.cjs`
- `test-clay-format-result.md`
- `test-clay-formatting.cjs`
- `test-clay-formatting.js`
- `test-clay-formatting.ts`
- `test-context-detection.js`
- `test-detailed-debug.ts`
- `test-owen-boundary.ts`
- `test-owen-specific.js`
- `test-production-output.cjs`
- `test-raw-conversation.txt`

#### Report Files (Temporary Documentation)
- `COMPREHENSIVE_PIPELINE_VALIDATION_REPORT.md`
- `FINAL_INTEGRATION_REPORT.md`
- `GROUP_E_VALIDATION_REPORT.md`
- `IMPLEMENTATION_REPORT.md`
- `PERFORMANCE_OPTIMIZATION_REPORT.md`
- `REGRESSION_FIX_REPORT.md`
- `TESTING_VALIDATION_REPORT.md`
- `pipeline-validation-summary.md`

#### Compiled JS Files (Should Be Generated, Not Tracked)
- `src/formatter/processors/*.js` (keep .ts files)
- `src/formatter/stages/*.js` (keep .ts files)
- `src/formatter/strategies/*.js` (keep .ts files)
- `src/utils/*.js` (keep .ts files)
- `src/types/*.js` (keep .ts files)
- `src/interfaces.js`
- `src/models.js`
- `src/settings.js`

#### Test Files That Should Be Organized
- Multiple duplicate test files in `tests/unit/` and `tests/integration/`
- Clay-specific test files that appear to be debugging remnants

### Files Already Staged for Deletion (Commit the Deletions)
- `test-result.md`
- `test-slack-conversation.txt`
- Various debug test files in `tests/unit/`

### .gitignore Improvements
✅ **COMPLETED** - Added patterns to prevent future cruft:
- Debug files: `debug-*`
- Test files: `test-*`
- Clay formatting files: `clay-formatting-*`
- Generated JS from TS: `src/**/*.js`
- Report files: `*REPORT.md`, etc.

## Cleanup Actions

### Phase 1: Local Cleanup
1. Remove all debug files from root
2. Remove all test files from root
3. Remove all report markdown files
4. Remove generated JS files from src/
5. Clean up redundant test files

### Phase 2: Git Cleanup
1. Commit the deletions that are already staged
2. Add and commit .gitignore improvements
3. Test that cleaned files are now ignored

### Phase 3: Verification
1. Verify git status is clean
2. Verify build still works
3. Verify tests still pass
4. Check that main.js is still built correctly

## Preserved Files
- `scripts/*.js` - Legitimate build/test scripts
- `main.js` - Final built output (ignored but can exist)
- All `.ts` source files
- All legitimate test files in `tests/` directory
- `README.md`, `SPEC.md`, `CLAUDE.md` - New documentation

## Post-Cleanup Verification Commands
```bash
npm run build    # Should work
npm test         # Should pass
git status       # Should be clean
```