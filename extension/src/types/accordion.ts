export interface AccordionItem {
  id: string; // Unique key: `${videoId}_${promptId}`
  videoId: string;
  videoTitle: string;
  videoUrl: string;
  promptId: string;
  promptName: string; // Cached at generation time (survives prompt deletion)
  modelId: string;
  summary: string;
  timestamp: number;
  customPromptText?: string; // Stored when a modified prompt was used (not the original)
}

export const MAX_ACCORDION_ITEMS = 20;
