import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import type { Note, Task } from '../../api';
import { api } from '../../api';
import { applyView } from './taskFilters';
import { useTasksViewState } from './useTasksViewState';
import { TabStrip } from './TabStrip';
import { QuickAddBar } from './QuickAddBar';
import { ControlBar } from './ControlBar';
import { TaskGroup } from './TaskGroup';
import { BulkActionBar } from './BulkActionBar';
import { CheatsheetOverlay } from './CheatsheetOverlay';
import { useKeyboardNav, visibleRowIds } from './useKeyboardNav';
import { isUntriaged } from './TriagedPredicate';
import { NewTabBody } from './NewTabBody';
import { useNow } from './useNow';
import { stubCalendarProvider } from '../../lib/calendar';
import type { CalendarEvent } from '../../lib/calendar';
import { computeFreeSlots } from '../../lib/timeSlots';
import { TodayPlate, partitionPlateSections, localDateYmd } from './TodayPlate';
import { TodayStrip } from './TodayStrip';
import { TaskRow } from './TaskRow';
import { dueBucket } from './taskFilters';

/** Props for the tasks view: full task/note state plus status and refresh callbacks. */
export interface TasksViewProps {
  tasks: Task[];
  notes: Note[];
  onUpdateStatus: (id: number, status: Task['status']) => void;
  onNavigateToNote: (noteId: number) => void;
  onRefreshTasks: () => void | Promise<void>;
}

