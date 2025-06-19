"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const message_continuation_processor_js_1 = require("./src/formatter/processors/message-continuation-processor.js");
const constants_js_1 = require("./src/utils/constants.js");
// Test the fixed MessageContinuationProcessor
const processor = new message_continuation_processor_js_1.MessageContinuationProcessor();
const testMessages = [
    {
        username: 'John Doe',
        text: 'Hello world',
        timestamp: '10:00 AM',
        reactions: []
    },
    {
        username: constants_js_1.USER_CONSTANTS.UNKNOWN_USER,
        text: '[10:01 AM](https://slack.com/archives/123)',
        timestamp: '10:01 AM',
        reactions: []
    }
];
console.log('Testing MessageContinuationProcessor...');
console.log('Input messages:', testMessages.length);
try {
    const result = processor.process(testMessages);
    console.log('Success! Processor returned ProcessorResult:', {
        modified: result.modified,
        contentLength: result.content.length
    });
    console.log('Output messages:', result.content);
}
catch (error) {
    console.error('Error:', error);
}
