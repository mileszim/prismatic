// The instrument panel: the three camera controls (aperture, focus, ISO).

import Slider from './Slider.jsx';
import { STOPS, ISOS } from '../constants.js';

export default function ControlPanel({
  apIdx,
  setApIdx,
  focusSlider,
  setFocusSlider,
  focusDisplay,
  isoIdx,
  setIsoIdx,
}) {
  return (
    <div className="panel">
      <Slider
        label="Aperture"
        display={`ƒ/${STOPS[apIdx]}`}
        hint="shallow ◄──── depth of field ────► deep"
        min={0}
        max={STOPS.length - 1}
        value={apIdx}
        onChange={setApIdx}
      />
      <Slider
        label="Focus"
        display={focusDisplay}
        hint="near ◄──── focal plane ────► ∞"
        min={0}
        max={1000}
        value={focusSlider}
        onChange={setFocusSlider}
      />
      <Slider
        label="ISO"
        display={ISOS[isoIdx]}
        hint="clean ◄──── sensor grain ────► noisy"
        min={0}
        max={ISOS.length - 1}
        value={isoIdx}
        onChange={setIsoIdx}
      />
    </div>
  );
}
