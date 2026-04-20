import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useRef, useState } from 'react';
import { useEditorPretext } from '../hooks/useEditorPretext';

interface NoteEditorProps {
  noteId: number;
  title: string;
  content: string;
  folderName: string | null;
  updatedAt: string;
  isExtracting?: boolean;
  onTitleChange: (title: string) => void;
  onContentChange: (html: string) => void;
}

/**
 * Two-pane editor: plain `<input>` for the title, Tiptap (StarterKit +
 * Placeholder) for the body. Splitting them is more honest than the old
 * regex-extract approach and matches the API model (Note.title and
 * Note.content are separate fields server-side).
 *
 * Pretext measures the contenteditable body to drive the live LINES count
 * in the foot bar and the floating stats badge in App.tsx (the badge reads
 * the same data via context — see useEditorPretext).
 *
 * Title input remembers its DOM value across rapid edits without echoing
 * each keystroke through React, which keeps caret position stable.
 */
export function NoteEditor({
  noteId,
  title,
  content,
  folderName,
  updatedAt,
  isExtracting,
  onTitleChange,
  onContentChange,
}: NoteEditorProps) {
  const editorRootRef = useRef<HTMLElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const lastSavedTitleRef = useRef(title);
  const [savedFlash, setSavedFlash] = useState(false);

  const editor = useEditor(
    {
      extensions: [StarterKit, Placeholder.configure({ placeholder: 'Start writing…' })],
      content,
      editorProps: { attributes: { 'data-pretext': '' } },
      onUpdate: ({ editor }) => onContentChange(editor.getHTML()),
    },
    [noteId] // re-create when switching notes so initial content is set cleanly
  );

  // External content changes (e.g. note swap) — re-set editor body.
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || '<p></p>', { emitUpdate: false });
    }
  }, [content, editor]);

  // Keep the title input in sync when the active note changes from outside.
  useEffect(() => {
    if (titleInputRef.current && titleInputRef.current.value !== title) {
      titleInputRef.current.value = title;
      lastSavedTitleRef.current = title;
    }
  }, [title, noteId]);

  // Brief "SAVED" flash when content settles (debounced visual feedback).
  useEffect(() => {
    setSavedFlash(true);
    const t = window.setTimeout(() => setSavedFlash(false), 1200);
    return () => window.clearTimeout(t);
  }, [content, title]);

  const stats = useEditorPretext(editorRootRef);

  const wordCount = useWordCount(editor?.getText() ?? '');

  return (
    <main className="editor" aria-label="Note editor" ref={editorRootRef as React.RefObject<HTMLElement>}>
      <div className="editor-meta">
        <span>{formatDate(updatedAt)}</span>
        <span className="sep">·</span>
        <span>{formatTime(updatedAt)}</span>
        {folderName && (
          <>
            <span className="sep">·</span>
            <span className="folder-pill">{folderName.toUpperCase()}</span>
          </>
        )}
        <span className="ai-status">
          <span className="ai-pulse" aria-hidden="true" />
          {isExtracting ? 'Extracting…' : 'AI watching'}
        </span>
      </div>

      <div
        className="editor-scroll"
        onMouseDown={(e) => {
          // Clicking in any empty area of the canvas (below/around the
          // content) should place the caret at end of the document so the
          // user can start typing immediately — standard text-editor feel.
          const target = e.target as HTMLElement;
          if (
            target.closest('.ProseMirror') ||
            target.closest('input.note-title')
          ) {
            return;
          }
          if (!editor) return;
          e.preventDefault();
          editor.chain().focus('end').run();
        }}
      >
        <article className="canvas">
          <input
            ref={titleInputRef}
            className="note-title"
            type="text"
            defaultValue={title}
            placeholder="Untitled"
            spellCheck={false}
            onChange={(e) => onTitleChange(e.target.value)}
          />
          <div className="note-body">
            <EditorContent editor={editor} />
          </div>
        </article>
      </div>

      <div className="editor-foot">
        <span>
          <span>{wordCount}</span> WORDS · <span>{stats.ready ? stats.lineCount : '—'}</span> LINES
        </span>
        <span className={`saved${savedFlash ? '' : ''}`}>{savedFlash ? 'SAVED' : 'IDLE'}</span>
      </div>
    </main>
  );
}

/* ----- helpers ----- */

function useWordCount(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}
