export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: 'complete' | 'streaming' | 'error';
  error?: string;
}
