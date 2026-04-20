import { useEffect, useRef, useState } from 'react';
import { api } from '../api';

interface SettingsModalProps {
  open: boolean;
  apiKey: string;
  onClose: () => void;
  onApiKeyChange: (next: string) => void;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Preferences modal: API key (masked, edit-in-place) plus a placeholder
 * for future preferences (model selection, calendar account, theme override).
 *
 * The current API key is rendered masked unless the user clicks Edit;
 * Save validates non-empty and round-trips through `api.config.setApiKey`,
 * then surfaces a transient saved/error state. Esc closes; backdrop click closes.
 */
export function SettingsModal({ open, apiKey, onClose, onApiKeyChange }: SettingsModalProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reset state every time the modal opens.
  useEffect(() => {
    if (open) {
      setEditing(false);
      setDraft('');
      setSaveState('idle');
      setError(null);
    }
  }, [open]);

  // Focus the input when entering edit mode.
  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [editing]);

  // Esc-to-close at the document level so the input doesn't have to own it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleSave = async () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setError('API key cannot be empty.');
      setSaveState('error');
      return;
    }
    setSaveState('saving');
    setError(null);
    try {
      await api.config.setApiKey(trimmed);
      onApiKeyChange(trimmed);
      setEditing(false);
      setDraft('');
      setSaveState('saved');
      // Auto-clear the "saved" badge after a beat.
      setTimeout(() => setSaveState('idle'), 1600);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save key.');
      setSaveState('error');
    }
  };

  if (!open) return null;

  return (
    <div
      className="settings-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="settings-modal" onMouseDown={(e) => e.stopPropagation()}>
        <header className="settings-head">
          <h2 id="settings-title" className="settings-title">Settings</h2>
          <button type="button" className="settings-close" aria-label="Close settings" onClick={onClose}>×</button>
        </header>

        <section className="settings-section">
          <h3 className="settings-section-title">Anthropic API key</h3>
          <p className="settings-section-help">
            Used to extract tasks from your notes. The key never leaves your device beyond
            calls to <code>api.anthropic.com</code>.
          </p>

          {!editing && (
            <div className="settings-row">
              <span className="settings-key-mask">{maskKey(apiKey)}</span>
              <button type="button" className="btn-ghost" onClick={() => { setDraft(''); setEditing(true); }}>
                {apiKey ? 'Replace' : 'Set key'}
              </button>
            </div>
          )}

          {editing && (
            <div className="settings-edit">
              <input
                ref={inputRef}
                type="password"
                className="settings-input"
                placeholder="sk-ant-…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSave();
                  }
                }}
                spellCheck={false}
                autoComplete="off"
              />
              <div className="settings-edit-actions">
                <button type="button" className="btn-ghost" onClick={() => { setEditing(false); setDraft(''); setError(null); setSaveState('idle'); }}>
                  Cancel
                </button>
                <button type="button" className="btn-primary" onClick={handleSave} disabled={saveState === 'saving'}>
                  {saveState === 'saving' ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          )}

          {saveState === 'saved' && <div className="settings-flash success">Saved.</div>}
          {saveState === 'error' && error && <div className="settings-flash error">{error}</div>}
        </section>

        <section className="settings-section muted">
          <h3 className="settings-section-title">Coming soon</h3>
          <ul className="settings-coming">
            <li>Model selection (Sonnet / Opus / Haiku)</li>
            <li>Google Calendar account &amp; working hours</li>
            <li>Editor preferences (font size, line height, ruler)</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

function maskKey(key: string): string {
  if (!key) return 'No key set';
  if (key.length <= 12) return '••••••••';
  return `${key.slice(0, 7)}••••••••${key.slice(-4)}`;
}
