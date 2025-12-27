/**
 * Main Application Logic
 * Handles UI interactions and image processing workflow
 */

class MTGApp {
    constructor() {
        this.recognizer = new MTGCardRecognizer();
        this.uploadedFiles = [];
        this.results = [];
        this.trainingData = { trainingExamples: [] };
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadTrainingData();
    }

    initializeElements() {
        this.uploadArea = document.getElementById('uploadArea');
        this.fileInput = document.getElementById('fileInput');
        this.processBtn = document.getElementById('processBtn');
        this.progressSection = document.getElementById('progressSection');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.resultsSection = document.getElementById('resultsSection');
        this.identifiedGrid = document.getElementById('identifiedGrid');
        this.unidentifiedGrid = document.getElementById('unidentifiedGrid');
        this.identifiedCount = document.getElementById('identifiedCount');
        this.unidentifiedCount = document.getElementById('unidentifiedCount');
        this.downloadIdentifiedBtn = document.getElementById('downloadIdentifiedBtn');
        this.downloadUnidentifiedBtn = document.getElementById('downloadUnidentifiedBtn');
        this.downloadTrainingBtn = document.getElementById('downloadTrainingBtn');
        this.trainingCount = document.getElementById('trainingCount');
        this.importTrainingInput = document.getElementById('importTrainingInput');
        this.showTrainingStatsBtn = document.getElementById('showTrainingStatsBtn');
    }

