// Status update function
function updateStatus(message) {
  const statusElement = document.getElementById('status');
  statusElement.textContent = message;
}

// Progress bar update function
function updateProgress(current, total) {
  const progressBar = document.getElementById('progressBar');
  const percentage = (current / total) * 100;
  progressBar.style.width = percentage + '%';
}

// Load settings when popup opens
document.addEventListener('DOMContentLoaded', () => {
  // Load saved settings
  chrome.storage.local.get(['downloadDelay', 'batchSize'], (result) => {
    if (result.downloadDelay !== undefined) {
      document.getElementById('downloadDelay').value = result.downloadDelay;
    }
    if (result.batchSize !== undefined) {
      document.getElementById('batchSize').value = result.batchSize;
    }
  });

  // Make sure the fetch button has the correct text
  document.getElementById('fetchChapters').textContent = 'Fetch All Chapters';

  // Request current status from background script
  chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
    if (response && response.status) {
      updateStatus(response.status);
      if (response.current && response.total) {
        updateProgress(response.current, response.total);
      }

      // If download is in progress, disable the buttons
      if (response.inProgress) {
        document.getElementById('downloadChapter').disabled = true;
        document.getElementById('downloadZip').disabled = true;
        document.getElementById('fetchChapters').disabled = true;
        document.getElementById('downloadChapter').textContent = 'Download in progress...';
        document.getElementById('downloadZip').textContent = 'Download in progress...';
        document.getElementById('fetchChapters').textContent = 'Download in progress...';
      }
    }
  });
});

// Set up a listener for status updates from the content script
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'updateStatus') {
    updateStatus(message.status);
    if (message.current !== undefined && message.total !== undefined) {
      updateProgress(message.current, message.total);
    }

    // Enable/disable buttons based on status
    const downloadButton = document.getElementById('downloadChapter');
    const zipButton = document.getElementById('downloadZip');
    if (message.status.includes('Completed') || message.status.includes('Error')) {
      downloadButton.disabled = false;
      zipButton.disabled = false;
      downloadButton.textContent = 'Download Images';
      zipButton.textContent = 'Download as ZIP';
    } else {
      downloadButton.disabled = true;
      zipButton.disabled = true;
      downloadButton.textContent = 'Download in progress...';
      zipButton.textContent = 'Download in progress...';
    }
  }
  return true;
});

// Save settings button
document.getElementById('saveSettings').addEventListener('click', () => {
  const downloadDelay = parseInt(document.getElementById('downloadDelay').value);
  const batchSize = parseInt(document.getElementById('batchSize').value);

  // Validate inputs
  if (isNaN(downloadDelay) || downloadDelay < 0 || downloadDelay > 5000) {
    alert('Please enter a valid download delay (0-5000 ms)');
    return;
  }

  if (isNaN(batchSize) || batchSize < 1 || batchSize > 10) {
    alert('Please enter a valid batch size (1-10)');
    return;
  }

  // Save settings
  chrome.storage.local.set({
    downloadDelay: downloadDelay,
    batchSize: batchSize
  }, () => {
    updateStatus('Settings saved!');
    setTimeout(() => {
      updateStatus('Ready to download');
    }, 1500);
  });
});

// Download button
document.getElementById('downloadChapter').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  updateStatus('Starting download process...');
  updateProgress(0, 1);

  // Disable buttons during download
  document.getElementById('downloadChapter').disabled = true;
  document.getElementById('downloadZip').disabled = true;
  document.getElementById('downloadChapter').textContent = 'Download in progress...';
  document.getElementById('downloadZip').textContent = 'Download in progress...';

  // Get current settings
  chrome.storage.local.get(['downloadDelay', 'batchSize'], (settings) => {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: downloadChapterImages,  // Use 'func' instead of 'function'
      args: [settings.downloadDelay || 300, settings.batchSize || 3]
    });
  });
});

