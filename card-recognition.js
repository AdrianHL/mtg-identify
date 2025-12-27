/**
 * MTG Card Recognition Engine
 * Processes images to identify Magic: The Gathering cards
 */

class MTGCardRecognizer {
    constructor() {
        this.model = null;
        this.cardDatabase = new Map();
        this.initialized = false;
        this.nameMatcher = null; // Will be initialized with CardNameMatcher
        this.borderDetector = null; // Will be initialized with BlackBorderDetector
    }

    /**
     * Initialize the recognizer
     */
    async initialize() {
        if (this.initialized) return;
        
        // Load card database (in a real implementation, this would be a comprehensive database)
        await this.loadCardDatabase();
        
        // Initialize card name matcher for fuzzy matching (uses Scryfall API)
        if (typeof CardNameMatcher !== 'undefined') {
            this.nameMatcher = new CardNameMatcher();
            console.log('Initializing card name matcher with Scryfall API...');
            await this.nameMatcher.initialize();
            console.log(`Card name matcher initialized with ${this.nameMatcher.cardNames.length} cards`);
        }
        
        // Initialize black border detector
        if (typeof BlackBorderDetector !== 'undefined') {
            this.borderDetector = new BlackBorderDetector();
            console.log('Black border detector initialized');
        }
        
        this.initialized = true;
    }

    /**
     * Load a basic card database
     * In production, this would be a comprehensive database of MTG cards
     */
    async loadCardDatabase() {
        // This is a placeholder structure
        // In a real implementation, you would load a comprehensive database
        // For now, we'll use image feature matching
        console.log('Card database initialized');
    }

    /**
     * Process an image to identify MTG cards
     * @param {HTMLImageElement|ImageData} image - The image to process
     * @returns {Promise<Object>} Recognition result with card name and confidence
     */
    async recognizeCard(image) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            // Extract image features
            const features = await this.extractFeatures(image);
            
            // Attempt to identify the card
            const result = await this.matchCard(features, image);
            
