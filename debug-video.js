// Test script to debug video shortcode in browser console
// Paste this in the browser console when on the post editor page

console.log('=== Video Shortcode Debug Test ===');

// Test 1: Check if expandShortcodes function works
const testShortcode = '[video mp4="http://localhost:3000/uploads/file_example_MP4_480_1_5MG.mp4"][/video]';
console.log('Input shortcode:', testShortcode);

// We need to get the expandShortcodes function - it's not exposed globally
// Let's try to get access to the TipTap editor instance
const editorElement = document.querySelector('[data-placeholder]');
console.log('Editor element found:', editorElement);

// Test 2: Check if video shortcode HTML can be inserted directly
const testHTML = `<div data-video-shortcode="true" class="video-shortcode-frame">
  <video controls preload="metadata" data-shortcode-preview="true" 
         src="http://localhost:3000/uploads/file_example_MP4_480_1_5MG.mp4" 
         data-sources="%5B%7B%22src%22%3A%22http%3A%2F%2Flocalhost%3A3000%2Fuploads%2Ffile_example_MP4_480_1_5MG.mp4%22%2C%22type%22%3A%22video%2Fmp4%22%7D%5D" 
         data-shortcode-src="http://localhost:3000/uploads/file_example_MP4_480_1_5MG.mp4">
    <source src="http://localhost:3000/uploads/file_example_MP4_480_1_5MG.mp4" type="video/mp4" />
    <a href="http://localhost:3000/uploads/file_example_MP4_480_1_5MG.mp4">Download video</a>
  </video>
</div>`;

console.log('Test HTML to insert:', testHTML);

// Try to insert the HTML directly if we can find the editor
if (window.editor) {
  console.log('Global editor found, testing HTML insertion...');
  window.editor.commands.insertContent(testHTML);
} else {
  console.log('No global editor found. Try pasting the video shortcode and check console output.');
}

console.log('=== End Debug Test ===');