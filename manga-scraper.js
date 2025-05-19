// Manga scraper functionality for WeebCentral Downloader

// This function will be executed in the context of the manga page
// It needs to be defined outside the class to be properly serialized
function scrapeAllChaptersFromPage() {
  return new Promise(async (resolve) => {
    console.log("Scraping all chapters from page...");

    // First ensure all chapters are visible by clicking "show more" buttons
    await ensureAllChaptersVisible();

    // Now scrape the chapter URLs
    const chapters = await getAllChapters();

    resolve(chapters);
  });

  // Function to ensure all chapters are visible by clicking "show more" buttons
  async function ensureAllChaptersVisible() {
    console.log("Ensuring all chapters are visible...");

    // Common selectors for "show more" buttons
    const showMoreSelectors = [
      'button:not([disabled])',
      'a.button',
      'a.btn',
      'div.button',
      'div.btn',
      'span.button',
      'span.btn',
      '.load-more',
      '.show-more',
      '.view-more'
    ];

    // Try each selector
    for (const selector of showMoreSelectors) {
      const elements = document.querySelectorAll(selector);

      for (const el of elements) {
        // Check if text contains relevant phrases
        const text = el.textContent.toLowerCase();
        if (text.includes('show all') ||
            text.includes('load more') ||
            text.includes('show all chapters') ||
            text.includes('view more')) {

          console.log('Found "show more" button, clicking it...', el);
          el.click();

          // Wait for new content to load
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Check if there are more "show more" buttons after clicking
          const moreButtons = document.querySelectorAll(selector);
          for (const btn of moreButtons) {
            const btnText = btn.textContent.toLowerCase();
            if ((btnText.includes('show all') ||
                 btnText.includes('load more') ||
                 btnText.includes('show all chapters') ||
                 btnText.includes('view more')) &&
                btn !== el) {
              console.log('Found additional button, clicking it...', btn);
              btn.click();
              // Wait between clicks
              await new Promise(resolve => setTimeout(resolve, 1500));
            }
          }

          // Final wait to ensure everything is loaded
          await new Promise(resolve => setTimeout(resolve, 1000));
          return true;
        }
      }
    }

    console.log('No "show more" buttons found, all chapters should be visible');
    return true;
  }

  // Function to scrape chapter URLs
  async function scrapeChapterUrls() {
    // Now scrape the chapter URLs
    // First try WeebCentral specific selectors
    let chapterLinks = Array.from(document.querySelectorAll('div[x-data] > a'));

    // If no chapters found with specific selector, try generic selectors
    if (chapterLinks.length === 0) {
      console.log('No chapters found with WeebCentral specific selector, trying generic selectors');
      chapterLinks = Array.from(document.querySelectorAll('a[href*="chapter"]'));

      // If still no chapters, try links that might be chapters
      if (chapterLinks.length === 0) {
        console.log('No chapters found with chapter keyword, trying all links');
        chapterLinks = Array.from(document.querySelectorAll('a'))
          .filter(link => {
            const href = link.getAttribute('href');
            return href && (
              href.includes('chapters/') ||
              href.includes('chapter/') ||
              href.includes('read/')
            );
          });
      }
    }

    console.log(`Found ${chapterLinks.length} potential chapter links`);

    // Filter and map to get clean chapter URLs
    const chapterUrls = chapterLinks
      .map(link => link.href)
      .filter(url => url && (
        url.includes('chapter') ||
        url.includes('chapters/') ||
        url.includes('read/')
      ));

    // Remove duplicates
    const uniqueChapterUrls = [...new Set(chapterUrls)];

    console.log(`Found ${uniqueChapterUrls.length} unique chapter URLs`);
    return uniqueChapterUrls;
  }

  // Function to extract chapter number from URL or text
  function extractChapterNumber(url, text) {
    // Try to extract from URL first
    const urlPatterns = [
      /chapter[_\-](\d+(\.\d+)?)/i,
      /ch[_\-](\d+(\.\d+)?)/i,
      /\/chapter\/(\d+(\.\d+)?)/i,
      /\/ch\/(\d+(\.\d+)?)/i,
      /\/(\d+(\.\d+)?)$/,
      /\/chapters\/(\d+)/i
    ];
    
    for (const pattern of urlPatterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return parseFloat(match[1]);
      }
    }

    // For WeebCentral URLs like /chapters/01J76XYSNJDQCG2T1AW43Z34Y1
    // Try to extract from text since URL doesn't contain chapter number
    if (text) {
      // Look for "Chapter X" or "Ch. X" pattern
      const textPatterns = [
        /chapter\s*(\d+(\.\d+)?)/i,
        /ch\.\s*(\d+(\.\d+)?)/i,
        /ch\s+(\d+(\.\d+)?)/i,
        /^(\d+(\.\d+)?)$/,
        /episode\s*(\d+(\.\d+)?)/i,
        /ep\.\s*(\d+(\.\d+)?)/i,
        /ep\s+(\d+(\.\d+)?)/i
      ];
      
      for (const pattern of textPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          return parseFloat(match[1]);
        }
      }
    }

    // For sites that use numeric IDs in the URL path
    const pathParts = url.split('/').filter(part => part.length > 0);
    for (let i = pathParts.length - 1; i >= 0; i--) {
      const part = pathParts[i];
      // Check if this part is purely numeric
      if (/^\d+(\.\d+)?$/.test(part)) {
        return parseFloat(part);
      }
    }

    // For sites that use chapter numbers in query parameters
    try {
      const urlObj = new URL(url);
      const params = urlObj.searchParams;
      
      // Common query parameter names for chapter numbers
      const paramNames = ['chapter', 'ch', 'c', 'num', 'n'];
      
      for (const name of paramNames) {
        if (params.has(name)) {
          const value = params.get(name);
          if (/^\d+(\.\d+)?$/.test(value)) {
            return parseFloat(value);
          }
        }
      }
    } catch (e) {
      console.error('Error parsing URL:', e);
    }

    // If we still can't find a number, check if the URL contains any numbers
    const anyNumberMatch = url.match(/\/(\d+)(?:[^\d]|$)/);
    if (anyNumberMatch && anyNumberMatch[1]) {
      return parseFloat(anyNumberMatch[1]);
    }

    return null;
  }

  // Function to sort chapters by number
  function sortChaptersByNumber(chapters) {
    return chapters.sort((a, b) => {
      const aNum = a.number || 0;
      const bNum = b.number || 0;
      return aNum - bNum;
    });
  }

  // Main function to get all chapters with proper numbering
  async function getAllChapters() {
    // Now scrape the chapter URLs
    const chapterUrls = await scrapeChapterUrls();

    console.log(`Found ${chapterUrls.length} chapter URLs`);

    // Extract chapter information
    const chapters = [];
    
    // Get all chapter links with their text content
    const chapterLinks = Array.from(document.querySelectorAll('a[href*="chapter"], div[x-data] > a, a[href*="chapters/"], a[href*="read/"]'));
    
    console.log(`Found ${chapterLinks.length} chapter links with text content`);
    
    // Create a map of URLs to their text content
    const urlToTextMap = new Map();
    chapterLinks.forEach(link => {
      if (link.href) {
        urlToTextMap.set(link.href, link.textContent.trim());
      }
    });

    // Process each URL
    for (let i = 0; i < chapterUrls.length; i++) {
      const url = chapterUrls[i];
      const text = urlToTextMap.get(url) || '';
      
      // Try to extract chapter number from URL or text
      let chapterNum = extractChapterNumber(url, text);
      
      // If we couldn't extract a number, use the index (reversed to handle newest first)
      if (!chapterNum) {
        chapterNum = chapterUrls.length - i;
      }
      
      // For sites that list newest chapters first, we need to extract the actual chapter number
      // Try to extract from text content first
      const chapterMatch = text.match(/chapter\s+(\d+(\.\d+)?)/i) || 
                           text.match(/ch\.\s*(\d+(\.\d+)?)/i) ||
                           text.match(/ch\s+(\d+(\.\d+)?)/i) ||
                           text.match(/^(\d+(\.\d+)?)$/);
      
      if (chapterMatch && chapterMatch[1]) {
        chapterNum = parseFloat(chapterMatch[1]);
      } else {
        // Try to extract from URL
        const urlMatch = url.match(/chapter[_\-](\d+(\.\d+)?)/i) || 
                         url.match(/ch[_\-](\d+(\.\d+)?)/i) ||
                         url.match(/\/(\d+(\.\d+)?)$/);
        
        if (urlMatch && urlMatch[1]) {
          chapterNum = parseFloat(urlMatch[1]);
        }
      }
      
      // Clean up the chapter name
      let chapterName = text;
      if (!chapterName || chapterName.length < 2) {
        chapterName = `Chapter ${chapterNum}`;
      } else {
        // Clean up the name
        chapterName = cleanChapterName(chapterName);
        
        // If the cleaned name doesn't contain the chapter number, add it
        if (!chapterName.match(/chapter\s+\d+/i) && !chapterName.match(/ch\.\s*\d+/i)) {
          chapterName = `Chapter ${chapterNum} - ${chapterName}`;
        }
      }
      
      chapters.push({
        url: url,
        name: chapterName,
        number: chapterNum
      });
      
      console.log(`Processed chapter: ${chapterName} (${chapterNum}) - ${url}`);
    }

    // Helper function to clean up chapter names
    function cleanChapterName(name) {
      if (!name) return '';

      // Remove SVG code
      name = name.replace(/\.st\d+\s*{\s*fill:[^}]+}/g, '');

      // Remove dates (like Sep 7, 2024)
      name = name.replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}\b/g, '');

      // Remove "Last Read" text
      name = name.replace(/Last Read/g, '');

      // Remove extra whitespace
      name = name.replace(/\s+/g, ' ').trim();

      return name;
    }

    // Sort chapters by number
    const sortedChapters = sortChaptersByNumber(chapters);

    console.log('Sorted chapters:', sortedChapters);
    return sortedChapters;
  }
}

