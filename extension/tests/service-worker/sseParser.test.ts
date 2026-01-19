import { describe, it, expect } from 'vitest';
import { parseSSELine, parseSSEStream, StreamAbortedError } from '../../src/service-worker/sseParser';

describe('sseParser', () => {
  describe('parseSSELine', () => {
    it('should return null for empty lines', () => {
      const result = parseSSELine('');
      expect(result).toEqual({ chunk: null, done: false });
    });

    it('should return null for comment lines', () => {
      const result = parseSSELine(': OPENROUTER PROCESSING');
      expect(result).toEqual({ chunk: null, done: false });
    });

    it('should return null for non-data lines', () => {
      const result = parseSSELine('event: message');
      expect(result).toEqual({ chunk: null, done: false });
    });

    it('should return done=true for [DONE] marker', () => {
      const result = parseSSELine('data: [DONE]');
      expect(result).toEqual({ chunk: null, done: true });
    });

    it('should parse content from delta', () => {
      const json = JSON.stringify({
        choices: [{ delta: { content: 'Hello' }, finish_reason: null }],
      });
      const result = parseSSELine(`data: ${json}`);
      expect(result).toEqual({
        chunk: { content: 'Hello', finishReason: null },
        done: false,
      });
    });

    it('should parse finish_reason', () => {
      const json = JSON.stringify({
        choices: [{ delta: { content: '' }, finish_reason: 'stop' }],
      });
      const result = parseSSELine(`data: ${json}`);
      expect(result).toEqual({
        chunk: { content: '', finishReason: 'stop' },
        done: false,
      });
    });

    it('should parse error in response', () => {
      const json = JSON.stringify({
        error: { code: 500, message: 'Internal error' },
      });
      const result = parseSSELine(`data: ${json}`);
      expect(result.chunk?.error).toEqual({ code: 500, message: 'Internal error' });
      expect(result.done).toBe(true);
    });

    it('should handle error finish_reason', () => {
      const json = JSON.stringify({
        choices: [{ delta: { content: '' }, finish_reason: 'error' }],
      });
      const result = parseSSELine(`data: ${json}`);
      expect(result.done).toBe(true);
    });

    it('should handle malformed JSON gracefully', () => {
      const result = parseSSELine('data: {invalid json}');
      expect(result).toEqual({ chunk: null, done: false });
    });

    it('should strip CRLF line endings', () => {
      const json = JSON.stringify({
        choices: [{ delta: { content: 'Test' }, finish_reason: null }],
      });
      const result = parseSSELine(`data: ${json}\r`);
      expect(result.chunk?.content).toBe('Test');
    });

    it('should handle lines with only carriage return', () => {
      const result = parseSSELine('\r');
      expect(result).toEqual({ chunk: null, done: false });
    });

    it('should handle empty content in delta', () => {
      const json = JSON.stringify({
        choices: [{ delta: {}, finish_reason: null }],
      });
      const result = parseSSELine(`data: ${json}`);
      expect(result.chunk?.content).toBe('');
    });

    it('should handle missing choices array', () => {
      const json = JSON.stringify({});
      const result = parseSSELine(`data: ${json}`);
      expect(result.chunk?.content).toBe('');
      expect(result.chunk?.finishReason).toBe(null);
    });
  });

  describe('StreamAbortedError', () => {
    it('should be an instance of Error', () => {
      const error = new StreamAbortedError();
      expect(error).toBeInstanceOf(Error);
    });

    it('should have correct name', () => {
      const error = new StreamAbortedError();
      expect(error.name).toBe('StreamAbortedError');
    });

    it('should have correct message', () => {
      const error = new StreamAbortedError();
      expect(error.message).toBe('Stream aborted');
    });
  });

  describe('parseSSEStream', () => {
    function createMockResponse(chunks: string[]): Response {
      const encoder = new TextEncoder();
      let index = 0;

      const stream = new ReadableStream({
        pull(controller) {
          if (index < chunks.length) {
            controller.enqueue(encoder.encode(chunks[index]));
            index++;
          } else {
            controller.close();
          }
        },
      });

      return new Response(stream);
    }

    it('should yield chunks from stream', async () => {
      const json = JSON.stringify({
        choices: [{ delta: { content: 'Hello' }, finish_reason: null }],
      });
      const response = createMockResponse([`data: ${json}\n`]);

      const chunks = [];
      for await (const chunk of parseSSEStream(response)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.content).toBe('Hello');
    });

    it('should handle multiple chunks', async () => {
      const json1 = JSON.stringify({ choices: [{ delta: { content: 'Hello' } }] });
      const json2 = JSON.stringify({ choices: [{ delta: { content: ' World' } }] });
      const response = createMockResponse([`data: ${json1}\ndata: ${json2}\n`]);

      const chunks = [];
      for await (const chunk of parseSSEStream(response)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(chunks[0]?.content).toBe('Hello');
      expect(chunks[1]?.content).toBe(' World');
    });

    it('should stop at [DONE]', async () => {
      const json = JSON.stringify({ choices: [{ delta: { content: 'Hello' } }] });
      const response = createMockResponse([`data: ${json}\ndata: [DONE]\ndata: more\n`]);

      const chunks = [];
      for await (const chunk of parseSSEStream(response)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
    });

    it('should throw StreamAbortedError when signal is aborted', async () => {
      const json = JSON.stringify({ choices: [{ delta: { content: 'Hello' } }] });
      const response = createMockResponse([`data: ${json}\n`]);

      const controller = new AbortController();
      controller.abort();

      await expect(async () => {
        for await (const _ of parseSSEStream(response, controller.signal)) {
          // Should throw before yielding
        }
      }).rejects.toThrow(StreamAbortedError);
    });

    it('should handle chunked data across multiple reads', async () => {
      const json = JSON.stringify({ choices: [{ delta: { content: 'Hello' } }] });
      // Split the data line across two chunks
      const response = createMockResponse([`data: ${json.slice(0, 10)}`, `${json.slice(10)}\n`]);

      const chunks = [];
      for await (const chunk of parseSSEStream(response)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.content).toBe('Hello');
    });

    it('should skip empty lines between data', async () => {
      const json = JSON.stringify({ choices: [{ delta: { content: 'Hello' } }] });
      const response = createMockResponse([`\n\ndata: ${json}\n\n`]);

      const chunks = [];
      for await (const chunk of parseSSEStream(response)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
    });

    it('should throw error for non-readable response', async () => {
      const response = new Response(null);

      await expect(async () => {
        for await (const _ of parseSSEStream(response)) {
          // Should throw
        }
      }).rejects.toThrow('Response body is not readable');
    });
  });
});
