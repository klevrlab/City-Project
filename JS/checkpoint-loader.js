// Checkpoint Loader - Dynamically loads checkpoint data from shark-locations.json

async function loadCheckpoints() {
    try {
        const response = await fetch('./data/shark-locations.json');
        const data = await response.json();
        
        if (data.sharks && data.sharks.length > 0) {
            const progressTracker = document.getElementById('progress-tracker');
            if (!progressTracker) return;
            
            // Find the header div (the one with "Checkpoints" or "Tour Progress")
            const headerDiv = progressTracker.querySelector('div[style*="font-weight: bold"]');
            if (!headerDiv) return;
            
            // Remove all existing checkpoint items
            const existingItems = progressTracker.querySelectorAll('.stop-item');
            existingItems.forEach(item => item.remove());
            
            // Store reference to first existing item for style copying
            const firstExisting = progressTracker.querySelector('.stop-item');
            
            // Create checkpoint items dynamically from JSON
            data.sharks.forEach((shark, index) => {
                const checkpointDiv = document.createElement('div');
                checkpointDiv.className = 'stop-item';
                checkpointDiv.setAttribute('data-checkpoint', String.fromCharCode(65 + index)); // A, B, C, etc.
                checkpointDiv.id = 'checkpoint-' + String.fromCharCode(97 + index); // checkpoint-a, checkpoint-b, etc.
                
                // Add inline styles if they exist in the original
                if (firstExisting && firstExisting.getAttribute('style')) {
                    checkpointDiv.setAttribute('style', firstExisting.getAttribute('style'));
                }
                
                // Create SVG icon
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('class', 'check-icon');
                svg.setAttribute('viewBox', '0 0 24 24');
                svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                
                // Add inline styles if they exist
                if (firstExisting) {
                    const existingSvg = firstExisting.querySelector('.check-icon');
                    if (existingSvg && existingSvg.getAttribute('style')) {
                        svg.setAttribute('style', existingSvg.getAttribute('style'));
                    }
                }
                
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', '12');
                circle.setAttribute('cy', '12');
                circle.setAttribute('r', '10');
                
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', 'm9 12 2 2 4-4');
                
                svg.appendChild(circle);
                svg.appendChild(path);
                checkpointDiv.appendChild(svg);
                
                // Add text label
                const textNode = document.createTextNode('\n            ' + shark.title + '\n        ');
                checkpointDiv.appendChild(textNode);
                
                // Append to progress tracker (maintains order)
                progressTracker.appendChild(checkpointDiv);
            });
            
            console.log('Checkpoints loaded from shark-locations.json:', data.sharks.length, 'checkpoints');
        }
    } catch (error) {
        console.error('Error loading checkpoints:', error);
    }
}

// Load checkpoints when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadCheckpoints);
} else {
    loadCheckpoints();
}
