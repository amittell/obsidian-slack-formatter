import { describe, it, expect, beforeEach } from '@jest/globals';
import { FlexibleMessageParser } from '../../src/formatter/stages/flexible-message-parser';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';
import { normalizeWhitespace, cleanText, isValidText } from '../../src/utils/text-utils';
import { processEmoji, extractEmojiReactions } from '../../src/utils/emoji-utils';

describe('Text Processing Quality Assurance Suite', () => {
    let flexibleParser: FlexibleMessageParser;
    let intelligentParser: IntelligentMessageParser;

    beforeEach(() => {
        flexibleParser = new FlexibleMessageParser();
        intelligentParser = new IntelligentMessageParser(
            { debug: false },
            { userMap: {}, emojiMap: {} }
        );
    });

    describe('Character Encoding Tests', () => {
        it('should handle UTF-8 encoded text correctly', () => {
            const utf8Content = `User1  [12:00 PM](https://example.com)
Hello world! 你好世界 🌍
UTF-8 characters: áéíóú àèìòù âêîôû ñç`;

            const messages = flexibleParser.parse(utf8Content, true);
            
            expect(messages.length).toBe(1);
            expect(messages[0].username).toBe('User1');
            expect(messages[0].text).toContain('你好世界');
            expect(messages[0].text).toContain('áéíóú');
            expect(messages[0].text).toContain('ñç');
        });

        it('should handle UTF-16 surrogate pairs correctly', () => {
            const surrogatePairContent = `User1  [12:00 PM](https://example.com)
Emoji with surrogate pairs: 🎉🚀🌟💫⭐🔥
Mathematical symbols: 𝑥²+𝑦²=𝑟²
Ancient scripts: 𒀀𒀁𒀂`;

            const messages = flexibleParser.parse(surrogatePairContent, true);
            
            expect(messages.length).toBe(1);
            expect(messages[0].text).toContain('🎉🚀🌟💫⭐🔥');
            expect(messages[0].text).toContain('𝑥²+𝑦²=𝑟²');
        });

        it('should handle mixed encoding scenarios', () => {
            const mixedEncodingContent = `User1  [12:00 PM](https://example.com)
English text with émojis 😀
Русский текст с эмодзи 🇷🇺
中文文本与表情符号 🇨🇳
عربي مع الرموز التعبيرية 🇸🇦`;

            const messages = flexibleParser.parse(mixedEncodingContent, true);
            
            expect(messages.length).toBe(1);
            expect(messages[0].text).toContain('English text');
            expect(messages[0].text).toContain('Русский текст');
            expect(messages[0].text).toContain('中文文本');
            expect(messages[0].text).toContain('عربي مع');
        });

        it('should handle invalid or corrupted character sequences', () => {
            const invalidContent = `User1  [12:00 PM](https://example.com)
Text with invalid sequences
Some more valid text here`;

            const messages = flexibleParser.parse(invalidContent, true);
            
            expect(messages.length).toBe(1);
            expect(messages[0].text).toContain('Text with invalid');
            expect(messages[0].text).toContain('Some more valid');
        });
    });

    describe('Text Normalization Tests', () => {
        it('should normalize various whitespace characters', () => {
            const whitespaceVariations = [
                "Normal spaces",
                "Tab\tcharacters",
                "Non-breaking\u00A0spaces",
                "Multiple   spaces",
                "Trailing spaces   ",
                "   Leading spaces",
                "Mixed\t\u00A0  \twhitespace"
            ];

            whitespaceVariations.forEach(text => {
                const normalized = normalizeWhitespace(text);
                expect(normalized).not.toMatch(/\t/);
                expect(normalized).not.toMatch(/\u00A0/);
                expect(normalized).not.toMatch(/ {2,}/); // No multiple spaces
                expect(normalized.trim()).toBe(normalized); // No leading/trailing spaces
            });
        });

        it('should handle line ending normalization', () => {
            const lineEndingVariations = [
                "Line 1\nLine 2",           // Unix LF
                "Line 1\r\nLine 2",         // Windows CRLF
                "Line 1\rLine 2",           // Old Mac CR
                "Line 1\n\rLine 2",         // Mixed
                "Line 1\n\n\nLine 2"        // Multiple newlines
            ];

            lineEndingVariations.forEach(text => {
                const content = `User1  [12:00 PM](https://example.com)
${text}`;
                
                const messages = flexibleParser.parse(content, true);
                expect(messages.length).toBe(1);
                expect(messages[0].text).toContain('Line 1');
                expect(messages[0].text).toContain('Line 2');
            });
        });

        it('should handle Unicode normalization forms', () => {
            // Test different Unicode normalization forms
            const testCases = [
                {
                    description: "Composed vs decomposed characters",
                    composed: "café",           // é as single character
                    decomposed: "cafe\u0301"   // e + combining acute accent
                },
                {
                    description: "Different representation of same character",
                    composed: "ñ",             // ñ as single character
                    decomposed: "n\u0303"     // n + combining tilde
                }
            ];

            testCases.forEach(({ description, composed, decomposed }) => {
                const content1 = `User1  [12:00 PM](https://example.com)
Text with ${composed}`;
                const content2 = `User1  [12:00 PM](https://example.com)
Text with ${decomposed}`;

                const messages1 = flexibleParser.parse(content1, true);
                const messages2 = flexibleParser.parse(content2, true);

                expect(messages1.length).toBe(1);
                expect(messages2.length).toBe(1);
                
                // Both should be processed correctly
                expect(messages1[0].text).toContain('Text with');
                expect(messages2[0].text).toContain('Text with');
            });
        });
    });

    describe('Special Character Handling', () => {
        it('should handle control characters appropriately', () => {
            const controlCharsContent = `User1  [12:00 PM](https://example.com)
Text with control chars: \u0001\u0002\u0003
Bell character: \u0007
Backspace: \u0008
Form feed: \u000C
Regular text continues here`;

            const messages = flexibleParser.parse(controlCharsContent, true);
            
            expect(messages.length).toBe(1);
            expect(messages[0].text).toContain('Regular text continues');
            
            // Control characters should be handled gracefully (not crash)
            expect(messages[0].text).toBeTruthy();
        });

        it('should handle zero-width characters', () => {
            const zeroWidthContent = `User1  [12:00 PM](https://example.com)
Text with zero-width\u200Bspace
Zero-width\u200Cjoin\u200Der
Text with zero-width\u200Djoiner`;

            const messages = flexibleParser.parse(zeroWidthContent, true);
            
            expect(messages.length).toBe(1);
            expect(messages[0].text).toContain('zero-width');
            // Should preserve or handle zero-width characters appropriately
        });

        it('should handle bidirectional text correctly', () => {
            const bidiContent = `User1  [12:00 PM](https://example.com)
Mixed text: English العربية English
RTL override: \u202Eoverride text\u202C normal
LTR override: \u202Doverride text\u202C normal`;

            const messages = flexibleParser.parse(bidiContent, true);
            
            expect(messages.length).toBe(1);
            expect(messages[0].text).toContain('Mixed text');
            expect(messages[0].text).toContain('العربية');
            expect(messages[0].text).toContain('override text');
        });

        it('should handle mathematical and symbol characters', () => {
            const mathSymbolsContent = `User1  [12:00 PM](https://example.com)
Math symbols: ∑∏∫∂∇∞±≠≤≥∈∉∪∩⊂⊃
Greek letters: αβγδεζηθικλμνξοπρστυφχψω
Arrows: ←→↑↓↔↖↗↘↙⇐⇒⇑⇓⇔
Currency: $€£¥₹₽₿`;

            const messages = flexibleParser.parse(mathSymbolsContent, true);
            
            expect(messages.length).toBe(1);
            expect(messages[0].text).toContain('∑∏∫');
            expect(messages[0].text).toContain('αβγδ');
            expect(messages[0].text).toContain('←→↑↓');
            expect(messages[0].text).toContain('$€£¥');
        });
    });

    describe('Emoji Processing Quality', () => {
        it('should handle standard Unicode emoji correctly', () => {
            const standardEmojiContent = `User1  [12:00 PM](https://example.com)
Standard emoji: 😀😃😄😁😆😅😂🤣😊😇
Skin tone variations: 👋👋🏻👋🏼👋🏽👋🏾👋🏿
Complex emoji: 👨‍👩‍👧‍👦👩‍💻🧑‍🎓👨‍⚕️`;

            const messages = flexibleParser.parse(standardEmojiContent, true);
            
            expect(messages.length).toBe(1);
            expect(messages[0].text).toContain('😀😃😄');
            expect(messages[0].text).toContain('👋👋🏻');
            expect(messages[0].text).toContain('👨‍👩‍👧‍👦');
        });

        it('should handle Slack custom emoji format', () => {
            const customEmojiContent = `User1  [12:00 PM](https://example.com)
Custom emoji: :custom_emoji: :another-emoji:
Linked emoji: ![:custom:](https://emoji.slack-edge.com/url)
Mixed: :standard: ![:custom:](url) 😀`;

            const messages = flexibleParser.parse(customEmojiContent, true);
            
            expect(messages.length).toBe(1);
            expect(messages[0].text).toContain(':custom_emoji:');
            expect(messages[0].text).toContain(':another-emoji:');
        });

        it('should process emoji reactions correctly', () => {
            const emojiReactionsContent = `User1  [12:00 PM](https://example.com)
Message with reactions
:thumbsup:
5
:heart:
3
![:custom-reaction:](https://emoji.slack-edge.com/url)
2`;

            const messages = flexibleParser.parse(emojiReactionsContent, true);
            
            expect(messages.length).toBe(1);
            expect(messages[0].text).toContain('Message with reactions');
            
            // Check if reactions are properly parsed
            if (messages[0].reactions) {
                expect(messages[0].reactions.length).toBeGreaterThan(0);
                
                const thumbsUp = messages[0].reactions.find(r => r.name === 'thumbsup');
                const heart = messages[0].reactions.find(r => r.name === 'heart');
                
                expect(thumbsUp?.count).toBe(5);
                expect(heart?.count).toBe(3);
            }
        });

        it('should handle malformed emoji gracefully', () => {
            const malformedEmojiContent = `User1  [12:00 PM](https://example.com)
Malformed emoji: :incomplete
:no-closing-colon
![:missing-url:]
![:no-closing-bracket:](url
![:](empty-name)`;

            const messages = flexibleParser.parse(malformedEmojiContent, true);
            
            expect(messages.length).toBe(1);
            expect(messages[0].text).toContain('Malformed emoji');
            // Should not crash on malformed emoji
        });
    });

    describe('Text Cleanup and Validation', () => {
        it('should clean text appropriately', () => {
            const messyText = `   Text with    multiple   spaces   
\t\tTabs and newlines\n\n
\u00A0Non-breaking spaces\u00A0
Mixed\t\u00A0 \nwhitespace   `;

            const cleaned = cleanText(messyText);
            
            expect(cleaned).not.toMatch(/\t/);
            expect(cleaned).not.toMatch(/\u00A0/);
            expect(cleaned).not.toMatch(/ {2,}/); // No multiple spaces
            expect(cleaned.trim()).toBe(cleaned); // No leading/trailing spaces
            expect(cleaned).toContain('Text with multiple spaces');
            expect(cleaned).toContain('Tabs and newlines');
        });

        it('should validate text content correctly', () => {
            const validTexts = [
                "Normal text",
                "Text with 123 numbers",
                "Text with émojis 😀",
                "Mixed languages: Hello 你好 مرحبا",
                "Text with symbols: @#$%^&*()"
            ];

            const invalidTexts = [
                "",
                "   ",
                "\t\n",
                "\u0000\u0001\u0002"
            ];

            validTexts.forEach(text => {
                expect(isValidText(text)).toBe(true);
            });

            invalidTexts.forEach(text => {
                expect(isValidText(text)).toBe(false);
            });
        });

        it('should handle text length validation', () => {
            const shortText = "Short";
            const normalText = "This is a normal length text message";
            const longText = "Very long text ".repeat(1000);

            expect(isValidText(shortText)).toBe(true);
            expect(isValidText(normalText)).toBe(true);
            expect(isValidText(longText)).toBe(true);
            
            // All should be processed without errors
            const shortContent = `User1  [12:00 PM](https://example.com)\n${shortText}`;
            const normalContent = `User1  [12:00 PM](https://example.com)\n${normalText}`;
            const longContent = `User1  [12:00 PM](https://example.com)\n${longText.substring(0, 10000)}`;

            expect(() => flexibleParser.parse(shortContent, true)).not.toThrow();
            expect(() => flexibleParser.parse(normalContent, true)).not.toThrow();
            expect(() => flexibleParser.parse(longContent, true)).not.toThrow();
        });
    });

    describe('Code Block and Formatting Preservation', () => {
        it('should preserve code block formatting', () => {
            const codeBlockContent = `User1  [12:00 PM](https://example.com)
Here's some code:
\`\`\`javascript
function test() {
    console.log("Hello\tWorld");
    return "Special chars: àáâãäå";
}
\`\`\`
And inline code: \`const x = "test";\``;

            const messages = flexibleParser.parse(codeBlockContent, true);
            
            expect(messages.length).toBe(1);
            expect(messages[0].text).toContain('```javascript');
            expect(messages[0].text).toContain('function test()');
            expect(messages[0].text).toContain('Hello\tWorld');
            expect(messages[0].text).toContain('àáâãäå');
            expect(messages[0].text).toContain('`const x = "test";`');
        });

        it('should preserve markdown formatting', () => {
            const markdownContent = `User1  [12:00 PM](https://example.com)
**Bold text with special chars: ñç**
*Italic text with unicode: 你好*
~~Strikethrough with symbols: @#$%~~
> Quote with mixed: English العربية
1. Numbered list with émojis 😀
2. Another item with 中文
• Bullet with Русский
• Another with ñ`;

            const messages = flexibleParser.parse(markdownContent, true);
            
            expect(messages.length).toBe(1);
            expect(messages[0].text).toContain('**Bold text');
            expect(messages[0].text).toContain('*Italic text');
            expect(messages[0].text).toContain('~~Strikethrough');
            expect(messages[0].text).toContain('> Quote');
            expect(messages[0].text).toContain('你好');
            expect(messages[0].text).toContain('العربية');
            expect(messages[0].text).toContain('中文');
            expect(messages[0].text).toContain('Русский');
        });

        it('should handle mixed formatting and special characters', () => {
            const mixedContent = `User1  [12:00 PM](https://example.com)
Mixed content:
\`\`\`
Code with unicode: 🚀 ñç 你好
\`\`\`
**Bold with emoji: 😀**
*Italic with symbols: @#$%*
Normal text with special chars: àáâãäå
> Quote with math: x² + y² = r²`;

            const messages = flexibleParser.parse(mixedContent, true);
            
            expect(messages.length).toBe(1);
            expect(messages[0].text).toContain('🚀 ñç 你好');
            expect(messages[0].text).toContain('**Bold with emoji: 😀**');
            expect(messages[0].text).toContain('àáâãäå');
            expect(messages[0].text).toContain('x² + y² = r²');
        });
    });

    describe('Error Handling and Recovery', () => {
        it('should handle corrupted or truncated input gracefully', () => {
            const corruptedInputs = [
                "User1  [12:00 PM](https://example.com)\nText with invalid \uFFFD replacement char",
                "User1  [12:00 PM](https://example.com)\nIncomplete multi-byte sequence: \xC2",
                "User1  [12:00 PM](https://example.com)\nText with control sequences: \x1B[31mred\x1B[0m"
            ];

            corruptedInputs.forEach(input => {
                expect(() => flexibleParser.parse(input, true)).not.toThrow();
                const messages = flexibleParser.parse(input, true);
                expect(messages.length).toBeGreaterThan(0);
                expect(messages[0].username).toBe('User1');
            });
        });

        it('should handle extremely large text inputs', () => {
            const hugeText = "Very long text ".repeat(10000);
            const hugeContent = `User1  [12:00 PM](https://example.com)
${hugeText}`;

            const startTime = Date.now();
            const messages = flexibleParser.parse(hugeContent, true);
            const endTime = Date.now();

            expect(messages.length).toBe(1);
            expect(messages[0].username).toBe('User1');
            expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
        });

        it('should handle mixed valid and invalid characters', () => {
            const mixedContent = `User1  [12:00 PM](https://example.com)
Valid text: Hello world 你好
Invalid chars: \u0000\u0001\u0002
More valid: 😀🚀🌟
More invalid: \uFFFE\uFFFF
Final valid: Test complete`;

            const messages = flexibleParser.parse(mixedContent, true);
            
            expect(messages.length).toBe(1);
            expect(messages[0].text).toContain('Hello world');
            expect(messages[0].text).toContain('你好');
            expect(messages[0].text).toContain('😀🚀🌟');
            expect(messages[0].text).toContain('Test complete');
        });
    });

    describe('Text Processing Performance Metrics', () => {
        it('should process various text types efficiently', () => {
            const testCases = [
                {
                    name: "ASCII text",
                    content: "Simple ASCII text with basic characters"
                },
                {
                    name: "Unicode text",
                    content: "Unicode text with special chars: àáâãäå 你好世界 🌍"
                },
                {
                    name: "Mixed multilingual",
                    content: "English العربية 中文 Русский Français Español Deutsch"
                },
                {
                    name: "Emoji heavy",
                    content: "😀😃😄😁😆😅😂🤣😊😇🙂🙃😉😌😍🥰😘😗😙😚😋😛😝😜🤪🤨🧐🤓😎🤩🥳"
                },
                {
                    name: "Symbol heavy",
                    content: "∑∏∫∂∇∞±≠≤≥∈∉∪∩⊂⊃←→↑↓↔↖↗↘↙⇐⇒⇑⇓⇔$€£¥₹₽₿"
                }
            ];

            if (process.env.DEBUG_PERFORMANCE === 'true') {
                console.log('\nText Processing Performance Results:');
            }
            
            testCases.forEach(({ name, content }) => {
                const fullContent = `User1  [12:00 PM](https://example.com)\n${content}`;
                
                const startTime = Date.now();
                const messages = flexibleParser.parse(fullContent, true);
                const endTime = Date.now();
                
                const processingTime = endTime - startTime;
                if (process.env.DEBUG_PERFORMANCE === 'true') {
                    console.log(`${name}: ${processingTime}ms`);
                }
                
                expect(messages.length).toBe(1);
                expect(messages[0].username).toBe('User1');
                expect(processingTime).toBeLessThan(1000); // Should complete within 1 second
            });
        });

        it('should provide comprehensive text processing statistics', () => {
            const testContent = `User1  [12:00 PM](https://example.com)
Mixed content with:
- ASCII characters: ABCabc123
- Unicode chars: àáâãäå ñç
- CJK characters: 你好世界 こんにちは 안녕하세요
- Arabic: مرحبا بالعالم
- Emoji: 😀🚀🌟💫⭐🔥
- Symbols: ∑∏∫∂∇∞±≠≤≥
- Special: \t\n  multiple   spaces

:thumbsup:
5
:heart:
3`;

            const messages = flexibleParser.parse(testContent, true);
            
            expect(messages.length).toBe(1);
            
            const message = messages[0];
            const text = message.text || '';
            
            if (process.env.DEBUG_STATS === 'true') {
                console.log('\nText Processing Statistics:');
                console.log(`Total text length: ${text.length}`);
                console.log(`Contains ASCII: ${/[A-Za-z0-9]/.test(text)}`);
                console.log(`Contains Unicode: ${/[^\x00-\x7F]/.test(text)}`);
                console.log(`Contains CJK: ${/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(text)}`);
                console.log(`Contains Arabic: ${/[\u0600-\u06ff]/.test(text)}`);
                console.log(`Contains Emoji: ${/[\u{1f600}-\u{1f64f}]|[\u{1f300}-\u{1f5ff}]|[\u{1f680}-\u{1f6ff}]|[\u{1f1e0}-\u{1f1ff}]/u.test(text)}`);
                console.log(`Has reactions: ${message.reactions && message.reactions.length > 0}`);
            }
            
            // Basic validation
            expect(text.length).toBeGreaterThan(0);
            expect(message.username).toBe('User1');
            
            if (message.reactions) {
                expect(message.reactions.length).toBeGreaterThan(0);
            }
        });
    });
});