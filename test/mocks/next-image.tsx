import type { ReactEventHandler } from "react";

interface NextImageMockProps {
  alt: string;
  src: string;
  /** Passed through, so a test can fire `error` and see the photo's fallback. */
  onError?: ReactEventHandler<HTMLImageElement>;
}

// next/image needs the Next runtime; a plain img is enough for behaviour tests.
export default function NextImageMock({ alt, src, onError }: NextImageMockProps) {
  // biome-ignore lint/performance/noImgElement: stands in for next/image, which jsdom tests do not render
  return <img alt={alt} src={src} onError={onError} />;
}
