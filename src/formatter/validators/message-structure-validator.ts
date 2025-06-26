/**
 * Message structure validator for ensuring message integrity during processing
 */

import { SlackMessage } from '../../models';
import { Logger } from '../../utils/logger';

/**
 * Validation result interface
 */
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Validates message structure and content integrity
 */
export class MessageStructureValidator {
    private debugMode: boolean;

    constructor(debugMode: boolean = false) {
        this.debugMode = debugMode;
    }

    /**
     * Validate an array of messages
     */
    validateMessages(messages: SlackMessage[]): ValidationResult {
        const result: ValidationResult = {
            isValid: true,
            errors: [],
            warnings: []
        };

        for (let i = 0; i < messages.length; i++) {
            const messageResult = this.validateMessage(messages[i], i);
            
            if (!messageResult.isValid) {
                result.isValid = false;
            }
            
            result.errors.push(...messageResult.errors);
            result.warnings.push(...messageResult.warnings);
        }

        if (this.debugMode && result.errors.length > 0) {
            Logger.warn('MessageStructureValidator', `Validation found ${result.errors.length} errors`, result.errors);
        }

        return result;
    }

    /**
     * Validate a single message
     */
    validateMessage(message: SlackMessage, index?: number): ValidationResult {
        const result: ValidationResult = {
            isValid: true,
            errors: [],
            warnings: []
        };

        const messagePrefix = index !== undefined ? `Message ${index}` : 'Message';

        // Check required fields
        if (!message.username || message.username.trim() === '') {
            result.errors.push(`${messagePrefix}: Missing or empty username`);
            result.isValid = false;
        }

        if (!message.content || message.content.trim() === '') {
            result.warnings.push(`${messagePrefix}: Empty content`);
        }

        if (!message.id || message.id.trim() === '') {
            result.errors.push(`${messagePrefix}: Missing message ID`);
            result.isValid = false;
        }

        // Check message type
        if (!message.type || !['message', 'system', 'thread_start'].includes(message.type)) {
            result.errors.push(`${messagePrefix}: Invalid or missing message type`);
            result.isValid = false;
        }

        return result;
    }

    /**
     * Validate message content for potential issues
     */
    validateContent(content: string): ValidationResult {
        const result: ValidationResult = {
            isValid: true,
            errors: [],
            warnings: []
        };

        if (content.length > 10000) {
            result.warnings.push('Content is very long (>10000 chars)');
        }

        if (content.includes('<script>') || content.includes('javascript:')) {
            result.errors.push('Content contains potentially unsafe scripts');
            result.isValid = false;
        }

        return result;
    }
}