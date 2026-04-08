import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/Modal";

type ImageGalleryModalProps = {
  open: boolean;
  title: string;
  images: Array<{ src: string; alt?: string }>;
  initialIndex?: number;
  onClose: () => void;
};

export function ImageGalleryModal({
  open,
  title,
  images,
  initialIndex = 0,
  onClose
}: ImageGalleryModalProps) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!open) {
      return;
    }

    setActiveIndex(Math.min(Math.max(initialIndex, 0), Math.max(images.length - 1, 0)));
    setZoom(1);
  }, [images.length, initialIndex, open]);

  useEffect(() => {
    if (!open || images.length === 0) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setActiveIndex((current) => (current - 1 + images.length) % images.length);
        setZoom(1);
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        setActiveIndex((current) => (current + 1) % images.length);
        setZoom(1);
      }

      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        setZoom((current) => Math.min(Number((current + 0.25).toFixed(2)), 3));
      }

      if (event.key === "-") {
        event.preventDefault();
        setZoom((current) => Math.max(Number((current - 0.25).toFixed(2)), 1));
      }

      if (event.key === "0") {
        event.preventDefault();
        setZoom(1);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [images.length, open]);

  const activeImage = useMemo(() => images[activeIndex] ?? null, [activeIndex, images]);

  if (!open || !activeImage) {
    return null;
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      hideHeader
      maxWidthClassName="max-w-6xl"
      panelClassName="overflow-hidden rounded-[2rem] bg-[#09111f] p-0 text-white"
    >
      <div className="flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/5 px-4 py-3 md:px-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cobalt-200">Preview gallery</p>
            <h3 className="mt-1 font-display text-xl font-semibold text-white">{title}</h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
              {activeIndex + 1} / {images.length}
            </span>
            <button type="button" onClick={() => setZoom((current) => Math.max(Number((current - 0.25).toFixed(2)), 1))} className="rounded-full bg-cobalt-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-cobalt-500">
              Zoom out
            </button>
            <button type="button" onClick={() => setZoom(1)} className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/15">
              Reset
            </button>
            <button type="button" onClick={() => setZoom((current) => Math.min(Number((current + 0.25).toFixed(2)), 3))} className="rounded-full bg-cobalt-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-cobalt-500">
              Zoom in
            </button>
            <button type="button" onClick={onClose} className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/15">
              Close
            </button>
          </div>
        </div>

        <div className="relative flex min-h-[64vh] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,rgba(31,70,239,0.18),transparent_36%),linear-gradient(180deg,#0b1324_0%,#08101d_100%)] px-4 py-5 md:px-6">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/35 text-xl font-semibold text-white shadow-lg transition hover:bg-black/50"
            aria-label="Close gallery"
          >
            ×
          </button>
          {images.length > 1 ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setActiveIndex((current) => (current - 1 + images.length) % images.length);
                  setZoom(1);
                }}
                className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-cobalt-600 px-3 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-cobalt-500"
                aria-label="Previous image"
              >
                {"<"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveIndex((current) => (current + 1) % images.length);
                  setZoom(1);
                }}
                className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-cobalt-600 px-3 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-cobalt-500"
                aria-label="Next image"
              >
                {">"}
              </button>
            </>
          ) : null}

          <div className="flex h-full w-full items-center justify-center overflow-auto rounded-[1.5rem] border border-white/10 bg-black/20 p-3 md:p-5">
            <img
              src={activeImage.src}
              alt={activeImage.alt ?? title}
              className="max-h-[70vh] w-auto max-w-full rounded-[1.25rem] object-contain shadow-[0_18px_50px_rgba(0,0,0,0.35)] transition duration-200"
              style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
            />
          </div>
        </div>

        {images.length > 1 ? (
          <div className="border-t border-white/10 bg-white/5 px-4 py-3 md:px-5">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((image, index) => (
                <button
                  key={`${image.src}-${index}`}
                  type="button"
                  onClick={() => {
                    setActiveIndex(index);
                    setZoom(1);
                  }}
                  className={`shrink-0 overflow-hidden rounded-xl border transition ${
                    index === activeIndex ? "border-cobalt-400 ring-2 ring-cobalt-400/35" : "border-white/10 opacity-80 hover:opacity-100"
                  }`}
                >
                  <img src={image.src} alt={image.alt ?? `${title} preview ${index + 1}`} className="h-20 w-24 object-cover" />
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
