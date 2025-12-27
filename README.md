# MTG Card Identifier

A browser-based image recognition tool for identifying Magic: The Gathering cards from screenshots. This tool runs entirely in the browser without requiring any server, Docker, or additional dependencies.

🌐 **Live Demo**: [https://mtg-identity.netlify.app/](https://mtg-identity.netlify.app/)  
📦 **Repository**: [https://github.com/AdrianHL/mtg-identify](https://github.com/AdrianHL/mtg-identify)

## Features

- 📸 Upload multiple card images at once
- 📋 **Card Inventory Management** - Upload your collection (CSV) to automatically categorize cards
- 📝 **Wantlist Management** - Upload multiple wantlist CSV files with drag-and-drop support
- 🔍 Automatic card identification using OCR and image analysis
- 🎯 **Fuzzy matching** against known card names to correct OCR errors
- 📊 Categorizes results into five categories: **In Wantlist** (in wantlist only), **In Wantlist & Inventory** (in both - should be removed from wantlist), **Wanted** (not in wantlist/inventory), **Owned** (in inventory only), and **Unidentified**
- 💾 Download in-wantlist, in-both, wanted, owned, and unidentified images separately
- 🎨 Visual indicators: Yellow/orange warning for cards in both inventory and wantlist, green success for cards only in wantlist
- 🎨 Modern, user-friendly interface
- 🌐 Runs entirely in the browser - no backend required
- 💾 **LocalStorage persistence** - Your inventory and training data are saved locally

## How It Works

The tool uses:
1. **OCR (Optical Character Recognition)** - Extracts text from card images using Tesseract.js
2. **Fuzzy Matching** - Corrects OCR errors by matching against a database of known card names
3. **Image Feature Analysis** - Analyzes card characteristics (aspect ratio, colors, edges)
4. **Card Validation** - Verifies that images match MTG card characteristics

## Usage

1. **Open the application**: Simply open `index.html` in a modern web browser
2. **Upload your inventory (optional but recommended)**: 
   - Click "Upload Inventory (CSV)" to upload your card collection
   - CSV format: `quantity, card name` (first column is quantity, second is card name)
   - Example: `2,Lightning Bolt` or `1,Annie Joins Up`
   - Your inventory is saved to localStorage and persists across sessions
3. **Upload your wantlists (optional)**: 
   - Drag and drop or click to select multiple CSV files
   - Same CSV format: `quantity, card name`
   - Each file represents a separate wantlist
   - View summary modal after upload showing all wantlists and card counts
   - Wantlists are saved to localStorage and persist across sessions
4. **Upload images**: Click the upload area or drag and drop card images
5. **Process**: Click "Process Images" to analyze the uploaded cards
6. **View results**: 
   - **In Wantlist** - Cards identified and in your wantlist(s) but NOT in inventory (green highlight ✓ - still needed)
   - **In Wantlist & Inventory** - Cards in both your wantlist(s) and inventory (yellow/orange highlight ⚠ - should be removed from wantlist)
   - **Wanted (Not in Wantlist)** - Cards identified but not in any wantlist or inventory
   - **Owned** - Cards identified and in your inventory but NOT in any wantlist
   - **Unidentified** - Cards that couldn't be identified
   - View card names, confidence scores, and which wantlists contain each card
   - Click "Show OCR text" to see what was extracted
7. **Download**: Download in-wantlist, in-both, wanted, owned, or unidentified images separately

## Improving Accuracy with Card Name Database

The system includes a fuzzy matching system that can correct OCR errors by matching against known card names. To improve accuracy:

### Option 1: Add Cards to the Database

Edit `card-name-matcher.js` and add card names to the `cardNames` array:

```javascript
this.cardNames = [
    'Scourge of the Throne',
    'Evercoat Ursine',
    // Add your cards here
];
```

### Option 2: Load from JSON File

Create a `card-names.json` file with all MTG card names:

```json
[
    "Scourge of the Throne",
    "Evercoat Ursine",
    "Lightning Bolt",
    ...
]
```

Then load it:

```javascript
await matcher.loadFromJSON('card-names.json');
```

### Option 3: Use Scryfall API (Advanced)

You can integrate with Scryfall API to get all card names dynamically. See `card-name-matcher.js` for the structure.

## Browser Compatibility

- Chrome/Edge (recommended)
- Firefox
- Safari
- Any modern browser with JavaScript enabled

## Technical Details

### Files Structure

- `index.html` - Main HTML structure
- `styles.css` - Styling and layout (all CSS classes, no inline styles)
- `app.js` - Application logic and UI handling
- `card-recognition.js` - Card recognition engine
- `card-name-matcher.js` - Fuzzy matching system for correcting OCR errors
- `border-detector.js` - Black border detection for card content extraction
- `training-helper.js` - Training system helper functions
- `mtg-card-icon.svg` - MTG card back icon (classic design)
- `training-data.json` - Training examples for improving accuracy (optional)

### Dependencies (loaded via CDN)

- **Tesseract.js** - Browser-based OCR for text extraction
- **JSZip** - For downloading multiple images as a zip file

### Recognition Process

1. Image validation - Checks if image matches MTG card characteristics
2. OCR extraction - Attempts to read card name from image (top-left area)
3. Fuzzy matching - Matches OCR text against known card names to correct errors
4. Result categorization - Separates cards into five categories:
   - **In Wantlist**: Identified and in wantlist but NOT in inventory (green ✓ - still needed)
   - **In Wantlist & Inventory**: Identified and in BOTH wantlist and inventory (yellow/orange ⚠ - should be removed from wantlist)
   - **Wanted**: Identified but not in wantlist or inventory
   - **Owned**: Identified and in inventory but NOT in wantlist
   - **Unidentified**: Could not be identified

## Limitations

- OCR accuracy depends on image quality and text clarity
- Card names must be visible and readable in the image
- Works best with clear, well-lit card images
- May not identify cards with obscured or stylized text
- Fuzzy matching requires cards to be in the database for best results

## Inventory and Wantlist Management

The tool supports uploading both your card collection (inventory) and wantlists as CSV files:

### Inventory
- **CSV Format**: `quantity, card name`
  - First column: Quantity (ignored, but required)
  - Second column: Card name (used for matching)
  - Example: `2,Lightning Bolt` or `1,Annie Joins Up`
- **Header Row**: Automatically detected and skipped (supports "Qty", "Quantity", "Count")
- **Storage**: Saved to localStorage and persists across sessions
- **Unique Cards**: The system counts unique card names (duplicates are automatically handled)

### Wantlists
- **Multiple Files**: Upload multiple CSV files, each representing a separate wantlist
- **Same CSV Format**: `quantity, card name` (same as inventory)
- **Drag and Drop**: Supports drag-and-drop for multiple files at once
- **File Tracking**: Tracks which wantlist files contain each card
- **Summary Modal**: Shows a summary table after upload with file names and card counts
- **Storage**: Saved to localStorage and persists across sessions
- **Clear Function**: Button to clear all wantlists

### Categorization Logic

When you process images, identified cards are automatically sorted into:
- **In Wantlist**: Cards in your wantlist(s) but NOT in inventory
  - **Green highlighting** (✓): Indicates you still need these cards
  - Shows which wantlist files contain each card
- **In Wantlist & Inventory**: Cards in BOTH your wantlist(s) and inventory
  - **Yellow/Orange highlighting** (⚠): Warning that these should be removed from your wantlist since you already own them
  - Shows which wantlist files contain each card
  - Separate category makes it easy to identify cards that need cleanup
- **Wanted (Not in Wantlist)**: Cards not in any wantlist or inventory
- **Owned**: Cards in your inventory but NOT in any wantlist
- **Unidentified**: Cards that couldn't be identified

**Note**: Cards in both inventory and wantlist are placed in their own separate category ("In Wantlist & Inventory") with yellow/orange warning styling to make it easy to identify and remove them from your wantlists.

## Future Enhancements

Potential improvements:
- Integration with Scryfall API for comprehensive card database (already partially implemented)
- Machine learning model for visual card recognition
- Support for multiple card formats and languages
- Batch processing optimizations
- Card metadata display (set, rarity, etc.)
- Export inventory to CSV

## Training/Improving the System

The system can learn from examples you provide to improve accuracy! Here's how:

### Using Training Data

1. **Create training examples**: Edit `training-data.json` and add your test cases:
   ```json
   {
     "trainingExamples": [
       {
         "imageName": "card1.jpg",
         "ocrText": "Ll Scourge of the Throne Dee",
         "expectedCardName": "Scourge of the Throne",
         "notes": "Has leading 'Ll' and trailing 'Dee' artifacts"
       },
       {
         "imageName": "card2.jpg",
         "ocrText": "i Ce | olla % T A ba",
         "expectedCardName": "Evercoat Ursine",
         "notes": "Heavily corrupted OCR text"
       }
     ]
   }
   ```

2. **How it works**:
   - The system automatically loads training examples on startup
   - It learns common patterns (leading/trailing artifacts, character substitutions)
   - It adds expected card names to the database if missing
   - It uses learned patterns to clean OCR text before matching

3. **Iterative improvement**:
   - Process your images and note which ones fail
   - Add the OCR text and expected card name to `training-data.json`
   - Reload the page - the system will learn from the new examples
   - Repeat until accuracy improves

### Other Ways to Improve

1. **Adding more card names** to the database (see above)
2. **Loading a comprehensive card list** from a JSON file
3. **Using Scryfall API** to get all card names dynamically (already integrated)

## License

This project is open source and available for personal and commercial use.
