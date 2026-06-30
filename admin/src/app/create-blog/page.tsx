'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import {
  FaBold, FaItalic, FaUnderline, FaStrikethrough, FaCode, FaLink, FaUnlink,
  FaListUl, FaListOl, FaQuoteLeft, FaAlignLeft, FaAlignCenter, FaAlignRight,
  FaAlignJustify, FaImage, FaUndo, FaRedo, FaHighlighter, FaMinus, FaSave,
  FaArrowLeft, FaNewspaper, FaTimes, FaPlus, FaEye, FaCodeBranch,
} from 'react-icons/fa';
import {
  MdFormatClear,
} from 'react-icons/md';
import { useAdmin } from '@/components/admin/AdminProvider';
import { fetchAdminBlog, createBlog, updateBlog, uploadBlogCover } from '@/components/admin/admin-api';

// ─── Toolbar Button ────────────────────────────────────────────────────────
function TBtn({
  onClick, active, disabled, title, children,
}: {
  onClick: () => void; active?: boolean; disabled?: boolean; title: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      disabled={disabled}
      title={title}
      className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm transition select-none
        ${active ? 'bg-emerald-500/25 text-emerald-400' : 'text-slate-400 hover:bg-white/10 hover:text-white'}
        disabled:opacity-30`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="mx-1 h-6 w-px bg-white/10" />;
}

// ─── Toolbar ───────────────────────────────────────────────────────────────
function Toolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);

  if (!editor) return null;

  const applyLink = () => {
    if (linkUrl.trim()) {
      editor.chain().focus().setLink({ href: linkUrl.trim() }).run();
    }
    setLinkUrl('');
    setShowLinkInput(false);
  };

  const handleImageUrl = () => {
    const url = window.prompt('Enter image URL:');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 rounded-t-2xl border-b border-white/10 bg-slate-900/95 px-3 py-2 backdrop-blur">
      {/* Undo/Redo */}
      <TBtn title="Undo (Ctrl+Z)" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
        <FaUndo size={12} />
      </TBtn>
      <TBtn title="Redo (Ctrl+Y)" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
        <FaRedo size={12} />
      </TBtn>
      <Divider />

      {/* Headings */}
      <TBtn title="Heading 1" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <span className="text-xs font-bold">H1</span>
      </TBtn>
      <TBtn title="Heading 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <span className="text-xs font-bold">H2</span>
      </TBtn>
      <TBtn title="Heading 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <span className="text-xs font-bold">H3</span>
      </TBtn>
      <Divider />

      {/* Inline formatting */}
      <TBtn title="Bold (Ctrl+B)" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <FaBold size={12} />
      </TBtn>
      <TBtn title="Italic (Ctrl+I)" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <FaItalic size={12} />
      </TBtn>
      <TBtn title="Underline (Ctrl+U)" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <FaUnderline size={12} />
      </TBtn>
      <TBtn title="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <FaStrikethrough size={12} />
      </TBtn>
      <TBtn title="Highlight" active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight().run()}>
        <FaHighlighter size={12} />
      </TBtn>
      <TBtn title="Inline Code" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}>
        <FaCode size={12} />
      </TBtn>
      <Divider />

      {/* Alignment */}
      <TBtn title="Align Left" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
        <FaAlignLeft size={12} />
      </TBtn>
      <TBtn title="Align Center" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
        <FaAlignCenter size={12} />
      </TBtn>
      <TBtn title="Align Right" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
        <FaAlignRight size={12} />
      </TBtn>
      <TBtn title="Justify" active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()}>
        <FaAlignJustify size={12} />
      </TBtn>
      <Divider />

      {/* Lists */}
      <TBtn title="Bullet List" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <FaListUl size={12} />
      </TBtn>
      <TBtn title="Numbered List" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <FaListOl size={12} />
      </TBtn>
      <Divider />

      {/* Blocks */}
      <TBtn title="Blockquote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <FaQuoteLeft size={12} />
      </TBtn>
      <TBtn title="Code Block" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <FaCodeBranch size={12} />
      </TBtn>
      <TBtn title="Horizontal Rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <FaMinus size={12} />
      </TBtn>
      <Divider />

      {/* Link */}
      {showLinkInput ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            className="h-8 rounded-lg border border-white/15 bg-white/5 px-2 text-xs text-white placeholder-slate-500 focus:outline-none w-36"
            placeholder="https://..."
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') applyLink(); if (e.key === 'Escape') setShowLinkInput(false); }}
          />
          <TBtn title="Apply link" onClick={applyLink}><FaPlus size={10} /></TBtn>
          <TBtn title="Cancel" onClick={() => setShowLinkInput(false)}><FaTimes size={10} /></TBtn>
        </div>
      ) : (
        <>
          <TBtn title="Add Link" active={editor.isActive('link')} onClick={() => setShowLinkInput(true)}>
            <FaLink size={12} />
          </TBtn>
          {editor.isActive('link') && (
            <TBtn title="Remove Link" onClick={() => editor.chain().focus().unsetLink().run()}>
              <FaUnlink size={12} />
            </TBtn>
          )}
        </>
      )}
      <TBtn title="Insert Image (URL)" onClick={handleImageUrl}>
        <FaImage size={12} />
      </TBtn>
      <Divider />

      {/* Clear */}
      <TBtn title="Clear Formatting" onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}>
        <MdFormatClear size={16} />
      </TBtn>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function CreateBlogPage() {
  const { token } = useAdmin();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');
  const isEdit = Boolean(editId);

  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [coverPreview, setCoverPreview] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [preview, setPreview] = useState(false);
  const [loadingPost, setLoadingPost] = useState(isEdit);
  const fileRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Highlight,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false }),
      Image,
      Placeholder.configure({ placeholder: 'Start writing your blog post here...' }),
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-invert prose-emerald max-w-none min-h-[320px] px-6 py-5 focus:outline-none text-slate-200 leading-relaxed',
      },
    },
  });

  useEffect(() => {
    if (!editId || !token) return;
    fetchAdminBlog(token, editId).then(res => {
      const b = res.data;
      setTitle(b.title);
      setExcerpt(b.excerpt);
      setCoverImage(b.coverImage || '');
      setCoverPreview(b.coverImage || '');
      setTags(b.tags || []);
      setStatus(b.status);
      if (editor && b.content) {
        editor.commands.setContent(b.content);
      }
    }).catch(e => setMsg({ type: 'error', text: e.message }))
      .finally(() => setLoadingPost(false));
  }, [editId, token, editor]);

  const handleCoverUpload = async (file: File) => {
    if (!token) return;
    setUploading(true);
    try {
      const url = await uploadBlogCover(token, file);
      setCoverImage(url);
      setCoverPreview(url);
    } catch (e: any) {
      setMsg({ type: 'error', text: 'Cover upload failed: ' + e.message });
    } finally {
      setUploading(false);
    }
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t) && tags.length < 8) {
      setTags(prev => [...prev, t]);
    }
    setTagInput('');
  };

  const removeTag = (t: string) => setTags(prev => prev.filter(x => x !== t));

  const handleSave = async (saveStatus: 'draft' | 'published') => {
    if (!token || !title.trim() || !excerpt.trim()) {
      setMsg({ type: 'error', text: 'Title and excerpt are required' });
      return;
    }
    const content = editor?.getHTML() || '';
    if (!content || content === '<p></p>') {
      setMsg({ type: 'error', text: 'Blog content cannot be empty' });
      return;
    }
    setSaving(true);
    try {
      const payload = { title: title.trim(), excerpt: excerpt.trim(), content, coverImage, tags, status: saveStatus };
      if (isEdit && editId) {
        await updateBlog(token, editId, payload);
      } else {
        await createBlog(token, payload);
      }
      setMsg({ type: 'success', text: `Blog ${saveStatus === 'published' ? 'published' : 'saved as draft'}!` });
      setTimeout(() => router.push('/blogs'), 1200);
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (loadingPost) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-400/20 border-t-emerald-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/blogs')}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <FaArrowLeft size={13} />
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600">
            <FaNewspaper className="text-white" size={14} />
          </div>
          <h1 className="text-xl font-bold text-white">{isEdit ? 'Edit Blog Post' : 'New Blog Post'}</h1>
        </div>
        <button
          onClick={() => setPreview(p => !p)}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${preview ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}
        >
          <FaEye size={11} /> {preview ? 'Edit' : 'Preview'}
        </button>
      </div>

      {/* Message */}
      {msg && (
        <div className={`rounded-xl px-4 py-3 text-sm flex items-center justify-between ${msg.type === 'success' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20' : 'bg-red-500/15 text-red-300 border border-red-500/20'}`}>
          {msg.text}
          <button onClick={() => setMsg(null)} className="opacity-60 hover:opacity-100"><FaTimes size={12} /></button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left: Editor */}
        <div className="lg:col-span-2 space-y-5">
          {/* Title */}
          <div className="glass-panel rounded-2xl p-5 space-y-4">
            <input
              className="w-full bg-transparent text-2xl font-bold text-white placeholder-slate-600 focus:outline-none"
              placeholder="Blog Post Title..."
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={160}
            />
            <textarea
              className="w-full resize-none bg-transparent text-sm text-slate-300 placeholder-slate-600 focus:outline-none"
              placeholder="Short excerpt / summary (max 320 chars)..."
              rows={2}
              value={excerpt}
              onChange={e => setExcerpt(e.target.value)}
              maxLength={320}
            />
            <div className="flex justify-end gap-1 text-xs text-slate-600">
              <span>{excerpt.length}/320</span>
            </div>
          </div>

          {/* Editor */}
          {preview ? (
            <div className="glass-panel rounded-2xl overflow-hidden">
              <div className="border-b border-white/10 px-5 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Preview</div>
              <div
                className="prose prose-invert prose-emerald max-w-none px-6 py-5 text-slate-200"
                dangerouslySetInnerHTML={{ __html: editor?.getHTML() || '' }}
              />
            </div>
          ) : (
            <div className="glass-panel rounded-2xl overflow-hidden">
              <Toolbar editor={editor} />
              <EditorContent editor={editor} />
            </div>
          )}
        </div>

        {/* Right: Meta */}
        <div className="space-y-4">
          {/* Publish actions */}
          <div className="glass-panel rounded-2xl p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Publish</p>
            <div className="flex gap-2">
              <button
                onClick={() => { setStatus('draft'); handleSave('draft'); }}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
              >
                <FaSave size={12} /> {saving ? '...' : 'Draft'}
              </button>
              <button
                onClick={() => { setStatus('published'); handleSave('published'); }}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:opacity-90 disabled:opacity-50"
              >
                <FaNewspaper size={12} /> {saving ? 'Saving...' : 'Publish'}
              </button>
            </div>
            <div>
              <label className="text-xs text-slate-500">Status</label>
              <select
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none"
                value={status}
                onChange={e => setStatus(e.target.value as 'draft' | 'published')}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
          </div>

          {/* Cover Image */}
          <div className="glass-panel rounded-2xl p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cover Image</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f); }} />
            {coverPreview ? (
              <div className="relative">
                <img src={coverPreview} alt="cover" className="w-full rounded-xl object-cover h-36" />
                <button
                  onClick={() => { setCoverImage(''); setCoverPreview(''); }}
                  className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                >
                  <FaTimes size={10} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-white/10 py-6 text-slate-500 transition hover:border-emerald-500/30 hover:text-slate-400"
              >
                <FaImage size={20} />
                <span className="text-xs">{uploading ? 'Uploading...' : 'Click to upload'}</span>
              </button>
            )}
            <input
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none"
              placeholder="Or paste image URL..."
              value={coverImage}
              onChange={e => { setCoverImage(e.target.value); setCoverPreview(e.target.value); }}
            />
          </div>

          {/* Tags */}
          <div className="glass-panel rounded-2xl p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tags <span className="text-slate-600">({tags.length}/8)</span></p>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none"
                placeholder="Add tag..."
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }}
                maxLength={32}
              />
              <button onClick={addTag} className="rounded-xl bg-white/5 px-3 py-2 text-xs text-slate-300 hover:bg-white/10">
                <FaPlus size={10} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tags.map(t => (
                <span key={t} className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs text-emerald-400">
                  {t}
                  <button onClick={() => removeTag(t)} className="opacity-60 hover:opacity-100"><FaTimes size={9} /></button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
