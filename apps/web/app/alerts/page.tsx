'use client';

import { useCallback, useEffect, useState } from 'react';
import { NavBar } from '@/app/components/NavBar';
import { useLocale } from '@/app/context/LocaleContext';
import {
  fetchAlertsHistory,
  fetchRules,
  createRule,
  updateRule,
  deleteRule,
} from '@/lib/api';

const INDICATOR_KEYS = [
  'macro.us10y',
  'macro.dxy',
  'eq.nasdaq',
  'eq.leaders',
  'crypto.btc',
  'sent.fng',
] as const;

const CONDITION_TYPES = [
  { value: 'cross_below', labelKey: 'alerts.conditionCrossBelow' },
  { value: 'cross_above', labelKey: 'alerts.conditionCrossAbove' },
  { value: 'trend_change', labelKey: 'alerts.conditionTrendChange' },
  { value: 'persistence', labelKey: 'alerts.conditionPersistence' },
] as const;

type Rule = { id: string; json_rule: Record<string, unknown>; is_enabled: boolean };

type AlertForm = {
  name: string;
  conditionType: string;
  indicatorKey: string;
  threshold: string;
  confirmations: string;
  is_enabled: boolean;
  sendEmail: boolean;
};

function buildJsonRule(form: AlertForm): Record<string, unknown> {
  const condition: Record<string, unknown> = {
    type: form.conditionType,
    indicatorKey: form.indicatorKey || undefined,
  };
  if (form.conditionType === 'cross_below' || form.conditionType === 'cross_above') {
    const t = parseFloat(form.threshold);
    if (!Number.isNaN(t)) condition.threshold = t;
    const c = parseInt(form.confirmations, 10);
    if (!Number.isNaN(c) && c >= 1) condition.confirmations = c;
  }
  if (form.conditionType === 'persistence') {
    const c = parseInt(form.confirmations, 10);
    if (!Number.isNaN(c) && c >= 1) condition.confirmations = c;
  }
  return {
    name: form.name,
    condition,
    actions: form.sendEmail ? ['email'] : [],
  };
}

function ruleToForm(rule: Rule): AlertForm {
  const j = rule.json_rule || {};
  const cond = (j.condition as Record<string, unknown>) || {};
  const actions = (j.actions as string[] | undefined) || [];
  return {
    name: String(j.name ?? ''),
    conditionType: String(cond.type ?? 'cross_below'),
    indicatorKey: String(cond.indicatorKey ?? INDICATOR_KEYS[0]),
    threshold: cond.threshold != null ? String(cond.threshold) : '',
    confirmations: cond.confirmations != null ? String(cond.confirmations) : '1',
    is_enabled: rule.is_enabled,
    sendEmail: actions.includes('email'),
  };
}

const emptyForm: AlertForm = {
  name: '',
  conditionType: 'cross_below',
  indicatorKey: INDICATOR_KEYS[0],
  threshold: '',
  confirmations: '1',
  is_enabled: true,
  sendEmail: true,
};

