// Types for YouTube player response
export interface PlayerResponse {
  videoDetails?: {
    title?: string;
    videoId?: string;
    shortDescription?: string;
    defaultAudioLanguage?: string;
  };
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: CaptionTrack[];
    };
  };
  playabilityStatus?: {
    status?: string;
  };
}

export interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string;
  name?: {
    simpleText?: string;
  };
  vssId?: string;
  isTranslatable?: boolean;
}

// Types for YouTube initial data (ytInitialData)
export interface YouTubeInitialData {
  engagementPanels?: EngagementPanel[];
}

export interface EngagementPanel {
  engagementPanelSectionListRenderer?: {
    panelIdentifier?: string;
    targetId?: string;
    content?: PanelContent;
  };
}

export interface PanelContent {
  continuationItemRenderer?: {
    continuationEndpoint?: TranscriptEndpoint;
  };
  transcriptRenderer?: {
    params?: string;
  };
  transcriptSegmentListRenderer?: {
    continuations?: ContinuationItem[];
  };
}

export interface TranscriptEndpoint {
  getTranscriptEndpoint?: {
    params?: string;
  };
  continuationCommand?: {
    token?: string;
  };
}

export interface ContinuationItem {
  nextContinuationData?: {
    continuation?: string;
  };
  continuationCommand?: {
    token?: string;
  };
}

// Types for transcript segments
export interface TranscriptSegment {
  text: string;
  start: number;
  duration: number;
}

export interface TextSnippet {
  simpleText?: string;
  runs?: { text?: string }[];
}

// Types for JSON3 transcript format
export interface Json3Transcript {
  events?: {
    tStartMs?: number;
    segs?: { utf8?: string }[];
  }[];
}

// Types for capture store
export interface CaptureStore {
  installed?: boolean;
  pot?: string;
  clientName?: string;
  timedtextUrl?: string;
  videoId?: string;
}

// Window with capture store attached
export type WindowWithCapture = Window & { __ytSummarizerCapture?: CaptureStore };

// Types for YouTube config (ytcfg)
export interface InnerTubeContext {
  client?: {
    clientName?: string;
    clientVersion?: string;
    visitorData?: string;
  };
}
