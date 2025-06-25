import { describe, it, expect } from '@jest/globals';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';

describe('Comprehensive Fixes Validation', () => {
    it('should handle complex message with continuation and attachments', () => {
        // Complex test case that combines multiple issues that were fixed:
        // 1. Message continuation after [time](url)
        // 2. File attachment titles not parsed as usernames
        // 3. All content properly merged into one message
        const input = `Amy Brito  [Feb 6th at 7:47 PM](https://slack.com/archives/C06DUEZLJ6T/p1707261437.537849)

Wanted to get your feedback on my update Guidewire doc here https://docs.google.com/document/d/1l0LcYAZxgSNDNCNTmZaOBvVuyTt4fosZu6Lr49PXxWs/edit?tab=t.0

Google Docs


Guidewire–Stripe Connector: Consolidated Strategy & Decision Document
Google Doc


The part im missing is customer validation - are you guys able to help me out with some customer demand that I can list for these connectors?

[9:18](https://slack.com/archives/C06DUEZLJ6T/p1707261537.123456)

Additional content after timestamp link that should be included in the same message.

PDF

Technical specification document for the connector implementation.`;

        const parser = new IntelligentMessageParser();
        const messages = parser.parse(input);
        
        console.log('\n=== COMPREHENSIVE TEST OUTPUT ===');
        console.log('Number of messages:', messages.length);
        messages.forEach((msg, i) => {
            console.log(`\nMessage ${i}:`);
            console.log(`  Username: "${msg.username}"`);
            console.log(`  Timestamp: "${msg.timestamp}"`);
            console.log(`  Text length: ${msg.text?.length || 0}`);
            console.log(`  Text preview: "${msg.text?.substring(0, 100)}..."`);
            
            // Show key content indicators
            const text = msg.text || '';
            console.log(`  Contains continuation content: ${text.includes('Additional content after timestamp')}`);
            console.log(`  Contains attachment refs: ${text.includes('Google Docs') && text.includes('PDF')}`);
        });

        // Should have exactly 1 message, with all content properly merged
        expect(messages.length).toBe(1);
        
        // Message validation
        expect(messages[0].username).toBe('Amy Brito');
        expect(messages[0].timestamp).toBe('Feb 6th at 7:47 PM');
        
        const messageText = messages[0].text || '';
        // Should contain the original content
        expect(messageText).toContain('Wanted to get your feedback');
        expect(messageText).toContain('customer validation');
        // Should contain the continuation content after [9:18](...)
        expect(messageText).toContain('Additional content after timestamp');
        expect(messageText).toContain('should be included in the same message');
        // Should contain attachment references but not as separate messages
        expect(messageText).toContain('Google Docs');
        expect(messageText).toContain('Google Doc');
        expect(messageText).toContain('PDF');
        expect(messageText).toContain('Technical specification document');
    });

    it('should handle edge cases in content pattern detection', () => {
        // Test edge cases that could break the content pattern detection
        const input = `Developer  [Feb 6th at 7:47 PM](https://slack.com/archives/012/p123)

Here are the edge cases we need to handle:

Main content that starts with "Main" should not be treated as username.

Content lines with various patterns:
- Lines starting with common words like "Content", "Message", "Text"
- File extensions: .pdf, .zip, .doc, .xlsx
- Service names: GitHub, Notion, Slack, Google Drive
- Doubled patterns: TestingTesting, DevOpsDevOps

[9:00](https://slack.com/archives/012/p456)

And content after timestamp continuation should be preserved.

Actually, this is working as expected now.

Really important that this parsing is correct.`;

        const parser = new IntelligentMessageParser();
        const messages = parser.parse(input);
        
        console.log('\n=== EDGE CASES TEST OUTPUT ===');
        console.log('Number of messages:', messages.length);
        console.log(`Message username: "${messages[0]?.username}"`);
        
        // Should have exactly 1 message
        expect(messages.length).toBe(1);
        expect(messages[0].username).toBe('Developer');
        
        const text = messages[0].text || '';
        // All content should be in one message
        expect(text).toContain('Main content that starts with "Main"');
        expect(text).toContain('Lines starting with common words');
        expect(text).toContain('File extensions: .pdf, .zip');
        expect(text).toContain('Service names: GitHub, Notion');
        expect(text).toContain('Doubled patterns: TestingTesting');
        expect(text).toContain('content after timestamp continuation');
        expect(text).toContain('Actually, this is working');
        expect(text).toContain('Really important that this parsing');
    });

    it('should not create separate messages for common false positive patterns', () => {
        // Test specific patterns that were causing false positives
        const input = `RealUser  [Feb 6th at 7:47 PM](https://slack.com/archives/012/p123)

Testing various patterns that should NOT be usernames:

Google Docs
Microsoft Word
Adobe PDF
ZIP File
JSON Data
HTML Template
CSS Stylesheet
JavaScript Code
Python Script
Docker Image
Kubernetes Config
AWS Lambda
Azure Function
GitHub Repository
GitLab Project
Bitbucket Source
Jira Ticket
Confluence Page
Trello Board
Notion Database
Slack Channel
Discord Server
Teams Meeting
Zoom Call

[8:00](https://slack.com/archives/012/p789)

All of these should be content, not separate messages.`;

        const parser = new IntelligentMessageParser();
        const messages = parser.parse(input);
        
        console.log('\n=== FALSE POSITIVES TEST OUTPUT ===');
        console.log('Number of messages:', messages.length);
        messages.forEach((msg, i) => {
            console.log(`Message ${i}: Username="${msg.username}", Timestamp="${msg.timestamp}"`);
            console.log(`  Text preview: "${msg.text?.substring(0, 80)}..."`);
        });
        
        // Should have exactly 1 message, not separate messages for each service/file type
        expect(messages.length).toBe(1);
        expect(messages[0].username).toBe('RealUser');
        
        const text = messages[0].text || '';
        // Should contain all the content
        expect(text).toContain('Google Docs');
        expect(text).toContain('Microsoft Word');
        expect(text).toContain('ZIP File');
        expect(text).toContain('GitHub Repository');
        expect(text).toContain('All of these should be content');
    });
});