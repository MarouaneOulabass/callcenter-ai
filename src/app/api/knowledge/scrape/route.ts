import { NextRequest, NextResponse } from 'next/server';
import { createClientFromToken, extractToken, createServiceClient } from '@/lib/supabase/server';
import { ingestWebPage } from '@/lib/rag/ingest';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import * as cheerio from 'cheerio';

async function scrapeUrl(url: string): Promise<{ title: string; content: string }> {
  const { data: html } = await axios.get(url, {
    timeout: 10000,
    headers: { 'User-Agent': 'CallCenterAI-Bot/1.0' },
  });

  const $ = cheerio.load(html);

  // Remove scripts, styles, nav, footer
  $('script, style, nav, footer, header, iframe, noscript').remove();

  const title = $('title').text().trim() || url;
  const content = $('main, article, .content, #content, body')
    .first()
    .text()
    .replace(/\s+/g, ' ')
    .trim();

  return { title, content };
}

async function extractLinks(baseUrl: string, html: string): Promise<string[]> {
  const $ = cheerio.load(html);
  const base = new URL(baseUrl);
  const links = new Set<string>();

  $('a[href]').each((_, el) => {
    try {
      const href = $(el).attr('href');
      if (!href) return;
      const absolute = new URL(href, baseUrl);
      if (absolute.hostname === base.hostname && !absolute.hash) {
        links.add(absolute.origin + absolute.pathname);
      }
    } catch {
      // ignore invalid URLs
    }
  });

  return [...links].slice(0, 50);
}

export async function POST(request: NextRequest) {
  try {
    const token = extractToken(request);
    const supabase = await createClientFromToken(token);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceClient = await createServiceClient();
    const { data: userData } = await serviceClient
      .from('users')
      .select('workspace_id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
    }

    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: 'URL required' }, { status: 400 });
    }

    try {
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return NextResponse.json({ error: 'Invalid URL protocol' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    const sourceId = uuidv4();

    await serviceClient.from('knowledge_sources').insert({
      id: sourceId,
      workspace_id: userData.workspace_id,
      type: 'web',
      name: url,
      status: 'processing',
      metadata: { url },
    });

    // Start async scraping
    (async () => {
      try {
        // Scrape main page
        const { data: mainHtml } = await axios.get(url, {
          timeout: 10000,
          headers: { 'User-Agent': 'CallCenterAI-Bot/1.0' },
        });

        const links = await extractLinks(url, mainHtml);
        const allUrls = [url, ...links].slice(0, 50);

        let processedCount = 0;
        for (const pageUrl of allUrls) {
          try {
            const { content } = await scrapeUrl(pageUrl);
            if (content.length > 100) {
              await ingestWebPage(pageUrl, content, sourceId, userData.workspace_id);
              processedCount++;
            }
          } catch {
            // Skip failed pages
          }
        }

        await serviceClient
          .from('knowledge_sources')
          .update({
            status: 'completed',
            metadata: { url, pagesProcessed: processedCount },
          })
          .eq('id', sourceId);
      } catch (error) {
        console.error('Scrape error:', error);
        await serviceClient
          .from('knowledge_sources')
          .update({ status: 'error' })
          .eq('id', sourceId);
      }
    })();

    return NextResponse.json({ sourceId, status: 'processing' });
  } catch (error) {
    console.error('Scrape error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
