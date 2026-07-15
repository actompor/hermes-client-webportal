import { useEffect, useState, type FormEvent } from "react";
import { fetchSettings, saveSettings } from "../api/client";
import type { SettingsResponse } from "../types";

export default function SettingsPage() {
  const [hermesApiBaseUrl, setHermesApiBaseUrl] = useState("");
  const [hermesApiKey, setHermesApiKey] = useState("");
  const [current, setCurrent] = useState<SettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const settings = await fetchSettings();
        if (cancelled) return;
        setCurrent(settings);
        setHermesApiBaseUrl(settings.hermesApiBaseUrl);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load settings");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const payload: { hermesApiBaseUrl: string; hermesApiKey?: string } = {
        hermesApiBaseUrl: hermesApiBaseUrl.trim(),
      };
      if (hermesApiKey.trim()) {
        payload.hermesApiKey = hermesApiKey.trim();
      }

      const saved = await saveSettings(payload);
      setCurrent(saved);
      setHermesApiKey("");
      setMessage(saved.message ?? "Settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Settings</h1>
        <p className="mt-1 text-sm text-mist">
          Configure how the portal backend connects to the Hermes Agent API.
        </p>
      </div>

      {loading && <p className="text-sm text-mist">Loading settings…</p>}

      {!loading && (
        <form
          onSubmit={onSave}
          className="space-y-4 rounded-xl border border-slate-200 bg-panel p-5 shadow-sm"
        >
          <div>
            <label
              htmlFor="hermesApiBaseUrl"
              className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-mist"
            >
              Hermes Agent API URL
            </label>
            <input
              id="hermesApiBaseUrl"
              value={hermesApiBaseUrl}
              onChange={(e) => setHermesApiBaseUrl(e.target.value)}
              placeholder="http://127.0.0.1:8642"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm text-ink outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/20"
              required
            />
            <p className="mt-1.5 text-xs text-mist">
              Portal backend will proxy all Hermes calls to this base URL.
            </p>
          </div>

          <div>
            <label
              htmlFor="hermesApiKey"
              className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-mist"
            >
              Hermes API Key
            </label>
            <input
              id="hermesApiKey"
              type="password"
              value={hermesApiKey}
              onChange={(e) => setHermesApiKey(e.target.value)}
              placeholder={
                current?.hermesApiKeyConfigured
                  ? `Configured (${current.hermesApiKeyPreview}) — leave blank to keep`
                  : "Paste API_SERVER_KEY"
              }
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm text-ink outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/20"
              autoComplete="off"
            />
          </div>

          {current && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Status:{" "}
              <span
                className={
                  current.hermesReachable
                    ? "font-medium text-emerald-700"
                    : "font-medium text-rose-700"
                }
              >
                {current.hermesReachable ? "Hermes reachable" : "Hermes unreachable"}
              </span>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}
          {message && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={saving || !hermesApiBaseUrl.trim()}
            className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0369a1] disabled:hover:bg-brand"
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
        </form>
      )}
    </div>
  );
}
