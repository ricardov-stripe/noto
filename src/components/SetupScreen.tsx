import { useState } from 'react';
import { api } from '../api';

interface SetupScreenProps {
  onSave: (apiKey: string) => void;
}

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
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      background: '#f8f9fa',
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: 40, width: 400,
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 24 }}>Welcome to Noto</h1>
        <p style={{ color: '#666', fontSize: 14, margin: '0 0 24px' }}>
          Enter your Anthropic API key to enable AI task extraction from your notes.
        </p>

        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
          API Key
        </label>
        <input
          type="password"
          value={key}
          onChange={e => setKey(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder="sk-ant-..."
          style={{
            width: '100%', padding: '10px 12px', fontSize: 14,
            border: '1px solid #ddd', borderRadius: 6, boxSizing: 'border-box',
          }}
        />

        {error && <div style={{ color: '#e53e3e', fontSize: 13, marginTop: 8 }}>{error}</div>}

        <button
          onClick={handleSave}
          disabled={testing}
          style={{
            width: '100%', padding: '10px 16px', marginTop: 16,
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
            background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6,
            opacity: testing ? 0.6 : 1,
          }}
        >
          {testing ? 'Saving...' : 'Get Started'}
        </button>

        <p style={{ color: '#999', fontSize: 11, marginTop: 16, textAlign: 'center' }}>
          Your key is stored locally and never sent anywhere except the Anthropic API.
        </p>
      </div>
    </div>
  );
}
