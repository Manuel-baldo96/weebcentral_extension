# WeebCentral Downloader

A powerful browser extension for downloading manga chapters from weebcentral.com.

![WeebCentral Downloader](icons/icon128.png)

# Script

If You Don't want extension I have also created a script for it which is very fast. https://github.com/Yui007/weebcentral_downloader

## Features

- **Direct Image Download**: Download all images from a manga chapter with a single click
- **ZIP Download**: Package all chapter images into a convenient ZIP file
- **Batch Processing**: Download multiple chapters at once
- **Customizable Settings**: Adjust Delay and concurrent downloads
- **Chapter Range Selection**: Choose specific chapters to download
- **Progress Tracking**: Monitor download progress in real-time

## Supported Sites

- weebcentral.com

## Supported Browsers

- Google Chrome
- Microsoft Edge

## Installation

### From Browser Extension Stores
*(Coming Soon)*

### Manual Installation
1. Git Clone The Repository
3. Open Chrome and go to `chrome://extensions/`
4. Enable "Developer mode" in the top-right corner
5. Click "Load unpacked" and select the unzipped folder
6. The extension should now appear in your extensions list

## How to Use

### Basic Usage

1. Navigate to a manga chapter page on weebcentral.com
2. Click the WeebCentral Downloader icon in your browser toolbar
3. Choose one of the download options:
   - **Download Images**: Save all images individually
   - **Download as ZIP**: Package all images into a ZIP file

### Advanced Features

#### Download Settings
- **Download Delay**: Adjust the time between downloads (ms)
- **Concurrent Downloads**: Set how many images to download simultaneously
- Click "Save Settings" to apply changes

#### Manga Series Download
1. Navigate to a manga series page on weebcentral.com
2. Click the WeebCentral Downloader icon
3. Click "Fetch All Chapters" Or enter a chapter range in the format "1-10,20-25"
4. Select the chapters you want to download
5. Click "Download Selected"

## Troubleshooting

### Common Issues

- **No Images Found**: Try refreshing the page and ensuring all images are loaded
- **Download Fails**: The site may block rapid downloads; try increasing the download delay
- **Chapter List Not Loading**: Make sure you're on a manga series page, not a chapter page

### Reporting Bugs

If you encounter any issues, please [open an issue](https://github.com/yourusername/weebcentral-downloader/issues) with:
- A description of the problem
- The URL where the issue occurred
- Any error messages from the console (press F12 to open developer tools)

## Privacy

This extension:
- Does NOT collect any personal data
- Does NOT track your browsing history
- Only requests permissions necessary for downloading manga
- All processing happens locally on your device

## Development

### Project Structure
```
weebcentral-downloader/
├── manifest.json        # Extension configuration
├── popup.html           # Extension popup UI
├── popup.js             # Popup functionality
├── content.js           # Content script for manga pages
├── background.js        # Background service worker
├── manga-scraper.js     # Manga scraping functionality
├── jszip.min.js         # ZIP file creation library
└── icons/               # Extension icons
```

### Building from Source
1. Clone the repository
2. Make your changes
3. Load the unpacked extension in Chrome or Edge for testing

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [JSZip](https://stuk.github.io/jszip/) for ZIP file creation
- The open-source community for inspiration and resources

---

*Note: This extension is not affiliated with or endorsed by weebcentral.com. It is a tool created by fans, for fans.*
