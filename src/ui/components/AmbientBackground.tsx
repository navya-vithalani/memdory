export function AmbientBackground() {
  return (
    <div className="ambient-background" aria-hidden="true">
      <div className="ambient-wave ambient-wave-one" />
      <div className="ambient-wave ambient-wave-two" />
      <div className="ambient-bubbles">
        {Array.from({ length: 8 }, (_, index) => <i key={index} />)}
      </div>
    </div>
  );
}
