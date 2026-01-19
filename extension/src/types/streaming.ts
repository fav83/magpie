/**
 * Represents an item that is currently being streamed
 */
export interface StreamingItem {
  id: string;                    // `${videoId}_${promptId}`
  videoId: string;
  videoTitle: string;
  videoUrl: string;
  promptId: string;
  promptName: string;
  modelId: string;
  content: string;               // Accumulated streamed content (display-ready)
  fullContent: string;           // All content including buffer
  status: 'streaming' | 'error' | 'stopped';
  error?: string;                // Error message if status === 'error' or 'stopped'
  replaceItemId?: string;        // ID of the item being replaced (when prompt changes)
}
