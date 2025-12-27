/**
 * Card Name Matcher
 * Uses fuzzy matching to correct OCR errors by matching against known MTG card names
 */

class CardNameMatcher {
    constructor() {
        this.cardNames = [];
        this.initialized = false;
        this.learnedLeadingPatterns = [];
        this.learnedTrailingPatterns = [];
        this.trainingExamples = [];
        this.trainingStats = {
            totalMatches: 0,
            trainingExampleMatches: 0,
            patternCleaningUsed: 0,
            cardsAddedFromTraining: 0
        };
    }
    
    /**
     * Reset training statistics (useful when starting a new batch)
     */
    resetStats() {
        this.trainingStats = {
            totalMatches: 0,
            trainingExampleMatches: 0,
            patternCleaningUsed: 0,
            cardsAddedFromTraining: this.trainingStats.cardsAddedFromTraining // Keep this one
        };
    }

    /**
     * Initialize with card names database
     */
    async initialize() {
        if (this.initialized) return;
        
        // Try to load from Scryfall API or use a local list
        try {
            await this.loadCardNames();
        } catch (error) {
            console.warn('Could not load card names from API, using local list:', error);
            this.loadLocalCardNames();
        }
        
        // Load training examples to learn patterns and add cards
        await this.loadTrainingExamples();
        
        this.initialized = true;
    }

    /**
     * Load card names from Scryfall API (browser-friendly)
     */
    async loadCardNames() {
        // Try to load from cache first (localStorage)
        const cached = this.loadFromCache();
        if (cached && cached.length > 0) {
            console.log(`Loaded ${cached.length} card names from cache`);
            this.cardNames = cached;
            return;
        }

        // Try to load from Scryfall API
        try {
            await this.loadFromScryfallAPI();
        } catch (error) {
            console.warn('Could not load from Scryfall API, using local list:', error);
            this.loadLocalCardNames();
        }
    }

    /**
     * Load card names from Scryfall API
     * Uses Scryfall's bulk data endpoint for efficiency
     */
    async loadFromScryfallAPI() {
        console.log('Fetching card names from Scryfall API...');
        
        try {
            // First, get the bulk data info
            const bulkDataResponse = await fetch('https://api.scryfall.com/bulk-data');
            if (!bulkDataResponse.ok) {
                throw new Error(`Scryfall API error: ${bulkDataResponse.status}`);
            }
            
            const bulkData = await bulkDataResponse.json();
            
            // Find the "oracle_cards" bulk data file (contains all unique card names)
            const oracleCards = bulkData.data.find(item => item.type === 'oracle_cards');
            
            if (!oracleCards) {
                throw new Error('Oracle cards bulk data not found');
            }

            console.log('Downloading bulk card data...');
            // Fetch the bulk data file
            const cardsResponse = await fetch(oracleCards.download_uri);
            if (!cardsResponse.ok) {
                throw new Error(`Failed to download bulk data: ${cardsResponse.status}`);
            }
            
            const cardsData = await cardsResponse.json();
            
            // Extract unique card names
            const uniqueNames = new Set();
            if (Array.isArray(cardsData)) {
                cardsData.forEach(card => {
                    if (card.name) {
                        uniqueNames.add(card.name);
                    }
                });
            } else {
                throw new Error('Unexpected bulk data format');
            }

            this.cardNames = Array.from(uniqueNames).map(name => ({
                original: name,
                normalized: this.normalizeForMatching(name)
            }));

            // Cache the results
            this.saveToCache(this.cardNames);
            
            console.log(`Loaded ${this.cardNames.length} unique card names from Scryfall API`);
        } catch (error) {
            console.error('Error loading from Scryfall bulk API:', error);
            // Fallback: try a simpler approach with search API
            console.log('Trying Scryfall search API as fallback...');
            await this.loadFromScryfallSearch();
        }
    }

    /**
     * Alternative: Load card names using Scryfall search API
     * This is slower but works if bulk data fails
     */
    async loadFromScryfallSearch() {
        console.log('Trying Scryfall search API as fallback...');
        
        try {
            // Use search API to get cards (limited to 175 cards per page)
            // We'll fetch multiple pages to get a good sample
            const allNames = new Set();
            let hasMore = true;
            let page = 1;
            const maxPages = 10; // Limit to avoid too many requests

            while (hasMore && page <= maxPages) {
                const url = `https://api.scryfall.com/cards/search?q=*&page=${page}&order=name`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    throw new Error(`Scryfall API error: ${response.status}`);
                }
                
                const data = await response.json();
                
                if (data.data) {
                    data.data.forEach(card => {
                        if (card.name) {
                            allNames.add(card.name);
                        }
                    });
                }

                hasMore = data.has_more && page < maxPages;
                page++;
                
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            this.cardNames = Array.from(allNames).map(name => ({
                original: name,
                normalized: this.normalizeForMatching(name)
            }));

            // Cache the results
            this.saveToCache(this.cardNames);
            
            console.log(`Loaded ${this.cardNames.length} card names from Scryfall search API`);
        } catch (error) {
            console.error('Error loading from Scryfall search API:', error);
            throw error;
        }
    }

    /**
     * Save card names to browser cache (localStorage)
     */
    saveToCache(cardNames) {
        try {
            const cacheData = {
                names: cardNames,
                timestamp: Date.now(),
                version: '1.0'
            };
            localStorage.setItem('mtg_card_names_cache', JSON.stringify(cacheData));
            console.log('Card names cached to localStorage');
        } catch (error) {
            console.warn('Could not save to cache (localStorage may be full):', error);
        }
    }

