import { STORAGE_KEYS } from '../config';
import { createArrayStorage } from './chromeStorage';

const storage = createArrayStorage<string>(STORAGE_KEYS.PREFERRED_MODELS);

export async function getPreferredModelIds(): Promise<string[]> {
  return storage.get();
}

export async function addPreferredModel(modelId: string): Promise<void> {
  return storage.add(modelId);
}

export async function removePreferredModel(modelId: string): Promise<void> {
  return storage.remove(modelId);
}

export async function togglePreferredModel(modelId: string): Promise<boolean> {
  return storage.toggle(modelId);
}

export async function isModelPreferred(modelId: string): Promise<boolean> {
  return storage.has(modelId);
}
