// This file contains the fix for the link preview issue
// We'll add a new method to detect link preview content

/**
 * Check if content appears to be a link preview that should be attached to the previous message
 * Link previews typically appear after URLs and before the next message's avatar
 */
private isLikelyLinkPreview(lines: LineAnalysis[], startIndex: number, endIndex: number): boolean {
    // Look for patterns that indicate link preview content:
    // 1. Preceded by a URL in the previous message
    // 2. Contains preview metadata patterns
    // 3. Followed by an avatar (which would be the next message)
    
    let hasUrlBefore = false;
    let hasPreviewPatterns = false;
    
    // Check if there's a URL in the lines before this content
    for (let i = Math.max(0, startIndex - 5); i < startIndex; i++) {
        if (lines[i] && lines[i].characteristics.hasUrl) {
            hasUrlBefore = true;
            break;
        }
    }
    
    // Check for common link preview patterns
    const previewPatterns = [
        /^!\[.*\]\(.*\).*\(formerly.*\)$/i,  // ![X (formerly Twitter)](...)
        /\bChapters:\d+:\d+\b/i,             // Video chapters like "Chapters:0:00"
        /^\w+\s+\([\[@\w+\]\]\)\s+on\s+\w+$/i, // "Name (@handle) on Platform"
        /\(\d+\s*[KMG]?B\)$/,                // File sizes like "(213 KB)"
        /^Added by/i,                        // "Added by Service"
        /\bDocument\s+explaining\b/i,        // Description patterns
    ];
    
    // Check the content lines for preview patterns
    for (let i = startIndex; i <= endIndex && i < lines.length; i++) {
        const line = lines[i];
        if (!line || line.isEmpty) continue;
        
        for (const pattern of previewPatterns) {
            if (this.safeRegexTest(pattern, line.trimmed)) {
                hasPreviewPatterns = true;
                break;
            }
        }
        
        // Also check if line looks like a preview description
        // (starts with capital, no timestamp, looks like a sentence)
        if (line.characteristics.hasCapitalStart && 
            !line.characteristics.hasTimestamp &&
            line.trimmed.length > 20 &&
            /[.!?]$/.test(line.trimmed)) {
            hasPreviewPatterns = true;
        }
    }
    
    return hasUrlBefore && hasPreviewPatterns;
}

// Add this check to couldBeMessageStart method, around line 662:
// Before checking for avatar indicator, check if the previous content looks like a link preview

// Around line 662-664, add:
if (avatarIndicator) {
    // Check if the content before this avatar looks like a link preview
    let contentStart = index - 1;
    while (contentStart > 0 && !this.couldBeMessageStart(allLines[contentStart], allLines, contentStart)) {
        contentStart--;
    }
    
    if (contentStart < index - 1) {
        // There's content between the last message start and this avatar
        if (this.isLikelyLinkPreview(allLines, contentStart + 1, index - 1)) {
            // This avatar follows link preview content, so it's not part of that preview
            // It IS a new message start
            if (this.debugMode) {
                Logger.debug('IntelligentMessageParser', 
                    `Avatar at line ${index} follows link preview content - treating as new message start`, 
                    undefined, true);
            }
            // Continue with normal avatar handling
        }
    }
}