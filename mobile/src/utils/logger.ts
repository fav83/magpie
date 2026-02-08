const isDev = import.meta.env.MODE === 'development';

export function logError(context: string, error: unknown): void {
  if (isDev) {
    console.error(`[Magpie][${context}]`, error);
  }
}

export function logWarn(context: string, message: string): void {
  if (isDev) {
    console.warn(`[Magpie][${context}]`, message);
  }
}
