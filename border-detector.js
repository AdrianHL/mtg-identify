/**
 * Black Border Detector
 * Detects black borders/frames around MTG cards and extracts the card content area
 */

class BlackBorderDetector {
    /**
     * Detect black border and find the card content area
     * Dual approach: First identifies dark border lines, then finds where they transition to bright card content
     * Returns {x, y, width, height} of the card area, or null if not found
     */
    detectBlackBorder(image) {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = image.width;
            canvas.height = image.height;
            ctx.drawImage(image, 0, 0);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            // Dual approach: Find dark border lines first, then find where they transition to bright card content
            // Use a fixed threshold - pixels with brightness < 50 are considered "black/dark"
            const DARK_THRESHOLD = 50;
            const BRIGHT_THRESHOLD = 80; // Pixels brighter than this are definitely card content
            
            const getBrightness = (idx) => (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
            const isDark = (brightness) => brightness < DARK_THRESHOLD;
            const isBright = (brightness) => brightness > BRIGHT_THRESHOLD;
            
            // Helper: Find edge by looking for transition from dark border to bright card
            // First identifies dark border area, then finds where it transitions to bright content
            const findEdgeWithDarkDetection = (start, end, step, isVertical) => {
                let inDarkBorder = false;
                let darkBorderStart = null;
                let edgePosition = null;
                let consecutiveDark = 0;
                let consecutiveBright = 0;
                
                for (let pos = start; (step > 0 ? pos < end : pos > end); pos += step) {
                    let darkCount = 0;
                    let brightCount = 0;
                    let totalSamples = 0;
                    
                    // Sample across middle 50% of perpendicular dimension
                    const sampleStart = Math.floor((isVertical ? image.width : image.height) * 0.25);
                    const sampleEnd = Math.floor((isVertical ? image.width : image.height) * 0.75);
                    const sampleStep = Math.max(1, Math.floor((sampleEnd - sampleStart) / 40)); // More samples
                    
                    for (let sample = sampleStart; sample < sampleEnd; sample += sampleStep) {
                        const x = isVertical ? sample : pos;
                        const y = isVertical ? pos : sample;
                        
                        if (x >= 0 && x < image.width && y >= 0 && y < image.height) {
                            const idx = (y * image.width + x) * 4;
                            const brightness = getBrightness(idx);
                            if (isDark(brightness)) darkCount++;
                            if (isBright(brightness)) brightCount++;
                            totalSamples++;
                        }
                    }
                    
                    if (totalSamples === 0) continue;
                    
                    const darkRatio = darkCount / totalSamples;
                    const brightRatio = brightCount / totalSamples;
                    
                    // Phase 1: Identify dark border area (80%+ dark pixels - more strict)
                    if (darkRatio > 0.8) {
                        consecutiveDark++;
                        consecutiveBright = 0;
                        if (!inDarkBorder) {
                            inDarkBorder = true;
                            darkBorderStart = pos;
                        }
                    }
                    // Phase 2: Find transition from dark border to bright card content
                    else if (inDarkBorder && brightRatio > 0.65) {
                        consecutiveBright++;
                        consecutiveDark = 0;
                        // Require 3 consecutive bright rows/columns to confirm we've left the border (more strict)
                        if (consecutiveBright >= 3 && edgePosition === null) {
                            // Found transition: we were in dark border, now in bright card content
                            edgePosition = darkBorderStart; // Use start of dark border as edge
                            break;
                        }
                    } else {
                        // Mixed or unclear - reset counters
                        if (darkRatio < 0.3 && brightRatio < 0.3) {
                            consecutiveDark = 0;
                            consecutiveBright = 0;
                        }
                        // If we're in dark border but hit a mixed area, reset
                        if (inDarkBorder && darkRatio < 0.5) {
                            consecutiveDark = 0;
                        }
                    }
                }
                
                // If we found a dark border but no clear transition, use the end of dark border
                if (inDarkBorder && edgePosition === null && darkBorderStart !== null) {
                    // Look for where dark border ends (even if not super bright yet)
                    for (let pos = (step > 0 ? darkBorderStart : start); 
                         (step > 0 ? pos < end : pos > end); 
                         pos += step) {
                        let darkCount = 0;
                        let totalSamples = 0;
                        const sampleStart = Math.floor((isVertical ? image.width : image.height) * 0.25);
                        const sampleEnd = Math.floor((isVertical ? image.width : image.height) * 0.75);
                        const sampleStep = Math.max(1, Math.floor((sampleEnd - sampleStart) / 40));
                        
                        for (let sample = sampleStart; sample < sampleEnd; sample += sampleStep) {
                            const x = isVertical ? sample : pos;
                            const y = isVertical ? pos : sample;
                            if (x >= 0 && x < image.width && y >= 0 && y < image.height) {
                                const idx = (y * image.width + x) * 4;
                                const brightness = getBrightness(idx);
                                if (isDark(brightness)) darkCount++;
                                totalSamples++;
                            }
                        }
                        
                        if (totalSamples > 0 && darkCount / totalSamples < 0.4) {
                            // Dark ratio dropped below 40% - border ends here (more strict)
                            edgePosition = pos;
                            break;
                        }
                    }
                }
                
                return edgePosition;
            };
            
            // Find edges using dark border detection
            const topEdge = findEdgeWithDarkDetection(0, Math.floor(image.height * 0.4), 1, true);
            const topY = topEdge !== null ? topEdge : Math.floor(image.height * 0.05);
            
            const bottomEdge = findEdgeWithDarkDetection(image.height - 1, Math.floor(image.height * 0.6), -1, true);
            const bottomY = bottomEdge !== null ? bottomEdge + 1 : Math.floor(image.height * 0.95);
            
            const leftEdge = findEdgeWithDarkDetection(0, Math.floor(image.width * 0.4), 1, false);
            const leftX = leftEdge !== null ? leftEdge : Math.floor(image.width * 0.05);
            
            const rightEdge = findEdgeWithDarkDetection(image.width - 1, Math.floor(image.width * 0.6), -1, false);
            const rightX = rightEdge !== null ? rightEdge + 1 : Math.floor(image.width * 0.95);
            
            // Calculate card dimensions
            const cardWidth = rightX - leftX;
            const cardHeight = bottomY - topY;
            
            // Validation - be more strict
            const minCardSize = Math.min(image.width, image.height) * 0.2; // At least 20% of image
            const aspectRatio = cardWidth / cardHeight;
            const validAspectRatio = aspectRatio > 0.4 && aspectRatio < 1.5;
            
            // Ensure we actually cropped something (at least 8% from at least one side - more strict)
            const widthCropped = (image.width - cardWidth) / image.width;
            const heightCropped = (image.height - cardHeight) / image.height;
            const hasSignificantCrop = widthCropped > 0.08 || heightCropped > 0.08;
            
            // Additional check: if we detected edges, ensure they're reasonable
            // The detected area should not be too close to image edges (unless edges were actually found)
            const edgesFound = (topEdge !== null || bottomEdge !== null || leftEdge !== null || rightEdge !== null);
            const tooCloseToEdge = (topY < image.height * 0.02) || (bottomY > image.height * 0.98) ||
                                  (leftX < image.width * 0.02) || (rightX > image.width * 0.98);
            
            // If we're too close to edges but didn't find actual edges, reject
            if (tooCloseToEdge && !edgesFound) {
                console.log(`✗ Rejected: too close to image edges without edge detection`);
                return null;
            }
            
            // Additional safety check: ensure we didn't include too much area
            // If the detected area is more than 95% of the image, it's likely wrong
            const areaRatio = (cardWidth * cardHeight) / (image.width * image.height);
            const reasonableSize = areaRatio < 0.95; // Card should be less than 95% of image
            
            // Also check: if we're very close to image edges on all sides without finding edges, reject
            const allEdgesClose = (topY < image.height * 0.05 && bottomY > image.height * 0.95 &&
                                  leftX < image.width * 0.05 && rightX > image.width * 0.95);
            const allEdgesFound = (topEdge !== null && bottomEdge !== null && 
                                  leftEdge !== null && rightEdge !== null);
            
            if (cardWidth > minCardSize && cardHeight > minCardSize && 
                topY < bottomY && leftX < rightX && validAspectRatio && hasSignificantCrop &&
                reasonableSize && (!allEdgesClose || allEdgesFound)) {
                
                // Add small padding to shrink detected area slightly (1-2% on each side)
                // This ensures we're definitely inside the frame, not on the edge
                const paddingX = Math.max(1, Math.floor(cardWidth * 0.015)); // 1.5% padding
                const paddingY = Math.max(1, Math.floor(cardHeight * 0.015)); // 1.5% padding
                
                const paddedX = leftX + paddingX;
                const paddedY = topY + paddingY;
                const paddedWidth = cardWidth - (paddingX * 2);
                const paddedHeight = cardHeight - (paddingY * 2);
                
                // Ensure padded area is still valid
                if (paddedWidth > minCardSize && paddedHeight > minCardSize && 
                    paddedX < leftX + cardWidth && paddedY < topY + cardHeight) {
                    console.log(`✓ Detected black border - card area: x=${paddedX}, y=${paddedY}, w=${paddedWidth}, h=${paddedHeight}, aspect=${(paddedWidth/paddedHeight).toFixed(2)}, areaRatio=${(areaRatio*100).toFixed(1)}% (with padding)`);
                    return {
                        x: paddedX,
                        y: paddedY,
                        width: paddedWidth,
                        height: paddedHeight
                    };
                } else {
                    // If padding makes it too small, use original but log warning
                    console.log(`⚠ Using detected area without padding (would be too small)`);
                    return {
                        x: leftX,
                        y: topY,
                        width: cardWidth,
                        height: cardHeight
                    };
                }
            }
            
            console.log(`✗ Black border detection failed - w=${cardWidth}, h=${cardHeight}, aspect=${aspectRatio.toFixed(2)}, minSize=${minCardSize}, crop=${(widthCropped*100).toFixed(1)}%/${(heightCropped*100).toFixed(1)}%, areaRatio=${(areaRatio*100).toFixed(1)}%, allEdgesClose=${allEdgesClose}, allEdgesFound=${allEdgesFound}`);
            
            console.log(`✗ Black border detection failed - w=${cardWidth}, h=${cardHeight}, aspect=${aspectRatio.toFixed(2)}, minSize=${minCardSize}, crop=${(widthCropped*100).toFixed(1)}%/${(heightCropped*100).toFixed(1)}%`);
            return null;
        } catch (error) {
            console.error('Error in black border detection:', error);
            return null;
        }
    }
}

