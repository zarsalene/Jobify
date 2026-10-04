import { authApi } from './auth';
import { httpRepository } from './http';
import { mockRepository } from './mock';
import type { Repository } from './repository';

/** Real backend: auth + current user. */
export { authApi };

/**
 * Sample data only when explicitly asked for (EXPO_PUBLIC_USE_SAMPLE_DATA=1), e.g. for demos
 * or design reviews without a server. Everything else talks to the real backend.
 */
export const USING_SAMPLE_DATA = process.env.EXPO_PUBLIC_USE_SAMPLE_DATA === '1';
export const repo: Repository = USING_SAMPLE_DATA ? mockRepository : httpRepository;

export * from './types';
export { ApiError, serverStatus, API_BASE } from './client';
export { ParsingError } from './repository';
export type { JobListItem } from './repository';
