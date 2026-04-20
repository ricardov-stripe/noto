import { IconMoon, IconSearch, IconSun } from './Icons';

interface TitlebarProps {
  /** Active section name (e.g. folder + note title) for the breadcrumb. */
  crumb?: { folder?: string; note?: string };
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenSearch?: () => void;
}

/**
 * macOS-style window chrome with breadcrumb + theme toggle.
 *
 * The dots are decorative — when running outside Electron they're just
 * visual continuity for users coming from the desktop app. The title bar
 * itself is `-webkit-app-region: drag` for Electron; in the browser it
 * acts as a normal header.
 */
export function Titlebar({ crumb, theme, onToggleTheme, onOpenSearch }: TitlebarProps) {
  const folder = crumb?.folder ?? 'Notes';
  const note = crumb?.note;

  return (
    <header className="titlebar" aria-label="Window">
      <div className="dots" aria-hidden="true">
        <span className="dot close" />
        <span className="dot min" />
        <span className="dot max" />
      </div>
      <div className="crumbs">
        <strong>Noto</strong> <span>›</span> {folder}
        {note && <> <span>›</span> {note}</>}
      </div>
      <div className="actions">
        <button
          className="icon-btn"
          type="button"
          title="Search"
          aria-label="Search"
          onClick={onOpenSearch}
        >
          <IconSearch />
        </button>
        <button
          className="icon-btn"
          type="button"
          title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
          aria-label="Toggle theme"
          onClick={onToggleTheme}
        >
          {theme === 'dark' ? <IconSun /> : <IconMoon />}
        </button>
      </div>
    </header>
  );
}
