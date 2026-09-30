"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { fitMockupFrame } from "@/lib/mockupGeometry";

export function MockupStage({ src, alt, className, imageClassName, stageRef, children, onReady, onError, zoom = 1 }: {
  src: string; alt: string; className: string; imageClassName: string;
  stageRef: RefObject<HTMLDivElement | null>; children: ReactNode;
  zoom?: number;
  onReady?: (src: string) => void; onError?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState({ width: 1024, height: 1536 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => {
      const { width, height } = container.getBoundingClientRect();
      setAvailable((current) => current.width === width && current.height === height ? current : { width, height });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    const frame = requestAnimationFrame(measure);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, []);

  const frame = fitMockupFrame(available.width, available.height, imageSize.width, imageSize.height);
  return <div className={className} ref={containerRef}>
    <div className="mockup-zoom-frame" style={{ width: frame.width ? frame.width * zoom : "100%", height: frame.height ? frame.height * zoom : "100%", flex: "none", position: "relative" }}>
    <div className="mockup-coordinate-plane" ref={stageRef} style={{ width: frame.width || "100%", height: frame.height || "100%", transform: zoom === 1 ? undefined : `scale(${zoom})`, transformOrigin: "top left" }}>
      <Image src={src} alt={alt} fill sizes="(max-width: 760px) 100vw, 70vw" preload
        crossOrigin="anonymous" unoptimized className={imageClassName}
        style={{ padding: frame.padding }} onLoad={(event) => {
          const image = event.currentTarget;
          if (image.naturalWidth && image.naturalHeight) {
            setImageSize({ width: image.naturalWidth, height: image.naturalHeight });
            onReady?.(src);
          }
        }} onError={onError} />
      {children}
    </div>
    </div>
  </div>;
}
