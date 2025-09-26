// SPDX-License-Identifier: Apache-2.0
import { Node } from "@tiptap/core";

type VideoSource = {
  src: string;
  type?: string;
};

const decodeSources = (value: unknown): VideoSource[] => {
  if (typeof value !== "string" || value.length === 0) return [];
  try {
    const decoded = decodeURIComponent(value);
    const parsed = JSON.parse(decoded);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry): VideoSource | null => {
        if (!entry || typeof entry.src !== "string" || entry.src.length === 0) {
          return null;
        }
        const clean: VideoSource = { src: entry.src };
        if (typeof entry.type === "string" && entry.type.length > 0) {
          clean.type = entry.type;
        }
        return clean;
      })
      .filter((entry): entry is VideoSource => entry !== null);
  } catch {
    return [];
  }
};

const encodeSources = (sources: VideoSource[]): string | null => {
  if (!sources.length) return null;
  try {
    return encodeURIComponent(JSON.stringify(sources));
  } catch {
    return null;
  }
};

const extractBoolean = (value: unknown): boolean => value === "" || value === true || value === "true";

const extractAttributes = (video: HTMLVideoElement) => {
  const sourceList = Array.from(video.querySelectorAll("source"))
    .map((source) => {
      const src = source.getAttribute("src");
      if (!src) return null;
      const type = source.getAttribute("type");
      const result: VideoSource = { src };
      if (type) {
        result.type = type;
      }
      return result;
    })
    .filter((entry): entry is VideoSource => entry !== null);

  const encodedAttr = video.getAttribute("data-sources");
  let sourcesPayload = sourceList;
  if (!sourcesPayload.length && encodedAttr) {
    sourcesPayload = decodeSources(encodedAttr);
  }

  return {
    src: video.getAttribute("data-shortcode-src") ?? video.getAttribute("src"),
    width: video.getAttribute("width"),
    height: video.getAttribute("height"),
    poster: video.getAttribute("poster"),
    autoplay: video.hasAttribute("autoplay"),
    muted: video.hasAttribute("muted"),
    playsinline: video.hasAttribute("playsinline"),
    loop: video.hasAttribute("loop"),
    sources: sourcesPayload.length ? encodeSources(sourcesPayload) : null,
  };
};

export const VideoShortcode = Node.create({
  name: "videoShortcode",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: {
        default: null as string | null,
      },
      width: {
        default: null as string | null,
      },
      height: {
        default: null as string | null,
      },
      poster: {
        default: null as string | null,
      },
      autoplay: {
        default: false,
        parseHTML: extractBoolean,
      },
      muted: {
        default: false,
        parseHTML: extractBoolean,
      },
      playsinline: {
        default: false,
        parseHTML: extractBoolean,
      },
      loop: {
        default: false,
        parseHTML: extractBoolean,
      },
      sources: {
        default: null as string | null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-video-shortcode]",
        getAttrs: (dom) => {
          if (!(dom instanceof HTMLElement)) return false;
          const video = dom.querySelector<HTMLVideoElement>("video[data-shortcode-preview]");
          if (!video) return false;
          return extractAttributes(video);
        },
      },
      {
        tag: "video[data-shortcode-preview]",
        getAttrs: (dom) => {
          if (!(dom instanceof HTMLVideoElement)) return false;
          return extractAttributes(dom);
        },
      },
      {
        // Also handle plain video tags that might be created by markdown expansion
        tag: "video",
        getAttrs: (dom) => {
          if (!(dom instanceof HTMLVideoElement)) return false;
          // Only parse videos that have data-shortcode attributes or are in the video container
          const hasShortcodeData = dom.hasAttribute('data-shortcode-src') || 
                                   dom.hasAttribute('data-sources') ||
                                   dom.hasAttribute('data-shortcode-preview');
          if (!hasShortcodeData) return false;
          return extractAttributes(dom);
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const sources = decodeSources(HTMLAttributes.sources);

    const videoAttrs: Record<string, string> = {
      "data-shortcode-preview": "true",
      controls: "",
    };

    const copy = (key: "src" | "poster" | "width" | "height") => {
      const value = HTMLAttributes[key];
      if (value) {
        videoAttrs[key] = String(value);
      }
    };

    copy("src");
    copy("poster");
    copy("width");
    copy("height");

    const applyFlag = (key: "autoplay" | "muted" | "playsinline" | "loop") => {
      if (extractBoolean(HTMLAttributes[key])) {
        videoAttrs[key] = "";
      }
    };

    applyFlag("autoplay");
    applyFlag("muted");
    applyFlag("playsinline");
    applyFlag("loop");

    if (sources.length) {
      const encoded = encodeSources(sources);
      if (encoded) {
        videoAttrs["data-sources"] = encoded;
      }
      if (!videoAttrs.src) {
        videoAttrs.src = sources[0]!.src;
      }
    }

    if (videoAttrs.src) {
      videoAttrs["data-shortcode-src"] = videoAttrs.src;
    }

    const sourceNodes = sources.map((source) => {
      const attrs: Record<string, string> = { src: source.src };
      if (source.type) {
        attrs.type = source.type;
      }
      return ["source", attrs] as const;
    });

    if (!sourceNodes.length && videoAttrs.src) {
      sourceNodes.push(["source", { src: videoAttrs.src }] as const);
    }

    const downloadHref = videoAttrs.src ?? (sources[0]?.src ?? "");

    const wrapperAttrs = {
      "data-video-shortcode": "true",
      class: "video-shortcode-frame",
    } as const;

    const children: any[] = [["video", videoAttrs, ...sourceNodes]];

    if (downloadHref) {
      children.push([
        "div",
        { class: "video-shortcode-fallback" },
        [
          "a",
          {
            href: downloadHref,
            target: "_blank",
            rel: "noopener noreferrer",
          },
          "Download video",
        ],
      ]);
    }

    return ["div", wrapperAttrs, ...children];
  },
});
