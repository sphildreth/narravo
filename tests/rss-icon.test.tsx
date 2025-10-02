// SPDX-License-Identifier: Apache-2.0
// @vitest-environment jsdom
import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import RssIcon from "@/components/icons/RssIcon";

describe("RssIcon", () => {
  it("renders without crashing", () => {
    const { container } = render(<RssIcon />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
  });

  it("applies custom className", () => {
    const { container } = render(<RssIcon className="custom-class" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("class")).toContain("custom-class");
  });

  it("uses custom size", () => {
    const { container } = render(<RssIcon size={32} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("32");
    expect(svg?.getAttribute("height")).toBe("32");
  });

  it("has proper accessibility attributes", () => {
    const { container } = render(<RssIcon />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("contains RSS icon paths", () => {
    const { container } = render(<RssIcon />);
    const paths = container.querySelectorAll("path");
    const circle = container.querySelector("circle");
    
    // RSS icon has 2 paths and 1 circle
    expect(paths.length).toBe(2);
    expect(circle).toBeTruthy();
  });
});