    /**
     * Load card names from browser cache (localStorage)
     */
    loadFromCache() {
        try {
            const cached = localStorage.getItem('mtg_card_names_cache');
            if (!cached) return null;

            const cacheData = JSON.parse(cached);
            const cacheAge = Date.now() - cacheData.timestamp;
            const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

            // Use cache if it's less than 7 days old
            if (cacheAge < maxAge && cacheData.names && cacheData.names.length > 0) {
                return cacheData.names;
            } else {
                // Cache expired, remove it
                localStorage.removeItem('mtg_card_names_cache');
                return null;
            }
        } catch (error) {
            console.warn('Error loading from cache:', error);
            return null;
        }
    }

    /**
     * Clear the cache (useful for forcing a refresh)
     */
    clearCache() {
        try {
            localStorage.removeItem('mtg_card_names_cache');
            console.log('Card names cache cleared');
        } catch (error) {
            console.warn('Error clearing cache:', error);
        }
    }

    /**
     * Load training examples and learn from them
     */
    async loadTrainingExamples() {
        let examples = [];
        
        // Try to load from localStorage first (for in-session updates, works in all scenarios)
        try {
            const stored = localStorage.getItem('mtg-training-data');
            if (stored) {
                const data = JSON.parse(stored);
                examples = data.trainingExamples || [];
                console.log(`Loaded ${examples.length} training examples from localStorage`);
            }
        } catch (error) {
            console.warn('Could not load training examples from localStorage:', error);
        }
        
        // Also try to load from file (only if on http/https, not file://)
        const isHttp = window.location.protocol === 'http:' || window.location.protocol === 'https:';
        if (examples.length === 0 && isHttp) {
            try {
                const response = await fetch('training-data.json');
                if (response.ok) {
                    const data = await response.json();
                    examples = data.trainingExamples || [];
                    console.log(`Loaded ${examples.length} training examples from file`);
                    // Save to localStorage for future use
                    localStorage.setItem('mtg-training-data', JSON.stringify(data));
                }
            } catch (error) {
                console.warn('Could not load training examples from file:', error);
            }
        }
        
        // Store training examples for tracking
        this.trainingExamples = examples;
        
        // Add expected card names to database if not already present
        let cardsAdded = 0;
        examples.forEach(example => {
            if (example.expectedCardName && !this.cardNames.find(c => 
                c.original.toLowerCase() === example.expectedCardName.toLowerCase())) {
                this.addCardName(example.expectedCardName);
                cardsAdded++;
                console.log('Added training example card to database:', example.expectedCardName);
            }
        });
        this.trainingStats.cardsAddedFromTraining = cardsAdded;
        
        // Learn patterns from examples
        this.learnFromExamples(examples);
        
        console.log(`Total training examples loaded: ${examples.length} (${cardsAdded} new cards added)`);
    }

    /**
     * Learn patterns from training examples to improve matching
     */
    learnFromExamples(examples) {
        // Extract common patterns
        const leadingPatterns = new Set();
        const trailingPatterns = new Set();
        
        examples.forEach(example => {
            const ocr = example.ocrText.toLowerCase().trim();
            const expected = example.expectedCardName.toLowerCase().trim();
            
            // Find leading patterns
            if (ocr.includes(expected)) {
                const before = ocr.substring(0, ocr.indexOf(expected));
                if (before.length > 0 && before.length < 15) {
                    leadingPatterns.add(before.trim());
                }
            }
            
            // Find trailing patterns
            if (ocr.includes(expected)) {
                const after = ocr.substring(ocr.indexOf(expected) + expected.length);
                if (after.length > 0 && after.length < 15) {
                    trailingPatterns.add(after.trim());
                }
            }
        });
        
        // Store patterns for use in cleaning
        this.learnedLeadingPatterns = Array.from(leadingPatterns);
        this.learnedTrailingPatterns = Array.from(trailingPatterns);
        
        console.log('Learned patterns:', {
            leading: this.learnedLeadingPatterns,
            trailing: this.learnedTrailingPatterns
        });
    }

    /**
     * Load a local list of common card names
     * In production, this could be loaded from a JSON file with all MTG card names
     */
    loadLocalCardNames() {
        // Start with a small set - in production, load from a comprehensive database
        // You can expand this list or load from a JSON file
        this.cardNames = [
            // User-provided examples
            'Scourge of the Throne',
            'Evercoat Ursine',
            'Evercoat ursine', // Also try lowercase variant
            'Retraced Image',
            'Annie Joins Up',
            
            // Common/popular cards
            'Lightning Bolt',
            'Counterspell',
            'Dark Ritual',
            'Sol Ring',
            'Black Lotus',
            'Ancestral Recall',
            'Time Walk',
            'Mox Pearl',
            'Mox Sapphire',
            'Mox Jet',
            'Mox Ruby',
            'Mox Emerald',
            'Force of Will',
            'Brainstorm',
            'Ponder',
            'Preordain',
            'Swords to Plowshares',
            'Path to Exile',
            'Wrath of God',
            'Damnation',
            'Snapcaster Mage',
            'Tarmogoyf',
            'Jace, the Mind Sculptor',
            'Liliana of the Veil',
            'Karn Liberated',
            'Ugin, the Spirit Dragon',
            // Add more cards here, or load from a JSON file
        ];
        
        // Normalize all names for matching
        this.cardNames = this.cardNames.map(name => ({
            original: name,
            normalized: this.normalizeForMatching(name)
        }));
    }

    /**
     * Normalize a string for fuzzy matching
     */
    normalizeForMatching(str) {
        return str
            .toLowerCase()
            .replace(/[^\w\s]/g, '') // Remove special characters
            .replace(/\s+/g, ' ')     // Normalize whitespace
            .trim();
    }

