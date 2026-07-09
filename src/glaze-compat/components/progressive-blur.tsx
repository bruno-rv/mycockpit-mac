"use client";

import { cn } from "../utils";
import React, { useMemo } from "react";

export interface ProgressiveBlurProps {
  className?: string;
  height?: string;
  position?: "top" | "bottom" | "both";
  blurLevels?: number[];
  children?: React.ReactNode;
}

export function ProgressiveBlur({
  className,
  height = "30%",
  position = "bottom",
  blurLevels = [0.5, 1, 2, 3, 4],
}: ProgressiveBlurProps) {
  const layers = useMemo(() => {
    const numLayers = blurLevels.length;
    const result = [];

    for (let i = 0; i < numLayers; i++) {
      const progress = i / (numLayers - 1);

      // Each layer extends from its position to the end, creating smooth overlaps
      const maskGradient =
        position === "bottom"
          ? `linear-gradient(to bottom, transparent 0%, transparent ${progress * 100}%, black ${progress * 100 + 10}%, black 100%)`
          : position === "top"
            ? `linear-gradient(to top, transparent 0%, transparent ${progress * 100}%, black ${progress * 100 + 10}%, black 100%)`
            : `linear-gradient(transparent 0%, black 5%, black 95%, transparent 100%)`;

      result.push({
        blur: blurLevels[i],
        mask: maskGradient,
        zIndex: i + 1,
      });
    }

    return result;
  }, [blurLevels, position]);

  return (
    <div
      className={cn(
        "gradient-blur pointer-events-none absolute z-10 inset-x-0",
        className,
        position === "top" ? "top-0" : position === "bottom" ? "bottom-0" : "inset-y-0",
      )}
      style={{
        height: position === "both" ? "100%" : height,
        willChange: "transform",
      }}
    >
      {layers.map((layer, index) => (
        <div
          key={index}
          className="absolute inset-0"
          style={{
            zIndex: layer.zIndex,
            backdropFilter: `blur(${layer.blur}px)`,
            WebkitBackdropFilter: `blur(${layer.blur}px)`,
            maskImage: layer.mask,
            WebkitMaskImage: layer.mask,
            transform: "translateZ(0)",
          }}
        />
      ))}
    </div>
  );
}
