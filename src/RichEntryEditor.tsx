import { useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import { ArrowLeft, Bold, Italic, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Upload, Undo2, Redo2, Heading2, Save } from 'lucide-react';
import { uploadArchiveImage } from './lib/community';
import { legacyToHtml, cleanEntryHtml } from './lib/entry-content';

const FlowImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      float: { default: 'none', parseHTML: element => element.getAttribute('data-float') || 'none', renderHTML: attributes => ({ 'data-float': attributes['float'] }) },
    };
  },
});

export function RichEntryEditor({ title, value, onSave, onBack }: { title: string; value: string; onSave: (html: string) => void; onBack: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const editor = useEditor({
    extensions: [StarterKit, FlowImage.configure({ allowBase64: false }), TextAlign.configure({ types: ['heading', 'paragraph'] })],
    content: legacyToHtml(value),
    immediatelyRender: false,
    editorProps: { attributes: { class: 'document-paper', 'aria-label': `${title} editor` } },
  });
  const cmd = (label: string, active: boolean, action: () => void, icon: React.ReactNode) => <button type="button" className={`editor-tool ${active ? 'active' : ''}`} title={label} aria-label={label} onClick={action}>{icon}</button>;
  const insertImage = async (file: File) => {
    if (!editor) return;
    setBusy(true); setError('');
    try { const src = await uploadArchiveImage(file); editor.chain().focus().setImage({ src, alt: file.name }).run(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Image upload failed'); }
    finally { setBusy(false); }
  };
  return <div className="document-editor">
    <header className="document-header"><button type="button" className="btn ghost" onClick={onBack}><ArrowLeft size={16}/> Back to entry</button><div><span className="eyebrow">Archive / document editor</span><h2>{title}</h2></div><button type="button" className="btn primary" disabled={!editor || busy} onClick={() => { if (editor) onSave(cleanEntryHtml(editor.getHTML())); }}><Save size={15}/> Apply text</button></header>
    <div className="document-toolbar" aria-label="Formatting tools">
      {cmd('Bold', !!editor?.isActive('bold'), () => editor?.chain().focus().toggleBold().run(), <Bold size={17}/>)}
      {cmd('Italic', !!editor?.isActive('italic'), () => editor?.chain().focus().toggleItalic().run(), <Italic size={17}/>)}
      {cmd('Heading', !!editor?.isActive('heading', { level: 2 }), () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), <Heading2 size={17}/>)}
      {cmd('Bullet list', !!editor?.isActive('bulletList'), () => editor?.chain().focus().toggleBulletList().run(), <List size={17}/>)}
      {cmd('Numbered list', !!editor?.isActive('orderedList'), () => editor?.chain().focus().toggleOrderedList().run(), <ListOrdered size={17}/>)}
      <span className="tool-divider"/>
      {cmd('Align left', !!editor?.isActive({ textAlign: 'left' }), () => editor?.chain().focus().setTextAlign('left').run(), <AlignLeft size={17}/>)}
      {cmd('Align center', !!editor?.isActive({ textAlign: 'center' }), () => editor?.chain().focus().setTextAlign('center').run(), <AlignCenter size={17}/>)}
      {cmd('Align right', !!editor?.isActive({ textAlign: 'right' }), () => editor?.chain().focus().setTextAlign('right').run(), <AlignRight size={17}/>)}
      <span className="tool-divider"/>
      <label className="editor-tool" title="Insert image" aria-label="Insert image"><Upload size={17}/><input hidden type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void insertImage(file); }}/></label>
      {editor?.isActive('image') && <select aria-label="Image text wrap" className="select-input wrap-select" value={editor.getAttributes('image')['float'] || 'none'} onChange={e => editor.chain().focus().updateAttributes('image', { float: e.target.value }).run()}><option value="none">Image: full width</option><option value="left">Wrap text right</option><option value="right">Wrap text left</option></select>}
      <span className="tool-divider"/>
      {cmd('Undo', false, () => editor?.chain().focus().undo().run(), <Undo2 size={17}/>)}
      {cmd('Redo', false, () => editor?.chain().focus().redo().run(), <Redo2 size={17}/>)}
    </div>
    {error && <div className="form-error" role="alert">{error}</div>}
    <div className="document-canvas">{editor && <EditorContent editor={editor}/>}</div>
  </div>;
}
