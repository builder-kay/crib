type PageLoaderProps = {
  label?: string;
  fullHeight?: boolean;
};

export function PageLoader({ label = "Loading page", fullHeight = false }: PageLoaderProps) {
  const heightClassName = fullHeight ? "min-h-[100dvh]" : "min-h-[calc(100dvh-10rem)]";

  return (
    <div className={`mx-auto flex w-full max-w-5xl items-center justify-center px-4 ${heightClassName}`}>
      <div className="page-loader-shell flex flex-col items-center justify-center">
        <div className="page-loader-logo-wrap" aria-hidden="true">
          <div className="page-loader-logo-glow" />
          <img src="/crib-logo.png" alt="" className="page-loader-logo h-16 w-16 object-contain sm:h-[4.5rem] sm:w-[4.5rem]" />
        </div>

        <div className="page-loader-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <span className="sr-only">{label}</span>
      </div>
    </div>
  );
}
