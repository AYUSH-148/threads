/**
 * The ambient wash behind the whole app.
 *
 * Three heavily blurred colour fields on a fixed, pointer-events-none layer.
 * Their opacity comes from `--aurora-strength`, which the dark theme raises —
 * the same alpha that reads as a gentle tint on white is nearly invisible on a
 * near-black canvas.
 *
 * Server component: it renders no interactive markup, so there is no reason to
 * ship it to the client.
 */
function AuroraBackground() {
  return (
    <div className="aurora-field" aria-hidden="true">
      <div
        className="aurora-blob animate-drift"
        style={{
          top: "-14vh",
          left: "-10vw",
          width: "52vw",
          height: "52vw",
          background: "hsl(var(--aurora-1))",
        }}
      />
      <div
        className="aurora-blob animate-drift"
        style={{
          top: "18vh",
          right: "-14vw",
          width: "46vw",
          height: "46vw",
          background: "hsl(var(--aurora-2))",
          // Offsetting the same 24s loop keeps the three from pulsing in unison.
          animationDelay: "-8s",
        }}
      />
      <div
        className="aurora-blob animate-drift"
        style={{
          bottom: "-18vh",
          left: "28vw",
          width: "44vw",
          height: "44vw",
          background: "hsl(var(--aurora-3))",
          animationDelay: "-16s",
        }}
      />

      {/* A faint grid over the blobs. It gives the blur something to read
          against so the background has texture instead of looking like a
          gradient someone forgot to finish. */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--fg)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--fg)) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse 100% 60% at 50% 0%, #000 40%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 100% 60% at 50% 0%, #000 40%, transparent 100%)",
        }}
      />
    </div>
  );
}

export default AuroraBackground;
