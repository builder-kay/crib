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
  const canZoomOut = zoom > 1;
  const canZoomIn = zoom < 3;

  function goToPreviousImage() {
    setActiveIndex((current) => (current - 1 + images.length) % images.length);
    setZoom(1);
  }

  function goToNextImage() {
    setActiveIndex((current) => (current + 1) % images.length);
    setZoom(1);
  }

  function zoomOut() {
    setZoom((current) => Math.max(Number((current - 0.25).toFixed(2)), 1));
  }

  function zoomIn() {
    setZoom((current) => Math.min(Number((current + 0.25).toFixed(2)), 3));
  }

  if (!open || !activeImage) {
    return null;
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      hideHeader
      maxWidthClassName="max-w-6xl"
      panelClassName="image-gallery-modal-panel overflow-x-hidden rounded-[2rem] p-0"
    >
      <div className="image-gallery-shell flex flex-col">
        <div className="image-gallery-toolbar sticky top-0 px-4 py-4 md:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="image-gallery-eyebrow">Preview gallery</p>
              <h3 className="mt-2 font-display text-xl font-semibold text-ink md:text-2xl">{title}</h3>
              <p className="mt-1 max-w-2xl text-sm text-sand-700">
                Browse every preview, inspect details with zoom, and use the left and right arrows to move quickly.
              </p>
            </div>

            <div className="flex flex-col gap-2 lg:items-end">
              <div className="flex flex-wrap items-center gap-2">
                <span className="image-gallery-counter">
                  {activeIndex + 1} of {images.length}
                </span>
                <button type="button" onClick={zoomOut} disabled={!canZoomOut} className="image-gallery-control" aria-label="Zoom out">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14" />
                  </svg>
                </button>
                <button type="button" onClick={() => setZoom(1)} disabled={zoom === 1} className="image-gallery-control px-3 text-xs font-semibold">
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={zoomIn}
                  disabled={!canZoomIn}
                  className="image-gallery-control image-gallery-control-primary"
                  aria-label="Zoom in"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                </button>
                <button type="button" onClick={onClose} className="image-gallery-control image-gallery-close-button" aria-label="Close gallery">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m6 6 12 12" />
                    <path d="M18 6 6 18" />
                  </svg>
                  <span className="hidden sm:inline">Close</span>
                </button>
              </div>

              <p className="text-xs text-sand-600">Arrow keys switch images. Use +, -, and 0 for quick zoom controls.</p>
            </div>
          </div>
        </div>

        <div className="image-gallery-stage px-4 py-4 md:px-6 md:py-5">
          <div className="relative flex min-h-[60vh] items-center justify-center">
            {images.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={goToPreviousImage}
                  className="image-gallery-nav-button absolute left-2 top-1/2 z-10 -translate-y-1/2 md:left-4"
                  aria-label="Previous image"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m15 6-6 6 6 6" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={goToNextImage}
                  className="image-gallery-nav-button absolute right-2 top-1/2 z-10 -translate-y-1/2 md:right-4"
                  aria-label="Next image"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </button>
              </>
            ) : null}

            <div className="image-gallery-figure flex h-full w-full items-center justify-center overflow-auto rounded-[1.7rem] p-3 md:p-5">
              <img
                src={activeImage.src}
                alt={activeImage.alt ?? title}
                className="max-h-[70vh] w-auto max-w-full rounded-[1.3rem] object-contain shadow-[0_18px_50px_rgba(0,0,0,0.2)] transition duration-200"
                style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
              />
            </div>
          </div>
        </div>

        {images.length > 1 ? (
          <div className="image-gallery-thumbs px-4 py-3 md:px-6">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((image, index) => (
                <button
                  key={`${image.src}-${index}`}
                  type="button"
                  onClick={() => {
                    setActiveIndex(index);
                    setZoom(1);
                  }}
                  className={`image-gallery-thumb group relative shrink-0 overflow-hidden rounded-[1.05rem] transition ${
                    index === activeIndex ? "image-gallery-thumb-active" : ""
                  }`}
                  aria-label={`Open image ${index + 1}`}
                >
                  <img
                    src={image.src}
                    alt={image.alt ?? `${title} preview ${index + 1}`}
                    className="h-20 w-24 object-cover transition duration-200 group-hover:scale-[1.03]"
                  />
                  <span className="image-gallery-thumb-index">{index + 1}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
