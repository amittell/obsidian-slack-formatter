import { describe, it, expect } from '@jest/globals';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';
import { TestLogger } from '../helpers';

describe('Attachment Parsing Fix', () => {
    it('should not parse file attachment titles as separate messages', () => {
        // Test case with Google Doc attachment that was being parsed as username
        const input = `UserName  [Feb 6th at 7:47 PM](https://slack.com/archives/012/p123)

Wanted to get your feedback on my update Guidewire doc here https://docs.google.com/document/d/1l0LcYAZxgSNDNCNTmZaOBvVuyTt4fosZu6Lr49PXxWs/edit?tab=t.0

Google Docs
 

Guidewire–Stripe Connector: Consolidated Strategy & Decision Document
Google Doc


The part im missing is customer validation - are you guys able to help me out with some customer demand that I can list for these connectors?`;

        const parser = new IntelligentMessageParser();
        const messages = parser.parse(input);
        
        TestLogger.log('\n=== ATTACHMENT PARSING TEST ===');
        TestLogger.log('Number of messages:', messages.length);
        messages.forEach((msg, i) => {
            TestLogger.log(`Message ${i}: "${msg.username}" -> "${msg.text?.substring(0, 50)}..."`);
        });

        // Should have 1 message, not separate messages for "Google Docs", "Google Doc", etc.
        expect(messages.length).toBe(1);
        
        // The message should be from UserName, not from file attachment titles
        expect(messages[0].username).toBe('UserName');
        
        // Should contain all the content, including the attachment references
        const allText = messages[0].text || '';
        expect(allText).toContain('Wanted to get your feedback');
        expect(allText).toContain('Google Docs');
        expect(allText).toContain('Google Doc');
        expect(allText).toContain('customer validation');
    });

    it('should not parse common file types as usernames', () => {
        const input = `RealUser  [Feb 6th at 7:47 PM](https://slack.com/archives/012/p123)

Here are the files:

PDF

Some document content

Zip

Archive contents

DOC

Word document`;

        const parser = new IntelligentMessageParser();
        const messages = parser.parse(input);
        
        TestLogger.log('\n=== FILE TYPES TEST ===');
        TestLogger.log('Number of messages:', messages.length);
        messages.forEach((msg, i) => {
            TestLogger.log(`Message ${i}: "${msg.username}"`);
        });

        // Should have 1 message, not separate messages for PDF, Zip, DOC
        expect(messages.length).toBe(1);
        expect(messages[0].username).toBe('RealUser');
    });

    it('should not parse service names as usernames', () => {
        const input = `Developer  [Feb 6th at 7:47 PM](https://slack.com/archives/012/p123)

Integration with:

GitHub

Repository setup

Notion

Documentation

Slack

API integration`;

        const parser = new IntelligentMessageParser();
        const messages = parser.parse(input);
        
        TestLogger.log('\n=== SERVICE NAMES TEST ===');
        TestLogger.log('Number of messages:', messages.length);
        messages.forEach((msg, i) => {
            TestLogger.log(`Message ${i}: "${msg.username}"`);
        });

        // Should have 1 message, not separate messages for GitHub, Notion, Slack
        expect(messages.length).toBe(1);
        expect(messages[0].username).toBe('Developer');
    });
});