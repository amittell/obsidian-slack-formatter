# Regex Operations Requiring Try-Catch Blocks

## Critical Fixes Needed

### 1. Array Bounds Issue (Line 468)
```typescript
// Current (UNSAFE):
const prevLine = allLines[currentIndex - 1];

// Should validate index first
```

### 2. Unicode Regex Operations (HIGH PRIORITY)
These can crash with malformed Unicode:

**Line 449 - hasEmojiPattern():**
```typescript
return /:\w+:|[\u{1F300}-\u{1F9FF}]|!\[:[\w-]+:\]/u.test(text);
```

**Line 457 - hasReactionPattern():**
```typescript
return /^[\u{1F300}-\u{1F9FF}]\s*\d+$|^:\w+:\s*\d+$/u.test(text);
```

**Line 918 - parseReaction():**
```typescript
const match = text.match(/^([\u{1F300}-\u{1F9FF}]|:\w+:)\s*(\d+)$/u);
```

### 3. Dynamic Regex Operations
**Line 279 - isObviousMetadata():**
```typescript
return metadataPatterns.some(pattern => pattern.test(text));
```

### 4. Complex Pattern Matching (Lines 715-741)
All the timestamp extraction patterns in identifyTimestampFormats():
- Line 715: Time with AM/PM
- Line 721: Linked timestamps  
- Line 727: Bracketed time
- Line 733: Date patterns
- Line 739: Relative dates

### 5. Username Extraction (Lines 868-886)
Three different match operations in extractUserAndTime():
- Line 868: Doubled username pattern
- Line 877: Simple username pattern
- Line 886: Username + time pattern

### 6. Character Class Patterns
**Line 144:** `/^[A-Z]/.test(trimmed)`
**Line 145:** `/\d/.test(trimmed)`
**Line 147:** `/[!@#$%^&*(),.?":{}|<>]/.test(trimmed)`

### 7. Validation Patterns
**Line 260:** `/^[A-Za-z0-9\-_.]+$/.test(word)`
**Line 695-698:** Username validation tests
**Line 905:** Username format test

### 8. Content Detection Patterns
**Line 437:** Timestamp detection (very long pattern)
**Line 441:** URL detection
**Line 445:** User mention detection
**Line 453:** Avatar detection
**Line 462:** User-timestamp combination
**Line 929:** Thread info detection

### 9. String Operations with Regex
**Line 257:** `text.split(/\s+/)`
**Line 914:** `text.replace(/[^\w\s\-_.]/g, '')`
**Line 921:** `(match[1] || '').replace(/:/g, '')`

## Total Count: 31 unprotected regex operations

## Additional Array Access Issues
Besides line 468, check:
- Line 632-633: Loop iteration with array access
- Any other places where indices are calculated dynamically