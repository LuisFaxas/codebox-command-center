import { describe, it } from 'node:test';
import assert from 'node:assert';
import { extractTextContent } from '../sdk-bridge.js';

describe('extractTextContent', () => {
  it('returns string content directly (user messages)', () => {
    assert.strictEqual(
      extractTextContent({ role: 'user', content: 'hello' }),
      'hello'
    );
  });

  it('extracts text from array content (assistant messages)', () => {
    assert.strictEqual(
      extractTextContent({ role: 'assistant', content: [{ type: 'text', text: 'hi' }] }),
      'hi'
    );
  });

  it('joins multiple text blocks with newline, skipping non-text blocks', () => {
    assert.strictEqual(
      extractTextContent({
        role: 'assistant',
        content: [
          { type: 'text', text: 'a' },
          { type: 'thinking', thinking: '...' },
          { type: 'text', text: 'b' }
        ]
      }),
      'a\nb'
    );
  });

  it('returns empty string for array with only tool_use blocks', () => {
    assert.strictEqual(
      extractTextContent({ role: 'assistant', content: [{ type: 'tool_use', id: 'x' }] }),
      ''
    );
  });

  it('returns empty string for null message', () => {
    assert.strictEqual(extractTextContent(null), '');
  });

  it('returns empty string for empty string content', () => {
    assert.strictEqual(
      extractTextContent({ role: 'user', content: '' }),
      ''
    );
  });

  it('returns empty string when content field is missing', () => {
    assert.strictEqual(extractTextContent({ role: 'user' }), '');
  });
});