    setupEventListeners() {
        // File input
        this.uploadArea.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // Drag and drop
        this.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.uploadArea.classList.add('dragover');
        });
        
        this.uploadArea.addEventListener('dragenter', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.uploadArea.classList.add('dragover');
        });
        
        this.uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Only remove dragover if we're actually leaving the upload area
            const rect = this.uploadArea.getBoundingClientRect();
            const x = e.clientX;
            const y = e.clientY;
            if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                this.uploadArea.classList.remove('dragover');
            }
        });
        
        this.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.uploadArea.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                this.handleFiles(Array.from(files));
            }
        });
        
        // Prevent default drag behavior on the whole page
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
        
        document.addEventListener('drop', (e) => {
            e.preventDefault();
        });
        
        // Process button
        this.processBtn.addEventListener('click', () => this.processImages());
        
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
        
        // Download buttons
        this.downloadIdentifiedBtn.addEventListener('click', () => this.downloadImages('identified'));
        this.downloadUnidentifiedBtn.addEventListener('click', () => this.downloadImages('unidentified'));
        this.downloadTrainingBtn.addEventListener('click', () => this.saveTrainingData());
        
        // Import training data
        if (this.importTrainingInput) {
            this.importTrainingInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    try {
                        const count = await this.importTrainingData(file);
                        alert(`Successfully imported ${count} training examples!`);
                        // Reload training examples in matcher
                        if (this.recognizer && this.recognizer.nameMatcher) {
                            await this.recognizer.nameMatcher.loadTrainingExamples();
                        }
                    } catch (error) {
                        alert(`Error importing training data: ${error.message}`);
                    }
                    // Reset input
                    e.target.value = '';
                }
            });
        }
        
        // Show training stats
        if (this.showTrainingStatsBtn) {
            this.showTrainingStatsBtn.addEventListener('click', () => {
                this.showTrainingStats();
            });
        }
    }
    
    showTrainingStats() {
        if (!this.recognizer || !this.recognizer.nameMatcher) {
            alert('Card matcher not initialized. Please process some images first.');
            return;
        }
        
        const stats = this.recognizer.nameMatcher.trainingStats;
        const trainingExamples = this.recognizer.nameMatcher.trainingExamples || [];
        const learnedPatterns = {
            leading: this.recognizer.nameMatcher.learnedLeadingPatterns || [],
            trailing: this.recognizer.nameMatcher.learnedTrailingPatterns || []
        };
        
        const statsHtml = `
            <div style="background: white; padding: 20px; border-radius: 10px; max-width: 600px; margin: 20px auto; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h2 style="color: #667eea; margin-bottom: 15px;">Training Data Statistics</h2>
                
                <div style="margin-bottom: 15px;">
                    <strong>Training Examples:</strong> ${trainingExamples.length}
                </div>
                
                <div style="margin-bottom: 15px;">
                    <strong>Cards Added from Training:</strong> ${stats.cardsAddedFromTraining}
                </div>
                
                <div style="margin-bottom: 15px;">
                    <strong>Learned Patterns:</strong>
                    <ul style="margin: 5px 0; padding-left: 20px;">
                        <li>Leading patterns: ${learnedPatterns.leading.length} (${learnedPatterns.leading.slice(0, 5).join(', ')}${learnedPatterns.leading.length > 5 ? '...' : ''})</li>
                        <li>Trailing patterns: ${learnedPatterns.trailing.length} (${learnedPatterns.trailing.slice(0, 5).join(', ')}${learnedPatterns.trailing.length > 5 ? '...' : ''})</li>
                    </ul>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <strong>Usage Statistics:</strong>
                    <ul style="margin: 5px 0; padding-left: 20px;">
                        <li>Total matches found: ${stats.totalMatches}</li>
                        <li>Matches from training examples: ${stats.trainingExampleMatches}</li>
                        <li>Pattern cleaning used: ${stats.patternCleaningUsed} times</li>
                    </ul>
                </div>
                
                ${stats.totalMatches > 0 ? `
                <div style="margin-top: 15px; padding: 10px; background: #f0f0f0; border-radius: 5px;">
                    <strong>Training Impact:</strong><br>
                    ${stats.trainingExampleMatches > 0 ? 
                        `✓ Training examples helped identify ${stats.trainingExampleMatches} card(s) (${((stats.trainingExampleMatches / stats.totalMatches) * 100).toFixed(1)}% of matches)` :
                        '⚠ No matches yet from training examples'}
                    <br>
                    ${stats.patternCleaningUsed > 0 ? 
                        `✓ Pattern cleaning applied ${stats.patternCleaningUsed} time(s)` :
                        '⚠ Pattern cleaning not used yet'}
                </div>
                ` : '<div style="margin-top: 15px; color: #999;">No matches processed yet. Process some images to see statistics.</div>'}
                
                <button id="closeStatsBtn" style="margin-top: 15px; padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    Close
                </button>
            </div>
        `;
        
        // Create overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;';
        overlay.innerHTML = statsHtml;
        
        // Close button handler
        const closeBtn = overlay.querySelector('#closeStatsBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                overlay.remove();
            });
        }
        
        // Click outside to close
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
        
        document.body.appendChild(overlay);
    }

    async loadTrainingData() {
        // First, try loading from localStorage (works in all scenarios)
        try {
            const stored = localStorage.getItem('mtg-training-data');
            if (stored) {
                this.trainingData = JSON.parse(stored);
                console.log(`Loaded ${this.trainingData.trainingExamples.length} training examples from localStorage`);
                this.updateTrainingCount();
                return; // Use localStorage data if available
            }
        } catch (e) {
            console.warn('Could not load training data from localStorage:', e);
        }
        
        // Only try to fetch from file if we're on http/https (not file://)
        const isHttp = window.location.protocol === 'http:' || window.location.protocol === 'https:';
        if (isHttp) {
            try {
                const response = await fetch('training-data.json');
                if (response.ok) {
                    const data = await response.json();
                    this.trainingData = data;
                    console.log(`Loaded ${this.trainingData.trainingExamples.length} training examples from file`);
                    // Also save to localStorage for future use
                    localStorage.setItem('mtg-training-data', JSON.stringify(data));
                    this.updateTrainingCount();
                    return;
                }
            } catch (error) {
                console.warn('Could not load training data from file:', error);
            }
        } else {
            console.log('Running from file:// - using localStorage only. Use "Import Training Data" to load from file.');
        }
        
        // Fallback: empty training data
        this.trainingData = { trainingExamples: [] };
        this.updateTrainingCount();
    }
    
    importTrainingData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (data.trainingExamples && Array.isArray(data.trainingExamples)) {
                        // Merge with existing training data (avoid duplicates)
                        const existing = this.trainingData.trainingExamples || [];
                        const newExamples = data.trainingExamples.filter(newEx => {
                            return !existing.some(ex => 
                                ex.imageName === newEx.imageName && 
                                ex.expectedCardName === newEx.expectedCardName
                            );
                        });
                        this.trainingData.trainingExamples = [...existing, ...newExamples];
                        localStorage.setItem('mtg-training-data', JSON.stringify(this.trainingData));
                        this.updateTrainingCount();
                        console.log(`Imported ${newExamples.length} new training examples`);
                        resolve(newExamples.length);
                    } else {
                        reject(new Error('Invalid training data format'));
                    }
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    updateTrainingCount() {
        if (this.trainingCount) {
            this.trainingCount.textContent = this.trainingData.trainingExamples.length;
        }
    }

    async saveTrainingData() {
        // In browser, we can't directly write to files, so we'll download it
        const dataStr = JSON.stringify(this.trainingData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'training-data.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        // Also try to save to localStorage as backup
        try {
            localStorage.setItem('mtg-training-data', dataStr);
            console.log('Training data saved to localStorage');
        } catch (error) {
            console.warn('Could not save to localStorage:', error);
        }
    }

    addTrainingExample(result, correctCardName) {
        const example = {
            imageName: result.fileName || result.file?.name || 'unknown.jpg',
            ocrText: result.rawText || '',
            expectedCardName: correctCardName,
            notes: `Corrected from: ${result.cardName || 'Unidentified'}`
        };
        
        // Check if this example already exists
        const exists = this.trainingData.trainingExamples.some(ex => 
            ex.imageName === example.imageName && 
            ex.expectedCardName === example.expectedCardName
        );
        
        if (!exists) {
            this.trainingData.trainingExamples.push(example);
            console.log('Added training example:', example);
            return true;
        } else {
            console.log('Training example already exists');
            return false;
        }
    }

    handleFileSelect(event) {
        const files = Array.from(event.target.files);
        this.handleFiles(files);
    }

    handleFiles(files) {
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        
        if (imageFiles.length === 0) {
            alert('Please select image files only.');
            return;
        }
        
        this.uploadedFiles = [...this.uploadedFiles, ...imageFiles];
        this.processBtn.disabled = this.uploadedFiles.length === 0;
        
        // Update upload area text
        const uploadContent = this.uploadArea.querySelector('.upload-content p');
        if (this.uploadedFiles.length > 0) {
            uploadContent.textContent = `${this.uploadedFiles.length} image(s) selected`;
        }
    }

    async processImages() {
        if (this.uploadedFiles.length === 0) return;
        
        // Show progress
        this.progressSection.style.display = 'block';
        this.resultsSection.style.display = 'none';
        this.processBtn.disabled = true;
        
        // Reset training stats for new batch
        if (this.recognizer && this.recognizer.nameMatcher) {
            this.recognizer.nameMatcher.resetStats();
        }
        
        // Initialize recognizer (this will also load card names from Scryfall)
        this.updateProgress(5, 'Loading card database from Scryfall API...');
        try {
            await this.recognizer.initialize();
            this.updateProgress(10, 'Card database loaded. Starting image processing...');
        } catch (error) {
            console.error('Error initializing recognizer:', error);
            this.updateProgress(10, 'Using local card database. Starting image processing...');
        }
        
        // Process images in parallel - First pass
        this.results = [];
        const total = this.uploadedFiles.length;
        let completed = 0;
        
        // Process images in parallel with concurrency limit (3-4 at a time to avoid overwhelming browser)
        const concurrency = Math.min(4, total);
        const processFile = async (file, index) => {
            try {
                const result = await this.recognizer.processImageFile(file);
                completed++;
                this.updateProgress(10 + (completed / total) * 80, `Processing ${completed} of ${total} images...`);
                return {
                    index: index,
                    file: file,
                    ...result
                };
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
                completed++;
                this.updateProgress(10 + (completed / total) * 80, `Processing ${completed} of ${total} images...`);
                return {
                    index: index,
                    file: file,
                    identified: false,
                    cardName: null,
                    confidence: 0,
                    error: error.message,
                    fileName: file.name
                };
            }
        };
        
        // Process in batches with concurrency limit
        for (let i = 0; i < total; i += concurrency) {
            const batch = this.uploadedFiles.slice(i, i + concurrency);
            const batchPromises = batch.map((file, batchIndex) => 
                processFile(file, i + batchIndex)
            );
            
            const batchResults = await Promise.all(batchPromises);
            this.results.push(...batchResults);
        }
        
        // Sort results by original index to maintain file order
        this.results.sort((a, b) => a.index - b.index);
        this.results = this.results.map(r => {
            const { index, ...rest } = r;
            return rest;
        });
        
        // Second pass: Retry unidentified cards with black border detection (in parallel)
        const unidentified = this.results.filter(r => !r.identified);
        if (unidentified.length > 0) {
            this.updateProgress(90, `Retrying ${unidentified.length} unidentified cards with black border detection...`);
            
            let retryCompleted = 0;
            const retryConcurrency = Math.min(3, unidentified.length); // Slightly lower for retry pass
            
            const retryFile = async (result) => {
                try {
                    // Load the image again for black border detection
                    const image = await this.loadImageFromFile(result.file);
                    
                    // Retry with black border detection
                    const retryResult = await this.recognizer.retryWithBlackBorder(image);
                    
                    retryCompleted++;
                    this.updateProgress(90 + (retryCompleted / unidentified.length) * 10, 
                        `Retrying ${retryCompleted} of ${unidentified.length} with black border detection...`);
                    
                    return {
                        file: result.file,
                        retryResult: retryResult
                    };
                } catch (error) {
                    console.error(`Error in black border retry for ${result.file?.name}:`, error);
                    retryCompleted++;
                    this.updateProgress(90 + (retryCompleted / unidentified.length) * 10, 
                        `Retrying ${retryCompleted} of ${unidentified.length} with black border detection...`);
                    return {
                        file: result.file,
                        retryResult: null
                    };
                }
            };
            
            // Process retries in batches
            for (let i = 0; i < unidentified.length; i += retryConcurrency) {
                const batch = unidentified.slice(i, i + retryConcurrency);
                const batchPromises = batch.map(result => retryFile(result));
                const batchResults = await Promise.all(batchPromises);
                
                // Update results
                for (const { file, retryResult } of batchResults) {
                    if (retryResult) {
                        const index = this.results.findIndex(r => r.file === file);
                        if (index >= 0) {
                            if (retryResult.identified) {
                                this.results[index] = {
                                    file: file,
                                    ...retryResult
                                };
                                console.log(`Black border retry successful for ${file.name}: ${retryResult.cardName}`);
                            } else {
                                this.results[index] = {
                                    ...this.results[index],
                                    ...retryResult,
                                    blackBorderRetry: true
                                };
                            }
                        }
                    }
                }
            }
        }
        
        this.updateProgress(100, 'Card name extraction complete!');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Display results
        this.displayResults();
        this.progressSection.style.display = 'none';
        this.resultsSection.style.display = 'block';
        this.processBtn.disabled = false;
    }

    loadImageFromFile(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    }

    updateProgress(percentage, text) {
        this.progressFill.style.width = `${percentage}%`;
        this.progressText.textContent = text;
    }

    displayResults() {
        const identified = this.results.filter(r => r.identified);
        const unidentified = this.results.filter(r => !r.identified);
        
        // Update counts
        this.identifiedCount.textContent = identified.length;
        this.unidentifiedCount.textContent = unidentified.length;
        
        // Clear grids
        this.identifiedGrid.innerHTML = '';
        this.unidentifiedGrid.innerHTML = '';
        
        // Display identified cards
        if (identified.length === 0) {
            this.identifiedGrid.innerHTML = '<div class="empty-state"><p>No cards identified</p></div>';
        } else {
            identified.forEach(result => {
                this.createCardElement(result, this.identifiedGrid);
            });
        }
        
        // Display unidentified cards
        if (unidentified.length === 0) {
            this.unidentifiedGrid.innerHTML = '<div class="empty-state"><p>All cards identified!</p></div>';
        } else {
            unidentified.forEach(result => {
                this.createCardElement(result, this.unidentifiedGrid, true);
            });
        }
    }

    createCardElement(result, container, isUnidentified = false) {
        const cardDiv = document.createElement('div');
        cardDiv.className = `card-item ${isUnidentified ? 'unidentified' : ''}`;
        
        const img = document.createElement('img');
        img.className = 'card-image';
        
        // Determine image source
        if (result.imageElement && result.imageElement.src) {
            img.src = result.imageElement.src;
        } else if (result.file) {
            img.src = URL.createObjectURL(result.file);
        } else {
            img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"><text>No image</text></svg>';
        }
        
        img.alt = result.fileName || result.file?.name || 'Card image';
        img.onerror = function() {
            this.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#ccc"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#999">Image not available</text></svg>';
        };
        
        const infoDiv = document.createElement('div');
        infoDiv.className = 'card-info';
        
        const nameDiv = document.createElement('div');
        nameDiv.className = 'card-name';
        nameDiv.textContent = result.cardName || (isUnidentified ? 'Unidentified Card' : 'Unknown Card');
        
        const confidenceDiv = document.createElement('div');
        confidenceDiv.className = 'card-confidence';
        if (result.confidence > 0) {
            confidenceDiv.textContent = `Confidence: ${(result.confidence * 100).toFixed(1)}%`;
            if (result.method) {
                confidenceDiv.textContent += ` (${result.method})`;
            }
        } else if (result.error) {
            confidenceDiv.textContent = `Error: ${result.error}`;
        } else {
            confidenceDiv.textContent = 'Could not identify';
        }

        // Add correction button for training
        const correctionDiv = document.createElement('div');
        correctionDiv.className = 'correction-section';
        correctionDiv.style.marginTop = '10px';
        
        const correctBtn = document.createElement('button');
        correctBtn.className = 'correct-btn';
        correctBtn.textContent = '✏️ Correct Name';
        correctBtn.style.cssText = 'padding: 6px 12px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 0.85em; margin-right: 5px;';
        
        let correctionInput = null;
        let saveBtn = null;
        let cancelBtn = null;
        
        correctBtn.addEventListener('click', () => {
            if (correctionInput) {
                // Already showing input, hide it
                correctionInput.remove();
                if (saveBtn) saveBtn.remove();
                if (cancelBtn) cancelBtn.remove();
                correctionInput = null;
                saveBtn = null;
                cancelBtn = null;
                correctBtn.textContent = '✏️ Correct Name';
                return;
            }
            
            // Show input field
            correctionInput = document.createElement('input');
            correctionInput.type = 'text';
            correctionInput.placeholder = 'Enter correct card name...';
            correctionInput.value = result.cardName || '';
            correctionInput.style.cssText = 'padding: 6px; border: 1px solid #667eea; border-radius: 4px; font-size: 0.9em; width: 100%; margin-bottom: 5px;';
            
            saveBtn = document.createElement('button');
            saveBtn.textContent = '✓ Save';
            saveBtn.style.cssText = 'padding: 6px 12px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 0.85em; margin-right: 5px;';
            
            cancelBtn = document.createElement('button');
            cancelBtn.textContent = '✕ Cancel';
            cancelBtn.style.cssText = 'padding: 6px 12px; background: #dc3545; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 0.85em;';
            
            const buttonDiv = document.createElement('div');
            buttonDiv.style.display = 'flex';
            buttonDiv.appendChild(saveBtn);
            buttonDiv.appendChild(cancelBtn);
            
            saveBtn.addEventListener('click', async () => {
                const correctName = correctionInput.value.trim();
                if (correctName) {
                    // Add to training data
                    const added = this.addTrainingExample(result, correctName);
                    
                    if (added) {
                        // Update the card name display
                        nameDiv.textContent = correctName;
                        nameDiv.style.color = '#28a745';
                        nameDiv.style.fontWeight = 'bold';
                        
                        // Update training count
                        this.updateTrainingCount();
                        
                        // Show success message
                        const successMsg = document.createElement('div');
                        successMsg.textContent = '✓ Saved to training data!';
                        successMsg.style.cssText = 'color: #28a745; font-size: 0.8em; margin-top: 5px; font-weight: bold;';
                        correctionDiv.appendChild(successMsg);
                        
                        // Save training data
                        await this.saveTrainingData();
                        
                        // Reload training examples in the recognizer
                        if (this.recognizer && this.recognizer.nameMatcher) {
                            await this.recognizer.nameMatcher.loadTrainingExamples();
                            console.log('Training examples reloaded in matcher');
                        }
                        
                        // Remove input after a delay
                        setTimeout(() => {
                            if (correctionInput) correctionInput.remove();
                            if (saveBtn) saveBtn.remove();
                            if (cancelBtn) cancelBtn.remove();
                            if (successMsg) successMsg.remove();
                            correctionInput = null;
                            saveBtn = null;
                            cancelBtn = null;
                            correctBtn.textContent = '✏️ Correct Name';
                        }, 2000);
                    } else {
                        alert('This correction has already been saved.');
                    }
                } else {
                    alert('Please enter a card name.');
                }
            });
            
            cancelBtn.addEventListener('click', () => {
                if (correctionInput) correctionInput.remove();
                if (saveBtn) saveBtn.remove();
                if (cancelBtn) cancelBtn.remove();
                correctionInput = null;
                saveBtn = null;
                cancelBtn = null;
                correctBtn.textContent = '✏️ Correct Name';
            });
            
            correctionDiv.appendChild(correctionInput);
            correctionDiv.appendChild(buttonDiv);
            correctBtn.textContent = '✕ Cancel';
        });
        
        correctionDiv.appendChild(correctBtn);
        
        // Show raw OCR text on hover for debugging
        if (result.rawText) {
            const rawTextPreview = result.rawText.substring(0, 150).replace(/\n/g, ' | ');
            cardDiv.title = `OCR Text: ${rawTextPreview}${result.rawText.length > 150 ? '...' : ''}`;
            
            // Show OCR preview image and text for debugging
            if (result.ocrPreviewImage || (result.rawText && result.rawText.length > 0)) {
                const debugDiv = document.createElement('details');
                debugDiv.className = 'raw-text-details';
                debugDiv.style.marginTop = '10px';
                debugDiv.style.fontSize = '0.85em';
                
                const summary = document.createElement('summary');
                summary.textContent = `Show OCR details${result.rawText ? ` (${result.rawText.length} chars)` : ''}`;
                summary.style.cursor = 'pointer';
                summary.style.color = '#667eea';
                
                const contentDiv = document.createElement('div');
                contentDiv.style.marginTop = '10px';
                
                // Show OCR preview image (the cropped area used for identification)
                if (result.ocrPreviewImage) {
                    const previewLabel = document.createElement('div');
                    previewLabel.style.marginBottom = '5px';
                    previewLabel.style.fontSize = '0.9em';
                    previewLabel.style.fontWeight = 'bold';
                    previewLabel.style.color = '#666';
                    
                    // Different label for black border retry
                    if (result.ocrArea?.isBlackBorderRetry) {
                        previewLabel.textContent = result.blackBorderDetected ? 
                            'Card area after black border detection:' : 
                            'Card area after fallback crop:';
                    } else {
                        previewLabel.textContent = 'Area used for OCR:';
                    }
                    contentDiv.appendChild(previewLabel);
                    
                    const previewImg = document.createElement('img');
                    previewImg.src = result.ocrPreviewImage;
                    previewImg.style.width = '100%';
                    previewImg.style.maxWidth = '400px';
                    previewImg.style.height = 'auto';
                    previewImg.style.border = '2px solid #667eea';
                    previewImg.style.borderRadius = '4px';
                    previewImg.style.marginBottom = '10px';
                    previewImg.style.background = '#fff';
                    previewImg.alt = 'OCR preview area';
                    contentDiv.appendChild(previewImg);
                    
                    if (result.ocrArea) {
                        const areaInfo = document.createElement('div');
                        areaInfo.style.fontSize = '0.75em';
                        areaInfo.style.color = '#999';
                        areaInfo.style.marginBottom = '10px';
                        
                        if (result.ocrArea.isBlackBorderRetry && result.ocrArea.fullCrop) {
                            // Show black border crop info
                            const crop = result.ocrArea.fullCrop;
                            areaInfo.textContent = `Cropped from original: x=${crop.x}, y=${crop.y}, ${Math.round(crop.width)}×${Math.round(crop.height)} pixels`;
                            if (result.usedFallback) {
                                areaInfo.textContent += ' (fallback crop)';
                            } else if (result.blackBorderDetected) {
                                areaInfo.textContent += ' (black border detected)';
                            }
                        } else {
                            // Regular OCR area info
                            areaInfo.textContent = `OCR area: ${Math.round(result.ocrArea.width)}×${Math.round(result.ocrArea.height)} pixels (top-left 75% of card)`;
                        }
                        contentDiv.appendChild(areaInfo);
                    }
                }
                
                // Show OCR text
                if (result.rawText && result.rawText.length > 0) {
                    const textLabel = document.createElement('div');
                    textLabel.style.marginTop = '10px';
                    textLabel.style.marginBottom = '5px';
                    textLabel.style.fontSize = '0.9em';
                    textLabel.style.fontWeight = 'bold';
                    textLabel.style.color = '#666';
                    textLabel.textContent = 'OCR Text:';
                    contentDiv.appendChild(textLabel);
                    
                    const pre = document.createElement('pre');
                    pre.style.marginTop = '5px';
                    pre.style.padding = '5px';
                    pre.style.background = '#f0f0f0';
                    pre.style.borderRadius = '4px';
                    pre.style.fontSize = '0.8em';
                    pre.style.whiteSpace = 'pre-wrap';
                    pre.style.wordBreak = 'break-word';
                    pre.textContent = result.rawText || 'No text extracted';
                    
                    // Add word details if available
                    if (result.words && result.words.length > 0) {
                        const wordsInfo = document.createElement('div');
                        wordsInfo.style.marginTop = '5px';
                        wordsInfo.style.fontSize = '0.75em';
                        wordsInfo.style.color = '#666';
                        wordsInfo.textContent = `Words detected: ${result.words.length}`;
                        pre.appendChild(document.createElement('br'));
                        pre.appendChild(wordsInfo);
                    }
                    
                    contentDiv.appendChild(pre);
                }
                
                debugDiv.appendChild(summary);
                debugDiv.appendChild(contentDiv);
                infoDiv.appendChild(debugDiv);
            }
        }
        
        infoDiv.appendChild(nameDiv);
        infoDiv.appendChild(confidenceDiv);
        infoDiv.appendChild(correctionDiv);
        cardDiv.appendChild(img);
        cardDiv.appendChild(infoDiv);
        
        container.appendChild(cardDiv);
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}Tab`);
        });
    }

    async downloadImages(type) {
        const filtered = type === 'identified' 
            ? this.results.filter(r => r.identified)
            : this.results.filter(r => !r.identified);
        
        if (filtered.length === 0) {
            alert(`No ${type} images to download.`);
            return;
        }
        
        // Create a zip download (using JSZip if available, or download individually)
        await this.downloadAsZip(filtered, type);
    }

    async downloadAsZip(results, type) {
        if (typeof JSZip === 'undefined') {
            // Fallback to individual downloads
            this.downloadImagesIndividually(results);
            return;
        }
        
        const zip = new JSZip();
        
        for (const result of results) {
            try {
                let imageUrl;
                if (result.imageElement && result.imageElement.src) {
                    imageUrl = result.imageElement.src;
                } else {
                    imageUrl = URL.createObjectURL(result.file);
                }
                
                const response = await fetch(imageUrl);
                const blob = await response.blob();
                const fileName = result.fileName || result.file?.name || `card_${Date.now()}.jpg`;
                zip.file(fileName, blob);
            } catch (error) {
                console.error('Error adding file to zip:', error);
            }
        }
        
        try {
            const content = await zip.generateAsync({ type: 'blob' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `mtg_cards_${type}_${Date.now()}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        } catch (error) {
            console.error('Error creating zip:', error);
            // Fallback to individual downloads
            this.downloadImagesIndividually(results);
        }
    }

    downloadImagesIndividually(results) {
        results.forEach((result, index) => {
            setTimeout(() => {
                const link = document.createElement('a');
                let imageUrl;
                if (result.imageElement && result.imageElement.src) {
                    imageUrl = result.imageElement.src;
                } else {
                    imageUrl = URL.createObjectURL(result.file);
                }
                link.href = imageUrl;
                link.download = result.fileName || result.file?.name || `card_${index}_${Date.now()}.jpg`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }, index * 100); // Stagger downloads to avoid browser blocking
        });
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new MTGApp();
});

