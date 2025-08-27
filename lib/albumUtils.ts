/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// Helper function to load an image and return it as an HTMLImageElement
function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(new Error(`Failed to load image: ${src.substring(0, 50)}...`));
        img.src = src;
    });
}

/**
 * Creates a single "character sheet" page image from a collection of pose images.
 * @param imageData A record mapping pose strings to their image objects.
 * @param onComplete Callback function called with the generated sheet URL.
 * @returns A promise that resolves to a data URL of the generated sheet (JPEG format).
 */
export async function createCharacterSheet(
    imageData: Record<string, { status: string; url?: string; error?: string }>, 
    onComplete: (url: string) => void
): Promise<void> {
    const canvas = document.createElement('canvas');
    const canvasWidth = 3508;
    const canvasHeight = 2480;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Could not get 2D canvas context');
    }

    // 1. Draw the background
    ctx.fillStyle = '#171717'; // A dark background
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

     // Add a subtle grid pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 2;
    for (let i = 0; i < canvasWidth; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvasHeight);
        ctx.stroke();
    }
    for (let i = 0; i < canvasHeight; i += 50) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvasWidth, i);
        ctx.stroke();
    }


    // 2. Draw the title
    ctx.fillStyle = '#e5e5e5'; // light gray
    ctx.textAlign = 'center';

    ctx.font = `bold 100px 'Caveat', cursive`;
    ctx.fillText('Character Crafter', canvasWidth / 2, 150);

    ctx.font = `50px 'Roboto', sans-serif`;
    ctx.fillStyle = '#a3a3a3'; // neutral-400
    ctx.fillText('Generated on Google AI Studio', canvasWidth / 2, 220);

    // 3. Extract URLs from image objects and filter completed ones
    const completedImages = Object.entries(imageData)
        .filter(([_, imageObj]) => imageObj.status === 'done' && imageObj.url)
        .reduce((acc, [pose, imageObj]) => {
            acc[pose] = imageObj.url!;
            return acc;
        }, {} as Record<string, string>);

    const poses = Object.keys(completedImages);
    const loadedImages = await Promise.all(
        Object.values(completedImages).map(url => loadImage(url))
    );

    const imagesWithPoses = poses.map((pose, index) => ({
        pose,
        img: loadedImages[index],
    }));

    // 4. Define grid layout and draw each pose
    const grid = { cols: 3, rows: 2, padding: 100 };
    const contentTopMargin = 300; // Space for the header
    const contentHeight = canvasHeight - contentTopMargin;
    const cellWidth = (canvasWidth - grid.padding * (grid.cols + 1)) / grid.cols;
    const cellHeight = (contentHeight - grid.padding * (grid.rows + 1)) / grid.rows;

    const cardAspectRatio = 5 / 4; // h/w
    const maxCardWidth = cellWidth * 0.95;
    const maxCardHeight = cellHeight * 0.95;

    let cardWidth = maxCardWidth;
    let cardHeight = cardWidth * cardAspectRatio;
    if (cardHeight > maxCardHeight) {
        cardHeight = maxCardHeight;
        cardWidth = cardHeight / cardAspectRatio;
    }
    
    const imageContainerHeight = cardHeight * 0.8;
    const imageContainerWidth = cardWidth * 0.9;
    
    imagesWithPoses.forEach(({ pose, img }, index) => {
        const row = Math.floor(index / grid.cols);
        const col = index % grid.cols;

        const x = grid.padding * (col + 1) + cellWidth * col + (cellWidth - cardWidth) / 2;
        const y = contentTopMargin + grid.padding * (row + 1) + cellHeight * row + (cellHeight - cardHeight) / 2;
        
        ctx.save();
        ctx.translate(x, y);
        
        // Draw a soft shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 40;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 10;
        
        // Draw the card background
        ctx.fillStyle = '#262626'; // neutral-800
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(0, 0, cardWidth, cardHeight, 16);
        ctx.fill();
        ctx.stroke();
        
        ctx.shadowColor = 'transparent';
        
        // Draw image inside the card
        const imageMargin = (cardWidth - imageContainerWidth) / 2;
        const imageX = imageMargin;
        const imageY = imageMargin;
        
        ctx.drawImage(img, imageX, imageY, imageContainerWidth, imageContainerHeight);
        
        // Draw the caption
        ctx.fillStyle = '#d4d4d4'; // neutral-300
        ctx.font = `60px 'Permanent Marker', cursive`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const captionY = imageMargin + imageContainerHeight + (cardHeight - (imageMargin + imageContainerHeight)) / 2;
        ctx.fillText(pose, cardWidth / 2, captionY);
        
        ctx.restore();
    });

    const sheetUrl = canvas.toDataURL('image/jpeg', 0.9);
    onComplete(sheetUrl);
}
