# Training Guide

This guide explains how to improve the card recognition accuracy by providing training examples.

## Quick Start

1. **Process your images** and note which cards are incorrectly identified
2. **Check the OCR text** - Click "Show OCR details" on each card to see what text was extracted
3. **Add to training data** - Edit `training-data.json` with the OCR text and expected card name
4. **Reload and test** - The system will learn from your examples

## Training Data Format

Edit `training-data.json`:

```json
{
  "trainingExamples": [
    {
      "imageName": "example1.jpg",
      "ocrText": "Ll Scourge of the Throne Dee",
      "expectedCardName": "Scourge of the Throne",
      "notes": "Has leading 'Ll' and trailing 'Dee' artifacts"
    },
    {
      "imageName": "example2.jpg",
      "ocrText": "i Ce | olla % T A ba",
      "expectedCardName": "Evercoat Ursine",
      "notes": "Heavily corrupted OCR text"
    }
  ]
}
```

### Fields

- **imageName**: The filename of your test image (for reference only)
- **ocrText**: The exact text extracted by OCR (check "Show OCR details" in the UI)
- **expectedCardName**: The correct card name that should be matched
- **notes**: Optional description of the issue

## How Training Works

The system learns from your examples by:

1. **Pattern Learning**: Identifies common leading/trailing artifacts (e.g., "Ll", "Dee")
2. **Database Addition**: Adds expected card names to the matching database
3. **Text Cleaning**: Uses learned patterns to clean OCR text before matching
4. **Matching Improvement**: Better handles similar OCR errors in future

## Example Workflow

1. Upload 5 card images
2. Process them
3. Find that "Scourge of the Throne" shows OCR text: "Ll Scourge of the Throne Dee"
4. Add to `training-data.json`:
   ```json
   {
     "imageName": "scourge.jpg",
     "ocrText": "Ll Scourge of the Throne Dee",
     "expectedCardName": "Scourge of the Throne"
   }
   ```
5. Reload the page
6. Process the same images again - it should now correctly identify "Scourge of the Throne"

## Tips

- **Copy OCR text exactly** - Include all artifacts, spaces, and special characters
- **Include multiple examples** - More examples = better pattern learning
- **Test iteratively** - Add a few examples, test, add more, test again
- **Check console logs** - Open browser console to see matching details

## Testing Accuracy

After adding training examples, you can test the system:

1. Open browser console (F12)
2. The system will log learned patterns
3. Process your images and check if accuracy improved
4. Review console logs to see matching scores and decisions

## Advanced: Manual Pattern Learning

If you notice consistent OCR errors, you can help the system by:

1. Identifying common patterns (e.g., "|" often appears, "I" and "l" are confused)
2. Adding more examples with those patterns
3. The system will automatically learn to handle them