    /**
     * Calculate Levenshtein distance between two strings
     */
    levenshteinDistance(str1, str2) {
        const len1 = str1.length;
        const len2 = str2.length;
        const matrix = [];

        // Initialize matrix
        for (let i = 0; i <= len1; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= len2; j++) {
            matrix[0][j] = j;
        }

        // Fill matrix
        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                if (str1[i - 1] === str2[j - 1]) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j] + 1,     // deletion
                        matrix[i][j - 1] + 1,     // insertion
                        matrix[i - 1][j - 1] + 1  // substitution
                    );
                }
            }
        }

        return matrix[len1][len2];
    }

    /**
     * Calculate similarity score between two strings (0-1, higher is more similar)
     */
    similarity(str1, str2) {
        const maxLen = Math.max(str1.length, str2.length);
        if (maxLen === 0) return 1;
        
        const distance = this.levenshteinDistance(str1, str2);
        return 1 - (distance / maxLen);
    }

    /**
     * Extract potential card name candidates from OCR text
     * Looks for sequences of words that could be card names
     */
    extractCardNameCandidates(ocrText) {
        const candidates = [];
        // Remove numbers, special characters, but keep words
        const words = ocrText.split(/\s+/).filter(w => {
            // Keep words that are at least 2 characters and mostly letters
            return w.length >= 2 && /^[a-zA-Z]+$/.test(w.replace(/[^a-zA-Z]/g, ''));
        });
        
        // Try sequences of 2-5 words (typical card name length)
        for (let len = 2; len <= Math.min(5, words.length); len++) {
            for (let start = 0; start <= words.length - len; start++) {
                const candidate = words.slice(start, start + len).join(' ');
                if (candidate.length >= 3) {
                    candidates.push(candidate);
                }
            }
        }
        
        return candidates;
    }

    /**
     * Find the best matching card name for OCR text
     * @param {string} ocrText - Text extracted from OCR
     * @returns {Object|null} - Best match with score, or null if no good match
     */
    findBestMatch(ocrText) {
        if (!ocrText || ocrText.trim().length < 3) {
            return null;
        }

        // FIRST: Try to find exact card name matches in the OCR text
        // This handles cases like "3 TN ( Annie Joins Up 18x 202.5" where the card name is embedded
        const normalizedOCR = this.normalizeForMatching(ocrText);
        let bestMatch = null;
        let bestScore = 0;
        
        console.log('Fuzzy matching OCR text:', ocrText, '-> normalized:', normalizedOCR);
        
        // PRIORITY 1: Check if any card name appears as an exact substring in the OCR text
        // This is the highest priority - if "Annie Joins Up" appears in OCR, it should match
        for (const card of this.cardNames) {
            const cardNormalized = card.normalized;
            
            // Check if card name appears in OCR text (case-insensitive)
            if (normalizedOCR.includes(cardNormalized)) {
                // Calculate how much of the OCR text is the card name
                const cardLength = cardNormalized.length;
                const ocrLength = normalizedOCR.length;
                const coverage = cardLength / ocrLength;
                
                // High score for exact substring match
                const score = 0.95 + (coverage * 0.05); // 0.95-1.0 range
                
                console.log(`EXACT SUBSTRING MATCH: "${card.original}" found in OCR (score: ${score.toFixed(3)})`);
                
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = card.original;
                }
            }
        }
        
        // If we found an exact match, return it immediately (don't do fuzzy matching)
        if (bestMatch && bestScore > 0.9) {
            // Check if this match came from a training example
            const fromTraining = this.trainingExamples.some(ex => 
                ex.expectedCardName.toLowerCase() === bestMatch.toLowerCase()
            );
            if (fromTraining) {
                this.trainingStats.trainingExampleMatches++;
                console.log(`[Training] Match found from training example: "${bestMatch}"`);
            }
            this.trainingStats.totalMatches++;
            
            return {
                cardName: bestMatch,
                confidence: bestScore,
                method: 'exact_substring',
                fromTraining: fromTraining
            };
        }
        
        // PRIORITY 2: Extract card name candidates and match them
        const candidates = this.extractCardNameCandidates(ocrText);
        for (const candidate of candidates) {
            const normalizedCandidate = this.normalizeForMatching(candidate);
            
            for (const card of this.cardNames) {
                // Exact match of candidate
                if (normalizedCandidate === card.normalized) {
                    const score = 0.9;
                    console.log(`EXACT CANDIDATE MATCH: "${card.original}" matches candidate "${candidate}" (score: ${score.toFixed(3)})`);
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = card.original;
                    }
                }
                // Check if candidate contains card name or vice versa
                else if (normalizedCandidate.includes(card.normalized) || card.normalized.includes(normalizedCandidate)) {
                    const score = Math.min(normalizedCandidate.length, card.normalized.length) / 
                                 Math.max(normalizedCandidate.length, card.normalized.length) * 0.85;
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = card.original;
                    }
                }
            }
        }
        
        // If we found a good candidate match, return it
        if (bestMatch && bestScore > 0.8) {
            const fromTraining = this.trainingExamples.some(ex => 
                ex.expectedCardName.toLowerCase() === bestMatch.toLowerCase()
            );
            if (fromTraining) {
                this.trainingStats.trainingExampleMatches++;
                console.log(`[Training] Candidate match from training example: "${bestMatch}"`);
            }
            this.trainingStats.totalMatches++;
            
            return {
                cardName: bestMatch,
                confidence: bestScore,
                method: 'candidate_match',
                fromTraining: fromTraining
            };
        }

        // PRIORITY 3: Try to clean OCR text and match word sequences
        // Try to clean OCR text first - remove common leading/trailing artifacts
        let cleanedOCR = ocrText.trim();
        let patternUsed = false;
        
        // Remove learned leading patterns
        if (this.learnedLeadingPatterns && this.learnedLeadingPatterns.length > 0) {
            for (const pattern of this.learnedLeadingPatterns) {
                if (cleanedOCR.toLowerCase().startsWith(pattern.toLowerCase())) {
                    cleanedOCR = cleanedOCR.substring(pattern.length).trim();
                    patternUsed = true;
                    console.log(`[Training] Removed leading pattern: "${pattern}"`);
                }
            }
        }
        
        // Remove learned trailing patterns
        if (this.learnedTrailingPatterns && this.learnedTrailingPatterns.length > 0) {
            for (const pattern of this.learnedTrailingPatterns) {
                if (cleanedOCR.toLowerCase().endsWith(pattern.toLowerCase())) {
                    cleanedOCR = cleanedOCR.substring(0, cleanedOCR.length - pattern.length).trim();
                    patternUsed = true;
                    console.log(`[Training] Removed trailing pattern: "${pattern}"`);
                }
            }
        }
        
        if (patternUsed) {
            this.trainingStats.patternCleaningUsed++;
        }
        
        // Remove common leading artifacts like "Ll", "ll", "I", "l" at start
        cleanedOCR = cleanedOCR.replace(/^[LlI|!1\s]+/i, '');
        // Remove common trailing artifacts like "Dee", "dee", single letters
        cleanedOCR = cleanedOCR.replace(/[Dd]ee\s*$/, '');
        cleanedOCR = cleanedOCR.replace(/\s+[a-zA-Z]{1,3}\s*$/, ''); // Remove trailing 1-3 letter words
        
        const normalizedCleanedOCR = this.normalizeForMatching(cleanedOCR);
        
        // Validate OCR text length - card names are typically 3-60 characters
        if (normalizedCleanedOCR.length < 3 || normalizedCleanedOCR.length > 80) {
            console.log('OCR text length out of range, skipping match');
            return null;
        }

        // Try exact substring match with cleaned OCR
        // Be more strict - only match if card name is a significant portion of OCR text
        for (const card of this.cardNames) {
            // Only match if card name appears as a substring (not the other way around)
            // This prevents matching partial card names
            if (normalizedCleanedOCR.includes(card.normalized)) {
                // Calculate how much of the OCR text is the card name
                const coverage = card.normalized.length / normalizedCleanedOCR.length;
                // Require at least 60% coverage to avoid false positives
                if (coverage >= 0.6) {
                    const score = 0.85 + (coverage * 0.1); // 0.85-0.95 range
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = card.original;
                    }
                }
            }
            
            // Try matching card name within OCR text (handles "Ll Scourge of the Throne Dee")
            const cardWords = card.normalized.split(/\s+/).filter(w => w.length >= 2);
            if (cardWords.length >= 2) {
                // Check if all significant words of card name appear in OCR text IN SEQUENCE
                const ocrWords = normalizedCleanedOCR.split(/\s+/).filter(w => w.length >= 2);
                
                // Try to find the card name words in sequence within OCR words
                let foundSequence = false;
                let sequenceScore = 0;
                for (let i = 0; i <= ocrWords.length - cardWords.length; i++) {
                    let sequenceMatch = true;
                    let totalSim = 0;
                    for (let j = 0; j < cardWords.length; j++) {
                        if (!ocrWords[i + j]) {
                            sequenceMatch = false;
                            break;
                        }
                        const wordSim = this.similarity(ocrWords[i + j], cardWords[j]);
                        if (wordSim <= 0.7) { // Fixed: was !this.similarity(...) > 0.7 which is wrong
                            sequenceMatch = false;
                            break;
                        }
                        totalSim += wordSim;
                    }
                    if (sequenceMatch) {
                        foundSequence = true;
                        sequenceScore = totalSim / cardWords.length; // Average similarity
                        break;
                    }
                }
                
                if (foundSequence && sequenceScore > 0.75) {
                    const score = 0.8 + (sequenceScore * 0.1); // 0.8-0.9 range based on similarity
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = card.original;
                    }
                }
            }
        }
        
        // If we found a good match from cleaned OCR, return it
        // Use higher threshold (0.85) to avoid false positives
        if (bestMatch && bestScore > 0.85) {
            const fromTraining = this.trainingExamples.some(ex => 
                ex.expectedCardName.toLowerCase() === bestMatch.toLowerCase()
            );
            if (fromTraining) {
                this.trainingStats.trainingExampleMatches++;
                console.log(`[Training] Cleaned substring match from training example: "${bestMatch}"`);
            }
            this.trainingStats.totalMatches++;
            
            return {
                cardName: bestMatch,
                confidence: bestScore,
                method: 'cleaned_substring',
                fromTraining: fromTraining
            };
        }

        // If no good substring match, try fuzzy matching
        if (!bestMatch || bestScore < 0.6) {
            const ocrWords = normalizedOCR.split(/\s+/).filter(w => w.length >= 2);
            
            for (const card of this.cardNames) {
                const cardWords = card.normalized.split(/\s+/).filter(w => w.length >= 2);
                
                // Length validation - card names shouldn't be drastically different in length
                const lengthRatio = Math.min(normalizedCleanedOCR.length, card.normalized.length) / 
                                   Math.max(normalizedCleanedOCR.length, card.normalized.length);
                if (lengthRatio < 0.4) {
                    // Skip if lengths are too different (more than 60% difference)
                    continue;
                }
                
                // Try matching the whole string
                const wholeScore = this.similarity(normalizedCleanedOCR, card.normalized);
                
                // Try matching word by word (for cases like "Scourge of the Throne")
                // Use advanced word matching that considers position - this is key for correct matching
                const wordMatchScore = this.advancedWordMatching(normalizedCleanedOCR, card.normalized);
                
                // Try character-based partial matching (for heavily corrupted text)
                // This helps with cases like "i Ce | olla % T A ba" -> "Evercoat Ursine"
                let charMatchScore = 0;
                if (ocrWords.length >= 2 && cardWords.length >= 2) {
                    // Try to match first letters or character patterns
                    const ocrFirstChars = ocrWords.map(w => w.charAt(0).toLowerCase()).join('');
                    const cardFirstChars = cardWords.map(w => w.charAt(0).toLowerCase()).join('');
                    
                    if (ocrFirstChars.length >= 2 && cardFirstChars.length >= 2) {
                        charMatchScore = this.similarity(ocrFirstChars, cardFirstChars) * 0.6;
                    }
                    
                    // Try matching word lengths and positions
                    if (ocrWords.length === cardWords.length) {
                        let lengthMatch = 0;
                        for (let i = 0; i < Math.min(ocrWords.length, cardWords.length); i++) {
                            const lengthRatio = Math.min(ocrWords[i].length, cardWords[i].length) / 
                                               Math.max(ocrWords[i].length, cardWords[i].length);
                            lengthMatch += lengthRatio;
                        }
                        lengthMatch /= Math.min(ocrWords.length, cardWords.length);
                        charMatchScore = Math.max(charMatchScore, lengthMatch * 0.4);
                    }
                }
                
                // Try phonetic-like matching (matching similar sounding characters)
                // This helps when OCR misreads similar-looking characters
                let phoneticScore = 0;
                if (ocrWords.length >= 2 && cardWords.length >= 2) {
                    // Create a simplified version removing common OCR errors
                    const ocrSimplified = this.simplifyForMatching(normalizedCleanedOCR);
                    const cardSimplified = this.simplifyForMatching(card.normalized);
                    phoneticScore = this.similarity(ocrSimplified, cardSimplified) * 0.7;
                    
                    // Also try aggressive simplification for heavily corrupted cases
                    // BUT only if we haven't found a good match yet (avoid false positives)
                    if (!bestMatch || bestScore < 0.7) {
                        const ocrAggressive = this.aggressiveSimplify(normalizedCleanedOCR);
                        const cardAggressive = this.aggressiveSimplify(card.normalized);
                        const aggressiveScore = this.similarity(ocrAggressive, cardAggressive) * 0.6;
                        phoneticScore = Math.max(phoneticScore, aggressiveScore);
                    }
                }
                
                // Bonus for matching word count exactly (important for card names)
                const wordCountBonus = ocrWords.length === cardWords.length ? 0.15 : 0;
                
                // Prioritize word matching score (it considers position which is important)
                // Use the best of all scores, but boost word matching
                // However, require minimum scores to avoid false positives
                let finalScore = 0;
                
                // Only use scores that meet very high minimum thresholds
                const validScores = [];
                if (wholeScore > 0.6) validScores.push(wholeScore);
                if (wordMatchScore > 0.6) validScores.push(wordMatchScore * 1.2);  // Boost word matching
                if (charMatchScore > 0.5) validScores.push(charMatchScore);
                if (phoneticScore > 0.6) validScores.push(phoneticScore);
                
                if (validScores.length > 0) {
                    finalScore = Math.max(...validScores) + wordCountBonus;
                } else {
                    // Penalty for low scores
                    finalScore = 0;
                }
                
                // Strong penalty if word counts don't match exactly
                if (ocrWords.length !== cardWords.length) {
                    finalScore *= 0.6; // 40% penalty for mismatched word count
                }
                
                // Strong penalty if first words don't match well (position-aware)
                if (ocrWords.length > 0 && cardWords.length > 0) {
                    const firstWordSim = this.similarity(ocrWords[0], cardWords[0]);
                    if (firstWordSim < 0.5) {
                        finalScore *= 0.5; // 50% penalty for poor first word match
                    }
                }
                
                // Additional penalty for poor position-aware matching
                if (ocrWords.length === cardWords.length) {
                    let positionScore = 0;
                    for (let i = 0; i < ocrWords.length; i++) {
                        positionScore += this.similarity(ocrWords[i], cardWords[i]);
                    }
                    positionScore /= ocrWords.length;
                    if (positionScore < 0.6) {
                        finalScore *= 0.7; // 30% penalty for poor position matching
                    }
                }
                
                // Log matches for debugging
                if (finalScore > 0.6) {
                    console.log(`Match candidate: "${card.original}" score: ${finalScore.toFixed(3)} (whole: ${wholeScore.toFixed(3)}, word: ${wordMatchScore.toFixed(3)}, char: ${charMatchScore.toFixed(3)}, phonetic: ${phoneticScore.toFixed(3)})`);
                }
                
                if (finalScore > bestScore && finalScore > 0.6) {
                    bestScore = finalScore;
                    bestMatch = card.original;
                }
            }
        }

        // Use strict but balanced threshold
        // Require high confidence but allow for OCR errors in valid matches
        // BUT: if we found an exact substring match, accept it immediately
        if (bestMatch && bestScore > 0.9) {
            // Exact match found - return immediately
            return {
                cardName: bestMatch,
                confidence: bestScore,
                method: 'exact_substring'
            };
        }
        
        const minThreshold = 0.7; // Balanced threshold for fuzzy matches
        
        if (bestMatch && bestScore > minThreshold) {
            // Additional validation: check if the match makes sense using position-aware word matching
            const ocrWords = normalizedCleanedOCR.split(/\s+/).filter(w => w.length >= 1);
            const matchWords = this.normalizeForMatching(bestMatch).split(/\s+/).filter(w => w.length >= 1);
            
            // Require word counts to match exactly (or very close - allow 1 word difference for OCR errors)
            if (Math.abs(ocrWords.length - matchWords.length) > 1) {
                console.log(`Match rejected (word count mismatch): "${bestMatch}" for OCR: "${ocrText}" (OCR: ${ocrWords.length} words, Match: ${matchWords.length} words)`);
                return null;
            }
            
            // Position-aware word matching: match words in order (first to first, second to second, etc.)
            let positionMatches = 0;
            let totalPositionSim = 0;
            const minWords = Math.min(ocrWords.length, matchWords.length);
            
            for (let i = 0; i < minWords; i++) {
                const wordSim = this.similarity(ocrWords[i], matchWords[i]);
                totalPositionSim += wordSim;
                if (wordSim > 0.5) {
                    positionMatches++;
                }
            }
            
            const positionMatchRatio = positionMatches / minWords;
            const avgPositionSim = totalPositionSim / minWords;
            
            // Require first word to match reasonably well (card names usually start correctly)
            let firstWordOk = true;
            if (ocrWords.length > 0 && matchWords.length > 0) {
                const firstWordSim = this.similarity(ocrWords[0], matchWords[0]);
                if (firstWordSim < 0.5) {
                    firstWordOk = false;
                    console.log(`Match rejected (first word mismatch): "${bestMatch}" for OCR: "${ocrText}" (first word similarity: ${firstWordSim.toFixed(3)})`);
                }
            }
            
            // Only accept if:
            // 1. First word matches well (>0.5)
            // 2. At least 60% of words match in position with >0.5 similarity
            // 3. Average position similarity is good (>0.55)
            if (firstWordOk && positionMatchRatio >= 0.6 && avgPositionSim > 0.55) {
                const fromTraining = this.trainingExamples.some(ex => 
                    ex.expectedCardName.toLowerCase() === bestMatch.toLowerCase()
                );
                if (fromTraining) {
                    this.trainingStats.trainingExampleMatches++;
                    console.log(`[Training] Fuzzy match from training example: "${bestMatch}"`);
                }
                this.trainingStats.totalMatches++;
                
                console.log(`Match accepted: "${bestMatch}" for OCR: "${ocrText}" (score: ${bestScore.toFixed(3)}, position match: ${(positionMatchRatio * 100).toFixed(1)}%, avg sim: ${avgPositionSim.toFixed(3)})`);
                return {
                    cardName: bestMatch,
                    confidence: bestScore,
                    method: 'fuzzy_match',
                    fromTraining: fromTraining
                };
            } else {
                console.log(`Match rejected (poor position matching): "${bestMatch}" for OCR: "${ocrText}" (score: ${bestScore.toFixed(3)}, position match: ${(positionMatchRatio * 100).toFixed(1)}%, avg sim: ${avgPositionSim.toFixed(3)})`);
                return null;
            }
        } else if (bestMatch) {
            console.log(`Match rejected (too low score): "${bestMatch}" for OCR: "${ocrText}" (score: ${bestScore.toFixed(3)}, threshold: ${minThreshold})`);
        }

        // Last resort: Try very aggressive matching for heavily corrupted text
        // This handles cases like "i Ce | olla % T A ba" -> "Evercoat Ursine"
        // BUT: Only do this if we haven't found ANY match yet (avoid false positives)
        // AND: Only if the OCR text doesn't contain a clear card name substring
        if (!bestMatch && normalizedCleanedOCR.length >= 5) {
            // First check: if OCR text contains any card name as substring, don't do aggressive matching
            let hasSubstringMatch = false;
            for (const card of this.cardNames) {
                if (normalizedCleanedOCR.includes(card.normalized) || card.normalized.includes(normalizedCleanedOCR)) {
                    hasSubstringMatch = true;
                    break;
                }
            }
            
            // Skip aggressive matching if we found a substring match (even if score was low)
            if (hasSubstringMatch) {
                console.log('Skipping aggressive matching - substring match found');
                return null;
            }
            
            // Use cleaned OCR for aggressive matching
            const cleanedNormalized = normalizedCleanedOCR;
            const simplifiedOCR = this.simplifyForMatching(cleanedOCR);
            let aggressiveBest = null;
            let aggressiveScore = 0;

            for (const card of this.cardNames) {
                const simplifiedCard = this.simplifyForMatching(card.original);
                const normalizedCard = card.normalized;
                
                // Try multiple matching strategies
                const strategies = [
                    // Strategy 1: Advanced word-by-word matching (prioritize position)
                    this.advancedWordMatching(cleanedNormalized, normalizedCard) * 1.2, // Boost this
                    
                    // Strategy 2: Simplified similarity
                    this.similarity(simplifiedOCR, simplifiedCard),
                    
                    // Strategy 3: First letter matching
                    this.matchFirstLetters(cleanedNormalized, normalizedCard),
                    
                    // Strategy 4: Word count and length matching
                    this.matchStructure(cleanedNormalized, normalizedCard),
                    
                    // Strategy 5: Partial word matching
                    this.matchPartialWords(cleanedNormalized, normalizedCard),
                    
                    // Strategy 6: Significant word matching (for heavily corrupted text)
                    this.matchSignificantWords(cleanedNormalized, normalizedCard)
                ];

                const maxStrategy = Math.max(...strategies);
                
                // Bonus for matching word count exactly
                const ocrWordCount = cleanedNormalized.split(/\s+/).filter(w => w.length >= 2).length;
                const cardWordCount = normalizedCard.split(/\s+/).filter(w => w.length >= 2).length;
                const wordCountBonus = ocrWordCount === cardWordCount ? 0.15 : 0;
                
                const finalScore = maxStrategy + wordCountBonus;
                
                if (finalScore > aggressiveScore && finalScore > 0.4) {
                    aggressiveScore = finalScore;
                    aggressiveBest = card.original;
                }
            }

            // Use balanced threshold for aggressive matching
            if (aggressiveBest && aggressiveScore > 0.5) {
                // Additional validation for aggressive matches
                const ocrWords = cleanedNormalized.split(/\s+/).filter(w => w.length >= 2);
                const matchWords = this.normalizeForMatching(aggressiveBest).split(/\s+/).filter(w => w.length >= 2);
                
                // Require word count to match (or within 1) for aggressive matches
                if (ocrWords.length === matchWords.length || Math.abs(ocrWords.length - matchWords.length) <= 1) {
                    console.log(`Aggressive match found: "${aggressiveBest}" for OCR: "${ocrText}" (cleaned: "${cleanedOCR}", score: ${aggressiveScore.toFixed(2)})`);
                    return {
                        cardName: aggressiveBest,
                        confidence: aggressiveScore * 0.8, // Slightly lower confidence for aggressive matches
                        method: 'aggressive_fuzzy_match'
                    };
                } else {
                    console.log(`Aggressive match rejected (word count mismatch): "${aggressiveBest}" for OCR: "${ocrText}" (OCR: ${ocrWords.length}, Match: ${matchWords.length})`);
                }
            } else if (aggressiveBest) {
                console.log(`Aggressive match rejected (too low): "${aggressiveBest}" for OCR: "${ocrText}" (score: ${aggressiveScore.toFixed(2)})`);
            }
        }
        
        console.log('No match found for OCR text:', ocrText);
        return null;
    }

    /**
     * Match based on first letters of words
     */
    matchFirstLetters(text1, text2) {
        const words1 = text1.split(/\s+/).filter(w => w.length > 0);
        const words2 = text2.split(/\s+/).filter(w => w.length > 0);
        
        if (words1.length !== words2.length || words1.length < 2) return 0;
        
        let matches = 0;
        for (let i = 0; i < Math.min(words1.length, words2.length); i++) {
            if (words1[i].charAt(0) === words2[i].charAt(0)) {
                matches++;
            }
        }
        
        return matches / Math.max(words1.length, words2.length);
    }

    /**
     * Match based on word structure (count, lengths)
     */
    matchStructure(text1, text2) {
        const words1 = text1.split(/\s+/).filter(w => w.length > 0);
        const words2 = text2.split(/\s+/).filter(w => w.length > 0);
        
        if (words1.length !== words2.length) return 0;
        
        let lengthMatches = 0;
        for (let i = 0; i < Math.min(words1.length, words2.length); i++) {
            const len1 = words1[i].length;
            const len2 = words2[i].length;
            const ratio = Math.min(len1, len2) / Math.max(len1, len2);
            if (ratio > 0.5) {
                lengthMatches += ratio;
            }
        }
        
        return lengthMatches / Math.max(words1.length, words2.length);
    }

    /**
     * Match based on partial word overlap
     */
    matchPartialWords(text1, text2) {
        const words1 = text1.split(/\s+/).filter(w => w.length >= 2);
        const words2 = text2.split(/\s+/).filter(w => w.length >= 2);
        
        if (words1.length < 2 || words2.length < 2) return 0;
        
        let totalScore = 0;
        for (const word1 of words1) {
            let bestMatch = 0;
            for (const word2 of words2) {
                // Try matching 2-3 character sequences
                for (let len = 3; len <= Math.min(word1.length, word2.length); len++) {
                    for (let i = 0; i <= word1.length - len; i++) {
                        const seq1 = word1.substring(i, i + len);
                        if (word2.includes(seq1)) {
                            bestMatch = Math.max(bestMatch, len / Math.max(word1.length, word2.length));
                        }
                    }
                }
            }
            totalScore += bestMatch;
        }
        
        return totalScore / Math.max(words1.length, words2.length);
    }

    /**
     * Match based on significant words (handles heavily corrupted text)
     * For "i Ce | olla" -> "Evercoat Ursine", looks for word fragments
     */
    matchSignificantWords(text1, text2) {
        const words1 = text1.split(/\s+/).filter(w => w.length >= 2);
        const words2 = text2.split(/\s+/).filter(w => w.length >= 2);
        
        if (words1.length !== words2.length || words1.length < 2) return 0;
        
        // Try to match words in position, looking for character patterns
        let matches = 0;
        let totalSim = 0;
        
        for (let i = 0; i < Math.min(words1.length, words2.length); i++) {
            const w1 = words1[i];
            const w2 = words2[i];
            
            // Try different matching approaches
            const sim1 = this.similarity(w1, w2);
            const sim2 = this.similarity(this.simplifyForMatching(w1), this.simplifyForMatching(w2));
            const sim3 = this.partialWordMatch(w1, w2);
            
            const bestSim = Math.max(sim1, sim2, sim3);
            totalSim += bestSim;
            
            if (bestSim > 0.3) {
                matches++;
            }
        }
        
        if (matches === 0) return 0;
        
        const matchRatio = matches / Math.min(words1.length, words2.length);
        const avgSim = totalSim / Math.min(words1.length, words2.length);
        
        return matchRatio * avgSim;
    }

    /**
     * Simplify text for matching by handling common OCR character confusions
     * Helps match corrupted text like "i Ce | olla" to "Evercoat"
     */
    simplifyForMatching(text) {
        return text
            .toLowerCase()
            .replace(/[|!1il]/g, 'l')  // |, !, 1, i, l -> l
            .replace(/[0o]/g, 'o')      // 0, o -> o
            .replace(/[5s]/g, 's')      // 5, s -> s
            .replace(/[3e]/g, 'e')      // 3, e -> e
            .replace(/[4a]/g, 'a')      // 4, a -> a
            .replace(/[%&]/g, '')       // Remove symbols
            .replace(/[^\w\s]/g, '')   // Remove remaining special chars
            .replace(/\s+/g, ' ')      // Normalize whitespace
            .trim();
    }

    /**
     * Aggressive simplification for heavily corrupted text
     * Handles cases like "i Ce | olla" -> "evercoat ursine"
     */
    aggressiveSimplify(text) {
        return text
            .toLowerCase()
            // Handle common OCR character confusions more aggressively
            .replace(/[|!1il]/g, 'e')  // |, !, 1, i, l -> e (for "i" -> "e" in "Evercoat")
            .replace(/c(?=[aeiou])/g, 'v')  // "c" before vowel -> "v" (for "Ce" -> "ve")
            .replace(/[0o]/g, 'o')
            .replace(/[5s]/g, 's')
            .replace(/[3e]/g, 'e')
            .replace(/[4a]/g, 'a')
            .replace(/[%&]/g, '')
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Advanced word-by-word matching that handles position and similarity
     * This helps match "i Ce | olla" to "Evercoat Ursine"
     */
    advancedWordMatching(ocrText, cardText) {
        const ocrWords = ocrText.split(/\s+/).filter(w => w.length >= 2);
        const cardWords = cardText.split(/\s+/).filter(w => w.length >= 2);
        
        if (ocrWords.length < 2 || cardWords.length < 2) return 0;
        
        // Try to match words in order (position matters for card names)
        let positionScore = 0;
        let maxMatches = 0;
        
        // Try matching first word to first word, second to second, etc.
        for (let offset = 0; offset <= Math.min(ocrWords.length, cardWords.length); offset++) {
            let matches = 0;
            let totalSimilarity = 0;
            
            for (let i = 0; i < Math.min(ocrWords.length - offset, cardWords.length); i++) {
                const ocrWord = ocrWords[i + offset];
                const cardWord = cardWords[i];
                
                // Try different matching strategies
                const strategies = [
                    this.similarity(ocrWord, cardWord),
                    this.similarity(this.simplifyForMatching(ocrWord), this.simplifyForMatching(cardWord)),
                    this.partialWordMatch(ocrWord, cardWord),
                    this.firstLetterMatch(ocrWord, cardWord)
                ];
                
                const bestStrategy = Math.max(...strategies);
                
                if (bestStrategy > 0.4) {
                    matches++;
                    totalSimilarity += bestStrategy;
                }
            }
            
            if (matches > maxMatches || (matches === maxMatches && totalSimilarity > positionScore)) {
                maxMatches = matches;
                positionScore = totalSimilarity;
            }
        }
        
        if (maxMatches === 0) return 0;
        
        // Score based on number of matches and their quality
        const matchRatio = maxMatches / Math.max(ocrWords.length, cardWords.length);
        const avgSimilarity = positionScore / maxMatches;
        
        return matchRatio * avgSimilarity;
    }

    /**
     * Match partial words (handles cases like "olla" matching "ursine")
     */
    partialWordMatch(word1, word2) {
        if (word1.length < 2 || word2.length < 2) return 0;
        
        // Try matching character sequences of different lengths
        let bestMatch = 0;
        
        for (let len = 2; len <= Math.min(word1.length, word2.length); len++) {
            for (let i = 0; i <= word1.length - len; i++) {
                const seq1 = word1.substring(i, i + len);
                for (let j = 0; j <= word2.length - len; j++) {
                    const seq2 = word2.substring(j, j + len);
                    if (seq1 === seq2) {
                        bestMatch = Math.max(bestMatch, len / Math.max(word1.length, word2.length));
                    }
                }
            }
        }
        
        return bestMatch;
    }

    /**
     * Match first letters and character patterns
     */
    firstLetterMatch(word1, word2) {
        if (word1.length < 1 || word2.length < 1) return 0;
        
        // Match first letter
        if (word1.charAt(0) === word2.charAt(0)) {
            return 0.3;
        }
        
        // Try matching first 2-3 characters
        for (let len = 2; len <= Math.min(3, word1.length, word2.length); len++) {
            if (word1.substring(0, len) === word2.substring(0, len)) {
                return 0.2 + (len * 0.1);
            }
        }
        
        return 0;
    }

    /**
     * Add a card name to the database (for training/learning)
     * This allows the system to learn from user corrections
     */
    addCardName(cardName) {
        if (!this.cardNames.find(c => c.original.toLowerCase() === cardName.toLowerCase())) {
            this.cardNames.push({
                original: cardName,
                normalized: this.normalizeForMatching(cardName)
            });
            console.log('Added card name to database:', cardName);
        }
    }

    /**
     * Load card names from a JSON file
     * This can be used to load a comprehensive list of all MTG cards
     */
    async loadFromJSON(url) {
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (Array.isArray(data)) {
                this.cardNames = data.map(name => ({
                    original: name,
                    normalized: this.normalizeForMatching(name)
                }));
            } else if (data.cards && Array.isArray(data.cards)) {
                this.cardNames = data.cards.map(card => ({
                    original: card.name || card,
                    normalized: this.normalizeForMatching(card.name || card)
                }));
            }
            
            console.log(`Loaded ${this.cardNames.length} card names from JSON`);
        } catch (error) {
            console.error('Error loading card names from JSON:', error);
        }
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CardNameMatcher;
}