class MangaScraper {
  constructor(settings = {}) {
    this.settings = {
      downloadDelay: settings.downloadDelay || 300,
      batchSize: settings.batchSize || 3,
      chapterDelay: settings.chapterDelay || 1000,
      maxRetries: 3,
      retryDelay: 1000
    };
    this.baseUrl = 'https://weebcentral.com';
    this.stopFlag = false;

    // Keep track of chapters being processed to prevent duplicates
    this.processingChapters = new Set();
  }

  async fetchWithRetry(url, options = {}, retries = this.settings.maxRetries) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response;
    } catch (error) {
      if (retries > 0) {
        console.log(`Fetch failed, retrying (${retries} attempts left)...`);
        await new Promise(resolve => setTimeout(resolve, this.settings.retryDelay));
        return this.fetchWithRetry(url, options, retries - 1);
      } else {
        throw error;
      }
    }
  }

  getChapterListUrl(mangaUrl) {
    // For weebcentral.com, the chapter list is on the manga page
    return mangaUrl;
  }

  extractChapterNumber(chapterName) {
    // Try to extract chapter number from name
    const match = chapterName.match(/chapter\s+(\d+(\.\d+)?)/i);
    if (match) {
      return parseFloat(match[1]);
    }

    // Try other formats
    const numMatch = chapterName.match(/(\d+(\.\d+)?)/);
    if (numMatch) {
      return parseFloat(numMatch[1]);
    }

    return 0; // Default if no number found
  }

  async getMangaTitle(mangaUrl) {
    try {
      const response = await this.fetchWithRetry(mangaUrl);
      const text = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');

      // Try different selectors for the title
      const titleSelectors = [
        'h1.text-2xl', // Common selector for manga titles
        'h1', // Generic h1
        '.manga-title',
        '.series-title'
      ];

      for (const selector of titleSelectors) {
        const titleElement = doc.querySelector(selector);
        if (titleElement && titleElement.textContent.trim()) {
          return titleElement.textContent.trim();
        }
      }

      // Fallback: extract from URL
      const urlParts = mangaUrl.split('/');
      const lastPart = urlParts[urlParts.length - 1];
      if (lastPart) {
        return lastPart.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      }

      return "Unknown Manga";
    } catch (error) {
      console.error("Error getting manga title:", error);
      return "Unknown Manga";
    }
  }

  async getChapters(mangaUrl) {
    try {
      const chapterListUrl = this.getChapterListUrl(mangaUrl);
      console.log("Fetching chapter list from:", chapterListUrl);

      // Create a tab to load the manga page and ensure all chapters are visible
      return new Promise((resolve) => {
        chrome.tabs.create({
          url: chapterListUrl,
          active: false
        }, async (tab) => {
          try {
            // Wait a moment to ensure the page loads
            await new Promise(r => setTimeout(r, 3000));
            
            // Execute script to ensure all chapters are visible and scrape them
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: scrapeAllChaptersFromPage
            }, (results) => {
              // Close the tab after scraping
              chrome.tabs.remove(tab.id);

              if (results && results[0] && results[0].result) {
                const chapters = results[0].result;
                console.log(`Found ${chapters.length} unique chapters`);
                
                // Validate chapter numbers
                const validatedChapters = chapters.map(chapter => {
                  // Ensure chapter has a valid number
                  if (!chapter.number || isNaN(chapter.number)) {
                    console.warn(`Chapter has invalid number: ${chapter.name}, URL: ${chapter.url}`);
                    // Try to extract from name
                    const nameMatch = chapter.name.match(/chapter\s+(\d+(\.\d+)?)/i);
                    if (nameMatch && nameMatch[1]) {
                      chapter.number = parseFloat(nameMatch[1]);
                    } else {
                      // Default to 0 if we can't extract a number
                      chapter.number = 0;
                    }
                  }
                  return chapter;
                });
                
                resolve(validatedChapters);
              } else {
                console.error("Failed to scrape chapters");
                resolve([]);
              }
            });
          } catch (error) {
            // Make sure to close the tab even if there's an error
            chrome.tabs.remove(tab.id);
            console.error("Error in getChapters:", error);
            resolve([]);
          }
        });
      });
    } catch (error) {
      console.error("Error getting chapters:", error);
      return [];
    }
  }

  parseChapterRange(chapterRange, chapters) {
    if (!chapterRange || chapterRange.trim() === '') {
      return chapters; // All chapters
    }

    let filteredChapters = [];

    if (chapterRange.includes('-')) {
      // Range of chapters
      const [start, end] = chapterRange.split('-').map(n => parseFloat(n.trim()));
      filteredChapters = chapters.filter(chapter =>
        chapter.number >= start && chapter.number <= end
      );
    } else {
      // Single chapter
      const targetNumber = parseFloat(chapterRange.trim());
      filteredChapters = chapters.filter(chapter => chapter.number === targetNumber);
    }

    // Ensure uniqueness by URL
    const uniqueFilteredChapters = [];
    const seenUrls = new Set();

    for (const chapter of filteredChapters) {
      if (!seenUrls.has(chapter.url)) {
        seenUrls.add(chapter.url);
        uniqueFilteredChapters.push(chapter);
      }
    }

    return uniqueFilteredChapters;
  }

  async downloadMangaSeries(mangaUrl, selectedChapters, progressCallback) {
    try {
      this.stopFlag = false;
      const mangaTitle = await this.getMangaTitle(mangaUrl);
      console.log(`Starting download for manga: ${mangaTitle}`);

      let totalProcessed = 0;
      let totalChapters = selectedChapters.length;

      // Clear the processing set at the start of a new download
      this.processingChapters.clear();

      // Process each chapter to collect images
      for (let i = 0; i < selectedChapters.length; i++) {
        if (this.stopFlag) {
          console.log("Download stopped by user");
          break;
        }

        const chapter = selectedChapters[i];

        // Skip if we've already processed this chapter URL
        if (this.processingChapters.has(chapter.url)) {
          console.log(`Skipping duplicate chapter: ${chapter.name} (${chapter.url})`);
          continue;
        }

        // Mark this chapter as being processed
        this.processingChapters.add(chapter.url);

        const chapterProgress = {
          current: i + 1,
          total: totalChapters,
          chapterName: chapter.name,
          mangaTitle: mangaTitle,
          status: `Processing chapter ${i+1}/${totalChapters}: ${chapter.name}`
        };

        if (progressCallback) {
          progressCallback(chapterProgress);
        }

        console.log(`Processing chapter ${i+1}/${totalChapters}: ${chapter.name} (${chapter.url})`);

        // Send message to background script to handle the chapter processing
        await new Promise(resolve => {
          chrome.runtime.sendMessage({
            action: 'downloadMangaChapter',
            chapterUrl: chapter.url,
            chapterName: chapter.name,
            mangaTitle: mangaTitle,
            settings: this.settings
          }, (response) => {
            if (response && response.success) {
              totalProcessed++;
            }
            resolve();
          });
        });

        // Wait between chapters to avoid overloading
        if (i < selectedChapters.length - 1) {
          await new Promise(resolve => setTimeout(resolve, this.settings.chapterDelay));
        }
      }

      // After all chapters are processed, download them as a single ZIP
      if (totalProcessed > 0 && !this.stopFlag) {
        if (progressCallback) {
          progressCallback({
            current: totalChapters,
            total: totalChapters,
            mangaTitle: mangaTitle,
            status: `Creating ZIP file for ${totalProcessed} chapters...`
          });
        }

        // Send message to background script to create the ZIP file
        await new Promise(resolve => {
          chrome.runtime.sendMessage({
            action: 'downloadPendingChapters',
            settings: this.settings
          }, (response) => {
            resolve(response);
          });
        });
      }

      return {
        success: true,
        totalProcessed,
        totalChapters,
        mangaTitle
      };
    } catch (error) {
      console.error("Error downloading manga series:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  stopDownload() {
    this.stopFlag = true;
  }
}

// Make the class available globally
window.MangaScraper = MangaScraper;






