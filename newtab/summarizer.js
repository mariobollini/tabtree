// Chrome AI Summarizer for newtab page context

let summarizer = null;
let isAvailable = false;
let errorMessage = null;

// Check if Chrome AI is available
export async function initSummarizer() {
  try {
    console.log('Canopy: Checking for Chrome AI...');
    console.log('Canopy: window.ai exists?', !!window.ai);

    if (!window.ai) {
      errorMessage = 'Chrome AI not available. Enable at chrome://flags/#optimization-guide-on-device-model';
      console.log('Canopy:', errorMessage);
      console.log('Canopy: Note - Built-in AI is experimental and may require Chrome Canary with flags enabled');
      return false;
    }

    console.log('Canopy: window.ai.summarizer exists?', !!window.ai.summarizer);

    if (!window.ai.summarizer) {
      errorMessage = 'Summarizer API not available. Try Chrome Canary with --enable-features=SummarizationAPI';
      console.log('Canopy:', errorMessage);
      return false;
    }

    console.log('Canopy: Checking summarizer capabilities...');
    const capabilities = await window.ai.summarizer.capabilities();
    console.log('Canopy: Capabilities:', capabilities);

    if (capabilities.available === 'no') {
      errorMessage = 'Summarizer not available on this device';
      console.log('Canopy:', errorMessage);
      return false;
    }

    if (capabilities.available === 'after-download') {
      console.log('Canopy: Summarizer model downloading in background...');
      errorMessage = 'AI model downloading...';
    }

    console.log('Canopy: Creating summarizer...');
    summarizer = await window.ai.summarizer.create({
      type: 'key-points',
      format: 'plain-text',
      length: 'short'
    });

    isAvailable = true;
    errorMessage = null;
    console.log('Canopy: AI summarization ready!');
    return true;
  } catch (error) {
    errorMessage = `Chrome AI error: ${error.message}`;
    console.error('Canopy: Chrome AI initialization failed:', error);
    console.log('Canopy: Stack trace:', error.stack);
    return false;
  }
}

// Generate a summary from page titles and URLs
export async function generateSummary(pages) {
  if (!isAvailable || !summarizer) {
    await initSummarizer();
    if (!isAvailable) return null;
  }

  try {
    // Create a natural text representation of the browsing session
    const text = pages.map((page, index) => {
      return `${index + 1}. ${page.title || 'Untitled'}`;
    }).join('\n');

    const summary = await summarizer.summarize(text);

    // Clean up and limit to 2 sentences
    const sentences = summary.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const shortSummary = sentences.slice(0, 2).join('. ') + '.';

    return shortSummary;
  } catch (error) {
    console.error('Canopy: Summarization failed:', error);
    return null;
  }
}

export function isSummarizerAvailable() {
  return isAvailable;
}

export function getSummarizerError() {
  return errorMessage;
}

// Fallback heuristic summarization when AI isn't available
export function generateHeuristicSummary(pages) {
  if (!pages || pages.length === 0) return null;

  // Extract meaningful words from titles (filter out common stop words)
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'when', 'where', 'why', 'how']);

  const wordCounts = new Map();
  const domains = new Set();

  pages.forEach(page => {
    // Extract domain
    try {
      const url = new URL(page.url);
      const domain = url.hostname.replace('www.', '').split('.')[0];
      domains.add(domain);
    } catch (e) {
      // Invalid URL, skip
    }

    // Extract words from title
    const title = (page.title || '').toLowerCase();
    const words = title.split(/[\s\-_|:,\.\/]+/)
      .filter(word => word.length > 3 && !stopWords.has(word))
      .filter(word => !/^\d+$/.test(word)); // Filter out pure numbers

    words.forEach(word => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });
  });

  // Find most common words (mentioned 2+ times or in multiple pages)
  const keywords = Array.from(wordCounts.entries())
    .filter(([word, count]) => count >= 2 || pages.length <= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);

  // Detect patterns
  const patterns = [];
  const allText = pages.map(p => (p.title || '').toLowerCase()).join(' ');

  if (allText.includes('documentation') || allText.includes('docs') || allText.includes('guide') || allText.includes('tutorial')) {
    patterns.push('reading documentation');
  }
  if (allText.includes('github') || allText.includes('repository') || allText.includes('code')) {
    patterns.push('reviewing code');
  }
  if (allText.includes('shop') || allText.includes('buy') || allText.includes('price') || allText.includes('cart')) {
    patterns.push('shopping');
  }
  if (allText.includes('news') || allText.includes('article')) {
    patterns.push('reading news');
  }
  if (domains.size === 1 && pages.length > 3) {
    patterns.push(`browsing ${Array.from(domains)[0]}`);
  }

  // Build summary
  let summary = '';

  if (patterns.length > 0) {
    summary = patterns[0].charAt(0).toUpperCase() + patterns[0].slice(1);
  } else if (keywords.length > 0) {
    summary = `Researching ${keywords.slice(0, 3).join(', ')}`;
  } else if (pages.length === 1) {
    // Single page - just use a shortened title
    const title = pages[0].title || 'Untitled';
    summary = title.length > 50 ? title.substring(0, 47) + '...' : title;
  } else {
    summary = `Browsing ${pages.length} pages`;
  }

  // Add page count context if multiple pages
  if (pages.length > 1 && !summary.includes(pages.length.toString())) {
    summary += ` (${pages.length} page${pages.length === 1 ? '' : 's'})`;
  }

  return summary;
}
