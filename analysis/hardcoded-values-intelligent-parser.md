# Hardcoded Values in intelligent-message-parser.ts

## Analysis of hardcoded values that should be extracted to named constants

### 1. **Line Length Thresholds**
- **Line 239**: `trimmed.length < 30` - Short line threshold
- **Line 240**: `trimmed.length > 100` - Long line threshold
- **Line 243**: `trimmed.length > 3` - Minimum length for all caps check
- **Line 310**: `line.length > 10` - Minimum line length for capital start pattern
- **Line 355**: `words.length > 4` - Maximum words for username
- **Line 467**: `Math.min(3, messageLines.length)` - Maximum lines to check for metadata
- **Line 615**: `Math.min(5, patterns.messageStartCandidates.length)` - Sample size for format detection
- **Line 792**: `username.length < 2 || username.length > 50` - Username length bounds
- **Line 1008**: `text.length < 50` - Maximum timestamp text length

### 2. **Confidence Scores and Thresholds**
- **Line 412**: `b.confidence > 0.3` - Minimum boundary confidence threshold
- **Line 634**: `bracketRatio > 0.7` - Bracket format dominance threshold
- **Line 636**: `standardRatio > 0.7` - Standard format dominance threshold
- **Line 652**: `messageRatio >= 0.5 && messageRatio <= 2.0` - Message ratio confidence ranges
- **Line 654**: `messageRatio >= 0.3 && messageRatio <= 3.0` - Lower confidence message ratio
- **Line 653**: `confidence += 0.2` - Confidence increment values (appears multiple times)
- **Line 655**: `confidence += 0.1` - Lower confidence increment
- **Line 664**: `3 / patterns.timestampFormats.length` - Format consistency calculation
- **Line 694**: `0.5` - Default confidence value
- **Line 705**: `Math.abs(ts - start) <= 2` - Timestamp alignment distance
- **Line 778**: `count >= 2` - Minimum count for common usernames
- **Line 859**: `Math.abs(ts - candidateIndex) <= 2` - Nearby timestamp distance
- **Line 883**: `distance >= patterns.averageMessageLength * 0.5` - Minimum message spacing
- **Line 884**: `distance <= patterns.averageMessageLength * 2` - Maximum message spacing
- **Line 914**: `messageLength >= avgLength * 0.2 && messageLength <= avgLength * 3` - Normal message length range
- **Line 916**: `messageLength >= avgLength * 0.1 && messageLength <= avgLength * 5` - Extended message length range
- **Line 923**: `userIndex <= Math.min(start + 2, end)` - Username search window
- **Line 932**: `tsIndex <= Math.min(start + 2, end)` - Timestamp search window
- **Line 949**: `contentLines >= 1` - Minimum content lines
- **Line 959**: `message.text.length > 5` - Minimum valid message text length

### 3. **Scoring Values**
- **Line 859**: `score += 3` - Nearby timestamp score
- **Line 862**: `score += 2` - After empty line score
- **Line 869**: `score += 2` - Common username score
- **Line 872**: `score += 1` - Capital start score
- **Line 873**: `score += 1` - Short line score
- **Line 877**: `score -= 3` - Metadata penalty score
- **Line 886**: `score += 1` - Good message spacing score

### 4. **Regex Patterns (as constants)**
Several regex patterns are repeated and should be extracted:
- **Line 241**: `/^[A-Z]/` - Capital start pattern
- **Line 242**: `/\d/` - Has numbers pattern
- **Line 244**: `/[!@#$%^&*(),.?":{}|<>]/` - Special characters pattern
- **Line 357**: `/^[A-Za-z0-9\-_.]+$/` - Valid word pattern
- **Line 368-374**: Various metadata patterns array
- **Line 534**: Timestamp pattern (very long)
- **Line 542**: `/@\w+|<@[UW]\w+>|\[\[@\w+\]\]/` - User mention pattern
- **Line 546**: `/:\w+:|[\u{1F300}-\u{1F9FF}]|!\[:[\w-]+:\]/u` - Emoji pattern
- **Line 550**: `/!\[\]\(https:\/\/[^)]*slack[^)]*\)/` - Avatar pattern
- **Line 554**: `/^[\u{1F300}-\u{1F9FF}]\s*\d+$|^:\w+:\s*\d+$/u` - Reaction pattern
- **Line 559**: `/\w+.*(?:\d{1,2}:\d{2}|\[.*\].*archives)/` - User timestamp combination
- **Line 793**: `/^\d+$/` - All numbers pattern
- **Line 794-796**: Day/month name patterns
- **Line 1003**: `/^[A-Za-z][A-Za-z0-9\s\-_.]{1,30}$/` - Username pattern
- **Line 1012**: `/[^\w\s\-_.]/g` - Username cleanup pattern
- **Line 1016**: `/^([\u{1F300}-\u{1F9FF}]|:\w+:)\s*(\d+)$/u` - Reaction parsing pattern
- **Line 1027**: `/replies|thread|view thread/i` - Thread info pattern

### 5. **Array Indices and Limits**
- **Line 966-968**: Various match array indices (1, 2)
- **Line 1020**: `parseInt(match[2] || '0', 10)` - Default parse value

### 6. **String Literals**
- **Line 442**: `'Unknown User'` - Default username
- **Line 959**: `'Unknown User'` - Repeated default username

## Recommended Constants to Extract