// Function to be injected into the page for downloading images
function downloadChapterImages(downloadDelay = 300, batchSize = 3) {
  console.log('Starting download process...');
  console.log('Current URL:', window.location.href);
  console.log('Download delay:', downloadDelay, 'ms');
  console.log('Batch size:', batchSize);

  // Send status update to popup
  chrome.runtime.sendMessage({
    action: 'updateStatus',
    status: 'Searching for manga images...'
  });

  // Wait for page to load fully
  setTimeout(() => {
    // COMPLETELY NEW IMAGE SELECTION APPROACH - similar to ZIP function
    console.log('Collecting images from page...');
    
    // Create a Map to store unique images by URL
    const uniqueImages = new Map();
    
    // Try multiple selectors to find manga images
    const selectors = [
      'img[src*="/manga/"]',
      'img[src*="/chapters/"]',
      '.reader-content img',
      '.chapter-content img',
      '.manga-reader img',
      '.reader img',
      '.chapter img',
      'img[src*="chapter"]',
      'img[src*=".jpg"], img[src*=".png"], img[src*=".jpeg"]'
    ];
    
    // Try each selector
    for (const selector of selectors) {
      console.log(`Trying selector: ${selector}`);
      const found = Array.from(document.querySelectorAll(selector))
        .filter(img => img.src && img.width > 100);
      
      console.log(`Found ${found.length} images with selector: ${selector}`);
      
      // Add to our unique images Map
      found.forEach(img => {
        if (!uniqueImages.has(img.src)) {
          uniqueImages.set(img.src, img);
        }
      });
    }
    
    // Convert Map to Array
    const images = Array.from(uniqueImages.values());
    
    // Filter out unwanted images
    const filteredImages = images.filter(img => {
      const src = img.src.toLowerCase();
      return !['avatar', 'icon', 'logo', 'banner', 'brand'].some(word => src.includes(word));
    });
    
    console.log(`Final unique image count: ${filteredImages.length}`);
    
    if (filteredImages.length === 0) {
      chrome.runtime.sendMessage({
        action: 'updateStatus',
        status: 'Error: No manga images found on this page'
      });
      return;
    }
    
    // Extract manga name and chapter number
    let mangaName = document.title.split('|')[0]?.trim() || 'Manga';
    let chapterNum = 'unknown';
    
    // Try to extract chapter number from title
    const chapterMatch = document.title.match(/Chapter\s+(\d+)/i) || 
                         document.title.match(/Ch\.\s*(\d+)/i) ||
                         document.title.match(/Ch\s+(\d+)/i);
    
    if (chapterMatch) {
      chapterNum = chapterMatch[1];
    } else {
      // Try from URL
      const urlParts = window.location.pathname.split('/');
      if (urlParts.length > 0) {
        const lastPart = urlParts[urlParts.length - 1];
        if (lastPart) {
          chapterNum = lastPart.substring(0, 8); // Use first 8 chars as identifier
        }
      }
    }
    
    // Create folder name
    const folderName = `${mangaName}_ch${chapterNum}`.replace(/[\\/*?:"<>|]/g, '_');
    
    console.log(`Using folder name: ${folderName}`);
    
    chrome.runtime.sendMessage({
      action: 'updateStatus',
      status: `Found ${filteredImages.length} images. Starting download...`,
      current: 0,
      total: filteredImages.length
    });

    // Regular download - process in batches
    let downloadCount = 0;
    let currentBatch = 0;
    const totalImages = filteredImages.length;

    // Process downloads in batches
    async function processBatch() {
      if (currentBatch >= totalImages) {
        chrome.runtime.sendMessage({
          action: 'updateStatus',
          status: `Completed! Downloaded ${downloadCount} images from chapter ${chapterNum}`,
          current: totalImages,
          total: totalImages
        });
        return;
      }

      const batchPromises = [];
      const batchEnd = Math.min(currentBatch + batchSize, totalImages);

      chrome.runtime.sendMessage({
        action: 'updateStatus',
        status: `Downloading images ${currentBatch+1}-${batchEnd}/${totalImages}...`,
        current: currentBatch,
        total: totalImages
      });

      for (let i = currentBatch; i < batchEnd; i++) {
        const img = filteredImages[i];
        const imgUrl = img.src;
        if (!imgUrl) continue;

        console.log(`Downloading image ${i+1}/${totalImages}: ${imgUrl}`);

        const filename = `${folderName}/${(i+1).toString().padStart(3, '0')}.jpg`;

        // Create a promise for each download
        const downloadPromise = new Promise((resolve) => {
          chrome.runtime.sendMessage({
            action: 'downloadImage',
            url: imgUrl,
            filename: filename
          }, (response) => {
            if (response && response.success) {
              downloadCount++;
            }
            resolve();
          });
        });

        batchPromises.push(downloadPromise);
      }

      // Wait for all downloads in this batch to complete
      await Promise.all(batchPromises);

      // Update the current batch
      currentBatch = batchEnd;

      // Wait for the specified delay before processing the next batch
      setTimeout(processBatch, downloadDelay);
    }

    // Start processing the first batch
    processBatch();
  }, 2000); // Wait 2 seconds for images to load
}

// ZIP download button
document.getElementById('downloadZip').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  updateStatus('Starting ZIP download process...');
  updateProgress(0, 1);

  // Disable buttons during download
  document.getElementById('downloadChapter').disabled = true;
  document.getElementById('downloadZip').disabled = true;
  document.getElementById('downloadChapter').textContent = 'Download in progress...';
  document.getElementById('downloadZip').textContent = 'Download in progress...';

  // Get current settings
  chrome.storage.local.get(['downloadDelay', 'batchSize'], (settings) => {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: collectImagesForZip,
      args: [settings.downloadDelay || 300, settings.batchSize || 3]
    });
  });
});

// New function to collect images for ZIP
function collectImagesForZip(downloadDelay = 300, batchSize = 3) {
  console.log('Starting image collection for ZIP...');
  console.log('Current URL:', window.location.href);
  console.log('Download delay:', downloadDelay, 'ms');
  console.log('Batch size:', batchSize);

  // Send status update to popup
  chrome.runtime.sendMessage({
    action: 'updateStatus',
    status: 'Collecting images for ZIP...'
  });

  // Wait for page to load fully
  setTimeout(() => {
    // COMPLETELY NEW IMAGE SELECTION APPROACH
    console.log('Collecting images from page...');
    
    // Create a Map to store unique images by URL
    const uniqueImages = new Map();
    
    // Try multiple selectors to find manga images
    const selectors = [
      'img[src*="/manga/"]',
      'img[src*="/chapters/"]',
      '.reader-content img',
      '.chapter-content img',
      '.manga-reader img',
      '.reader img',
      '.chapter img',
      'img[src*="chapter"]',
      'img[src*=".jpg"], img[src*=".png"], img[src*=".jpeg"]'
    ];
    
    // Try each selector
    for (const selector of selectors) {
      console.log(`Trying selector: ${selector}`);
      const found = Array.from(document.querySelectorAll(selector))
        .filter(img => img.src && img.width > 100);
      
      console.log(`Found ${found.length} images with selector: ${selector}`);
      
      // Add to our unique images Map
      found.forEach(img => {
        if (!uniqueImages.has(img.src)) {
          uniqueImages.set(img.src, img);
        }
      });
    }
    
    // Convert Map to Array
    const images = Array.from(uniqueImages.values());
    
    // Filter out unwanted images
    const filteredImages = images.filter(img => {
      const src = img.src.toLowerCase();
      return !['avatar', 'icon', 'logo', 'banner', 'brand'].some(word => src.includes(word));
    });
    
    console.log(`Final unique image count: ${filteredImages.length}`);
    
    if (filteredImages.length === 0) {
      chrome.runtime.sendMessage({
        action: 'updateStatus',
        status: 'Error: No manga images found on this page'
      });
      return;
    }
    
    // Extract manga name and chapter number
    let mangaName = document.title.split('|')[0]?.trim() || 'Manga';
    let chapterNum = 'unknown';
    
    // Try to extract chapter number from title
    const chapterMatch = document.title.match(/Chapter\s+(\d+)/i) || 
                         document.title.match(/Ch\.\s*(\d+)/i) ||
                         document.title.match(/Ch\s+(\d+)/i);
    
    if (chapterMatch) {
      chapterNum = chapterMatch[1];
    } else {
      // Try from URL
      const urlParts = window.location.pathname.split('/');
      if (urlParts.length > 0) {
        const lastPart = urlParts[urlParts.length - 1];
        if (lastPart) {
          chapterNum = lastPart.substring(0, 8); // Use first 8 chars as identifier
        }
      }
    }
    
    // Create folder name
    const folderName = `${mangaName}_ch${chapterNum}`.replace(/[\\/*?:"<>|]/g, '_');
    
    console.log(`Using folder name: ${folderName}`);
    
    // Collect all image URLs
    const imageUrls = filteredImages.map(img => img.src);
    
    // Send to background script with a NEW action
    chrome.runtime.sendMessage({
      action: 'createSingleChapterZip', // NEW ACTION NAME
      urls: imageUrls,
      folderName: folderName,
      settings: {
        downloadDelay: downloadDelay,
        batchSize: batchSize
      }
    }, response => {
      console.log('ZIP creation response:', response);
    });
  }, 2000); // Wait 2 seconds for images to load
}

// Add manga series functionality with auto-detection of manga URL
document.getElementById('fetchChapters').addEventListener('click', async () => {
  // Get the active tab to detect the manga URL
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentUrl = tab.url;

  // Check if we're on a manga page
  const isMangaPage = currentUrl.includes('/series/') || currentUrl.includes('/manga/');
  if (!isMangaPage) {
    alert('Please navigate to a manga page first (URL should contain "/series/" or "/manga/")');
    return;
  }

  const mangaUrl = currentUrl;
  updateStatus('Fetching all chapters...');

  // Disable the fetch button during operation
  document.getElementById('fetchChapters').disabled = true;
  document.getElementById('fetchChapters').textContent = 'Fetching...';

  try {
    // Get settings
    const settings = await new Promise(resolve => {
      chrome.storage.local.get(['downloadDelay', 'batchSize'], (result) => {
        resolve({
          downloadDelay: result.downloadDelay || 300,
          batchSize: result.batchSize || 3,
          chapterDelay: 1000 // 1 second between chapters
        });
      });
    });

    // Create scraper instance
    const scraper = new MangaScraper(settings);

    // Get manga title
    const mangaTitle = await scraper.getMangaTitle(mangaUrl);

    // Get all chapters using the improved functionality
    const chapters = await scraper.getChapters(mangaUrl);

    if (chapters.length === 0) {
      throw new Error('No chapters found for this manga');
    }

    // Parse chapter range if provided
    const chapterRange = document.getElementById('chapterRange').value.trim();
    const filteredChapters = scraper.parseChapterRange(chapterRange, chapters);

    // Display chapters
    displayChapters(filteredChapters, mangaTitle);

    updateStatus(`Found ${filteredChapters.length} chapters for ${mangaTitle}`);
  } catch (error) {
    updateStatus(`Error: ${error.message}`);
    console.error('Error fetching chapters:', error);
  } finally {
    // Re-enable the fetch button
    document.getElementById('fetchChapters').disabled = false;
    document.getElementById('fetchChapters').textContent = 'Fetch All Chapters';
  }
});

// Function to display chapters in the UI
function displayChapters(chapters, mangaTitle) {
  const chaptersContainer = document.getElementById('chaptersContainer');
  const chaptersList = document.getElementById('chaptersList');

  // Clear previous chapters
  chaptersList.innerHTML = '';

  // Add manga title as header
  const titleElement = document.createElement('h4');
  titleElement.textContent = mangaTitle;
  chaptersList.appendChild(titleElement);

  // Add each chapter with a checkbox
  chapters.forEach((chapter, index) => {
    const chapterItem = document.createElement('div');
    chapterItem.className = 'chapter-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = chapter.url;

    // Clean up chapter name if needed
    let chapterName = chapter.name;
    if (!chapterName || chapterName.includes('{') || chapterName.includes('Last Read')) {
      // If the name contains SVG code or other unwanted text, use a simple chapter number
      chapterName = `Chapter ${chapter.number || index + 1}`;
    }

    checkbox.dataset.name = chapterName;
    checkbox.checked = true;

    const label = document.createElement('label');
    label.textContent = chapterName;

    chapterItem.appendChild(checkbox);
    chapterItem.appendChild(label);
    chaptersList.appendChild(chapterItem);
  });

  // Show the chapters container
  chaptersContainer.style.display = 'block';
}

// Handle select all button
document.getElementById('selectAll').addEventListener('click', () => {
  const checkboxes = document.querySelectorAll('#chaptersList input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    checkbox.checked = true;
  });
});

// Handle deselect all button
document.getElementById('deselectAll').addEventListener('click', () => {
  const checkboxes = document.querySelectorAll('#chaptersList input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    checkbox.checked = false;
  });
});

// Handle download button click
document.getElementById('downloadSelected').addEventListener('click', async () => {
  const checkboxes = document.querySelectorAll('#chaptersList input[type="checkbox"]:checked');
  if (checkboxes.length === 0) {
    updateStatus('Please select at least one chapter to download');
    return;
  }

  // Disable the download button
  document.getElementById('downloadSelected').disabled = true;
  document.getElementById('downloadSelected').textContent = 'Downloading...';

  // Get the active tab to detect the manga URL
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const mangaUrl = tab.url;

  // Get selected chapters
  const selectedChapters = Array.from(checkboxes).map(checkbox => ({
    url: checkbox.value,
    name: checkbox.dataset.name
  }));

  updateStatus(`Starting download of ${selectedChapters.length} chapters...`);

  try {
    // Get settings
    const settings = await new Promise(resolve => {
      chrome.storage.local.get(['downloadDelay', 'batchSize'], (result) => {
        resolve({
          downloadDelay: result.downloadDelay || 300,
          batchSize: result.batchSize || 3,
          chapterDelay: 1000 // 1 second between chapters
        });
      });
    });

    // Create scraper instance
    const scraper = new MangaScraper(settings);

    // Start download with progress updates
    const result = await scraper.downloadMangaSeries(
      mangaUrl,
      selectedChapters,
      (progress) => {
        updateStatus(progress.status);
        updateProgress(progress.current, progress.total);
      }
    );

    // Update status based on result
    if (result.success) {
      updateStatus(`Completed downloading ${result.totalDownloaded} chapters of ${result.mangaTitle}`);
    } else {
      updateStatus(`Error: ${result.error}`);
    }
  } catch (error) {
    updateStatus(`Error: ${error.message}`);
    console.error('Error downloading chapters:', error);
  } finally {
    // Re-enable the download button
    document.getElementById('downloadSelected').disabled = false;
    document.getElementById('downloadSelected').textContent = 'Download Selected';
  }
});














