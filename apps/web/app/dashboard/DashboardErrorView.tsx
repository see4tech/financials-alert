'use client';

import { NavBar } from '@/app/components/NavBar';

export type DashboardErrorViewProps = {
  error: string;
  t: (key: string) => string;
  runJobsNow: (secret?: string) => void;
  runJobsLoading: boolean;
  runJobsError: string | null;
  cronSecretPrompt: boolean;
  cronSecretInput: string;
  setCronSecretInput: (v: string) => void;
};

export function DashboardErrorView(props: DashboardErrorViewProps) {
  const {
    error,
    t,
    runJobsNow,
    runJobsLoading,
    runJobsError,
    cronSecretPrompt,
    cronSecretInput,
    setCronSecretInput,
  } = props;

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      <NavBar />
      <div className="mb-4 text-red-600">{t('common.error')}: {error}</div>
      <p className="mb-4 text-sm text-gray-600">{t('dashboard.errorHint')}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => runJobsNow()}
          disabled={runJobsLoading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {runJobsLoading ? t('dashboard.running') : t('dashboard.runJobs')}
        </button>
        {runJobsError && <p className="text-sm text-red-600">{runJobsError}</p>}
      </div>
      {cronSecretPrompt && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
          <label htmlFor="cron-secret-err" className="text-sm font-medium">{t('dashboard.cronSecretLabel')}</label>
          <input
            id="cron-secret-err"
            type="password"
            value={cronSecretInput}
            onChange={(e) => setCronSecretInput(e.target.value)}
            placeholder={t('dashboard.cronSecretPlaceholder')}
            className="rounded border border-amber-300 px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={() => runJobsNow(cronSecretInput)}
            disabled={runJobsLoading || !cronSecretInput.trim()}
            className="rounded bg-amber-600 px-3 py-1 text-sm text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {t('dashboard.runWithSecret')}
          </button>
        </div>
      )}
    </main>
  );
}
