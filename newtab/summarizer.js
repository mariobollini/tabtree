// Chrome AI Summarizer for newtab page context

let summarizer = null;
let isAvailable = false;

// Check if Chrome AI is available
export async function initSummarizer() {
  try {
    if (!window.ai || !window.ai.summarizer) {
      console.log('Canopy: Chrome AI not available (requires Chrome 127+)');
      return false;
    }

    const capabilities = await window.ai.summarizer.capabilities();
    if (capabilities.available === 'no') {
      console.log('Canopy: Summarizer not available on this device');
      return false;
    }

    if (capabilities.available === 'after-download') {
      console.log('Canopy: Summarizer downloading in background...');
    }

    summarizer = await window.ai.summarizer.create({
      type: 'key-points',
      format: 'plain-text',
      length: 'short'
    });

    isAvailable = true;
    console.log('Canopy: AI summarization ready');
    return true;
  } catch (error) {
    console.log('Canopy: Chrome AI not supported:', error.message);
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
