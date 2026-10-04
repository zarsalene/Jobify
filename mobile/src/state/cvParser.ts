import { repo } from '@/api';
import { isOnline } from '@/lib/network';
import { createStore } from '@/lib/store';

import { setParsedCv } from './profile';

export interface CvParserState {
  status: 'idle' | 'uploading' | 'reading' | 'ready' | 'error';
  /** 0..1 across upload + reading. */
  progress: number;
  fileName?: string;
  error?: string;
}

/** Lives outside any screen so parsing continues in the background. */
export const cvParser = createStore<CvParserState>({ status: 'idle', progress: 0 });

export async function startCvParse(file: { name: string; size?: number; uri?: string; mimeType?: string }) {
  if (!isOnline()) {
    cvParser.set({ status: 'error', progress: 0, fileName: file.name, error: 'offline' });
    return;
  }
  cvParser.set({ status: 'uploading', progress: 0, fileName: file.name, error: undefined });
  try {
    const parsed = await repo.cv.parse(file, (p) => {
      cvParser.set({ progress: p, status: p < 0.3 ? 'uploading' : 'reading' });
    });
    setParsedCv(parsed);
    cvParser.set({ status: 'ready', progress: 1 });
  } catch (e) {
    // The server's explanation (wrong type, scanned image, too large) is shown as is.
    cvParser.set({ status: 'error', error: e instanceof Error && e.message ? e.message : 'failed' });
  }
}

export function resetCvParser() {
  cvParser.set({ status: 'idle', progress: 0, fileName: undefined, error: undefined });
}
