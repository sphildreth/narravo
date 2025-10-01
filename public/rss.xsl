<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>
  
  <xsl:template match="/rss/channel">
    <html>
      <head>
        <title><xsl:value-of select="title"/> - RSS Feed</title>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            padding: 20px;
          }
          
          .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 8px 8px 0 0;
          }
          
          .header h1 {
            font-size: 28px;
            margin-bottom: 8px;
          }
          
          .header p {
            opacity: 0.9;
            font-size: 16px;
          }
          
          .info {
            background: #fef3c7;
            border: 2px solid #fbbf24;
            border-radius: 6px;
            padding: 16px;
            margin: 20px;
          }
          
          .info h2 {
            font-size: 18px;
            color: #92400e;
            margin-bottom: 8px;
          }
          
          .info p {
            color: #78350f;
            font-size: 14px;
            line-height: 1.5;
          }
          
          .info code {
            background: #fef3c7;
            border: 1px solid #fbbf24;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 13px;
          }
          
          .items {
            padding: 20px;
          }
          
          .item {
            border-bottom: 1px solid #e5e7eb;
            padding: 20px 0;
          }
          
          .item:last-child {
            border-bottom: none;
          }
          
          .item h3 {
            font-size: 20px;
            margin-bottom: 8px;
          }
          
          .item h3 a {
            color: #667eea;
            text-decoration: none;
          }
          
          .item h3 a:hover {
            text-decoration: underline;
          }
          
          .item-meta {
            color: #6b7280;
            font-size: 14px;
            margin-bottom: 12px;
          }
          
          .item-description {
            color: #4b5563;
            line-height: 1.6;
          }
          
          .footer {
            text-align: center;
            padding: 20px;
            color: #9ca3af;
            font-size: 14px;
            border-top: 1px solid #e5e7eb;
          }
          
          .footer a {
            color: #667eea;
            text-decoration: none;
          }
          
          .footer a:hover {
            text-decoration: underline;
          }
          
          @media (prefers-color-scheme: dark) {
            body {
              background: #1f2937;
            }
            
            .container {
              background: #111827;
              color: #e5e7eb;
            }
            
            .item {
              border-bottom-color: #374151;
            }
            
            .item-meta {
              color: #9ca3af;
            }
            
            .item-description {
              color: #d1d5db;
            }
            
            .footer {
              color: #6b7280;
              border-top-color: #374151;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1><xsl:value-of select="title"/></h1>
            <p><xsl:value-of select="description"/></p>
          </div>
          
          <div class="info">
            <h2>📡 This is an RSS Feed</h2>
            <p>
              This is a web feed in RSS format. To subscribe, copy the URL from your browser's address bar
              and paste it into your RSS reader application.
            </p>
            <p style="margin-top: 8px;">
              <strong>Popular RSS readers:</strong> Feedly, Inoreader, NewsBlur, NetNewsWire, Reeder
            </p>
          </div>
          
          <div class="items">
            <h2 style="font-size: 22px; margin-bottom: 20px; color: #374151;">Recent Posts</h2>
            <xsl:apply-templates select="item"/>
          </div>
          
          <div class="footer">
            <p>
              RSS Feed • <a href="{link}">Visit Website</a>
            </p>
          </div>
        </div>
      </body>
    </html>
  </xsl:template>
  
  <xsl:template match="item">
    <div class="item">
      <h3>
        <a href="{link}" target="_blank">
          <xsl:value-of select="title"/>
        </a>
      </h3>
      <div class="item-meta">
        <xsl:if test="pubDate">
          Published: <xsl:value-of select="pubDate"/>
        </xsl:if>
      </div>
      <xsl:if test="description">
        <div class="item-description">
          <xsl:value-of select="description" disable-output-escaping="yes"/>
        </div>
      </xsl:if>
    </div>
  </xsl:template>
</xsl:stylesheet>
