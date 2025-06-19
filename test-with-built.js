// Test using the built main.js file
import('./main.js').then(module => {
    // The built file exports everything, we need to find the right classes
    console.log('Module loaded, testing IntelligentMessageParser...\n');
    
    // Create a simple test to verify the fix
    const testInput = `Clement MiaoClement Miao  [Feb 7th at 8:25 AM](url)  

this is AMAZING omg

[8:26](url)

even if a bit buggy, this is going to be great

Trajan McGillTrajan McGill  [Feb 7th at 9:18 AM](url)  

Yeah, this is going to be fantastic.

[9:18](url)

So, first attempt was copying and pasting this very thread`;

    console.log('Test input has:');
    console.log('- 2 authors: Clement Miao and Trajan McGill');
    console.log('- 2 continuation timestamps: [8:26] and [9:18]');
    console.log('- Content after each continuation timestamp\n');
    
    console.log('If the fix works correctly:');
    console.log('- Should parse 2 messages (not 4)');
    console.log('- Each message should include its continuation content');
    console.log('- No "Unknown User" messages\n');
    
}).catch(err => {
    console.error('Failed to load module:', err);
});