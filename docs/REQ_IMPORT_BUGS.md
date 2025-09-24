# Overview

This highlights the continual problem with importing posts from WordPress WXR files.

I deleted all posts and then did an import from a word press wxr xml file.

# Issues
- There are post that have "featured_image_url" which are URLs from the original post. The image on this url should be downloaded to the file storage and then the value stored in the database is the new relative url. 
  - An example is "http://www.shildreth.com/wp-content/uploads/2016/07/20160724_211045_HDR.jpg" and "http://www.shildreth.com/wp-content/uploads/2019/11/800px-FAA_Phonetic_and_Morse_Chart2.svg_-501x1024.png"   
- The index is showing "No More posts to load" and there are over 100 items imported seen in the posts table.
- When a youtube video is imported, it gets saved in the database accurately but does not display accurately.
    - The value is the database look like this ```<iframe width="560" height="315" src="https://www.youtube.com/embed/TJTDTyNdJdY" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen="allowfullscreen"></iframe>``` which is correct.      
- When a imported post has <ul><li> items these do not get properly imported and the imported post does not render close to the original
- Example item that does not get imported correctly this should have 9 <li> items
```xml
<item>
		<title><![CDATA[Getting Rusty]]></title>
		<link>https://www.shildreth.com/2022/10/26/getting-rusty/</link>
		<pubDate>Wed, 26 Oct 2022 18:39:40 +0000</pubDate>
		<dc:creator><![CDATA[steven]]></dc:creator>
		<guid isPermaLink="false">https://www.sphildreth.com/?p=503</guid>
		<description></description>
		<content:encoded><![CDATA[With the continued impressive industry reception and <a href="https://stackoverflow.blog/2020/01/20/what-is-rust-and-why-is-it-so-popular/">excitement</a> around <a href="https://www.rust-lang.org/">Rust</a>,  I think it is time I jump and and see what all the <span jsslot=""><span data-dobid="hdw">hub·bub</span></span> is about.

After watching a few starter videos, and reading documentation, here are some of my  initial thoughts:
<ul>
 	<li>Statically compilied versus interpreted (like my dear Python language.)</li>
 	<li>Performance is almost hard to believe compared to some other languages doing like processes.</li>
 	<li>Memory-safety and thread-safety design ground up sounds like a dream come true for those of us who have fought those demons.</li>
 	<li><a href="https://crates.io/">Creates</a> is to Rust what Pip is to Python.</li>
 	<li>A lot of people seem to have issues (or at least a hard time understanding) what <a href="https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html">Rust's Borrowing</a> is all about.</li>
 	<li>None over Null data type is interesting for a hard core C# developer.</li>
 	<li><a href="https://rustacean.net/">The Crab logo is odd</a>, as is the entire "cRUSTaceans" name used by those who adore Rust.</li>
 	<li>Linux kernel is going to have <a href="https://www.theregister.com/2022/10/05/rust_kernel_pull_request_pulled/">Rust support with v6.1</a>. I never thought I would ever see anything but C in Linux kernel code.</li>
 	<li><a href="https://www.redox-os.org/">Redox</a> is an entire operation system written in Rust</li>
</ul>
I think the first thing I am going to try to tackle with Rust is media file processing for Roadie. Perhaps re-write Inspector in Rust.

Wish me luck getting Rusty!]]></content:encoded>
		<excerpt:encoded><![CDATA[]]></excerpt:encoded>
		<wp:post_id>503</wp:post_id>
		<wp:post_date><![CDATA[2022-10-26 13:39:40]]></wp:post_date>
		<wp:post_date_gmt><![CDATA[2022-10-26 18:39:40]]></wp:post_date_gmt>
		<wp:post_modified><![CDATA[2022-10-26 13:47:37]]></wp:post_modified>
		<wp:post_modified_gmt><![CDATA[2022-10-26 18:47:37]]></wp:post_modified_gmt>
		<wp:comment_status><![CDATA[open]]></wp:comment_status>
		<wp:ping_status><![CDATA[open]]></wp:ping_status>
		<wp:post_name><![CDATA[getting-rusty]]></wp:post_name>
		<wp:status><![CDATA[publish]]></wp:status>
		<wp:post_parent>0</wp:post_parent>
		<wp:menu_order>0</wp:menu_order>
		<wp:post_type><![CDATA[post]]></wp:post_type>
		<wp:post_password><![CDATA[]]></wp:post_password>
		<wp:is_sticky>0</wp:is_sticky>
										<category domain="post_tag" nicename="development"><![CDATA[development]]></category>
		<category domain="category" nicename="development"><![CDATA[development]]></category>
		<category domain="post_tag" nicename="rust"><![CDATA[rust]]></category>
						<wp:postmeta>
		<wp:meta_key><![CDATA[_edit_last]]></wp:meta_key>
		<wp:meta_value><![CDATA[1]]></wp:meta_value>
		</wp:postmeta>
							<wp:postmeta>
		<wp:meta_key><![CDATA[_thumbnail_id]]></wp:meta_key>
		<wp:meta_value><![CDATA[508]]></wp:meta_value>
		</wp:postmeta>
							</item>
```
- When this is seen in a import post it should be transformed into a syntax and displayed using the syntax highlighter for source code, in this case its "Bash" based on the data-lang value
```html
  <div class="hcb_wrap">
<pre class="prism undefined-numbers lang-bash" data-lang="Bash"><code>sudo pacman -S podman podman-docker</code></pre>
</div>
```


# Changes
- The post column name "guid" is being populated with values like "https://www.sphildreth.com/?p=512" this is going to cause much confusion in the future. Rename this to "imported_system_id" and update all operations around this column appropriately.
- The featured image (stored in "featured_image_url" in the dataae) does not display when viewing a post.
    - If this value is not null or empty then display it in the same manner as the index banner in the post detail view below the "Admin Actions" section.