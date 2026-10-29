/**
 * File Name      : syncQueue.js
 * Description    : Background jobs for the list page (AniList chronology fetching).
 *                  Jobs run one at a time (AniList is rate limited anyway) while the
 *                  UI stays usable; listeners are told about every state change so the
 *                  page can show what is happening.
 */

const jobs = [];            // queued + running jobs, in order
const failedJobs = new Map(); // key -> failed job (kept so the card can offer a retry)
const listeners = new Set();
let isRunning = false;

/**
 * Add a job to the queue. A job with the same key that is already queued or
 * running is not duplicated.
 * @param {{ key: string, kind: 'add' | 'inprogress', label: string, listName: string, run: () => Promise<any> }} job
 */
export function enqueueJob(job) {
  const existing = jobs.find((current) => current.key === job.key);
  if (existing) return existing.promise;

  failedJobs.delete(job.key);

  const entry = { ...job, state: 'queued', error: null };
  entry.promise = new Promise((resolve) => {
    entry.resolve = resolve;
  });
  jobs.push(entry);
  emit({ type: 'queued', job: entry });
  processQueue();
  return entry.promise;
}

/** Re-run a failed job with the same parameters */
export function retryJob(key) {
  const failed = failedJobs.get(key);
  if (!failed) return null;
  const { key: jobKey, kind, label, listName, run } = failed;
  return enqueueJob({ key: jobKey, kind, label, listName, run });
}

/**
 * State of a job for a given key
 * @returns {{ state: 'queued' | 'running' | 'error', error?: Error } | null}
 */
export function getJobState(key) {
  const job = jobs.find((current) => current.key === key);
  if (job) return { state: job.state };
  const failed = failedJobs.get(key);
  if (failed) return { state: 'error', error: failed.error };
  return null;
}

/** Snapshot of the queue, for the activity indicator */
export function getActivity() {
  const running = jobs.find((job) => job.state === 'running') || null;
  return {
    running,
    queuedCount: jobs.filter((job) => job.state === 'queued').length,
    failedCount: failedJobs.size,
  };
}

/** Listen to queue events: { type: 'queued' | 'running' | 'done' | 'error', job, result?, error? } */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function processQueue() {
  if (isRunning) return;
  isRunning = true;

  try {
    while (jobs.length) {
      // Things the user explicitly added go before the automatic "En cours" lookups
      const job = jobs.find((current) => current.kind === 'add') || jobs[0];
      job.state = 'running';
      emit({ type: 'running', job });

      try {
        const result = await job.run();
        removeJob(job);
        emit({ type: 'done', job, result });
        job.resolve({ ok: true, result });
      } catch (error) {
        console.warn(`Background job failed (${job.key})`, error);
        removeJob(job);
        job.state = 'error';
        job.error = error;
        failedJobs.set(job.key, job);
        emit({ type: 'error', job, error });
        job.resolve({ ok: false, error });
      }
    }
  } finally {
    isRunning = false;
  }
}

function removeJob(job) {
  const index = jobs.indexOf(job);
  if (index > -1) jobs.splice(index, 1);
}

function emit(event) {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch (error) {
      console.warn('syncQueue listener failed', error);
    }
  });
}