            return result;
        } catch (error) {
            console.error('Error recognizing card:', error);
            return {
                identified: false,
                cardName: null,
                confidence: 0,
                error: error.message
            };
        }
    }

    /**
     * Extract features from an image
     * @param {HTMLImageElement|ImageData} image - The image to extract features from
     * @returns {Promise<Object>} Extracted features
     */
    async extractFeatures(image) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        let imgElement;
        if (image instanceof ImageData) {
            canvas.width = image.width;
            canvas.height = image.height;
            ctx.putImageData(image, 0, 0);
            imgElement = { width: image.width, height: image.height };
        } else {
            canvas.width = image.width;
            canvas.height = image.height;
            ctx.drawImage(image, 0, 0);
            imgElement = image;
        }

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Calculate basic features
        const features = {
            width: canvas.width,
            height: canvas.height,
            aspectRatio: canvas.width / canvas.height,
            averageColor: this.calculateAverageColor(data),
            colorHistogram: this.calculateColorHistogram(data),
            edgeDensity: this.calculateEdgeDensity(imageData),
            dominantColors: this.getDominantColors(data)
        };

        return features;
    }

    /**
     * Calculate average color of the image
     */
    calculateAverageColor(data) {
        let r = 0, g = 0, b = 0;
        const pixelCount = data.length / 4;

        for (let i = 0; i < data.length; i += 4) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
        }

        return {
            r: Math.round(r / pixelCount),
            g: Math.round(g / pixelCount),
            b: Math.round(b / pixelCount)
        };
    }

    /**
     * Calculate color histogram
     */
    calculateColorHistogram(data) {
        const histogram = {
            r: new Array(256).fill(0),
            g: new Array(256).fill(0),
            b: new Array(256).fill(0)
        };

        for (let i = 0; i < data.length; i += 4) {
            histogram.r[data[i]]++;
            histogram.g[data[i + 1]]++;
            histogram.b[data[i + 2]]++;
        }

        return histogram;
    }

    /**
     * Calculate edge density using Sobel operator
     */
    calculateEdgeDensity(imageData) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        let edgeCount = 0;

        // Simple edge detection
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = (y * width + x) * 4;
                const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
                
                const rightIdx = (y * width + (x + 1)) * 4;
                const rightGray = (data[rightIdx] + data[rightIdx + 1] + data[rightIdx + 2]) / 3;
                
                const bottomIdx = ((y + 1) * width + x) * 4;
                const bottomGray = (data[bottomIdx] + data[bottomIdx + 1] + data[bottomIdx + 2]) / 3;
                
                const edge = Math.abs(gray - rightGray) + Math.abs(gray - bottomGray);
                if (edge > 30) edgeCount++;
            }
        }

        return edgeCount / (width * height);
    }

    /**
     * Get dominant colors using k-means-like approach
     */
    getDominantColors(data, k = 5) {
        // Simplified dominant color extraction
        const colorMap = new Map();
        
        // Sample pixels
        for (let i = 0; i < data.length; i += 16) {
            const r = Math.floor(data[i] / 32) * 32;
            const g = Math.floor(data[i + 1] / 32) * 32;
            const b = Math.floor(data[i + 2] / 32) * 32;
            const key = `${r},${g},${b}`;
            colorMap.set(key, (colorMap.get(key) || 0) + 1);
        }

        // Get top k colors
        const sorted = Array.from(colorMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, k)
            .map(([color]) => color.split(',').map(Number));

        return sorted;
    }

    /**
     * Match extracted features against card database
     * @param {Object} features - Extracted image features
     * @param {HTMLImageElement} image - Original image
     * @returns {Promise<Object>} Match result
     */
    async matchCard(features, image) {
        // Check if image looks like an MTG card based on features
        const isMTGCard = this.validateMTGCardFeatures(features);
        
        if (!isMTGCard) {
            return {
                identified: false,
                cardName: null,
                confidence: 0,
                reason: 'Image does not match MTG card characteristics'
            };
        }

        // In a real implementation, this would match against a comprehensive database
        // For now, we'll use a heuristic approach
        
        // Try to extract text using OCR
        const textResult = await this.extractTextFromImage(image);
        
        // Only mark as identified if we have a match in the database
        // First, try fuzzy matching against known card names
        let databaseMatch = null;
        if (this.nameMatcher && textResult) {
            // Try matching the extracted card name
            if (textResult.cardName && textResult.cardName.length > 1) {
                databaseMatch = this.nameMatcher.findBestMatch(textResult.cardName);
            }
            
            // If no match on extracted name, try matching raw OCR text
            if (!databaseMatch && textResult.rawText && textResult.rawText.trim().length > 3) {
                databaseMatch = this.nameMatcher.findBestMatch(textResult.rawText);
            }
        }
        
        // Only mark as identified if we found a match in the database
        // Use strict threshold: require 98% confidence to mark as identified
        if (databaseMatch && databaseMatch.confidence >= 0.98) {
            return {
                identified: true,
                cardName: databaseMatch.cardName,
                confidence: databaseMatch.confidence,
                method: databaseMatch.method || 'database_match',
                rawText: textResult.rawText,
                allLines: textResult.allLines,
                originalOCR: textResult.cardName,
                ocrPreviewImage: textResult.ocrPreviewImage, // Include OCR preview
                ocrArea: textResult.ocrArea
            };
        }
        
        // If no database match, mark as unidentified (even if OCR found text)
        // This ensures only cards in the database are marked as identified
        return {
            identified: false,
            cardName: textResult?.cardName || null, // Keep OCR result for display, but mark as unidentified
            confidence: textResult?.confidence || 0,
            method: 'no_database_match',
            rawText: textResult?.rawText,
            allLines: textResult?.allLines,
            ocrPreviewImage: textResult?.ocrPreviewImage, // Include OCR preview
            ocrArea: textResult?.ocrArea,
            reason: textResult && textResult.cardName ? 
                'Card name not found in database' : 
                'Could not extract card name',
            originalImage: image // Keep reference for second pass
        };
    }


    /**
     * Retry identification with black border detection (for unidentified cards)
     */
    async retryWithBlackBorder(image) {
        console.log(`[Black Border Retry] Starting for image ${image.width}x${image.height}`);
        
        // Try to detect black border and crop to card area
        let cardArea = null;
        if (this.borderDetector) {
            cardArea = this.borderDetector.detectBlackBorder(image);
        }
        let usedFallback = false;
        
        // If border detection fails, try a fallback: crop center 80% (assuming border is ~10% on each side)
        if (!cardArea) {
            console.log(`[Black Border Retry] Border detection failed, using fallback crop`);
            const marginX = Math.floor(image.width * 0.1);
            const marginY = Math.floor(image.height * 0.1);
            cardArea = {
                x: marginX,
                y: marginY,
                width: image.width - (marginX * 2),
                height: image.height - (marginY * 2)
            };
            usedFallback = true;
        }
        
        console.log(`[Black Border Retry] Using crop area: x=${cardArea.x}, y=${cardArea.y}, w=${cardArea.width}, h=${cardArea.height}`);
        
        // Create a cropped image of just the card area
        const croppedCanvas = document.createElement('canvas');
        const croppedCtx = croppedCanvas.getContext('2d');
        croppedCanvas.width = cardArea.width;
        croppedCanvas.height = cardArea.height;
        
        croppedCtx.drawImage(
            image,
            cardArea.x, cardArea.y, cardArea.width, cardArea.height, // Source: card area
            0, 0, cardArea.width, cardArea.height // Destination
        );
        
        // Save preview of the full cropped card area (before OCR)
        const fullCropPreview = croppedCanvas.toDataURL('image/png');
        
        // Create an image element from the cropped canvas
        const croppedImage = new Image();
        croppedImage.src = croppedCanvas.toDataURL();
        
        // Wait for image to load
        await new Promise((resolve) => {
            croppedImage.onload = resolve;
        });
        
        console.log(`[Black Border Retry] Extracting text from cropped image`);
        
        // Now extract text from the cropped card image
        const textResult = await this.extractTextFromImage(croppedImage);
        
        console.log(`[Black Border Retry] OCR result:`, {
            cardName: textResult?.cardName,
            rawText: textResult?.rawText?.substring(0, 100),
            confidence: textResult?.confidence
        });
        
        // Try matching against database
        let databaseMatch = null;
        if (this.nameMatcher && textResult) {
            // Try matching the extracted card name
            if (textResult.cardName && textResult.cardName.length > 1) {
                console.log(`[Black Border Retry] Trying to match extracted name: "${textResult.cardName}"`);
                databaseMatch = this.nameMatcher.findBestMatch(textResult.cardName);
                if (databaseMatch) {
                    console.log(`[Black Border Retry] Match found via cardName: "${databaseMatch.cardName}" (confidence: ${databaseMatch.confidence})`);
                }
            }
            
            // If no match on extracted name, try matching raw OCR text
            if (!databaseMatch && textResult.rawText && textResult.rawText.trim().length > 3) {
                console.log(`[Black Border Retry] Trying to match raw OCR text: "${textResult.rawText.substring(0, 50)}"`);
                databaseMatch = this.nameMatcher.findBestMatch(textResult.rawText);
                if (databaseMatch) {
                    console.log(`[Black Border Retry] Match found via rawText: "${databaseMatch.cardName}" (confidence: ${databaseMatch.confidence})`);
                }
            }
        }
        
        // For second pass, use lower confidence threshold (0.85 instead of 0.98)
        // Since we're already in unidentified territory, be more lenient
        const secondPassThreshold = 0.85;
        
        // Return result with black border detection info
        // Use the full cropped card preview instead of just the OCR area preview
        if (databaseMatch && databaseMatch.confidence >= secondPassThreshold) {
            console.log(`[Black Border Retry] ✓ SUCCESS - Identified: "${databaseMatch.cardName}"`);
            return {
                identified: true,
                cardName: databaseMatch.cardName,
                confidence: databaseMatch.confidence,
                method: databaseMatch.method || (usedFallback ? 'fallback_crop_retry' : 'black_border_retry'),
                rawText: textResult.rawText,
                allLines: textResult.allLines,
                originalOCR: textResult.cardName,
                ocrPreviewImage: fullCropPreview, // Show the full cropped card area, not just OCR area
                ocrArea: {
                    ...textResult.ocrArea,
                    fullCrop: cardArea, // Include full crop info
                    isBlackBorderRetry: true
                },
                blackBorderDetected: !usedFallback,
                cardArea: cardArea,
                usedFallback: usedFallback
            };
        }
        
        console.log(`[Black Border Retry] ✗ No match found (threshold: ${secondPassThreshold}, match confidence: ${databaseMatch?.confidence || 0})`);
        
        // Even if no match, return the OCR result with black border info
        return {
            identified: false,
            cardName: textResult?.cardName || null,
            confidence: textResult?.confidence || 0,
            method: usedFallback ? 'fallback_crop_retry_no_match' : 'black_border_retry_no_match',
            rawText: textResult?.rawText,
            allLines: textResult?.allLines,
            ocrPreviewImage: fullCropPreview, // Show the full cropped card area, not just OCR area
            ocrArea: {
                ...textResult?.ocrArea,
                fullCrop: cardArea, // Include full crop info
                isBlackBorderRetry: true
            },
            blackBorderDetected: !usedFallback,
            cardArea: cardArea,
            usedFallback: usedFallback,
            reason: databaseMatch ? 
                `Match found but confidence ${databaseMatch.confidence.toFixed(2)} < ${secondPassThreshold}` :
                'No match found in database'
        };
    }

    /**
     * Validate if features match MTG card characteristics
     */
    validateMTGCardFeatures(features) {
        // MTG cards typically have:
        // - Aspect ratio around 2.5:3.5 (or similar, but screenshots may vary)
        // - Rich colors and textures
        // - Text areas
        
        const aspectRatio = features.aspectRatio;
        // More lenient: accept wider range of aspect ratios (screenshots can vary)
        const validAspectRatio = aspectRatio > 0.4 && aspectRatio < 1.2;
        
        // More lenient: just check if it's not a single color image
        const hasRichColors = features.dominantColors.length >= 2;
        // More lenient: just check if there are some edges (not a blank image)
        const hasEdges = features.edgeDensity > 0.005;
        
        // Accept if at least 2 out of 3 conditions are met, or if aspect ratio is reasonable
        const conditionsMet = (validAspectRatio ? 1 : 0) + (hasRichColors ? 1 : 0) + (hasEdges ? 1 : 0);
        return conditionsMet >= 2 || validAspectRatio;
    }

    /**
     * Extract text from image using OCR - focuses on card name area (top portion)
     */
    async extractTextFromImage(image) {
        try {
            // Use Tesseract.js for OCR if available
            if (typeof Tesseract !== 'undefined') {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Focus on the top-left portion of the card where the name is located
                // MTG card names are on the left side, mana costs are on the right
                // Use top 20-25% height, and left 70-80% width (exclude right side with mana cost)
                const nameAreaHeight = Math.min(image.height * 0.25, image.height * 0.3);
                const nameAreaWidth = image.width * 0.75; // Focus on left 75%, exclude right 25% (mana cost area)
                
                // Scale up if image is too small (better for OCR)
                const scale = image.width < 800 ? Math.max(2, 800 / image.width) : 1;
                canvas.width = nameAreaWidth * scale;
                canvas.height = nameAreaHeight * scale;
                
                // Draw only the top-left portion of the card (name area, excluding mana cost)
                ctx.drawImage(
                    image,
                    0, 0, nameAreaWidth, nameAreaHeight,  // Source: top-left portion
                    0, 0, canvas.width, canvas.height  // Destination
                );
                
                // Save the pre-enhanced image for preview (before enhancement)
                const previewCanvas = document.createElement('canvas');
                const previewCtx = previewCanvas.getContext('2d');
                previewCanvas.width = canvas.width;
                previewCanvas.height = canvas.height;
                previewCtx.drawImage(canvas, 0, 0);
                const ocrPreviewImage = previewCanvas.toDataURL('image/png');
                
                // Use OCR with optimized settings for card names
                const ocrOptions = {
                    logger: m => {
                        // Progress logging disabled
                    }
                };
                
                // Add page segmentation mode if available (treat as single text block)
                if (typeof Tesseract !== 'undefined' && Tesseract.PSM) {
                    ocrOptions.tessedit_pageseg_mode = Tesseract.PSM.SINGLE_BLOCK;
                }
                
                // Try multiple preprocessing approaches and use the best result
                let bestText = null;
                let bestConfidence = 0;
                let bestWords = null;
                let bestLines = null;
                
                // Approach 1: High contrast enhancement
                const canvas1 = document.createElement('canvas');
                const ctx1 = canvas1.getContext('2d');
                canvas1.width = canvas.width;
                canvas1.height = canvas.height;
                ctx1.drawImage(canvas, 0, 0);
                const imageData1 = ctx1.getImageData(0, 0, canvas1.width, canvas1.height);
                this.enhanceImageForOCR(imageData1);
                ctx1.putImageData(imageData1, 0, 0);
                
                try {
                    const result1 = await Tesseract.recognize(canvas1, 'eng', ocrOptions);
                    if (result1.data.confidence > bestConfidence && result1.data.text && result1.data.text.trim().length > 0) {
                        bestText = result1.data.text;
                        bestConfidence = result1.data.confidence;
                        bestWords = result1.data.words;
                        bestLines = result1.data.lines;
                        console.log('Approach 1 (high contrast) result:', bestConfidence, bestText?.substring(0, 50));
                    }
                } catch (e) {
                    console.warn('Approach 1 failed:', e);
                }
                
                // Approach 2: Binary thresholding
                const canvas2 = document.createElement('canvas');
                const ctx2 = canvas2.getContext('2d');
                canvas2.width = canvas.width;
                canvas2.height = canvas.height;
                ctx2.drawImage(canvas, 0, 0);
                const imageData2 = ctx2.getImageData(0, 0, canvas2.width, canvas2.height);
                this.enhanceImageForOCRAlternative(imageData2);
                ctx2.putImageData(imageData2, 0, 0);
                
                try {
                    const result2 = await Tesseract.recognize(canvas2, 'eng', ocrOptions);
                    if (result2.data.confidence > bestConfidence && result2.data.text && result2.data.text.trim().length > 0) {
                        bestText = result2.data.text;
                        bestConfidence = result2.data.confidence;
                        bestWords = result2.data.words;
                        bestLines = result2.data.lines;
                        console.log('Approach 2 (binary threshold) result:', bestConfidence, bestText?.substring(0, 50));
                    }
                } catch (e) {
                    console.warn('Approach 2 failed:', e);
                }
                
                // Approach 3: Sharpening + contrast
                const canvas3 = document.createElement('canvas');
                const ctx3 = canvas3.getContext('2d');
                canvas3.width = canvas.width;
                canvas3.height = canvas.height;
                ctx3.drawImage(canvas, 0, 0);
                const imageData3 = ctx3.getImageData(0, 0, canvas3.width, canvas3.height);
                this.enhanceImageWithSharpening(imageData3);
                ctx3.putImageData(imageData3, 0, 0);
                
                try {
                    const result3 = await Tesseract.recognize(canvas3, 'eng', ocrOptions);
                    if (result3.data.confidence > bestConfidence && result3.data.text && result3.data.text.trim().length > 0) {
                        bestText = result3.data.text;
                        bestConfidence = result3.data.confidence;
                        bestWords = result3.data.words;
                        bestLines = result3.data.lines;
                        console.log('Approach 3 (sharpening) result:', bestConfidence, bestText?.substring(0, 50));
                    }
                } catch (e) {
                    console.warn('Approach 3 failed:', e);
                }
                
                // Use the best result
                const text = bestText || '';
                const confidence = bestConfidence;
                const words = bestWords;
                const ocrLines = bestLines;
                
                console.log('Best OCR Result:', {
                    text: text?.substring(0, 100),
                    confidence: confidence,
                    wordCount: words?.length || 0,
                    areaScanned: `${nameAreaWidth}x${nameAreaHeight} (top-left 75%)`
                });
                
                // Extract card name - focus on the topmost, largest text
                let cardName = null;
                let nameConfidence = 0;
                
                // First, try to extract name from noisy text using pattern matching
                const patternMatch = this.extractNameFromNoisyText(text);
                if (patternMatch && patternMatch.length > 3) {
                    cardName = patternMatch;
                    nameConfidence = Math.min(confidence / 100, 1) * 0.8;
                    console.log('Found card name via pattern matching:', cardName);
                }
                
                // Method 1: Use word data to find the largest/most prominent text (card name)
                if (!cardName && words && words.length > 0) {
                    // Filter out words that are likely mana costs or symbols
                    const filteredWords = words.filter(word => {
                        const text = word.text.trim();
                        // Filter out:
                        // - Pure numbers (mana costs)
                        // - Single symbols
                        // - Very short text that's likely not part of name
                        // - Text that's mostly numbers/symbols
                        if (/^\d+$/.test(text)) return false; // Pure numbers
                        if (text.length <= 1 && /[^a-zA-Z]/.test(text)) return false; // Single symbol
                        if (/^[\d\s\W]+$/.test(text) && !/[a-zA-Z]/.test(text)) return false; // Mostly numbers/symbols
                        return true;
                    });
                    
                    // Group words by y-position to find lines
                    const lineGroups = new Map();
                    filteredWords.forEach(word => {
                        const y = Math.round(word.bbox.y0 / 5) * 5; // Group by y position (tighter grouping)
                        if (!lineGroups.has(y)) {
                            lineGroups.set(y, []);
                        }
                        lineGroups.get(y).push(word);
                    });
                    
                    // Find the top line with the largest average word size
                    // Prefer lines on the left side (card name is left, mana cost is right)
                    let bestLine = null;
                    let bestLineY = Infinity;
                    let bestAvgSize = 0;
                    let bestLeftPosition = Infinity;
                    
                    lineGroups.forEach((lineWords, y) => {
                        // Calculate average size and leftmost position
                        const avgSize = lineWords.reduce((sum, w) => {
                            return sum + ((w.bbox.y1 - w.bbox.y0) * (w.bbox.x1 - w.bbox.x0));
                        }, 0) / lineWords.length;
                        
                        const leftmostX = Math.min(...lineWords.map(w => w.bbox.x0));
                        const rightmostX = Math.max(...lineWords.map(w => w.bbox.x1));
                        const lineWidth = rightmostX - leftmostX;
                        
                        // Prefer lines that are:
                        // 1. Higher up (smaller y)
                        // 2. Have larger text
                        // 3. Are more to the left (card name is left, mana cost is right)
                        // 4. Don't extend too far right (likely includes mana cost)
                        const canvasWidth = canvas.width;
                        const isLeftSide = leftmostX < canvasWidth * 0.6; // Prefer left 60% of area
                        const notTooWide = lineWidth < canvasWidth * 0.7; // Don't span too wide
                        
                        const score = avgSize * (isLeftSide ? 1.5 : 0.8) * (notTooWide ? 1.2 : 0.7);
                        
                        if (score > bestAvgSize || (score > bestAvgSize * 0.8 && y < bestLineY && isLeftSide)) {
                            bestAvgSize = score;
                            bestLineY = y;
                            bestLeftPosition = leftmostX;
                            
                            // Build the line, but filter out words that look like mana costs
                            const nameWords = lineWords
                                .filter(w => {
                                    const txt = w.text.trim();
                                    // Exclude if it's clearly a mana cost (numbers, symbols on right side)
                                    if (/^\d+$/.test(txt)) return false;
                                    if (w.bbox.x0 > canvasWidth * 0.65 && /[\d\W]/.test(txt) && txt.length <= 3) return false;
                                    return true;
                                })
                                .sort((a, b) => a.bbox.x0 - b.bbox.x0) // Sort by x position (left to right)
                                .map(w => w.text.trim())
                                .filter(w => w.length > 0 && /[a-zA-Z]/.test(w)); // Must have letters
                            
                            if (nameWords.length > 0) {
                                bestLine = nameWords.join(' ').trim();
                            }
                        }
                    });
                    
                    if (bestLine && bestLine.length > 1 && bestLine.length < 60) {
                        // Additional cleanup: remove any remaining mana cost patterns
                        cardName = this.cleanCardName(bestLine);
                        if (cardName.length > 1) {
                            nameConfidence = Math.min(confidence / 100, 1) * 0.9;
                        }
                    }
                }
                
                // Method 2: Extract card name from noisy OCR text using pattern matching
                // This handles cases where the name is mixed with other text
                if (!cardName) {
                    const patternMatch = this.extractNameFromNoisyText(text);
                    if (patternMatch && patternMatch.length > 3) {
                        cardName = patternMatch;
                        nameConfidence = Math.min(confidence / 100, 1) * 0.75;
                        console.log('Found card name via pattern matching (Method 2):', cardName);
                    }
                }
                
                // Method 2b: Fallback to text lines (if word sequence didn't work)
                if (!cardName) {
                    const lines = text.split('\n').filter(line => line.trim().length > 0);
                    
                    // Try all lines, not just the first one
                    for (const line of lines) {
                        let trimmed = line.trim();
                        
                        // Skip lines that are clearly not card names
                        if (/^\d+$/.test(trimmed)) continue; // Pure numbers
                        if (trimmed.length < 2) continue; // Too short
                        if (!/[a-zA-Z]/.test(trimmed)) continue; // No letters
                        
                        // Remove mana cost patterns from the end
                        trimmed = this.removeManaCostFromText(trimmed);
                        
                        // Card names are typically 2-60 characters
                        if (trimmed.length > 1 && trimmed.length < 60) {
                            cardName = this.cleanCardName(trimmed);
                            if (cardName.length > 1) {
                                nameConfidence = Math.min(confidence / 100, 1) * 0.7;
                                break;
                            }
                        }
                    }
                }
                
                // Method 3: Try extracting from all words if we have word data
                if (!cardName && words && words.length > 0) {
                    // Get all words, filter out mana costs, sort by position
                    const nameWords = words
                        .filter(w => {
                            const txt = w.text.trim();
                            if (/^\d+$/.test(txt)) return false; // Pure numbers
                            if (txt.length <= 1 && /[^a-zA-Z]/.test(txt)) return false; // Single symbol
                            if (w.bbox.x0 > canvas.width * 0.7) return false; // Right side (mana cost area)
                            return true;
                        })
                        .sort((a, b) => {
                            // Sort by y position first (top to bottom), then x (left to right)
                            if (Math.abs(a.bbox.y0 - b.bbox.y0) > 10) {
                                return a.bbox.y0 - b.bbox.y0;
                            }
                            return a.bbox.x0 - b.bbox.x0;
                        })
                        .slice(0, 5) // Take first 5 words max
                        .map(w => w.text.trim())
                        .filter(w => w.length > 0 && /[a-zA-Z]/.test(w));
                    
                    if (nameWords.length > 0) {
                        const candidate = nameWords.join(' ').trim();
                        cardName = this.cleanCardName(candidate);
                        if (cardName.length > 1) {
                            nameConfidence = Math.min(confidence / 100, 1) * 0.6;
                        }
                    }
                }
                
                // Method 4: Try to extract from heavily corrupted OCR text
                // For cases where OCR misreads characters but structure might be preserved
                if (!cardName && text.trim().length > 0) {
                    // Look for word-like sequences even with OCR errors
                    const allText = text.replace(/\n/g, ' ').replace(/\s+/g, ' ');
                    const tokens = allText.split(/\s+/).filter(t => t.trim().length > 0);
                    
                    // Find sequences that might be card names despite OCR errors
                    // Look for 2-4 word sequences with reasonable character patterns
                    let bestCandidate = null;
                    let bestScore = 0;
                    
                    for (let len = 4; len >= 2; len--) {
                        for (let i = 0; i <= tokens.length - len; i++) {
                            const candidate = tokens.slice(i, i + len).join(' ');
                            // Remove obvious non-name characters
                            let cleaned = candidate.replace(/[|%$#@!~^&*()_+=\[\]{};:'"<>?\/\\]/g, '');
                            cleaned = cleaned.replace(/\d+/g, ''); // Remove numbers
                            cleaned = cleaned.replace(/\s+/g, ' ').trim();
                            
                            if (cleaned.length < 5 || cleaned.length > 50) continue;
                            
                            // Score based on:
                            // - Has multiple words (likely a name)
                            // - Contains some letters (not just symbols)
                            // - Reasonable length
                            const wordCount = cleaned.split(/\s+/).length;
                            const letterCount = (cleaned.match(/[a-zA-Z]/g) || []).length;
                            const letterRatio = letterCount / cleaned.length;
                            
                            if (wordCount >= 2 && letterRatio > 0.4 && cleaned.length >= 5) {
                                const score = wordCount * letterRatio * (cleaned.length >= 10 ? 1.2 : 1);
                                if (score > bestScore) {
                                    bestScore = score;
                                    bestCandidate = this.cleanCardName(cleaned);
                                }
                            }
                        }
                    }
                    
                    if (bestCandidate && bestCandidate.length > 3) {
                        cardName = bestCandidate;
                        nameConfidence = Math.min(confidence / 100, 1) * 0.5;
                        console.log('Found card name via corrupted text extraction:', cardName);
                    }
                }
                
                // Method 5: Final fallback - use any reasonable text
                if (!cardName && text.trim().length > 0) {
                    // Try all lines, not just first
                    const allLines = text.split('\n').filter(l => l.trim().length > 0);
                    for (const line of allLines) {
                        let trimmed = line.trim();
                        trimmed = this.removeManaCostFromText(trimmed);
                        trimmed = this.cleanCardName(trimmed);
                        if (trimmed.length > 1 && /[a-zA-Z]/.test(trimmed)) {
                            cardName = trimmed.substring(0, 60); // Limit length
                            nameConfidence = Math.min(confidence / 100, 1) * 0.3;
                            break;
                        }
                    }
                }
                
                // Note: Fuzzy matching is now done in matchCard() to ensure
                // cards are only marked as identified if they match the database
                
                if (cardName && cardName.length > 1) {
                    console.log('Extracted card name:', cardName, 'from text:', text?.substring(0, 50));
                    return {
                        cardName: cardName,
                        confidence: nameConfidence,
                        rawText: text,
                        allLines: text.split('\n').filter(l => l.trim().length > 0),
                        words: words, // Include word data for debugging
                        ocrPreviewImage: ocrPreviewImage, // Preview of area used for OCR
                        ocrArea: { width: nameAreaWidth, height: nameAreaHeight } // Dimensions of OCR area
                    };
                } else {
                    console.log('Could not extract card name from:', text?.substring(0, 100));
                    return {
                        cardName: null,
                        confidence: confidence / 100,
                        rawText: text,
                        words: words,
                        ocrPreviewImage: ocrPreviewImage, // Preview even if no name extracted
                        ocrArea: { width: nameAreaWidth, height: nameAreaHeight }
                    };
                }
                
            } else {
                // Fallback if Tesseract is not loaded
                return {
                    cardName: null,
                    confidence: 0
                };
            }
        } catch (error) {
            console.error('OCR error:', error);
            return {
                cardName: null,
                confidence: 0,
                error: error.message
            };
        }
    }

    /**
     * Enhance image for better OCR results - High contrast approach
     */
    enhanceImageForOCR(imageData) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        
        // First pass: convert to grayscale and calculate statistics
        const grays = [];
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
            grays.push(gray);
        }
        
        // Calculate adaptive threshold (Otsu-like)
        const histogram = new Array(256).fill(0);
        grays.forEach(g => histogram[g]++);
        
        let sum = 0;
        for (let i = 0; i < 256; i++) sum += i * histogram[i];
        
        let sumB = 0;
        let wB = 0;
        let wF = 0;
        let maxVariance = 0;
        let threshold = 128;
        
        const total = width * height;
        for (let i = 0; i < 256; i++) {
            wB += histogram[i];
            if (wB === 0) continue;
            wF = total - wB;
            if (wF === 0) break;
            
            sumB += i * histogram[i];
            const mB = sumB / wB;
            const mF = (sum - sumB) / wF;
            const variance = wB * wF * (mB - mF) * (mB - mF);
            
            if (variance > maxVariance) {
                maxVariance = variance;
                threshold = i;
            }
        }
        
        // Apply adaptive contrast enhancement
        for (let i = 0; i < data.length; i += 4) {
            const gray = grays[i / 4];
            
            // High contrast enhancement with adaptive threshold
            let enhanced;
            if (gray < threshold) {
                // Dark areas - make darker (text)
                enhanced = Math.max(0, gray * 0.3);
            } else {
                // Light areas - make lighter (background)
                enhanced = Math.min(255, 200 + (gray - threshold) * 0.5);
            }
            
            data[i] = enhanced;
            data[i + 1] = enhanced;
            data[i + 2] = enhanced;
        }
    }

    /**
     * Alternative image enhancement method - Binary thresholding
     */
    enhanceImageForOCRAlternative(imageData) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        
        // First pass: convert to grayscale and calculate histogram
        const grays = [];
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
            grays.push(gray);
        }
        
        // Calculate average brightness
        const avgBrightness = grays.reduce((a, b) => a + b, 0) / grays.length;
        
        // Apply adaptive binary thresholding
        for (let i = 0; i < data.length; i += 4) {
            const gray = grays[i / 4];
            
            // Use adaptive threshold based on average brightness
            const threshold = avgBrightness * 0.9; // Slightly lower threshold
            const enhanced = gray > threshold ? 255 : 0; // Binary threshold
            
            data[i] = enhanced;
            data[i + 1] = enhanced;
            data[i + 2] = enhanced;
        }
    }

    /**
     * Enhance image with sharpening filter for better text recognition
     */
    enhanceImageWithSharpening(imageData) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        
        // Convert to grayscale first
        const grays = [];
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
            grays.push(gray);
        }
        
        // Apply sharpening kernel
        const sharpened = new Array(grays.length);
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                
                // Sharpening kernel
                const center = grays[idx] * 5;
                const top = grays[(y - 1) * width + x];
                const bottom = grays[(y + 1) * width + x];
                const left = grays[y * width + (x - 1)];
                const right = grays[y * width + (x + 1)];
                
                const sharp = center - top - bottom - left - right;
                sharpened[idx] = Math.max(0, Math.min(255, sharp));
            }
        }
        
        // Copy edges
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (y === 0 || y === height - 1 || x === 0 || x === width - 1) {
                    sharpened[y * width + x] = grays[y * width + x];
                }
            }
        }
        
        // Apply high contrast
        for (let i = 0; i < data.length; i += 4) {
            const gray = sharpened[i / 4];
            const enhanced = Math.min(255, Math.max(0, (gray - 100) * 2.5 + 100));
            
            data[i] = enhanced;
            data[i + 1] = enhanced;
            data[i + 2] = enhanced;
        }
    }

    /**
     * Remove mana cost patterns from text
     * Mana costs are typically at the end: numbers, symbols, or combinations
     */
    removeManaCostFromText(text) {
        // Remove patterns like: "Card Name 3WW" or "Card Name {3}{W}{W}" or "Card Name 5"
        // Look for numbers/symbols at the end that are likely mana costs
        
        // Pattern 1: Numbers/symbols at the very end
        text = text.replace(/\s+[\d\W]{1,5}$/, ''); // Remove trailing numbers/symbols (1-5 chars)
        
        // Pattern 2: Curly braces with content (mana symbols)
        text = text.replace(/\s*\{[^}]*\}+$/, '');
        
        // Pattern 3: Multiple numbers/symbols separated by spaces
        text = text.replace(/\s+(\d+\s*)+$/, '');
        
        // Pattern 4: Common mana symbols at the end
        text = text.replace(/\s+[WUBRGC\d\s]{1,10}$/, ''); // Remove trailing mana symbols
        
        return text.trim();
    }

    /**
     * Clean and normalize card name
     */
    cleanCardName(name) {
        if (!name) return '';
        
        // Remove mana cost patterns
        name = this.removeManaCostFromText(name);
        
        // Normalize whitespace
        name = name.replace(/\s+/g, ' ');
        
        // Remove special characters except common ones in card names
        // Keep: letters, numbers, spaces, hyphens, apostrophes, periods, commas
        name = name.replace(/[^\w\s\-'.,]/g, '');
        
        // Remove leading/trailing numbers that might be mana costs
        name = name.replace(/^\d+\s+/, '').replace(/\s+\d+$/, '');
        
        // Remove single character words that are likely OCR errors (but keep 'a' and 'I')
        name = name.split(' ').filter(w => {
            if (w.length === 1 && w !== 'a' && w !== 'A' && w !== 'I') return false;
            return true;
        }).join(' ');
        
        // Remove words that are clearly OCR artifacts (single letters mixed with symbols)
        name = name.replace(/\b[a-zA-Z]\s+[a-zA-Z]\b/g, (match) => {
            // Keep if it's a valid two-letter word, otherwise might be OCR error
            const validTwoLetters = ['of', 'to', 'in', 'on', 'at', 'is', 'it', 'an', 'as', 'be', 'we', 'he', 'me', 'my', 'up', 'go', 'do', 'no', 'so', 'or', 'if', 'am', 'ad', 'ah', 'ai', 'aw', 'ax', 'ay', 'by', 'eh', 'em', 'en', 'er', 'ex', 'ha', 'hi', 'ho', 'id', 'im', 'io', 'is', 'it', 'jo', 'ka', 'la', 'li', 'lo', 'ma', 'mi', 'mo', 'mu', 'my', 'na', 'ne', 'no', 'nu', 'od', 'oe', 'oh', 'oi', 'ok', 'om', 'on', 'op', 'or', 'os', 'ow', 'ox', 'oy', 'pa', 'pe', 'pi', 'po', 'qi', 're', 'sh', 'si', 'so', 'ta', 'te', 'ti', 'to', 'uh', 'um', 'un', 'up', 'us', 'ut', 'we', 'wo', 'xi', 'xu', 'ya', 'ye', 'yo', 'za', 'zo'];
            return validTwoLetters.includes(match.toLowerCase()) ? match : '';
        });
        
        return name.trim();
    }

    /**
     * Extract card name from noisy OCR text using pattern matching
     * Looks for sequences that match card name patterns
     */
    extractNameFromNoisyText(text) {
        if (!text) return null;
        
        // Normalize text - replace newlines with spaces
        const normalizedText = text.replace(/\n/g, ' ').replace(/\s+/g, ' ');
        
        // Pattern 1: Look for "X of the Y" or "X of Y" patterns
        // This handles cases like "Scourge of the Throne" even with OCR errors
        const ofPatterns = [
            /\b([A-Z][a-z]*(?:\s+[a-z]+)*)\s+of\s+the\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
            /\b([A-Z][a-z]+(?:\s+[a-z]+)*)\s+of\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
            // More flexible: allow OCR errors in capitalization
            /\b([A-Za-z]+(?:\s+[A-Za-z]+)*)\s+of\s+(?:the\s+)?([A-Za-z]+(?:\s+[A-Za-z]+)*)/i
        ];
        
        for (const pattern of ofPatterns) {
            const match = normalizedText.match(pattern);
            if (match) {
                const fullMatch = match[0].trim();
                // Clean up common OCR errors
                let cleaned = fullMatch
                    .replace(/\s+/g, ' ')
                    .replace(/[^\w\s\s-]/g, '') // Remove special chars except spaces and hyphens
                    .replace(/\b([a-z])\s+([a-z])\b/gi, '$1$2') // Fix split words like "Scou rge" -> "Scourge"
                    .trim();
                
                if (cleaned.length >= 5 && cleaned.length <= 60) {
                    // Capitalize properly
                    cleaned = cleaned.split(' ').map(word => {
                        if (word.toLowerCase() === 'of' || word.toLowerCase() === 'the') {
                            return word.toLowerCase();
                        }
                        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
                    }).join(' ');
                    
                    return this.cleanCardName(cleaned);
                }
            }
        }
        
        // Pattern 2: Look for sequences of words that look like card names
        // Find the longest sequence of words that:
        // - Contains mostly letters
        // - Has reasonable length (5-50 chars)
        // - Doesn't contain obvious OCR artifacts
        
        const words = normalizedText.split(/\s+/).filter(w => w.trim().length > 0);
        let bestSequence = null;
        let bestLength = 0;
        
        // Try sequences of 2-5 words
        for (let len = 5; len >= 2; len--) {
            for (let i = 0; i <= words.length - len; i++) {
                const sequence = words.slice(i, i + len).join(' ');
                const cleaned = this.cleanCardName(sequence);
                
                // Check if it looks like a card name
                const letterCount = (cleaned.match(/[a-zA-Z]/g) || []).length;
                const totalChars = cleaned.length;
                const letterRatio = letterCount / totalChars;
                
                // Must be mostly letters, reasonable length, and not just numbers/symbols
                if (letterRatio > 0.7 && cleaned.length >= 5 && cleaned.length <= 50 && /[a-zA-Z]{3,}/.test(cleaned)) {
                    if (cleaned.length > bestLength) {
                        bestLength = cleaned.length;
                        bestSequence = cleaned;
                    }
                }
            }
        }
        
        if (bestSequence) {
            return bestSequence;
        }
        
        // Pattern 3: Look for capitalized word sequences
        const capitalizedPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})/;
        const capMatch = normalizedText.match(capitalizedPattern);
        if (capMatch) {
            const candidate = this.cleanCardName(capMatch[1]);
            if (candidate.length >= 5 && candidate.length <= 60) {
                return candidate;
            }
        }
        
        return null;
    }

    /**
     * Match card by features
     */
    matchByFeatures(features) {
        // Simplified feature matching
        // In production, this would compare against a database of card features
        
        // For demonstration, we'll return a generic result
        // A real implementation would have a database of card features to match against
        
        return {
            cardName: null,
            confidence: 0.2 // Low confidence for feature-only matching
        };
    }

    /**
     * Process multiple images
     * @param {Array<File>} files - Array of image files
     * @returns {Promise<Array>} Array of recognition results
     */
    async processImages(files) {
        const results = [];
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const result = await this.processImageFile(file);
            results.push({
                file: file,
                ...result
            });
        }
        
        return results;
    }

    /**
     * Process a single image file
     * @param {File} file - Image file to process
     * @returns {Promise<Object>} Recognition result
     */
    async processImageFile(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = async () => {
                try {
                    const result = await this.recognizeCard(img);
                    resolve({
                        ...result,
                        imageElement: img,
                        fileName: file.name
                    });
                } catch (error) {
                    reject(error);
                }
            };
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = URL.createObjectURL(file);
        });
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MTGCardRecognizer;
}

