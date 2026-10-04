import type {
  Application,
  ApplicationStatus,
  Approval,
  CvChange,
  CvItem,
  Draft,
  ImportPreview,
  Job,
  JobQuery,
  MatchResult,
  ParsedCv,
  PrepRun,
  Reminder,
  SearchSetup,
  SendResult,
  UsageInfo,
} from './types';

/** A job plus its match summary, as shown in feeds. */
export interface JobListItem {
  job: Job;
  match: Pick<MatchResult, 'score' | 'level'>;
  /** Set when the job is already in the user's applications. */
  applicationId?: string;
  applicationStatus?: ApplicationStatus;
}

export interface RepoSnapshot {
  jobs: Job[];
  applications: Application[];
  runs: PrepRun[];
  approvals: Approval[];
}

/** Error thrown by repository calls when content can't be understood. */
export class ParsingError extends Error {
  constructor(
    message: string,
    public reason: 'invalid_url' | 'unreadable' | 'unsupported',
  ) {
    super(message);
    this.name = 'ParsingError';
  }
}

/**
 * The typed data contract for everything except auth.
 * Today it is implemented by `src/api/mock` (sample data, in memory). A real
 * implementation can replace it behind the same interface without UI changes.
 */
export interface Repository {
  profile: {
    /** Tell the "server" the user's search setup + confirmed CV skills so matching can use them. */
    sync(input: { setup?: SearchSetup; cvItems?: CvItem[] }): void;
  };
  cv: {
    /** Simulates upload + parsing. `onProgress` reports 0..1 for the upload part. */
    parse(file: { name: string; size?: number }, onProgress?: (p: number) => void): Promise<ParsedCv>;
  };
  jobs: {
    list(q?: JobQuery): Promise<JobListItem[]>;
    recommended(): Promise<JobListItem[]>;
    get(id: string): Promise<Job>;
    match(id: string): Promise<MatchResult>;
    importPreview(url: string): Promise<ImportPreview>;
    /** Persist the imported job so it can be matched and saved. */
    importConfirm(preview: ImportPreview): Promise<Job>;
  };
  applications: {
    list(): Promise<Application[]>;
    create(job: Job, status: ApplicationStatus, match?: Pick<MatchResult, 'score' | 'level'>): Promise<Application>;
    updateStatus(id: string, status: ApplicationStatus): Promise<Application>;
    remove(id: string): Promise<void>;
    updateNotes(id: string, notes: string): Promise<Application>;
    setReminder(id: string, reminder: Reminder | null): Promise<Application>;
  };
  prep: {
    start(job: Job, userName: string): Promise<PrepRun>;
    /** Steps advance with time; poll to see progress. */
    get(runId: string): Promise<PrepRun>;
    retryStep(runId: string): Promise<PrepRun>;
    saveDraft(runId: string, draft: Draft): Promise<PrepRun>;
    regenerate(runId: string, kind: Draft['kind'], tone?: string): Promise<Draft>;
    setCvChange(runId: string, changeId: string, status: CvChange['status']): Promise<PrepRun>;
    /** Builds the approval request for sending the finished application. Nothing is sent. */
    requestApproval(runId: string): Promise<Approval>;
  };
  approvals: {
    list(): Promise<Approval[]>;
    get(id: string): Promise<Approval>;
    /** Register a new pending approval (e.g. created by the assistant). Nothing is executed. */
    create(approval: Approval): Promise<Approval>;
    /** The only call that "sends". Requires an explicit user action in the UI. */
    approve(id: string): Promise<SendResult>;
    cancel(id: string): Promise<Approval>;
  };
  usage: {
    get(): Promise<UsageInfo>;
  };
  /** Developer switches that make the mock fail, to exercise error states. */
  dev: {
    /** Re-seed the in-memory "server" from the app's persisted cache after a restart. */
    hydrate(snapshot: Partial<RepoSnapshot>): void;
    setSimulateSendFailure(v: boolean): void;
    setSimulatePrepFailure(v: boolean): void;
  };
}
