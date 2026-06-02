// Full-size view of a saved frame with its exposure data. Click the backdrop or
// press Escape to dismiss.

import { useEffect } from 'react';

function formatStamp(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Lightbox({ photo, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const m = photo.meta;
  return (
    <div className="lightbox" onClick={onClose}>
      <div className="lightbox-inner" onClick={(e) => e.stopPropagation()}>
        <img className="lightbox-img" src={photo.dataURL} alt="" />
        <div className="lightbox-meta">
          <span>ƒ/{m.fnum}</span>
          <span>{m.shutter}</span>
          <span>ISO {m.iso}</span>
          <span>FOCUS {m.focus}</span>
          <span className="stamp">{formatStamp(m.ts)}</span>
        </div>
        <button className="lightbox-close" onClick={onClose}>Close ✕</button>
      </div>
    </div>
  );
}
