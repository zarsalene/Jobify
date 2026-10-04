import type { EmploymentType, JobQuery, MatchLevel, Seniority, WorkMode } from '@/api';
import { createStore } from '@/lib/store';

export interface JobFilters {
  text: string;
  workModes: WorkMode[];
  employmentTypes: EmploymentType[];
  seniority: Seniority[];
  salaryMin?: number;
  minLevel?: MatchLevel;
  sort: 'best_match' | 'newest';
}

export const defaultFilters: JobFilters = {
  text: '',
  workModes: [],
  employmentTypes: [],
  seniority: [],
  salaryMin: undefined,
  minLevel: undefined,
  sort: 'best_match',
};

/** Shared between the Jobs list and the filter sheet. Not persisted on purpose. */
export const jobFilters = createStore<JobFilters>(defaultFilters);

export function activeFilterCount(f: JobFilters): number {
  return (
    (f.workModes.length ? 1 : 0) +
    (f.employmentTypes.length ? 1 : 0) +
    (f.seniority.length ? 1 : 0) +
    (f.salaryMin ? 1 : 0) +
    (f.minLevel ? 1 : 0) +
    (f.sort !== 'best_match' ? 1 : 0)
  );
}

export function toQuery(f: JobFilters): JobQuery {
  return {
    text: f.text || undefined,
    workModes: f.workModes,
    employmentTypes: f.employmentTypes,
    seniority: f.seniority,
    salaryMin: f.salaryMin,
    minLevel: f.minLevel,
    sort: f.sort,
  };
}

export function resetFilters() {
  jobFilters.set({ ...defaultFilters, text: jobFilters.get().text });
}
