import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

export const alt = site.name;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 96,
        background: "#ffffff",
      }}
    >
      <div style={{ fontSize: 96, fontWeight: 700, color: "#111827" }}>
        {site.name}
      </div>
      <div style={{ marginTop: 24, fontSize: 40, color: "#6b7280" }}>
        Book with confidence
      </div>
    </div>,
    size,
  );
}
