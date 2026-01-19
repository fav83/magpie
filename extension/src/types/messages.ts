// ============================================
// Transcript Messages
// ============================================

export interface GetTranscriptRequest {
  type: 'GET_TRANSCRIPT';
  videoId: string;
}

export type TranscriptResponse =
  | { type: 'TRANSCRIPT_SUCCESS'; transcript: string; videoTitle: string }
  | { type: 'TRANSCRIPT_ERROR'; error: TranscriptError };

export type TranscriptError =
  | 'NO_CAPTIONS'
  | 'VIDEO_NOT_FOUND'
  | 'EXTRACTION_FAILED'
  | 'AD_PLAYING';

// ============================================
// Summary Messages
// ============================================

export interface GetSummaryRequest {
  type: 'GET_SUMMARY';
  promptId?: string;
  modelId?: string;
  tabId?: number;
  videoId?: string;
}

export type SummaryResponse =
  | {
      type: 'SUMMARY_SUCCESS';
      summary: string;
      videoTitle: string;
      promptId: string;
      modelId: string;
    }
  | { type: 'SUMMARY_ERROR'; error: SummaryError };

export type SummaryError =
  | 'NO_API_KEY'
  | 'INVALID_API_KEY'
  | 'RATE_LIMITED'
  | 'API_ERROR'
  | 'NOT_YOUTUBE_VIDEO'
  | 'CONTEXT_TOO_LONG'
  | 'Cancelled'
  | 'Stopped'
  | 'Connection lost'
  | TranscriptError;

// ============================================
// Video Info Messages
// ============================================

export interface GetVideoInfoRequest {
  type: 'GET_VIDEO_INFO';
  tabId?: number;
}

export type VideoInfoResponse =
  | { type: 'VIDEO_INFO_SUCCESS'; videoId: string; videoTitle: string; videoUrl: string }
  | { type: 'VIDEO_INFO_ERROR'; error: string };

// ============================================
// Settings Messages
// ============================================

export interface GetApiKeyRequest {
  type: 'GET_API_KEY';
}

export type ApiKeyResponse =
  | { type: 'API_KEY_SUCCESS'; hasKey: boolean }
  | { type: 'API_KEY_ERROR'; error: string };

export interface SaveApiKeyRequest {
  type: 'SAVE_API_KEY';
  apiKey: string;
}

// ============================================
// Utility Messages
// ============================================

export interface PingRequest {
  type: 'PING';
}

export type SaveApiKeyResponse =
  | { type: 'SAVE_API_KEY_SUCCESS' }
  | { type: 'SAVE_API_KEY_ERROR'; error: string };

// ============================================
// Union Types
// ============================================

export type RequestMessage =
  | GetTranscriptRequest
  | GetSummaryRequest
  | GetVideoInfoRequest
  | GetApiKeyRequest
  | SaveApiKeyRequest
  | PingRequest;

export type ResponseMessage =
  | TranscriptResponse
  | SummaryResponse
  | VideoInfoResponse
  | ApiKeyResponse
  | SaveApiKeyResponse;

// ============================================
// Streaming Messages (Port-based)
// ============================================

export interface StreamSummaryRequest {
  type: 'STREAM_SUMMARY';
  videoId: string;
  promptId: string;
  modelId: string;
  tabId: number;
  customPromptText?: string; // If provided, use this instead of loading prompt from storage
}

export interface CancelStreamRequest {
  type: 'CANCEL_STREAM';
}

export interface KeepAliveRequest {
  type: 'KEEPALIVE';
}

export type StreamPortRequest =
  | StreamSummaryRequest
  | CancelStreamRequest
  | KeepAliveRequest;

// Service worker -> Side panel streaming responses
export interface StreamChunk {
  type: 'STREAM_CHUNK';
  content: string;
  videoId: string;
  promptId: string;
}

export interface StreamComplete {
  type: 'STREAM_COMPLETE';
  videoId: string;
  videoTitle: string;
  promptId: string;
  modelId: string;
  fullContent: string;
}

export interface StreamError {
  type: 'STREAM_ERROR';
  error: SummaryError;
  errorDetails?: string;
  partialContent: string | null;
  videoId: string;
  promptId: string;
}

export interface KeepAliveAck {
  type: 'KEEPALIVE_ACK';
}

export type StreamPortResponse =
  | StreamChunk
  | StreamComplete
  | StreamError
  | KeepAliveAck;

// ============================================
// Chat Messages (Port-based)
// ============================================

export interface ChatMessageRequest {
  type: 'CHAT_MESSAGE';
  videoId: string;
  tabId: number;
  message: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  summary: string;
  modelId: string;
}

export interface CancelChatRequest {
  type: 'CANCEL_CHAT';
}

export type ChatPortRequest =
  | ChatMessageRequest
  | CancelChatRequest
  | KeepAliveRequest;

// Service worker -> Side panel chat responses
export interface ChatChunk {
  type: 'CHAT_CHUNK';
  content: string;
  videoId: string;
}

export interface ChatComplete {
  type: 'CHAT_COMPLETE';
  videoId: string;
  fullContent: string;
}

export interface ChatError {
  type: 'CHAT_ERROR';
  error: SummaryError;
  errorDetails?: string;
  partialContent: string | null;
  videoId: string;
}

export type ChatPortResponse =
  | ChatChunk
  | ChatComplete
  | ChatError
  | KeepAliveAck;

// ============================================
// Type Guards
// ============================================

// Transcript type guards
export function isTranscriptSuccess(
  response: TranscriptResponse
): response is { type: 'TRANSCRIPT_SUCCESS'; transcript: string; videoTitle: string } {
  return response.type === 'TRANSCRIPT_SUCCESS';
}

export function isTranscriptError(
  response: TranscriptResponse
): response is { type: 'TRANSCRIPT_ERROR'; error: TranscriptError } {
  return response.type === 'TRANSCRIPT_ERROR';
}

// Summary type guards
export function isSummarySuccess(
  response: SummaryResponse
): response is {
  type: 'SUMMARY_SUCCESS';
  summary: string;
  videoTitle: string;
  promptId: string;
  modelId: string;
} {
  return response.type === 'SUMMARY_SUCCESS';
}

export function isSummaryError(
  response: SummaryResponse
): response is { type: 'SUMMARY_ERROR'; error: SummaryError } {
  return response.type === 'SUMMARY_ERROR';
}

// Video info type guards
export function isVideoInfoSuccess(
  response: VideoInfoResponse
): response is { type: 'VIDEO_INFO_SUCCESS'; videoId: string; videoTitle: string; videoUrl: string } {
  return response.type === 'VIDEO_INFO_SUCCESS';
}

export function isVideoInfoError(
  response: VideoInfoResponse
): response is { type: 'VIDEO_INFO_ERROR'; error: string } {
  return response.type === 'VIDEO_INFO_ERROR';
}

// Stream response type guards
export function isStreamChunk(response: StreamPortResponse): response is StreamChunk {
  return response.type === 'STREAM_CHUNK';
}

export function isStreamComplete(response: StreamPortResponse): response is StreamComplete {
  return response.type === 'STREAM_COMPLETE';
}

export function isStreamError(response: StreamPortResponse): response is StreamError {
  return response.type === 'STREAM_ERROR';
}

// Chat response type guards
export function isChatChunk(response: ChatPortResponse): response is ChatChunk {
  return response.type === 'CHAT_CHUNK';
}

export function isChatComplete(response: ChatPortResponse): response is ChatComplete {
  return response.type === 'CHAT_COMPLETE';
}

export function isChatError(response: ChatPortResponse): response is ChatError {
  return response.type === 'CHAT_ERROR';
}