export default function AlertsPage() {
  const { t } = useLocale();
  const [fired, setFired] = useState<{ id: string; rule_id: string; ts: string; payload?: unknown }[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadData = useCallback(() => {
    Promise.all([fetchAlertsHistory('30d'), fetchRules()])
      .then(([hist, r]) => {
        setFired(Array.isArray(hist) ? hist : []);
        setRules(Array.isArray(r) ? r : []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setSubmitError(null);
    setFormOpen(true);
  };

  const openEdit = (rule: Rule) => {
    setEditingId(rule.id);
    setForm(ruleToForm(rule));
    setSubmitError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setSubmitError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitLoading(true);
    try {
      const json_rule = buildJsonRule(form);
      if (editingId) {
        await updateRule(editingId, { json_rule, is_enabled: form.is_enabled });
      } else {
        await createRule(json_rule);
      }
      loadData();
      closeForm();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('alerts.confirmDelete'))) return;
    setSubmitError(null);
    try {
      await deleteRule(id);
      loadData();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e));
    }
  };

  if (loading) return <div className="pt-16 p-8 text-slate-500 dark:text-slate-400">{t('common.loading')}</div>;
  if (error) return <div className="pt-16 p-8 text-red-500 dark:text-red-400">{t('common.error')}: {error}</div>;

  return (
    <main className="min-h-screen pt-16 px-4 sm:px-6 lg:px-8 pb-8 max-w-4xl mx-auto">
      <NavBar />
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">{t('alerts.title')}</h1>

      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('alerts.rules')}</h2>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors shadow-sm"
          >
            {t('alerts.createRule')}
          </button>
        </div>
        {submitError && <p className="mb-2 text-sm text-red-600 dark:text-red-400">{submitError}</p>}
        <ul className="space-y-2">
          {rules.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 flex flex-wrap items-center justify-between gap-2 shadow-sm"
            >
              <span className="font-mono text-sm text-slate-900 dark:text-slate-100">{String(r.json_rule?.name ?? r.id)}</span>
              <div className="flex items-center gap-2">
                <span className={r.is_enabled ? 'text-green-600 dark:text-green-400' : 'text-slate-400 dark:text-slate-500'}>
                  {r.is_enabled ? t('alerts.on') : t('alerts.off')}
                </span>
                <button
                  type="button"
                  onClick={() => openEdit(r)}
                  className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  {t('alerts.editRule')}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(r.id)}
                  className="text-sm text-red-600 dark:text-red-400 hover:underline"
                >
                  {t('alerts.deleteRule')}
                </button>
              </div>
            </li>
          ))}
        </ul>
        {rules.length === 0 && !formOpen && <p className="text-slate-500 dark:text-slate-400">{t('alerts.noRules')}</p>}
      </section>

      {formOpen && (
        <div className="mb-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <h3 className="text-md font-semibold text-slate-900 dark:text-slate-100 mb-3">
            {editingId ? t('alerts.editRule') : t('alerts.createRule')}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label htmlFor="rule-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('alerts.name')}
              </label>
              <input
                id="rule-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="rule-condition" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('alerts.conditionType')}
              </label>
              <select
                id="rule-condition"
                value={form.conditionType}
                onChange={(e) => setForm((f) => ({ ...f, conditionType: e.target.value }))}
                className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {CONDITION_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="rule-indicator" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('alerts.indicator')}
              </label>
              <select
                id="rule-indicator"
                value={form.indicatorKey}
                onChange={(e) => setForm((f) => ({ ...f, indicatorKey: e.target.value }))}
                className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {INDICATOR_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {t('dashboard.indicatorShortLabel.' + key) !== 'dashboard.indicatorShortLabel.' + key
                      ? t('dashboard.indicatorShortLabel.' + key)
                      : key}
                  </option>
                ))}
              </select>
            </div>
            {(form.conditionType === 'cross_below' || form.conditionType === 'cross_above') && (
              <div>
                <label htmlFor="rule-threshold" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('alerts.threshold')}
                </label>
                <input
                  id="rule-threshold"
                  type="number"
                  step="any"
                  value={form.threshold}
                  onChange={(e) => setForm((f) => ({ ...f, threshold: e.target.value }))}
                  className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}
            {(form.conditionType === 'cross_below' ||
              form.conditionType === 'cross_above' ||
              form.conditionType === 'persistence') && (
              <div>
                <label htmlFor="rule-confirmations" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('alerts.confirmations')}
                </label>
                <input
                  id="rule-confirmations"
                  type="number"
                  min={1}
                  value={form.confirmations}
                  onChange={(e) => setForm((f) => ({ ...f, confirmations: e.target.value }))}
                  className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                id="rule-enabled"
                type="checkbox"
                checked={form.is_enabled}
                onChange={(e) => setForm((f) => ({ ...f, is_enabled: e.target.checked }))}
                className="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="rule-enabled" className="text-sm text-slate-700 dark:text-slate-300">
                {t('alerts.enabled')}
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="rule-send-email"
                type="checkbox"
                checked={form.sendEmail}
                onChange={(e) => setForm((f) => ({ ...f, sendEmail: e.target.checked }))}
                className="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="rule-send-email" className="text-sm text-slate-700 dark:text-slate-300">
                {t('alerts.sendEmail')}
              </label>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('alerts.emailRecipientNote')}</p>
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={submitLoading}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                {submitLoading ? t('common.loading') : t('alerts.save')}
              </button>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                {t('alerts.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      <section>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">{t('alerts.firedAlerts')}</h2>
        <ul className="space-y-2">
          {fired.map((a) => (
            <li key={a.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-sm shadow-sm">
              <span className="text-slate-500 dark:text-slate-400">{new Date(a.ts).toLocaleString()}</span>
              <pre className="mt-1 overflow-auto text-slate-700 dark:text-slate-300">{JSON.stringify(a.payload ?? {}, null, 0)}</pre>
            </li>
          ))}
        </ul>
        {fired.length === 0 && <p className="text-slate-500 dark:text-slate-400">{t('alerts.noFired')}</p>}
      </section>
    </main>
  );
}
