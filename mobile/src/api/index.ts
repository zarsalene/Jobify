import { authApi } from './auth';
import { mockRepository } from './mock';
import type { Repository } from './repository';

/** Real backend: auth + current user. */
export { authApi };
/** Typed data layer. Currently the clearly-marked mock; swap here for real endpoints. */
export const repo: Repository = mockRepository;

export * from './types';
export { ApiError, serverStatus, API_BASE } from './client';
export { ParsingError } from './repository';
export type { JobListItem } from './repository';
