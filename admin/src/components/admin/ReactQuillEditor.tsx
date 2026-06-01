"use client";

import React, { useEffect, useRef, useState } from 'react';
import 'react-quill/dist/quill.snow.css';
import { useAdmin } from './AdminProvider';

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
};

export default function ReactQuillEditor({ value, onChange, placeholder }: Props) {
  const { token } = useAdmin();
  const QuillRef = useRef<any>(null);
  const [ReactQuill, setReactQuill] = useState<any>(null);
  const [imageResizeAvailable, setImageResizeAvailable] = useState(false);
  const [selectedImage, setSelectedImage] = useState<HTMLElement | null>(null);
  const [selectedImageWidth, setSelectedImageWidth] = useState<number>(100);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const mod = await import('react-quill');
        if (!mounted) return;
        setReactQuill(() => mod.default || mod);
        // The image resize module is optional. Do not attempt a dynamic import here
        // because Next.js may try to resolve it at build time and fail. If you want
        // image resizing, install the package in the admin app:
        //   cd admin && npm install quill-image-resize-module
        // After installing, refresh the dev server and the editor will register it.
        // eslint-disable-next-line no-console
        console.warn('[ReactQuillEditor] To enable image resizing install `quill-image-resize-module` in the admin folder.');
      } catch (e) {
        // ignore
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // attach click handler to detect clicks on images inside editor
  React.useEffect(() => {
    const tryAttach = () => {
      const editor = QuillRef.current?.getEditor && QuillRef.current.getEditor();
      if (!editor || !editor.root) return false;

      // click handler
      const handler = (ev: any) => {
        const target = ev.target as HTMLElement | null;
        if (!target) return;
        if (target.tagName === 'IMG' && (target as HTMLElement).dataset.resizable === 'true') {
          setSelectedImage(target as HTMLElement);
          const w = (target as HTMLElement).style.width || '100%';
          const num = w.endsWith('%') ? parseInt(w.replace('%', '')) : NaN;
          setSelectedImageWidth(Number.isFinite(num) ? num : 100);
        } else {
          setSelectedImage(null);
        }
      };

      editor.root.addEventListener('click', handler);

      // observe for images added later and mark them resizable
      const observer = new MutationObserver(() => {
        try {
          const imgs = editor.root.querySelectorAll('img');
          imgs.forEach((img: Element) => {
            const el = img as HTMLElement;
            if (!el.dataset.resizable) {
              el.dataset.resizable = 'true';
              el.style.maxWidth = '100%';
              if (!el.style.width) el.style.width = '100%';
            }
          });
        } catch (err) {}
      });

      observer.observe(editor.root, { childList: true, subtree: true });

      return () => {
        try {
          editor.root.removeEventListener('click', handler);
          observer.disconnect();
        } catch (e) {}
      };
    };

    // try attach now; if editor not ready, retry shortly
    if (!tryAttach()) {
      const t = setTimeout(() => tryAttach(), 200);
      return () => clearTimeout(t);
    }
  }, [ReactQuill]);

  // custom image handler uploads to backend and inserts returned url
  const imageHandler = React.useCallback(() => {
    // open file picker for images
    // eslint-disable-next-line no-console
    console.debug('[ReactQuillEditor] imageHandler invoked');
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();
    input.onchange = async () => {
      const file = (input.files && input.files[0]) as File | undefined;
      if (!file) return;

      const form = new FormData();
      form.append('file', file);

      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
        const resp = await fetch(`${apiBase.replace(/\/$/, '')}/blogs/admin/upload-cover`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: form,
        });

        const payload = await resp.json();
        if (!resp.ok) throw new Error(payload.error || 'Upload failed');

        let url = payload.data?.coverImage;
        // convert relative paths like /uploads/xyz to absolute URL using API base
        try {
          const assetBase = apiBase.replace(/\/api\/?$/, '') || apiBase;
          if (typeof url === 'string' && url.startsWith('/')) {
            url = assetBase.replace(/\/$/, '') + url;
          }
        } catch (err) {
          // ignore
        }
        // eslint-disable-next-line no-console
        console.debug('[ReactQuillEditor] inserting image url', url);
        const editor = QuillRef.current?.getEditor && QuillRef.current.getEditor();
        try {
          const range = editor.getSelection(true);
          const index = (range && typeof range.index === 'number') ? range.index : editor.getLength() || 0;
          editor.insertEmbed(index, 'image', url, 'user');
          // mark inserted image(s) so we can attach resize UI
          setTimeout(() => {
            try {
              const imgs = editor.root.querySelectorAll(`img[src="${url}"]`);
              imgs.forEach((img: Element) => {
                if (!(img as HTMLElement).dataset.resizable) {
                  (img as HTMLElement).dataset.resizable = 'true';
                  (img as HTMLElement).style.maxWidth = '100%';
                  // default width to 100% (user can change)
                  (img as HTMLElement).style.width = '100%';
                }
              });
            } catch (err) {}
          }, 50);
        } catch (e) {
          // Selection may be invalid if editor lost DOM focus — fallback to appending at end
          try {
            editor.insertEmbed(editor.getLength() || 0, 'image', url, 'user');
            setTimeout(() => {
              try {
                const imgs = editor.root.querySelectorAll(`img[src="${url}"]`);
                imgs.forEach((img: Element) => {
                  if (!(img as HTMLElement).dataset.resizable) {
                    (img as HTMLElement).dataset.resizable = 'true';
                    (img as HTMLElement).style.maxWidth = '100%';
                    (img as HTMLElement).style.width = '100%';
                  }
                });
              } catch (err) {}
            }, 50);
          } catch (err) {
            // swallow errors
          }
        }
      } catch (e: any) {
        // eslint-disable-next-line no-console
        console.error('[ReactQuillEditor] image upload failed', e);
        try {
          alert('Image upload failed: ' + (e?.message || 'Unknown error'));
        } catch (_) {}
      }
    };
  }, [token]);

  const modules = React.useMemo(() => ({
    toolbar: {
      container: [
        [{ header: [1, 2, 3, 4, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }, { indent: '-1' }, { indent: '+1' }],
        [{ align: [] }],
        [{ color: [] }, { background: [] }],
        ['blockquote', 'code-block'],
        ['link', 'image'],
        ['clean'],
      ],
      handlers: { image: imageHandler },
    },
    // optional image resize module (works if package is installed)
    ...(imageResizeAvailable ? { imageResize: {} } : {}),
    clipboard: {
      matchVisual: false,
    },
  }), [imageHandler]);

  const formats = React.useMemo(() => [
    'header',
    'bold',
    'italic',
    'underline',
    'strike',
    'list',
    'bullet',
    'indent',
    'align',
    'color',
    'background',
    'blockquote',
    'code-block',
    'link',
    'image',
  ], []);

  return ReactQuill ? (
    <div className="blog-editor h-full">
      <ReactQuill
        ref={QuillRef}
        theme="snow"
        value={value}
        onChange={(val: string, _delta: any, _source: any, editor: any) => {
          try {
            // expose plain text length for debugging
            // eslint-disable-next-line no-console
            console.debug('[ReactQuillEditor] change length', editor.getLength(), 'html length', String(val).length);
          } catch (e) {}

          onChange(val);
        }}
        modules={modules}
        formats={formats}
        placeholder={placeholder || 'Write content here...'}
      />
      {/* Image resize UI shown when an image inside editor is selected (clicked) */}
      {selectedImage ? (
        <div className="absolute right-6 top-6 z-50 flex items-center gap-3 rounded-md bg-white/95 p-3 shadow">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-700 mr-2">Align</label>
            <button
              type="button"
              title="Align left"
              className="admin-button"
              onClick={() => {
                try {
                  selectedImage.style.float = 'left';
                  selectedImage.style.display = 'inline';
                  selectedImage.style.margin = '0 1rem 1rem 0';
                } catch (err) {}
              }}
            >
              L
            </button>
            <button
              type="button"
              title="Align center"
              className="admin-button"
              onClick={() => {
                try {
                  selectedImage.style.float = 'none';
                  selectedImage.style.display = 'block';
                  selectedImage.style.margin = '0 auto 1rem auto';
                } catch (err) {}
              }}
            >
              C
            </button>
            <button
              type="button"
              title="Align right"
              className="admin-button"
              onClick={() => {
                try {
                  selectedImage.style.float = 'right';
                  selectedImage.style.display = 'inline';
                  selectedImage.style.margin = '0 0 1rem 1rem';
                } catch (err) {}
              }}
            >
              R
            </button>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-700">Width</label>
            <input
              type="range"
              min={10}
              max={100}
              value={selectedImageWidth}
              onChange={(e) => {
                const v = Number(e.target.value);
                setSelectedImageWidth(v);
                try {
                  if (selectedImage) selectedImage.style.width = `${v}%`;
                } catch (err) {}
              }}
            />
            <button
              type="button"
              className="admin-button-secondary"
              onClick={() => {
                setSelectedImage(null);
              }}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  ) : (
    <textarea className="admin-input w-full min-h-[200px]" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
  );
}
