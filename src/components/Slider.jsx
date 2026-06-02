// One labelled instrument slider: a title, the current value readout, the
// range input, and a hint line. Reports changes as a number via onChange.

export default function Slider({ label, display, hint, min, max, value, onChange }) {
  return (
    <div className="ctrl">
      <div className="row">
        <span>{label}</span>
        <span className="val">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        autoComplete="off"
        onChange={(e) => onChange(+e.target.value)}
      />
      <div className="hint">{hint}</div>
    </div>
  );
}
