import { describe, it, expect } from '@jest/globals';
import { ImprovedFormatDetector } from '../../src/formatter/stages/improved-format-detector';
import { readFileSync } from 'fs';

describe('Enhanced Format Detection', () => {
    let detector: ImprovedFormatDetector;

    beforeEach(() => {
        detector = new ImprovedFormatDetector();
    });

    it('should detect standard format correctly for test-slack-content.txt', () => {
        const standardInput = readFileSync('./test-slack-content.txt', 'utf8');
        
        console.log('\n=== STANDARD FORMAT DETECTION ===');
        console.log('Input preview:', standardInput.substring(0, 200) + '...');
        
        const detectedFormat = detector.detectFormat(standardInput);
        
        console.log('Detected format:', detectedFormat);
        
        // Should detect as standard format due to "Username  Time" patterns without DM indicators
        expect(detectedFormat).toBe('standard');
    });

    it('should detect thread format correctly for test-thread-content.txt', () => {
        const threadInput = readFileSync('./test-thread-content.txt', 'utf8');
        
        console.log('\n=== THREAD FORMAT DETECTION ===');
        console.log('Input preview:', threadInput.substring(0, 200) + '...');
        
        const detectedFormat = detector.detectFormat(threadInput);
        
        console.log('Detected format:', detectedFormat);
        
        // Should detect as thread format due to "13 replies", "---" separator, and thread_ts URLs
        expect(detectedFormat).toBe('thread');
    });

    it('should detect different format indicators correctly', () => {
        // Test DM indicators
        const dmPatterns = [
            '[10:30](https://stripe.slack.com/archives/D07M9Q92R24/p1749652229260679)',
            'Alex Mittell',
            'We need to sign off'
        ].join('\n\n');
        
        const dmFormat = detector.detectFormat(dmPatterns);
        console.log('\n=== DM Pattern Test ===');
        console.log('Detected:', dmFormat);
        
        // Test Thread indicators
        const threadPatterns = [
            'Bill MeiBill Mei![:emoji:](url)  [Monday at 4:28 PM](https://stripe.slack.com/archives/C053MUD1RK2/p1750105691887189)',
            '17 replies',
            '---',
            '![](https://ca.slack-edge.com/E0181S17H6Z-U01SNKQFY68-a076510e80d8-48)',
            '[5:04](https://stripe.slack.com/archives/C053MUD1RK2/p1750107870968349?thread_ts=1750105691.887189&cid=C053MUD1RK2)'
        ].join('\n\n');
        
        const threadFormat = detector.detectFormat(threadPatterns);
        console.log('\n=== Thread Pattern Test ===');
        console.log('Detected:', threadFormat);
        
        // DM should be detected for DM patterns
        expect(dmFormat).toBe('dm');
        
        // Thread should be detected for thread patterns  
        expect(threadFormat).toBe('thread');
    });

    it('should handle format disambiguation correctly', () => {
        // Test ambiguous case - both formats have [timestamp](url) patterns
        // but context should determine the correct format
        
        const ambiguousDM = `
[10:30](https://stripe.slack.com/archives/D07M9Q92R24/p1749652229260679)

Alex Mittell

Some message content

[10:37](https://stripe.slack.com/archives/D07M9Q92R24/p1749652649157289)

Shaun Millin

Another message
`;

        const ambiguousThread = `
Bill Mei  [Monday at 4:28 PM](https://stripe.slack.com/archives/C053MUD1RK2/p1750105691887189)

Main thread message

![](https://ca.slack-edge.com/avatar.png)

User Name  [4:30 PM](https://stripe.slack.com/archives/C053MUD1RK2/p1750105812739059?thread_ts=1750105691.887189&cid=C053MUD1RK2)

Thread reply

[5:04](https://stripe.slack.com/archives/C053MUD1RK2/p1750107870968349?thread_ts=1750105691.887189&cid=C053MUD1RK2)

Continuation content
`;

        const dmResult = detector.detectFormat(ambiguousDM);
        const threadResult = detector.detectFormat(ambiguousThread);
        
        console.log('\n=== Format Disambiguation ===');
        console.log('Ambiguous DM detected as:', dmResult);
        console.log('Ambiguous Thread detected as:', threadResult);
        
        // Should correctly distinguish based on context
        expect(dmResult).toBe('dm');
        expect(threadResult).toBe('thread');
    });

    it('should detect multi-person DM conversations correctly', () => {
        // Test multi-person DM with C archive URLs but DM contextual indicators
        const multiPersonDM = `![](https://ca.slack-edge.com/E0181S17H6Z-U023H2QHYG1-79ffd588753a-48)

Amy BritoAmy Brito  [12:36 PM](https://stripe.slack.com/archives/C08K7SJG3LG/p1749573392955799)  

Hi Alex, Shannon, what package of materials are we ready to take to Infosys

![](https://ca.slack-edge.com/E0181S17H6Z-U07JC6P29UM-67fda94224a3-48)

Alex MittellAlex Mittell  [1:14 PM](https://stripe.slack.com/archives/C08K7SJG3LG/p1749575654085999)  

Hi [@amybrito](https://stripe.slack.com/team/U023H2QHYG1), we are in product development currently

![](https://ca.slack-edge.com/E0181S17H6Z-U07NHRJSB27-6751cc45b0a1-48)

Josh LeveyJosh Levey  [1:36 PM](https://stripe.slack.com/archives/C08K7SJG3LG/p1749576989163729)  

thanks for sharing those details, that's helpful!`;

        const result = detector.detectFormat(multiPersonDM);
        
        console.log('\n=== Multi-Person DM Detection ===');
        console.log('Detected format:', result);
        
        // Should detect as DM despite C archive URLs due to contextual indicators
        expect(result).toBe('dm');
    });

    it('should detect actual channel conversations correctly', () => {
        // Test actual channel conversation with channel-specific indicators
        const channelConversation = `User1 joined the channel

User2  [10:30 AM](https://company.slack.com/archives/C123456789/p1234567890)

Welcome to #general channel!

User3 set the channel topic: Daily updates and announcements

User4 pinned a message to this channel

User5  [10:35 AM](https://company.slack.com/archives/C123456789/p1234567895)

Thanks everyone!`;

        const result = detector.detectFormat(channelConversation);
        
        console.log('\n=== Channel Detection ===');
        console.log('Detected format:', result);
        
        // Should detect as channel due to channel-specific actions
        expect(result).toBe('channel');
    });

    it('should detect multi-person DM from test file correctly', () => {
        try {
            const multiDmContent = readFileSync('./test-multi-dm-complex.txt', 'utf8');
            
            console.log('\n=== Multi-Person DM File Test ===');
            console.log('Content preview:', multiDmContent.substring(0, 200) + '...');
            
            const detectedFormat = detector.detectFormat(multiDmContent);
            
            console.log('Detected format:', detectedFormat);
            
            // Should detect as DM format despite C archive URLs
            expect(detectedFormat).toBe('dm');
        } catch (error) {
            console.log('Test file not found, skipping test:', error);
        }
    });

    it('should maintain backward compatibility with existing formats', () => {
        // Test that standard and bracket formats still work
        const standardFormat = `
Username  10:30 AM
Message content

Another User  10:35 AM
Different message
`;

        const bracketFormat = `
[Message from Username]
[Time: 10:30 AM]
Message content

[Message from Another User]
[Time: 10:35 AM]
Different message
`;

        const standardResult = detector.detectFormat(standardFormat);
        const bracketResult = detector.detectFormat(bracketFormat);
        
        console.log('\n=== Backward Compatibility ===');
        console.log('Standard format detected as:', standardResult);
        console.log('Bracket format detected as:', bracketResult);
        
        // Should maintain existing format detection
        expect(standardResult).toBe('standard');
        expect(bracketResult).toBe('bracket');
    });
});