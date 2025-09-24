// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseWxrItem, type WxrItem } from "../scripts/import-wxr";

describe("Import WXR Integration Tests", () => {
  describe("Complete import processing pipeline", () => {
    it("should handle post with all transformation requirements", () => {
      const item: WxrItem = {
        title: "Getting Rusty",
        link: "https://www.shildreth.com/2022/10/26/getting-rusty/",
        guid: "https://www.sphildreth.com/?p=503",
        "dc:creator": "steven",
        "wp:post_type": "post",
        "wp:status": "publish",
        "wp:post_date_gmt": "2022-10-26 18:39:40",
        "wp:post_name": "getting-rusty",
        "content:encoded": `
With the continued impressive industry reception and <a href="https://stackoverflow.blog/2020/01/20/what-is-rust-and-why-is-it-so-popular/">excitement</a> around <a href="https://www.rust-lang.org/">Rust</a>, I think it is time I jump and and see what all the <span jsslot=""><span data-dobid="hdw">hub·bub</span></span> is about.

After watching a few starter videos, and reading documentation, here are some of my initial thoughts:
<ul>
  <li>Statically compiled versus interpreted (like my dear Python language.)</li>
  <li>Performance is almost hard to believe compared to some other languages doing like processes.</li>
  <li>Memory-safety and thread-safety design ground up sounds like a dream come true for those of us who have fought those demons.</li>
  <li><a href="https://crates.io/">Crates</a> is to Rust what Pip is to Python.</li>
  <li>A lot of people seem to have issues (or at least a hard time understanding) what <a href="https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html">Rust's Borrowing</a> is all about.</li>
  <li>None over Null data type is interesting for a hard core C# developer.</li>
  <li><a href="https://rustacean.net/">The Crab logo is odd</a>, as is the entire "cRUSTaceans" name used by those who adore Rust.</li>
  <li>Linux kernel is going to have <a href="https://www.theregister.com/2022/10/05/rust_kernel_pull_request_pulled/">Rust support with v6.1</a>. I never thought I would ever see anything but C in Linux kernel code.</li>
  <li><a href="https://www.redox-os.org/">Redox</a> is an entire operation system written in Rust</li>
</ul>

I think the first thing I am going to try to tackle with Rust is media file processing for Roadie. Perhaps re-write Inspector in Rust.

<iframe width="560" height="315" src="https://www.youtube.com/embed/TJTDTyNdJdY" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen="allowfullscreen"></iframe>

<div class="hcb_wrap">
<pre class="prism undefined-numbers lang-bash" data-lang="Bash"><code>sudo pacman -S podman podman-docker</code></pre>
</div>

Wish me luck getting Rusty!
        `,
        category: [
          {
            _: "development", 
            "$": { domain: "category", nicename: "development" }
          },
          {
            _: "development", 
            "$": { domain: "post_tag", nicename: "development" }
          },
          {
            _: "rust", 
            "$": { domain: "post_tag", nicename: "rust" }
          }
        ]
      };

      const result = parseWxrItem(item);

      expect(result).toEqual({
        type: "post",
        importedSystemId: "https://www.sphildreth.com/?p=503",
        title: "Getting Rusty",
        slug: "getting-rusty",
        html: expect.stringContaining("With the continued impressive industry reception"),
        excerpt: undefined,
        author: "steven",
        publishedAt: new Date("2022-10-26 18:39:40"),
        originalUrl: "https://www.shildreth.com/2022/10/26/getting-rusty/",
        featuredImageId: undefined,
        categories: [{ name: "development", slug: "development" }],
        tags: [
          { name: "development", slug: "development" },
          { name: "rust", slug: "rust" }
        ],
        comments: [],
      });

      // Verify the content contains proper list structure
      expect(result?.html).toContain("<ul>");
      expect(result?.html).toContain("<li>Statically compiled");
      expect(result?.html).toContain("<li>Performance is almost");
      expect(result?.html).toContain("<li>Memory-safety and thread-safety");

      // Verify YouTube iframe is preserved
      expect(result?.html).toContain('<iframe width="560" height="315"');
      expect(result?.html).toContain('src="https://www.youtube.com/embed/TJTDTyNdJdY"');

      // Note: The actual transformation functions would be applied during importWxr,
      // not in parseWxrItem, so the syntax highlighting transformation
      // won't be visible in this test. This test validates the parsing stage.
    });

    it("should handle attachment items with featured image data", () => {
      const item: WxrItem = {
        title: "Test Featured Image",
        guid: "https://example.com/?attachment=123",
        "wp:post_type": "attachment",
        "wp:attachment_url": "http://www.shildreth.com/wp-content/uploads/2016/07/20160724_211045_HDR.jpg",
        "wp:postmeta": [
          {
            "wp:meta_key": "_wp_attachment_image_alt",
            "wp:meta_value": "HDR photo from 2016"
          }
        ]
      };

      const result = parseWxrItem(item);

      expect(result).toEqual({
        type: "attachment",
        importedSystemId: "https://example.com/?attachment=123",
        title: "Test Featured Image",
        attachmentUrl: "http://www.shildreth.com/wp-content/uploads/2016/07/20160724_211045_HDR.jpg",
        alt: "HDR photo from 2016",
      });
    });

    it("should handle post with WordPress thumbnail metadata", () => {
      const item: WxrItem = {
        title: "Post with Featured Image",
        guid: "https://example.com/?p=456",
        "dc:creator": "admin",
        "wp:post_type": "post",
        "wp:status": "publish",
        "wp:post_name": "post-with-featured-image",
        "content:encoded": "<p>This post has a featured image.</p>",
        "wp:postmeta": [
          {
            "wp:meta_key": "_thumbnail_id",
            "wp:meta_value": "123"
          }
        ]
      };

      const result = parseWxrItem(item);

      expect(result?.featuredImageId).toBe("123");
      expect(result?.importedSystemId).toBe("https://example.com/?p=456");
    });
  });

  describe("Database schema compatibility", () => {
    it("should use importedSystemId instead of guid for database operations", () => {
      // This is tested through the type system and compilation
      // The migration 0011_kind_donald_blake.sql renames the column
      const item: WxrItem = {
        title: "Test",
        guid: "https://example.com/?p=1",
        "wp:post_type": "post",
        "wp:status": "publish"
      };

      const result = parseWxrItem(item);
      expect(result?.importedSystemId).toBe("https://example.com/?p=1");
      
      // Verify that the parsed result uses importedSystemId, not guid
      expect(result).not.toHaveProperty('guid');
      expect(result).toHaveProperty('importedSystemId');
    });
  });
});