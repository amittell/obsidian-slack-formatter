import { describe, it, expect } from '@jest/globals';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';
import { TestLogger } from '../helpers';

describe('Clay APP vs Bo (Clay) Differentiation', () => {
    it('should properly differentiate Clay APP and Bo (Clay) messages', () => {
        // Based on the screenshots - Clay APP has URL prefix and shorter customer service response
        // Bo (Clay) has parentheses in username and longer advice content
        const input = `Owen Chandler
  Jun 8th at 6:25 PM
Here's my request for transcript analysis.

 (https://app.slack.com/services/B071TQU3SAH)Clay
Clay
APP  Jun 8th at 6:28 PM (https://clayrunhq.slack.com/archives/C025XGWSYTX/p1749421713437949?thread_ts=1749421707.955479&cid=C025XGWSYTX)
Hi there, thanks so much for sharing this! We'll be passing your feedback along to our product team, and any additional context you can provide will help us prioritize with your needs in mind as we shape the roadmap.

If there are specific use cases, workflows, or challenges where these suggestions would make a big difference, feel free to share—we'd love to hear more. Otherwise, we'll plan to close this ticket soon and review your input offline.

Bo (Clay)
Jun 10th at 2:30 PM
Have you tried testing it on a known transcript where you manually verified the longest monologue? Let me know if you have more questions.

Also, here are some suggestions for improving your speech patterns:
- Use more varied sentence structures
- Include pauses for emphasis
- Consider alternative phrasings when making key points

These techniques can help make your communication more engaging and effective.`;

        const parser = new IntelligentMessageParser();
        
        const messages = parser.parse(input);
        
        TestLogger.log('\n=== CLAY DIFFERENTIATION DEBUG ===');
        TestLogger.log('Number of messages:', messages.length);
        messages.forEach((msg, i) => {
            TestLogger.log(`\nMessage ${i + 1}:`);
            TestLogger.log(`  Username: "${msg.username}"`);
            TestLogger.log(`  Timestamp: "${msg.timestamp}"`);
            TestLogger.log(`  Text length: ${msg.text?.length || 0}`);
            
            if (msg.text) {
                const preview = msg.text.length > 100 ? `${msg.text.substring(0, 100)}...` : msg.text;
                TestLogger.log(`  Text: "${preview}"`);
            }
        });
        
        // Key differentiation tests
        const clayAppMessages = messages.filter(msg => {
            return msg.username === 'Clay' && 
                   (msg.text?.includes('Hi there, thanks so much') || 
                    msg.text?.includes('feedback along to our product team'));
        });
        
        const boClayMessages = messages.filter(msg => {
            return msg.username === 'Bo (Clay)' && 
                   (msg.text?.includes('Have you tried testing it on a known transcript') ||
                    msg.text?.includes('suggestions for improving your speech patterns'));
        });
        
        TestLogger.log(`\n--- DIFFERENTIATION ANALYSIS ---`);
        TestLogger.log(`Clay APP messages found: ${clayAppMessages.length}`);
        clayAppMessages.forEach((msg, i) => {
            TestLogger.log(`  Clay APP ${i + 1}: Username="${msg.username}", Date="${msg.timestamp}"`);
        });
        
        TestLogger.log(`Bo (Clay) messages found: ${boClayMessages.length}`);
        boClayMessages.forEach((msg, i) => {
            TestLogger.log(`  Bo (Clay) ${i + 1}: Username="${msg.username}", Date="${msg.timestamp}"`);
        });
        
        // Verify we detect both types correctly
        expect(messages.length).toBeGreaterThanOrEqual(3); // Owen + Clay APP + Bo (Clay)
        
        // Verify Clay APP message exists with correct characteristics
        expect(clayAppMessages.length).toBe(1);
        expect(clayAppMessages[0].username).toBe('Clay');
        expect(clayAppMessages[0].text).toContain('Hi there, thanks so much');
        
        // Verify Bo (Clay) message exists with correct characteristics  
        expect(boClayMessages.length).toBe(1);
        expect(boClayMessages[0].username).toBe('Bo (Clay)'); // Parentheses preserved
        expect(boClayMessages[0].text).toContain('Have you tried testing it on a known transcript');
        
        // Verify different timestamps/dates
        expect(clayAppMessages[0].timestamp).toContain('Jun 8th');
        expect(boClayMessages[0].timestamp).toContain('Jun 10th');
        
        // Verify no Unknown User messages
        const unknownMessages = messages.filter(msg => msg.username === 'Unknown User');
        expect(unknownMessages.length).toBe(0);
    });

    it('should handle Clay APP format with URL prefix correctly', () => {
        const clayAppOnly = ` (https://app.slack.com/services/B071TQU3SAH)Clay
Clay
APP  Jun 8th at 6:28 PM
Short customer service response.`;

        const parser = new IntelligentMessageParser();
        const messages = parser.parse(clayAppOnly);
        
        TestLogger.log('\n=== CLAY APP ONLY TEST ===');
        TestLogger.log('Messages:', messages.length);
        messages.forEach((msg, i) => {
            TestLogger.log(`Message ${i + 1}: "${msg.username}" - "${msg.text}"`);
        });
        
        expect(messages.length).toBe(1);
        expect(messages[0].username).toBe('Clay');
        expect(messages[0].text).toContain('Short customer service response');
    });

    it('should handle Bo (Clay) format with parentheses correctly', () => {
        const boClayOnly = `Bo (Clay)
Jun 10th at 2:30 PM
Longer advice message with detailed suggestions and multiple paragraphs of content.`;

        const parser = new IntelligentMessageParser();
        const messages = parser.parse(boClayOnly);
        
        TestLogger.log('\n=== BO (CLAY) ONLY TEST ===');
        TestLogger.log('Messages:', messages.length);
        messages.forEach((msg, i) => {
            TestLogger.log(`Message ${i + 1}: "${msg.username}" - "${msg.text}"`);
        });
        
        expect(messages.length).toBe(1);
        expect(messages[0].username).toBe('Bo (Clay)'); // Parentheses preserved
        expect(messages[0].text).toContain('Longer advice message');
    });
});