```typescript
// Line length thresholds
const SHORT_LINE_THRESHOLD = 30;
const LONG_LINE_THRESHOLD = 100;
const MIN_ALLCAPS_LENGTH = 3;
const MIN_CAPITAL_START_LENGTH = 10;
const MAX_USERNAME_WORDS = 4;
const MAX_METADATA_SCAN_LINES = 3;
const FORMAT_DETECTION_SAMPLE_SIZE = 5;
const MIN_USERNAME_LENGTH = 2;
const MAX_USERNAME_LENGTH = 50;
const MAX_TIMESTAMP_TEXT_LENGTH = 50;

// Confidence and scoring
const MIN_BOUNDARY_CONFIDENCE = 0.3;
const FORMAT_DOMINANCE_THRESHOLD = 0.7;
const HIGH_CONFIDENCE_INCREMENT = 0.2;
const LOW_CONFIDENCE_INCREMENT = 0.1;
const DEFAULT_CONFIDENCE = 0.5;
const TIMESTAMP_ALIGNMENT_DISTANCE = 2;
const MIN_COMMON_USERNAME_COUNT = 2;
const MIN_VALID_MESSAGE_TEXT_LENGTH = 5;
const MIN_CONTENT_LINES = 1;

// Message length ratios
const MESSAGE_RATIO_HIGH_CONF_MIN = 0.5;
const MESSAGE_RATIO_HIGH_CONF_MAX = 2.0;
const MESSAGE_RATIO_LOW_CONF_MIN = 0.3;
const MESSAGE_RATIO_LOW_CONF_MAX = 3.0;
const MESSAGE_LENGTH_NORMAL_MIN_FACTOR = 0.2;
const MESSAGE_LENGTH_NORMAL_MAX_FACTOR = 3;
const MESSAGE_LENGTH_EXTENDED_MIN_FACTOR = 0.1;
const MESSAGE_LENGTH_EXTENDED_MAX_FACTOR = 5;
const MESSAGE_SPACING_MIN_FACTOR = 0.5;
const MESSAGE_SPACING_MAX_FACTOR = 2;

// Scoring values
const SCORE_NEARBY_TIMESTAMP = 3;
const SCORE_AFTER_EMPTY_LINE = 2;
const SCORE_COMMON_USERNAME = 2;
const SCORE_CAPITAL_START = 1;
const SCORE_SHORT_LINE = 1;
const SCORE_GOOD_SPACING = 1;
const PENALTY_METADATA = -3;

// Search windows
const USERNAME_SEARCH_WINDOW = 2;
const TIMESTAMP_SEARCH_WINDOW = 2;

// Default values
const DEFAULT_USERNAME = 'Unknown User';
const DEFAULT_PARSE_INT_VALUE = 0;

// Regex patterns
const REGEX_CAPITAL_START = /^[A-Z]/;
const REGEX_HAS_NUMBERS = /\d/;
const REGEX_SPECIAL_CHARS = /[!@#$%^&*(),.?":{}|<>]/;
const REGEX_VALID_WORD = /^[A-Za-z0-9\-_.]+$/;
const REGEX_ALL_NUMBERS = /^\d+$/;
const REGEX_USERNAME_CLEANUP = /[^\w\s\-_.]/g;
const REGEX_USERNAME_PATTERN = /^[A-Za-z][A-Za-z0-9\s\-_.]{1,30}$/;
const REGEX_USER_MENTION = /@\w+|<@[UW]\w+>|\[\[@\w+\]\]/;
const REGEX_EMOJI = /:\w+:|[\u{1F300}-\u{1F9FF}]|!\[:[\w-]+:\]/u;
const REGEX_AVATAR = /!\[\]\(https:\/\/[^)]*slack[^)]*\)/;
const REGEX_REACTION = /^[\u{1F300}-\u{1F9FF}]\s*\d+$|^:\w+:\s*\d+$/u;
const REGEX_REACTION_PARSE = /^([\u{1F300}-\u{1F9FF}]|:\w+:)\s*(\d+)$/u;
const REGEX_THREAD_INFO = /replies|thread|view thread/i;
const REGEX_USER_TIMESTAMP_COMBO = /\w+.*(?:\d{1,2}:\d{2}|\[.*\].*archives)/;

// Metadata patterns array
const METADATA_PATTERNS = [
    /^\d+\s+(reply|replies|files?|minutes?|hours?|days?)$/i,
    /^(View thread|Thread:|Last reply|Added by|Language|TypeScript|Last updated)$/i,
    /^:\w+:\s*\d*$/,  // Reactions
    /^\d+$/,  // Just numbers
    /^(---+|===+)$/,  // Separators
    /^https?:\/\//,  // Just URLs
];

// Day and month names
const REGEX_DAY_NAMES = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i;
const REGEX_MONTH_NAMES = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/i;
```

### Summary

The file contains numerous hardcoded values that would benefit from being extracted to named constants:

1. **59 numeric literals** used for thresholds, scores, and calculations
2. **15+ regex patterns** that are used for pattern matching
3. **2 string literals** for default values
4. **Multiple array patterns** for metadata detection

Extracting these to constants would:
- Make the code more maintainable and configurable
- Provide self-documenting names for magic numbers
- Allow easy tuning of thresholds and scores
- Reduce duplication of regex patterns
- Make the code easier to test with different configurations