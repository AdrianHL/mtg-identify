/**
 * Training Helper
 * Helps improve the system by learning from provided examples
 */

class TrainingHelper {
    constructor() {
        this.trainingExamples = [];
    }

    /**
     * Load training examples from JSON file
     */
    async loadTrainingData(url = 'training-data.json') {
        try {
            const response = await fetch(url);
            const data = await response.json();
            this.trainingExamples = data.trainingExamples || [];
            console.log(`Loaded ${this.trainingExamples.length} training examples`);
            return this.trainingExamples;
        } catch (error) {
            console.warn('Could not load training data:', error);
            return [];
        }
    }

    /**
     * Add a training example manually
     */
    addExample(imageName, ocrText, expectedCardName, notes = '') {
        this.trainingExamples.push({
            imageName,
            ocrText,
            expectedCardName,
            notes
        });
    }

    /**
     * Analyze training examples to improve matching patterns
     */
    analyzePatterns() {
        const patterns = {
            leadingArtifacts: [],
            trailingArtifacts: [],
            characterSubstitutions: [],
            wordSplits: []
        };

        this.trainingExamples.forEach(example => {
            const ocr = example.ocrText.toLowerCase();
            const expected = example.expectedCardName.toLowerCase();
            
            // Find leading artifacts
            if (ocr.startsWith(expected) === false) {
                const leading = ocr.substring(0, ocr.indexOf(expected));
                if (leading.length > 0 && leading.length < 10) {
                    patterns.leadingArtifacts.push(leading.trim());
                }
            }
            
            // Find trailing artifacts
            if (ocr.endsWith(expected) === false) {
                const expectedIndex = ocr.indexOf(expected);
                if (expectedIndex >= 0) {
                    const trailing = ocr.substring(expectedIndex + expected.length);
                    if (trailing.length > 0 && trailing.length < 10) {
                        patterns.trailingArtifacts.push(trailing.trim());
                    }
                }
            }
        });

        return patterns;
    }

    /**
     * Generate improved cleaning rules based on training data
     */
    generateCleaningRules() {
        const patterns = this.analyzePatterns();
        
        // Find common leading artifacts
        const leadingCounts = {};
        patterns.leadingArtifacts.forEach(artifact => {
            leadingCounts[artifact] = (leadingCounts[artifact] || 0) + 1;
        });
        
        // Find common trailing artifacts
        const trailingCounts = {};
        patterns.trailingArtifacts.forEach(artifact => {
            trailingCounts[artifact] = (trailingCounts[artifact] || 0) + 1;
        });
        
        return {
            commonLeadingArtifacts: Object.keys(leadingCounts).filter(k => leadingCounts[k] > 1),
            commonTrailingArtifacts: Object.keys(trailingCounts).filter(k => trailingCounts[k] > 1)
        };
    }

    /**
     * Test current matching accuracy against training examples
     */
    async testAccuracy(matcher) {
        if (!matcher || this.trainingExamples.length === 0) {
            return { accuracy: 0, results: [] };
        }

        let correct = 0;
        const results = [];

        for (const example of this.trainingExamples) {
            const match = matcher.findBestMatch(example.ocrText);
            const isCorrect = match && match.cardName === example.expectedCardName;
            
            if (isCorrect) correct++;
            
            results.push({
                imageName: example.imageName,
                ocrText: example.ocrText,
                expected: example.expectedCardName,
                matched: match?.cardName || null,
                correct: isCorrect,
                confidence: match?.confidence || 0
            });
        }

        const accuracy = (correct / this.trainingExamples.length) * 100;

        return {
            accuracy,
            correct,
            total: this.trainingExamples.length,
            results
        };
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TrainingHelper;
}


