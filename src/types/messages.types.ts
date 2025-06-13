/**
 * Message-related type definitions for Slack formatter.
 * @module messages.types
 */

/**
 * Represents a reaction on a Slack message.
 * @interface SlackReaction
 */
export interface SlackReaction {
    /**
     * The name of the emoji reaction (without colons).
     * @type {string}
     * @example "thumbsup", "heart", "joy"
     */
    name: string;
    
    /**
     * The number of users who reacted with this emoji.
     * @type {number}
     * @example 3
     */
    count: number;
}

// Removed unused SlackAttachment interface










// Removed unused SlackField interface



