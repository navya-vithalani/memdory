type StudyTopBarProps = {
  position: number;
  total: number;
  elapsedSeconds: number;
  disabled: boolean;
  onClose: () => void;
};

export function StudyTopBar({ position, total, elapsedSeconds, disabled, onClose }: StudyTopBarProps) {
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = `${elapsedSeconds % 60}`.padStart(2, '0');
  return (
    <div className="study-topbar">
      <button className="study-close" aria-label="Save and exit" disabled={disabled} onClick={onClose}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
      <div
        className="study-progress-track"
        role="progressbar"
        aria-label="Session progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={position}
        aria-valuetext={`Card ${position + 1} of ${total}`}
      >
        <span className="study-progress-fill" style={{ ['--progress' as string]: `${(position / total) * 100}%` }} />
      </div>
      <span className="study-timer" aria-label="Time studied">{minutes}:{seconds}</span>
    </div>
  );
}
