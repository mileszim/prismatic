// The camera roll: a strip of saved frames below the viewfinder. Click a frame
// to open it large; Clear wipes the roll.

export default function CameraRoll({ photos, onSelect, onClear }) {
  return (
    <div className="roll">
      <div className="roll-head">
        <span className="roll-title">Camera Roll · {photos.length}</span>
        {photos.length > 0 && (
          <button className="btn-clear" onClick={onClear}>Clear</button>
        )}
      </div>
      {photos.length === 0 ? (
        <div className="roll-empty">no frames yet — press the shutter</div>
      ) : (
        <div className="roll-strip">
          {photos.map((p) => (
            <button key={p.id} className="roll-thumb" onClick={() => onSelect(p)}>
              <img src={p.dataURL} alt={`ƒ/${p.meta.fnum} ${p.meta.shutter}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
