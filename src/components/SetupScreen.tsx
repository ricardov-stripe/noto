import { useState } from 'react';
import { api } from '../api';

interface SetupScreenProps {
  onSave: (apiKey: string) => void;
}

/**
 * First-run screen — collects the Anthropic API key and stores it
 * server-side. Stylistic mate to the design system: same warm paper
 * background, terracotta accent, Cabinet Grotesk title.
 */
export function SetupScreen({ onSave }: SetupScreenProps) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);

  const handleSave = async () => {
    if (!key.trim()) {
      setError('Please enter an API key');
      return;
    }

    setTesting(true);
    setError('');

    try {
      await api.config.setApiKey(key.trim());
      onSave(key.trim());
    } catch {
      setError('Failed to save API key');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="setup-screen">
      <div className="setup-card">
        <h1>Welcome to Noto<span className="dot">.</span></h1>
        <p className="blurb">
          Add your Anthropic API key to enable AI task extraction from notes.
          The key is stored locally and only sent to Anthropic.
        </p>

        <label htmlFor="api-key">API key</label>
        <input
          id="api-key"
          type="password"
          autoComplete="off"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          placeholder="sk-ant-…"
        />

        {error && <div className="error">{error}</div>}

        <button className="cta" onClick={handleSave} disabled={testing}>
          {testing ? 'Saving…' : 'Get started'}
        </button>

        <p className="footnote">
          Your key never leaves your machine except to talk to Anthropic.
        </p>
      </div>
    </div>
  );
}
