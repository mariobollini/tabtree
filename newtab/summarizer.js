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