export function TasksView({
  tasks,
  notes,
  onUpdateStatus,
  onNavigateToNote,
  onRefreshTasks,
}: TasksViewProps) {
  const {
    view,
    setSearch,
    setStatus,
    setPriority,
    setDue,
    setSort,
    setGroup,
    setTab,
    toggleCollapsed,
    select,
    clearSelection,
  } = useTasksViewState();

  const refresh = useCallback(async () => {
    await onRefreshTasks();
  }, [onRefreshTasks]);

  const handleUpdateTask = useCallback(
    async (
      id: number,
      patch: Partial<Pick<Task, 'title' | 'description' | 'priority' | 'dueDate'>>,
    ) => {
      try {
        await api.tasks.update(id, patch);
        await refresh();
      } catch {
        await refresh();
      }
    },
    [refresh],
  );

  const handleCreateTask = useCallback(
    async (data: {
      title: string;
      priority: Task['priority'];
      dueDate: string | null;
      sourceNoteId: number | null;
    }): Promise<Task | null> => {
      try {
        const task = await api.tasks.create({
          title: data.title,
          description: '',
          priority: data.priority,
          status: 'todo',
          dueDate: data.dueDate,
          sourceNoteId: data.sourceNoteId,
          sourceText: '',
        });
        await refresh();
        return task;
      } catch {
        await refresh();
        return null;
      }
    },
    [refresh],
  );

  const handleDeleteTask = useCallback(
    async (id: number) => {
      try {
        await api.tasks.delete(id);
        await refresh();
      } catch {
        await refresh();
      }
    },
    [refresh],
  );

  const counts = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return {
      new: tasks.filter(isUntriaged).length,
      today: tasks.filter(
        (t) =>
          t.status !== 'done' &&
          t.dueDate != null &&
          t.dueDate.slice(0, 10) <= todayStr,
      ).length,
      upcoming: tasks.filter(
        (t) =>
          t.status !== 'done' &&
          t.dueDate != null &&
          t.dueDate.slice(0, 10) > todayStr,
      ).length,
      all: tasks.filter((t) => t.status !== 'done').length,
      done: tasks.filter((t) => t.status === 'done').length,
    };
  }, [tasks]);

  const groups = useMemo(() => applyView(tasks, view), [tasks, view]);

  const now = useNow();
  const flatTaskList = useMemo(() => groups.flatMap((g) => g.tasks), [groups]);

  const todayTabScopedTasks = useMemo(
    () =>
      flatTaskList.filter((t) => {
        const b = dueBucket(t.dueDate);
        return b === 'overdue' || b === 'today';
      }),
    [flatTaskList],
  );

  const navGroups = useMemo(() => {
    if (view.tab !== 'today') return groups;
    const ymd = localDateYmd(now);
    const { overdue, scheduled, today } = partitionPlateSections(todayTabScopedTasks, ymd);
    return [{ key: 'all', label: 'All', tasks: [...overdue, ...scheduled, ...today] }];
  }, [view.tab, groups, todayTabScopedTasks, now]);

  const { dayStartIso, dayEndIso } = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const ds = new Date(d);
    ds.setHours(8, 0, 0, 0);
    const de = new Date(d);
    de.setHours(20, 0, 0, 0);
    return { dayStartIso: ds.toISOString(), dayEndIso: de.toISOString() };
  }, [now]);

  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  useEffect(() => {
    let cancelled = false;
    void stubCalendarProvider.getEvents(dayStartIso, dayEndIso).then((ev) => {
      if (!cancelled) setCalendarEvents(ev);
    });
    return () => {
      cancelled = true;
    };
  }, [dayStartIso, dayEndIso]);

  const scheduledTodayForStrip = useMemo(() => {
    const ymd = localDateYmd(now);
    return partitionPlateSections(todayTabScopedTasks, ymd).scheduled;
  }, [todayTabScopedTasks, now]);

  const stripBlockers = useMemo(() => {
    const addMin = (iso: string, min: number) => {
      const x = new Date(iso);
      x.setTime(x.getTime() + min * 60_000);
      return x.toISOString();
    };
    const TASK_BLOCK_MIN = 30;
    return [
      ...calendarEvents.map((e) => ({ start: e.start, end: e.end })),
      ...scheduledTodayForStrip.map((t) => ({
        start: t.dueDate!,
        end: addMin(t.dueDate!, TASK_BLOCK_MIN),
      })),
    ];
  }, [calendarEvents, scheduledTodayForStrip]);

  const freeSlots = useMemo(
    () => computeFreeSlots(dayStartIso, dayEndIso, stripBlockers, 15),
    [dayStartIso, dayEndIso, stripBlockers],
  );

  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);
  const [editTitleTrigger, setEditTitleTrigger] = useState<number | null>(null);
  const [editDescTrigger, setEditDescTrigger] = useState<number | null>(null);

  const noteRefs = useMemo(
    () => notes.map((n) => ({ id: n.id, title: n.title })),
    [notes],
  );

  const navOptions = useMemo(
    () => ({
      tasks,
      groups: navGroups,
      collapsed: view.collapsed,
      selection: view.selection,
      onUpdateStatus,
      onUpdateTask: handleUpdateTask,
      onDeleteTask: handleDeleteTask,
      onCreateTask: handleCreateTask,
      onNavigateToNote,
      onSelect: select,
      onClearSelection: clearSelection,
      onToggleCollapsed: toggleCollapsed,
      onShowCheatsheet: () => setCheatsheetOpen((open) => !open),
      onStartEditTitle: (id: number) => setEditTitleTrigger(id),
      onStartEditDesc: (id: number) => setEditDescTrigger(id),
      onTabSwitch: setTab,
    }),
    [
      tasks,
      navGroups,
      view.collapsed,
      view.selection,
      onUpdateStatus,
      handleUpdateTask,
      handleDeleteTask,
      handleCreateTask,
      onNavigateToNote,
      select,
      clearSelection,
      toggleCollapsed,
      setTab,
    ],
  );

  const { focusedId, focusedGroupKey, handleKeyDown, setFocusedId } =
    useKeyboardNav(navOptions);

  const prevTabRef = useRef(view.tab);
  useEffect(() => {
    if (prevTabRef.current !== view.tab) {
      prevTabRef.current = view.tab;
      setFocusedId(null);
    }
  }, [view.tab, setFocusedId]);

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      handleKeyDown(e as unknown as ReactKeyboardEvent<Element>);
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [handleKeyDown]);

  const handleRowMouseDown = useCallback(
    (e: ReactMouseEvent, taskId: number) => {
      if (!e.shiftKey && !e.metaKey && !e.ctrlKey) return;
      e.preventDefault();
      if (e.metaKey || e.ctrlKey) select([taskId], 'toggle');
      else if (e.shiftKey) select([taskId], 'add');
    },
    [select],
  );

  const selectedTasks = useMemo(
    () => tasks.filter((t) => view.selection.has(t.id)),
    [tasks, view.selection],
  );

  const bulkAllDone =
    selectedTasks.length > 0 &&
    selectedTasks.every((t) => t.status === 'done');

  const bulkComplete = useCallback(async () => {
    const ids = [...view.selection];
    try {
      await Promise.all(ids.map((id) => api.tasks.update(id, { status: 'done' })));
    } finally {
      await refresh();
      clearSelection();
    }
  }, [view.selection, refresh, clearSelection]);

  const bulkReopen = useCallback(async () => {
    const ids = [...view.selection];
    try {
      await Promise.all(ids.map((id) => api.tasks.update(id, { status: 'todo' })));
    } finally {
      await refresh();
      clearSelection();
    }
  }, [view.selection, refresh, clearSelection]);

  const bulkSetDue = useCallback(
    async (date: string | null) => {
      const ids = [...view.selection];
      try {
        await Promise.all(ids.map((id) => api.tasks.update(id, { dueDate: date })));
      } finally {
        await refresh();
        clearSelection();
      }
    },
    [view.selection, refresh, clearSelection],
  );

  const bulkSetPriority = useCallback(
    async (p: Task['priority']) => {
      const ids = [...view.selection];
      try {
        await Promise.all(ids.map((id) => api.tasks.update(id, { priority: p })));
      } finally {
        await refresh();
        clearSelection();
      }
    },
    [view.selection, refresh, clearSelection],
  );

  const bulkDelete = useCallback(async () => {
    const ids = [...view.selection];
    try {
      await Promise.all(ids.map((id) => api.tasks.delete(id)));
    } finally {
      await refresh();
      clearSelection();
    }
  }, [view.selection, refresh, clearSelection]);

  const untriagedTasks = useMemo(() => tasks.filter(isUntriaged), [tasks]);

  const handleTriageAllToToday = useCallback(async () => {
    const todayIso = new Date().toISOString().slice(0, 10);
    try {
      await Promise.all(
        untriagedTasks.map((t) => api.tasks.update(t.id, { dueDate: todayIso })),
      );
    } finally {
      await refresh();
    }
  }, [untriagedTasks, refresh]);

  const handleDismissAllToLater = useCallback(async () => {
    try {
      // Empty patch bumps updatedAt, marking each task as triaged without
      // changing anything else. They drop out of NEW and flow to All / Upcoming.
      await Promise.all(untriagedTasks.map((t) => api.tasks.update(t.id, {})));
    } finally {
      await refresh();
    }
  }, [untriagedTasks, refresh]);

  const hideSortGroup = view.tab === 'today' || view.tab === 'new';

  const listEmpty =
    view.tab !== 'today' &&
    (groups.length === 0 || groups.every((g) => g.tasks.length === 0));

  return (
    <div className="tasks-view">
      <header className="tasks-view__header">
        <h1 className="tasks-view__title">Tasks</h1>
        <div className="tasks-view__meta">
          {counts.all} OPEN · {counts.done} DONE
        </div>
      </header>
      <TabStrip active={view.tab} counts={counts} onChange={setTab} />
      <div className="tasks-view__pad">
        <QuickAddBar
          notes={noteRefs}
          onCreate={handleCreateTask}
          onArrowDown={() => {
            const ids = visibleRowIds(navGroups, view.collapsed);
            if (ids.length) setFocusedId(ids[0]!);
          }}
        />
        <ControlBar
          view={view}
          setSearch={setSearch}
          setStatus={setStatus}
          setPriority={setPriority}
          setDue={setDue}
          setSort={setSort}
          setGroup={setGroup}
          hideSortGroup={hideSortGroup}
        />
        {view.selection.size > 0 && (
          <BulkActionBar
            count={view.selection.size}
            allDone={bulkAllDone}
            onComplete={() => void bulkComplete()}
            onReopen={() => void bulkReopen()}
            onSetDue={(d) => void bulkSetDue(d)}
            onSetPriority={(p) => void bulkSetPriority(p)}
            onDelete={() => void bulkDelete()}
            onClear={clearSelection}
          />
        )}
      </div>
      <div
        className={
          view.tab === 'today'
            ? 'tasks-view__body tasks-view__body--today'
            : 'tasks-view__body'
        }
      >
        {(() => {
          const groupsRendered = groups.map((g) => (
            <TaskGroup
              key={g.key}
              group={g}
              collapsed={!!view.collapsed[g.key]}
              selection={view.selection}
              focusedId={focusedId}
              focusedGroupKey={focusedGroupKey}
              onRowMouseDown={handleRowMouseDown}
              editTitleTrigger={editTitleTrigger}
              onConsumeTitleTrigger={() => setEditTitleTrigger(null)}
              editDescTrigger={editDescTrigger}
              onConsumeDescTrigger={() => setEditDescTrigger(null)}
              onToggleCollapsed={toggleCollapsed}
              onUpdateStatus={onUpdateStatus}
              onNavigateToNote={onNavigateToNote}
              onUpdateTask={handleUpdateTask}
              onCreateTask={handleCreateTask}
              onDeleteTask={handleDeleteTask}
              notes={notes}
            />
          ));

          if (view.tab === 'new') {
            const flatFiltered = groups.flatMap((g) => g.tasks);
            return (
              <NewTabBody
                tasks={flatFiltered}
                notes={notes}
                onTriageAllToToday={() => void handleTriageAllToToday()}
                onDismissAllToLater={() => void handleDismissAllToLater()}
              >
                {groupsRendered}
              </NewTabBody>
            );
          }

          if (view.tab === 'today') {
            return (
              <div className="tasks-view__today-layout">
                <div className="tasks-view__today-plate">
                  <TodayPlate tasks={todayTabScopedTasks} now={now}>
                    {(section, sectionTasks) =>
                      sectionTasks.map((t) => (
                        <TaskRow
                          key={t.id}
                          task={t}
                          selected={view.selection.has(t.id)}
                          focused={focusedId === t.id}
                          onRowMouseDown={handleRowMouseDown}
                          editTitleTrigger={editTitleTrigger}
                          onConsumeTitleTrigger={() => setEditTitleTrigger(null)}
                          editDescTrigger={editDescTrigger}
                          onConsumeDescTrigger={() => setEditDescTrigger(null)}
                          onUpdateStatus={onUpdateStatus}
                          onNavigateToNote={onNavigateToNote}
                          onUpdateTask={handleUpdateTask}
                          onCreateTask={handleCreateTask}
                          onDeleteTask={handleDeleteTask}
                          notes={notes}
                        />
                      ))
                    }
                  </TodayPlate>
                </div>
                <TodayStrip
                  now={now}
                  events={calendarEvents}
                  scheduledTasks={scheduledTodayForStrip}
                  freeSlots={freeSlots}
                  dayStart={dayStartIso}
                  dayEnd={dayEndIso}
                />
              </div>
            );
          }

          return listEmpty ? (
            <div className="empty-section" role="status">
              No tasks match this view.
            </div>
          ) : (
            groupsRendered
          );
        })()}
      </div>
      <CheatsheetOverlay
        open={cheatsheetOpen}
        onClose={() => setCheatsheetOpen(false)}
      />
    </div>
  );
}
