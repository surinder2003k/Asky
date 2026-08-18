import { useEffect, useState } from "react";
import { X, ZoomIn, ZoomOut } from "lucide-react";

/**
 * Fullscreen image viewer overlay with zoom and close/back controls.
 */
export function ImageViewer({
  src,
  onClose,
}: {
  src: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90"
      onClick={onClose}
      role="dialog"
      aria-label="Image viewer"
    >
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-black/60 px-3 py-2 text-sm font-medium text-white hover:bg-white/15"
          title="Close"
        >
          <X size={16} /> Close
        </button>
      </div>
      <ZoomableImage src={src} />
    </div>
  );
}

function ZoomableImage({ src }: { src: string }) {
  const max = 3;
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setZoom(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative flex max-h-full max-w-full items-center justify-center p-12" onClick={(e) => e.stopPropagation()}>
      <img
        src={src}
        alt="Full view"
        className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain transition-transform duration-150"
        style={{ transform: `scale(${zoom})` }}
      />
      <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/20 bg-black/60 px-2 py-1">
        <button
          onClick={() => setZoom((z) => Math.max(0.5, z - 0.5))}
          className="rounded-full p-1.5 text-white hover:bg-white/15"
          title="Zoom out"
        >
          <ZoomOut size={18} />
        </button>
        <span className="min-w-12 text-center text-xs text-white">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => setZoom((z) => Math.min(max, z + 0.5))}
          className="rounded-full p-1.5 text-white hover:bg-white/15"
          title="Zoom in"
        >
          <ZoomIn size={18} />
        </button>
        <button
          onClick={() => setZoom(1)}
          className="rounded-full px-2 py-1 text-xs text-white hover:bg-white/15"
          title="Reset zoom"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

