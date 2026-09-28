// next/image needs the Next runtime; a plain img is enough for behaviour tests.
export default function NextImageMock({ alt, src }: { alt: string; src: string }) {
  // biome-ignore lint/performance/noImgElement: stands in for next/image, which jsdom tests do not render
  return <img alt={alt} src={src} />;
}
