import React from "react";
import { Icon } from "./ui/Icon.jsx";

export function ArtworkThumb({
  primarySrc = null,
  fallbackSrc = null,
  thumbColor = "var(--surface-panel)",
  alt = "",
  iconSize = 20,
  style = {},
  imgStyle = {},
}) {
  const [src, setSrc] = React.useState(primarySrc || fallbackSrc || "");

  React.useEffect(() => {
    setSrc(primarySrc || fallbackSrc || "");
  }, [primarySrc, fallbackSrc]);

  const useFallback = React.useCallback(() => {
    if (fallbackSrc && src !== fallbackSrc) setSrc(fallbackSrc);
    else setSrc("");
  }, [fallbackSrc, src]);

  return (
    <div
      style={{
        background: thumbColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        ...style,
      }}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          onError={useFallback}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            ...imgStyle,
          }}
        />
      ) : (
        <Icon name="note" size={iconSize} color="rgba(255,255,255,0.92)" emboss={false} />
      )}
    </div>
  );
}
