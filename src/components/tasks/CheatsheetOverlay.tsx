interface Props {
  open: boolean;
  onClose: () => void;
}

function Col({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="cheatsheet-col">
      <h3 className="cheatsheet-section-title">{title}</h3>
      <dl className="cheatsheet-list">
        {rows.map(([k, a]) => (
          <div key={k + a} className="cheatsheet-row">
            <dt>{k}</dt>
            <dd>{a}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function CheatsheetOverlay({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="cheatsheet-backdrop" role="presentation" onClick={onClose} onKeyDown={(e) => e.stopPropagation()}>
      <div
        className="cheatsheet-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cheatsheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="cheatsheet-title" className="cheatsheet-title">
          Cheatsheet
        </h2>
        <div className="cheatsheet-grid">
          <Col
            title="Global"
            rows={[
              ['c', 'Focus quick-add'],
              ['/', 'Focus search'],
              ['?', 'Toggle this sheet'],
            ]}
          />
          <Col
            title="Switch tab"
            rows={[
              ['g n', 'New'],
              ['g t', 'Today'],
              ['g u', 'Upcoming'],
              ['g a', 'All'],
              ['g d', 'Done'],
            ]}
          />
          <Col
            title="Navigation"
            rows={[
              ['j / ↓', 'Next row'],
              ['k / ↑', 'Previous row'],
              ['J', 'Next group header'],
              ['K', 'Previous group header'],
              ['Home / End', 'First / last row'],
              ['Space (header)', 'Toggle collapse'],
            ]}
          />
          <Col
            title="Per row"
            rows={[
              ['Enter', 'Edit title'],
              ['e', 'Edit description'],
              ['x', 'Toggle selection'],
              ['⌘A', 'Select all visible'],
              ['Esc', 'Clear selection'],
              ['Space', 'Cycle status'],
              ['1 / 2 / 3', 'Priority high / med / low'],
              ['0', 'Priority medium'],
              ['t / T / w / n', 'Due today / tomorrow / weekend / +7d'],
              ['r', 'Clear due'],
              ['s', 'Schedule into a free slot'],
              ['o', 'Open source note'],
              ['⌘D', 'Duplicate'],
              ['⌫ / Del', 'Delete'],
            ]}
          />
          <Col
            title="Edit mode"
            rows={[
              ['Enter', 'Save title'],
              ['Esc', 'Cancel'],
              ['Tab', 'Save title, focus due'],
              ['⌘Enter', 'Save description'],
            ]}
          />
          <Col
            title="Quick-add"
            rows={[
              ['Enter', 'Parse & create'],
              ['⌘Enter', 'Literal title'],
              ['Esc', 'Clear input'],
              ['↓', 'Move into list'],
            ]}
          />
          <Col
            title="Board view"
            rows={[
              ['Drag card', 'Move between columns'],
              ['Drag → rail slot', 'Schedule at that time'],
              ['Space', 'Pick up focused card'],
              ['↑ / ↓ / ← / →', 'Move while picked up'],
              ['Space / Enter', 'Drop'],
              ['Esc', 'Cancel pickup'],
              ['Header → List/Board', 'Switch view mode'],
            ]}
          />
        </div>
      </div>
    </div>
  );
}
