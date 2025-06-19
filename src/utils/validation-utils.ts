/**
 * Validation utilities for Slack formatter output
 */

import { SlackMessage } from '../models';
import { Logger } from './logger';

/**
 * Validates that no "Unknown User" messages remain in the final output
 * @param messages - Array of processed Slack messages
 * @returns Object with validation status and any issues found
 */
export function validateNoUnknownUsers(messages: SlackMessage[]): { 
    isValid: boolean; 
    unknownUserCount: number; 
    issues: string[] 
} {
    const issues: string[] = [];
    let unknownUserCount = 0;
    
    messages.forEach((message, index) => {
        if (!message.username || message.username === 'Unknown User') {
            unknownUserCount++;
            const preview = message.text?.substring(0, 50) || '[no text]';
            issues.push(`Message ${index}: Unknown User with text: "${preview}..."`);
        }
    });
    
    if (unknownUserCount > 0) {
        Logger.warn('ValidationUtils', `Found ${unknownUserCount} Unknown User messages in output`, {
            totalMessages: messages.length,
            unknownRatio: (unknownUserCount / messages.length).toFixed(2)
        });
    }
    
    return {
        isValid: unknownUserCount === 0,
        unknownUserCount,
        issues
    };
}

/**
 * Validates message structure for completeness
 * @param messages - Array of Slack messages to validate
 * @returns Validation result with any structural issues
 */
export function validateMessageStructure(messages: SlackMessage[]): {
    isValid: boolean;
    issues: string[];
} {
    const issues: string[] = [];
    
    messages.forEach((message, index) => {
        // Check for empty messages
        if (!message.text || message.text.trim() === '') {
            issues.push(`Message ${index}: Empty message content`);
        }
        
        // Check for messages that are just metadata
        const metadataOnlyPatterns = [
            /^Added by\s+\w+$/i,
            /^Language$/i,
            /^TypeScript$/i,
            /^Last updated$/i,
            /^\d+\s*(?:minutes?|hours?|days?)\s*ago$/i,
            /^!\[\]\(https?:\/\/[^)]+\)$/  // Just an image
        ];
        
        if (message.text && metadataOnlyPatterns.some(pattern => pattern.test(message.text.trim()))) {
            issues.push(`Message ${index}: Contains only metadata: "${message.text}"`);
        }
        
        // Check for suspiciously short usernames
        if (message.username && message.username.length <= 2) {
            issues.push(`Message ${index}: Suspiciously short username: "${message.username}"`);
        }
    });
    
    return {
        isValid: issues.length === 0,
        issues
    };
}

/**
 * Comprehensive validation of formatter output
 * @param messages - Array of processed messages
 * @returns Combined validation results
 */
export function validateFormatterOutput(messages: SlackMessage[]): {
    isValid: boolean;
    unknownUsers: ReturnType<typeof validateNoUnknownUsers>;
    structure: ReturnType<typeof validateMessageStructure>;
} {
    const unknownUsers = validateNoUnknownUsers(messages);
    const structure = validateMessageStructure(messages);
    
    return {
        isValid: unknownUsers.isValid && structure.isValid,
        unknownUsers,
        structure
    };
}