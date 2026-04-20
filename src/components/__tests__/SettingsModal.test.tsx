import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsModal } from '../SettingsModal';
import { api } from '../../api';

vi.mock('../../api', () => ({
  api: {
    config: {
      setApiKey: vi.fn(),
    },
  },
}));

describe('SettingsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaults = {
    open: true,
    apiKey: 'sk-ant-12345abcdefghxyz',
    onClose: vi.fn(),
    onApiKeyChange: vi.fn(),
  };

  it('returns null when closed', () => {
    const { container } = render(<SettingsModal {...defaults} open={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders masked api key by default', () => {
    render(<SettingsModal {...defaults} />);
    expect(screen.getByText('sk-ant-••••••••hxyz')).toBeInTheDocument();
  });

  it('shows "No key set" when key is empty', () => {
    render(<SettingsModal {...defaults} apiKey="" />);
    expect(screen.getByText('No key set')).toBeInTheDocument();
    expect(screen.getByText('Set key')).toBeInTheDocument();
  });

  it('enters edit mode and saves a new key', async () => {
    (api.config.setApiKey as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const onApiKeyChange = vi.fn();
    render(<SettingsModal {...defaults} onApiKeyChange={onApiKeyChange} />);
    fireEvent.click(screen.getByText('Replace'));
    const input = screen.getByPlaceholderText('sk-ant-…');
    fireEvent.change(input, { target: { value: 'sk-ant-newkey0987654321' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(api.config.setApiKey).toHaveBeenCalledWith('sk-ant-newkey0987654321'));
    expect(onApiKeyChange).toHaveBeenCalledWith('sk-ant-newkey0987654321');
  });

  it('shows error when saving an empty key', () => {
    render(<SettingsModal {...defaults} />);
    fireEvent.click(screen.getByText('Replace'));
    fireEvent.click(screen.getByText('Save'));
    expect(screen.getByText('API key cannot be empty.')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<SettingsModal {...defaults} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close settings'));
    expect(onClose).toHaveBeenCalled();
  });

  it('cancels edit mode without saving', () => {
    render(<SettingsModal {...defaults} />);
    fireEvent.click(screen.getByText('Replace'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.getByText('Replace')).toBeInTheDocument();
    expect(api.config.setApiKey).not.toHaveBeenCalled();
  });
});
