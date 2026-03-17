import { useMemo } from "react";
import { buildPptxSlideSrcDoc } from "../lib/pptxHtml";

interface PptxHtmlFrameProps {
  html: string;
  className?: string;
}

export default function PptxHtmlFrame({ html, className }: PptxHtmlFrameProps) {
  const srcDoc = useMemo(() => buildPptxSlideSrcDoc(html), [html]);

  return (
    <iframe
      srcDoc={srcDoc}
      sandbox="allow-scripts"
      className={className}
      style={{ border: "0", pointerEvents: "none", background: "#000" }}
      title="PPTX Slide"
    />
  );
}

