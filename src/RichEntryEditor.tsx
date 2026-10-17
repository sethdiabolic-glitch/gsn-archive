import { ReferencePicker } from "./ReferencePicker";
import { useState, type ReactNode } from "react";
import { useBlocker } from "@tanstack/react-router";
import { EditorContent, useEditor } from "@tiptap/react";
import { entryEditorExtensions } from "./lib/entry-editor";
import {
  ArrowLeft,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Upload,
  Undo2,
  Redo2,
  Save,
  Table2,
  Plus,
  Trash2,
  Quote,
  Minus,
  Eye,
  Pencil,
  BookOpen,
} from "lucide-react";
import { uploadArchiveImage } from "./lib/community";
import { legacyToHtml, cleanEntryHtml, plainEntryText } from "./lib/entry-content";
import { RichDocument } from "./RichDocument";

function RibbonGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ribbon-group" role="group" aria-label={label}>
      <div className="ribbon-actions">{children}</div>
      <span className="ribbon-label">{label}</span>
    </div>
  );
}

export function RichEntryEditor({
  title,
  value,
  onSave,
  onBack,
  onDraftChange,
  draftStatus,
}: {
  title: string;
  value: string;
  onSave: (html: string) => void;
  onBack: () => void;
  onDraftChange?: (html: string) => void;
  draftStatus?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [tableHeader, setTableHeader] = useState(true);
  const [insertOpen, setInsertOpen] = useState(false);
  const [referenceOpen, setReferenceOpen] = useState(false);
  useBlocker({
    shouldBlockFn: () =>
      busy || (dirty && !window.confirm("Leave without applying your document changes?")),
    enableBeforeUnload: dirty || busy,
  });
  const editor = useEditor({
    extensions: entryEditorExtensions(),
    // Reserve *name* and **name** for archive references. Ribbon formatting still works.
    enableInputRules: [
      "heading",
      "bulletList",
      "orderedList",
      "blockquote",
      "codeBlock",
      "horizontalRule",
      "strike",
      "code",
    ],
    enablePasteRules: ["strike", "code", "link"],
    content: legacyToHtml(value),
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    onUpdate: ({ editor }) => {
      setDirty(true);
      onDraftChange?.(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "rich-document document-paper",
        "aria-label": `${title} editor`,
        role: "textbox",
        "aria-multiline": "true",
      },
    },
  });
  const disabled = !editor || busy || preview;
  const cmd = (
    label: string,
    active: boolean,
    action: () => void,
    icon: ReactNode,
    unavailable = false,
  ) => (
    <button
      type="button"
      className={`editor-tool ${active ? "active" : ""}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled || unavailable}
      onClick={action}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
  const insertImage = async (file: File) => {
    if (!editor) return;
    if (file.size > 12 * 1024 * 1024) {
      setError("Please keep summary images under 12 MB.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const src = await uploadArchiveImage(file);
      editor.chain().focus().setImage({ src, alt: file.name }).run();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image upload failed");
    } finally {
      setBusy(false);
    }
  };
  const inTable = !!editor?.isActive("table");
  const html = editor?.getHTML() || legacyToHtml(value);
  const words = plainEntryText(html).split(/\s+/).filter(Boolean).length;
  const blockStyle = editor?.isActive("heading", { level: 2 })
    ? "h2"
    : editor?.isActive("heading", { level: 3 })
      ? "h3"
      : "paragraph";

  return (
    <section className="document-editor" aria-label="Summary editor">
      <header className="document-header">
        <button
          type="button"
          className="btn ghost"
          disabled={busy}
          onClick={() => {
            if (!dirty || window.confirm("Discard unapplied document changes?")) onBack();
          }}
        >
          <ArrowLeft size={16} /> Back to entry
        </button>
        <div className="document-heading">
          <span className="eyebrow">Archive / document studio</span>
          <h2>{title}</h2>
        </div>
        <div className="row-actions">
          <button
            type="button"
            className="btn ghost"
            disabled={!editor || busy}
            aria-pressed={preview}
            onClick={() => {
              setPreview(!preview);
              setInsertOpen(false);
            }}
          >
            {preview ? <Pencil size={15} /> : <Eye size={15} />}
            {preview ? "Continue editing" : "Preview"}
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={!editor || busy}
            onClick={() => {
              if (editor) onSave(cleanEntryHtml(editor.getHTML()));
            }}
          >
            <Save size={15} /> Apply to draft
          </button>
        </div>
      </header>
      <p className="document-guidance">
        Format your summary, paste a table, or insert images. Wrap entry names or Appendix terms in
        *asterisks* (for example, *Anis*). Preview to test links. Apply it to the entry draft, then
        use <strong>Save file</strong> to publish.
      </p>
      {draftStatus && (
        <p className="draft-status" role="status">
          {draftStatus}
        </p>
      )}
      {!preview && (
        <div className="document-ribbon">
          <div className="document-toolbar" aria-label="Formatting ribbon">
            <RibbonGroup label="Text">
              <select
                aria-label="Paragraph style"
                className="select-input paragraph-style"
                value={blockStyle}
                disabled={disabled}
                onChange={(event) => {
                  const style = event.target.value;
                  if (style === "paragraph") editor?.chain().focus().setParagraph().run();
                  else
                    editor
                      ?.chain()
                      .focus()
                      .setHeading({ level: style === "h2" ? 2 : 3 })
                      .run();
                }}
              >
                <option value="paragraph">Normal text</option>
                <option value="h2">Heading</option>
                <option value="h3">Subheading</option>
              </select>
              {cmd(
                "Bold",
                !!editor?.isActive("bold"),
                () => editor?.chain().focus().toggleBold().run(),
                <Bold size={17} />,
              )}
              {cmd(
                "Italic",
                !!editor?.isActive("italic"),
                () => editor?.chain().focus().toggleItalic().run(),
                <Italic size={17} />,
              )}
              {cmd(
                "Underline",
                !!editor?.isActive("underline"),
                () => editor?.chain().focus().toggleUnderline().run(),
                <Underline size={17} />,
              )}
              {cmd(
                "Strike",
                !!editor?.isActive("strike"),
                () => editor?.chain().focus().toggleStrike().run(),
                <Strikethrough size={17} />,
              )}
            </RibbonGroup>
            <RibbonGroup label="Paragraph">
              {cmd(
                "Left",
                !!editor?.isActive({ textAlign: "left" }),
                () => editor?.chain().focus().setTextAlign("left").run(),
                <AlignLeft size={17} />,
              )}
              {cmd(
                "Center",
                !!editor?.isActive({ textAlign: "center" }),
                () => editor?.chain().focus().setTextAlign("center").run(),
                <AlignCenter size={17} />,
              )}
              {cmd(
                "Right",
                !!editor?.isActive({ textAlign: "right" }),
                () => editor?.chain().focus().setTextAlign("right").run(),
                <AlignRight size={17} />,
              )}
              {cmd(
                "Bullets",
                !!editor?.isActive("bulletList"),
                () => editor?.chain().focus().toggleBulletList().run(),
                <List size={17} />,
              )}
              {cmd(
                "Numbering",
                !!editor?.isActive("orderedList"),
                () => editor?.chain().focus().toggleOrderedList().run(),
                <ListOrdered size={17} />,
              )}
            </RibbonGroup>
            <RibbonGroup label="Insert">
              {cmd(
                "Reference",
                referenceOpen,
                () => setReferenceOpen(!referenceOpen),
                <BookOpen size={17} />,
              )}
              {cmd(
                "Quote",
                !!editor?.isActive("blockquote"),
                () => editor?.chain().focus().toggleBlockquote().run(),
                <Quote size={17} />,
              )}
              {cmd(
                "Divider",
                false,
                () => editor?.chain().focus().setHorizontalRule().run(),
                <Minus size={17} />,
              )}
              {cmd("Table", insertOpen, () => setInsertOpen(!insertOpen), <Table2 size={17} />)}
              <label className={`editor-tool image-insert ${disabled ? "disabled" : ""}`}>
                <Upload size={17} />
                <span>{busy ? "Uploading…" : "Image"}</span>
                <input
                  aria-label="Insert summary image"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  disabled={disabled}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void insertImage(file);
                  }}
                />
              </label>
            </RibbonGroup>
            <RibbonGroup label="History">
              {cmd(
                "Undo",
                false,
                () => editor?.chain().focus().undo().run(),
                <Undo2 size={17} />,
                !editor?.can().undo(),
              )}
              {cmd(
                "Redo",
                false,
                () => editor?.chain().focus().redo().run(),
                <Redo2 size={17} />,
                !editor?.can().redo(),
              )}
            </RibbonGroup>
          </div>
          {insertOpen && (
            <div className="table-insert-panel" role="group" aria-label="Insert table">
              <label>
                Rows
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={tableRows}
                  onChange={(event) => setTableRows(Number(event.target.value))}
                />
              </label>
              <label>
                Columns
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={tableCols}
                  onChange={(event) => setTableCols(Number(event.target.value))}
                />
              </label>
              <label className="check-control">
                <input
                  type="checkbox"
                  checked={tableHeader}
                  onChange={(event) => setTableHeader(event.target.checked)}
                />{" "}
                Header row
              </label>
              <button
                type="button"
                className="btn"
                disabled={
                  disabled ||
                  !Number.isInteger(tableRows) ||
                  tableRows < 1 ||
                  tableRows > 20 ||
                  !Number.isInteger(tableCols) ||
                  tableCols < 1 ||
                  tableCols > 10
                }
                onClick={() => {
                  editor
                    ?.chain()
                    .focus()
                    .insertTable({ rows: tableRows, cols: tableCols, withHeaderRow: tableHeader })
                    .run();
                  setInsertOpen(false);
                }}
              >
                <Plus size={14} /> Insert table
              </button>
            </div>
          )}
          {inTable && (
            <div className="table-context" role="group" aria-label="Table layout">
              <span className="ribbon-context-label">Table layout</span>
              {cmd(
                "Row above",
                false,
                () => editor?.chain().focus().addRowBefore().run(),
                <Plus size={15} />,
              )}
              {cmd(
                "Row below",
                false,
                () => editor?.chain().focus().addRowAfter().run(),
                <Plus size={15} />,
              )}
              {cmd(
                "Column left",
                false,
                () => editor?.chain().focus().addColumnBefore().run(),
                <Plus size={15} />,
              )}
              {cmd(
                "Column right",
                false,
                () => editor?.chain().focus().addColumnAfter().run(),
                <Plus size={15} />,
              )}
              {cmd(
                "Remove row",
                false,
                () => editor?.chain().focus().deleteRow().run(),
                <Minus size={15} />,
              )}
              {cmd(
                "Remove column",
                false,
                () => editor?.chain().focus().deleteColumn().run(),
                <Minus size={15} />,
              )}
              {cmd(
                "Header row",
                false,
                () => editor?.chain().focus().toggleHeaderRow().run(),
                <Table2 size={15} />,
              )}
              {cmd(
                "Merge cells",
                false,
                () => editor?.chain().focus().mergeCells().run(),
                <Table2 size={15} />,
                !editor?.can().mergeCells(),
              )}
              {cmd(
                "Split cell",
                false,
                () => editor?.chain().focus().splitCell().run(),
                <Table2 size={15} />,
                !editor?.can().splitCell(),
              )}
              {cmd(
                "Delete table",
                false,
                () => {
                  if (window.confirm("Delete this table and its contents?"))
                    editor?.chain().focus().deleteTable().run();
                },
                <Trash2 size={15} />,
              )}
            </div>
          )}
          {editor?.isActive("image") && (
            <div className="image-context">
              <label>
                Text wrapping
                <select
                  aria-label="Image text wrap"
                  className="select-input"
                  value={editor.getAttributes("image")["float"] || "none"}
                  onChange={(event) =>
                    editor
                      .chain()
                      .focus()
                      .updateAttributes("image", { float: event.target.value })
                      .run()
                  }
                >
                  <option value="none">Full width</option>
                  <option value="left">Image left, text right</option>
                  <option value="right">Image right, text left</option>
                </select>
              </label>
            </div>
          )}
        </div>
      )}
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {referenceOpen && !preview && (
        <ReferencePicker
          onClose={() => setReferenceOpen(false)}
          onInsert={(text) => editor?.chain().focus().insertContent({ type: "text", text }).run()}
        />
      )}
      <div className="document-status">
        <span>
          {preview
            ? "Reading preview · same styling as the published entry"
            : "Editing · Tab moves between table cells"}
        </span>
        <span>
          {words} {words === 1 ? "word" : "words"} · {dirty ? "Unapplied changes" : "Draft loaded"}
        </span>
      </div>
      <div className="document-canvas">
        {preview ? (
          <RichDocument value={html} />
        ) : editor ? (
          <EditorContent editor={editor} />
        ) : (
          <p role="status">Preparing your editor…</p>
        )}
      </div>
    </section>
  );
}
