# MTG Card Identifier

A browser-based image recognition tool for identifying Magic: The Gathering cards from screenshots. This tool runs entirely in the browser without requiring any server, Docker, or additional dependencies.

## Features

- 📸 Upload multiple card images at once
- 📋 **Card Inventory Management** - Upload your collection (CSV) to automatically categorize cards as Wanted or Owned
- 🔍 Automatic card identification using OCR and image analysis
- 🎯 **Fuzzy matching** against known card names to correct OCR errors
- 📊 Categorizes results into three categories: **Wanted** (identified but not owned), **Owned** (identified and in inventory), and **Unidentified**
- 💾 Download wanted, owned, and unidentified images separately
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
3. **Upload images**: Click the upload area or drag and drop card images
4. **Process**: Click "Process Images" to analyze the uploaded cards
5. **View results**: 
   - **Identified and Wanted** - Cards identified but not in your inventory
   - **Identified and Owned** - Cards identified and already in your inventory
   - **Unidentified** - Cards that couldn't be identified
   - View card names and confidence scores
   - Click "Show OCR text" to see what was extracted
6. **Download**: Download wanted, owned, or unidentified images separately

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
- `styles.css` - Styling and layout
- `app.js` - Application logic and UI handling
- `card-recognition.js` - Card recognition engine
- `card-name-matcher.js` - Fuzzy matching system for correcting OCR errors

### Dependencies (loaded via CDN)

- **Tesseract.js** - Browser-based OCR for text extraction
- **JSZip** - For downloading multiple images as a zip file

### Recognition Process

1. Image validation - Checks if image matches MTG card characteristics
2. OCR extraction - Attempts to read card name from image (top-left area)
3. Fuzzy matching - Matches OCR text against known card names to correct errors
4. Result categorization - Separates cards into three categories:
   - **Wanted**: Identified but not in inventory
   - **Owned**: Identified and in inventory
   - **Unidentified**: Could not be identified

## Limitations

- OCR accuracy depends on image quality and text clarity
- Card names must be visible and readable in the image
- Works best with clear, well-lit card images
- May not identify cards with obscured or stylized text
- Fuzzy matching requires cards to be in the database for best results

## Inventory Management

The tool supports uploading your card collection as a CSV file to automatically categorize identified cards:

- **CSV Format**: `quantity, card name`
  - First column: Quantity (ignored, but required)
  - Second column: Card name (used for matching)
  - Example: `2,Lightning Bolt` or `1,Annie Joins Up`
- **Header Row**: Automatically detected and skipped (supports "Qty", "Quantity", "Count")
- **Storage**: Inventory is saved to localStorage and persists across sessions
- **Unique Cards**: The system counts unique card names (duplicates are automatically handled)

When you process images, identified cards are automatically sorted into:
- **Wanted**: Cards you don't own yet
- **Owned**: Cards already in your inventory

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
