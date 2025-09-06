/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateCharacterImage, generateSceneImage } from './services/geminiService';
import CharacterPoseCard from './components/PolaroidCard';
import { createCharacterSheet } from './lib/albumUtils';
import Footer from './components/Footer';
import { CharacterEditor } from './components/AnnotationEditor/CharacterEditor';

const POSES = ['Front View', 'Side View', 'Back View', 'Action Pose', 'Happy Expression', 'Angry Expression'];
const MAX_FILE_SIZE_MB = 4;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const CARTOON_STYLES = {
    '3D Rendered Styles': [
        { id: 'faceted-crystal', name: 'Faceted Crystal Style', description: 'Low-poly crystalline surfaces with sharp edges and reflective facets', type: '3D' },
        { id: 'voxel-art', name: 'Voxel Art Style', description: 'Blocky 3D pixel art with cubic forms and retro gaming aesthetic', type: '3D' },
        { id: 'clay-render', name: 'Clay Render Style', description: 'Soft matte surfaces resembling sculpted clay or plasticine', type: '3D' },
        { id: 'marble-sculpture', name: 'Marble Sculpture Style', description: 'Polished stone-like surfaces with realistic material properties', type: '3D' },
        { id: 'glass-art', name: 'Glass Art Style', description: 'Translucent surfaces with refraction and crystal-clear transparency', type: '3D' },
    ],
    'Manga & Anime Inspired': [
        { id: 'manga-style', name: 'Manga Illustration', description: 'Sharp lineart with dramatic expressions', type: '2D' },
        { id: 'anime-style', name: 'Anime Character Design', description: 'Large eyes with detailed hair and shading', type: '2D' },
        { id: 'chibi-kawaii', name: 'Chibi Style', description: 'Super cute with oversized heads and small bodies', type: '2D' },
        { id: 'shounen-action', name: 'Action Anime Style', description: 'Dynamic poses with spiky hair and bold expressions', type: '2D' },
        { id: 'soft-anime', name: 'Soft Anime Style', description: 'Gentle colors with whimsical fantasy elements', type: '2D' },
    ],
    'Animation Techniques': [
        { id: 'cutout-animation', name: 'Cutout Animation Style', description: 'Flat layered shapes with simple joints', type: '2D' },
        { id: 'geometric-cartoon', name: 'Geometric Cartoon', description: 'Bold shapes with angular design elements', type: '2D' },
        { id: 'organic-shapes', name: 'Organic Shape Animation', description: 'Flowing curves with natural movement feel', type: '2D' },
        { id: 'vector-illustration', name: 'Vector Illustration', description: 'Clean digital art with smooth gradients', type: '2D' },
    ],
    'Artistic Approaches': [
        { id: 'gothic-cartoon', name: 'Gothic Cartoon Style', description: 'Dark themes with elongated proportions', type: '2D' },
        { id: 'comic-strip', name: 'Comic Strip Style', description: 'Expressive linework with classic comic proportions', type: '2D' },
        { id: 'watercolor-cartoon', name: 'Watercolor Cartoon', description: 'Soft painted textures with flowing colors', type: '2D' },
        { id: 'sketch-animation', name: 'Sketch Animation Style', description: 'Rough, hand-drawn aesthetic with visible strokes', type: '2D' },
    ],
};

type ImageStatus = 'pending' | 'done' | 'error';
interface GeneratedImage {
    status: ImageStatus;
    url?: string;
    error?: string;
}

type AppState = 'idle' | 'image-uploaded' | 'style-selection' | 'generating-base' | 'approval' | 'generating-sheet' | 'results-shown' | 'scene-generator' | 'generating-scene' | 'scene-results' | 'character-editor';

const primaryButtonClasses = "font-permanent-marker text-xl text-center text-black bg-yellow-400 py-3 px-8 rounded-sm transform transition-transform duration-200 hover:scale-105 hover:-rotate-2 hover:bg-yellow-300 shadow-[2px_2px_0px_2px_rgba(0,0,0,0.2)]";
const secondaryButtonClasses = "font-permanent-marker text-xl text-center text-white bg-white/10 backdrop-blur-sm border-2 border-white/80 py-3 px-8 rounded-sm transform transition-transform duration-200 hover:scale-105 hover:rotate-2 hover:bg-white hover:text-black";


function App() {
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [generatedImages, setGeneratedImages] = useState<Record<string, GeneratedImage>>({});
    const [isDownloading, setIsDownloading] = useState<boolean>(false);
    const [appState, setAppState] = useState<AppState>('idle');
    const [selectedStyle, setSelectedStyle] = useState<'2D' | '3D' | null>(null);
    const [selectedDetailedStyle, setSelectedDetailedStyle] = useState<string | null>(null);
    const [baseModelImage, setBaseModelImage] = useState<string | null>(null);
    const [styleExamples, setStyleExamples] = useState<Record<string, string>>({});
    const [lightboxImage, setLightboxImage] = useState<{src: string, title: string} | null>(null);
    const [scenePrompt, setScenePrompt] = useState<string>('');
    const [generatedScene, setGeneratedScene] = useState<{url: string, prompt: string} | null>(null);
    const [isGeneratingScene, setIsGeneratingScene] = useState<boolean>(false);
    const [editingImage, setEditingImage] = useState<string | null>(null);
    const [editingContext, setEditingContext] = useState<'character' | 'scene'>('character');

    const getStylePrompt = (styleId: string): string => {
        console.log(`DEBUG - getStylePrompt called with styleId: "${styleId}"`);
        
        const stylePrompts: Record<string, string> = {
            'faceted-crystal': '3D faceted crystal style with low-poly crystalline surfaces, sharp angular edges, and reflective prismatic facets',
            'voxel-art': '3D voxel art style with blocky cubic forms, pixelated 3D surfaces, and retro gaming aesthetic',
            'clay-render': '3D clay render style with soft matte surfaces, sculpted plasticine texture, and organic rounded forms',
            'marble-sculpture': '3D marble sculpture style with polished stone surfaces, realistic material properties, and classical sculpted appearance',
            'glass-art': '3D glass art style with translucent crystal surfaces, light refraction effects, and transparent crystalline forms',
            'minimalist-modern': 'minimalist modern style with simplified geometric forms, clean lines, and reduced color palette',
            'manga-style': 'manga illustration style with sharp precise lineart, dramatic expressions, and detailed backgrounds',
            'anime-style': 'anime character design style with large expressive eyes, detailed hair, and soft shading techniques',
            'chibi-kawaii': 'chibi kawaii style with oversized heads, tiny bodies, and super cute adorable features',
            'shounen-action': 'action anime style with dynamic poses, spiky dramatic hair, and bold energetic expressions',
            'soft-anime': 'soft anime style with gentle pastel colors, whimsical fantasy elements, and dreamy atmosphere',
            'cutout-animation': 'cutout animation style with flat layered shapes, simple joint connections, and paper-like texture',
            'geometric-cartoon': 'geometric cartoon style with bold angular shapes, sharp design elements, and structured composition',
            'organic-shapes': 'organic shape animation style with flowing natural curves, smooth transitions, and fluid movement',
            'vector-illustration': 'vector illustration style with clean digital art, smooth gradients, and precise geometric forms',
            'gothic-cartoon': 'gothic cartoon style with dark atmospheric themes, elongated proportions, and dramatic shadows',
            'comic-strip': 'comic strip style with expressive black linework, classic comic proportions, and traditional panel aesthetics',
            'watercolor-cartoon': 'watercolor cartoon style with soft painted textures, flowing translucent colors, and organic brush strokes',
            'sketch-animation': 'sketch animation style with rough hand-drawn aesthetic, visible pencil strokes, and organic imperfections'
        };
        
        const result = stylePrompts[styleId] || 'cartoon illustration style';
        console.log(`DEBUG - getStylePrompt result: "${result}"`);
        
        if (!stylePrompts[styleId]) {
            console.error(`DEBUG - Style ID "${styleId}" not found in stylePrompts! Available IDs:`, Object.keys(stylePrompts));
        }
        
        return result;
    };

    // Load static examples from local files
    React.useEffect(() => {
        const examples: Record<string, string> = {};
        
        // Get all style IDs and map them to local files
        const allStyleIds = Object.values(CARTOON_STYLES).flat().map(style => style.id);
        allStyleIds.forEach(styleId => {
            // Check if it's a 3D style and use the appropriate folder
            const style = Object.values(CARTOON_STYLES).flat().find(s => s.id === styleId);
            const folder = style?.type === '3D' ? '3d-style-examples' : 'style-examples';
            // Handle double .png extension for 3D styles
            const extension = style?.type === '3D' ? '.png.png' : '.png';
            examples[styleId] = `/${folder}/${styleId}${extension}`;
        });
        
        setStyleExamples(examples);
    }, []);

    // Filter styles based on selected type (2D or 3D)
    const getFilteredStyles = () => {
        if (!selectedStyle) return {};
        
        const filtered: Record<string, any[]> = {};
        Object.entries(CARTOON_STYLES).forEach(([category, styles]) => {
            const filteredStyles = styles.filter(style => style.type === selectedStyle);
            if (filteredStyles.length > 0) {
                filtered[category] = filteredStyles;
            }
        });
        return filtered;
    };

    // Open lightbox
    const openLightbox = (src: string, title: string) => {
        setLightboxImage({ src, title });
    };

    // Close lightbox
    const closeLightbox = () => {
        setLightboxImage(null);
    };

    const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];

            if (file.size > MAX_FILE_SIZE_BYTES) {
                alert(`File is too large. Please upload an image smaller than ${MAX_FILE_SIZE_MB}MB.`);
                e.target.value = ''; // Reset the file input
                return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                setUploadedImage(reader.result as string);
                setAppState('style-selection');
                setGeneratedImages({}); // Clear previous results
                setBaseModelImage(null);
                setSelectedStyle(null);
                setSelectedDetailedStyle(null);
            };
            reader.readAsDataURL(file);
        }
    };

    const generateBaseModel = async () => {
        console.log('DEBUG - generateBaseModel called');
        console.log('DEBUG - uploadedImage:', !!uploadedImage);
        console.log('DEBUG - selectedStyle:', selectedStyle);
        console.log('DEBUG - selectedDetailedStyle:', selectedDetailedStyle);
        
        if (!uploadedImage || !selectedStyle || !selectedDetailedStyle) {
            console.error('Missing required data for generation:', {
                hasUploadedImage: !!uploadedImage,
                selectedStyle,
                selectedDetailedStyle
            });
            return;
        }

        setAppState('generating-base');
        
        setGeneratedImages({
            [POSES[0]]: { status: 'pending' }
        });

        try {
            const detailedStylePrompt = getStylePrompt(selectedDetailedStyle);
            console.log(`DEBUG - Selected style ID: "${selectedDetailedStyle}"`);
            console.log(`DEBUG - Style prompt retrieved: "${detailedStylePrompt}"`);
            
            // Create a detailed, specific prompt following Gemini best practices
            const prompt = `GENERATE AN IMAGE: Create a detailed character reference sheet showing a full-body front view of the subject in the uploaded photo. Whether it's a person, animal, or any other subject, render it as a character in ${detailedStylePrompt}. 

MANDATORY IMAGE GENERATION REQUIREMENTS:
- DO NOT ask questions or provide text responses - generate the image directly
- Standing in a neutral front-facing pose with arms at their sides (or equivalent natural pose for animals)
- Clean white background with soft, even lighting
- Maintain all distinctive features, colors, patterns, and characteristics from the original photo
- Include full details of clothing, accessories, markings, or any unique features
- The character should face directly toward the viewer with a neutral expression
- This will be used as the master reference for generating additional poses of the same character

CRITICAL: You must generate an image, not text. Proceed with creating the character reference sheet immediately.

Style specifications: ${detailedStylePrompt}`;
            
            console.log(`DEBUG - Full prompt being sent to API:`);
            console.log(prompt);
            
            const resultUrl = await generateCharacterImage([uploadedImage], prompt);

            setGeneratedImages({
                [POSES[0]]: { status: 'done', url: resultUrl },
            });
            setBaseModelImage(resultUrl);
            setAppState('approval');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            setGeneratedImages({
                [POSES[0]]: { status: 'error', error: errorMessage },
            });
            setAppState('approval'); // Go to approval even on error, to show retry
            console.error(`Failed to generate base model:`, err);
        }
    };

    const handleApproveAndGenerateSheet = async () => {
        if (!uploadedImage || !baseModelImage || !selectedStyle || !selectedDetailedStyle) return;

        setAppState('generating-sheet');
        
        const remainingPoses = POSES.slice(1);
        const initialImages: Record<string, GeneratedImage> = { ...generatedImages };
        remainingPoses.forEach(pose => {
            initialImages[pose] = { status: 'pending' };
        });
        setGeneratedImages(initialImages);

        const processPose = async (pose: string) => {
            try {
                const detailedStylePrompt = getStylePrompt(selectedDetailedStyle!);
                
                // Enhanced prompt for character consistency following Gemini best practices
                let prompt = `Generate an image of the EXACT SAME CHARACTER shown in the reference images. This must be the identical character with the same facial features, hair style, hair color, body type, clothing style, and all distinguishing characteristics.

CRITICAL REQUIREMENTS FOR CHARACTER CONSISTENCY:
- Use the second reference image (the generated base model) as the PRIMARY character reference
- Maintain IDENTICAL facial features: same eye shape, nose, mouth, facial structure, and expressions
- Keep EXACT SAME hair: same style, color, texture, and length
- Preserve IDENTICAL clothing and accessories
- Match the same art style: ${detailedStylePrompt}
- Clean white background with consistent lighting
- Same character proportions and body type

CHARACTER POSE SPECIFICATION:
The character should be shown in a "${pose}" pose while maintaining ALL the visual characteristics from the reference images.`;

                if (pose.includes('Expression')) {
                    prompt += `\n\nCOMPOSITION: Close-up portrait showing head and shoulders only, focusing on the facial expression while keeping the character's identity identical to the reference.`;
                } else {
                    prompt += `\n\nCOMPOSITION: Full-body view showing the complete character in the specified pose, maintaining exact visual consistency with the reference images.`;
                }

                prompt += `\n\nStyle specifications: ${detailedStylePrompt}

FINAL REMINDER: This must be the SAME CHARACTER as shown in the reference images - identical in every visual aspect except for the pose.`;
                
                console.log(`Generating pose: ${pose} with enhanced consistency prompt`);
                console.log(`Style: ${selectedDetailedStyle}`);
                
                const resultUrl = await generateCharacterImage([uploadedImage, baseModelImage], prompt);
                setGeneratedImages(prev => ({
                    ...prev,
                    [pose]: { status: 'done', url: resultUrl },
                }));
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
                setGeneratedImages(prev => ({
                    ...prev,
                    [pose]: { status: 'error', error: errorMessage },
                }));
                console.error(`Failed to generate image for ${pose}:`, err);
            }
        };

        // Process poses sequentially with a delay to avoid rate limiting
        for (const pose of remainingPoses) {
            await processPose(pose);
            // Add a small delay between requests to be a good API citizen
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        setAppState('results-shown');
    };

    const handleRetryBaseModel = () => {
        generateBaseModel();
    };
    
    const handleReset = () => {
        setUploadedImage(null);
        setGeneratedImages({});
        setAppState('idle');
        setBaseModelImage(null);
        setSelectedStyle(null);
        setSelectedDetailedStyle(null);
        setScenePrompt('');
        setGeneratedScene(null);
        // Keep style examples cached for better UX
    };

    const handleOpenSceneGenerator = () => {
        setAppState('scene-generator');
    };

    const handleGenerateScene = async () => {
        if (!scenePrompt.trim() || !selectedDetailedStyle) return;

        setIsGeneratingScene(true);
        setAppState('generating-scene');

        try {
            // Get the best character images to use as reference
            const characterImages = [baseModelImage!];
            
            // Add a few pose images for better character reference
            const poseImages = Object.entries(generatedImages)
                .filter(([, image]) => (image as GeneratedImage).status === 'done' && (image as GeneratedImage).url)
                .slice(0, 2) // Use up to 2 pose images
                .map(([, image]) => (image as GeneratedImage).url!);
            
            const allReferenceImages = [characterImages[0], ...poseImages];
            const stylePrompt = getStylePrompt(selectedDetailedStyle);

            const sceneUrl = await generateSceneImage(allReferenceImages, scenePrompt, stylePrompt);
            
            setGeneratedScene({ url: sceneUrl, prompt: scenePrompt });
            setAppState('scene-results');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            console.error('Failed to generate scene:', err);
            alert(`Failed to generate scene: ${errorMessage}`);
            setAppState('scene-generator');
        } finally {
            setIsGeneratingScene(false);
        }
    };

    const handleDownloadScene = () => {
        if (generatedScene?.url) {
            const link = document.createElement('a');
            link.href = generatedScene.url;
            link.download = `character-scene-${Date.now()}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleOpenCharacterEditor = (imageUrl: string, context: 'character' | 'scene' = 'character') => {
        setEditingImage(imageUrl);
        setEditingContext(context);
        setAppState('character-editor');
    };

    const handleCloseCharacterEditor = () => {
        setEditingImage(null);
        setEditingContext('character');
        // Return to the appropriate state based on where we came from
        if (appState === 'character-editor') {
            // If we were editing a scene, go back to scene results
            if (editingContext === 'scene') {
                setAppState('scene-results');
            // If we were editing from approval, go back to approval
            } else if (baseModelImage) {
                setAppState('approval');
            } else {
                setAppState('results-shown');
            }
        }
    };

    const handleCharacterEdited = (editedImageUrl: string) => {
        if (editingContext === 'scene') {
            // Update the generated scene with the edited version
            setGeneratedScene(prev => prev ? { ...prev, url: editedImageUrl } : null);
        } else {
            // Update the base model image with the edited version
            setBaseModelImage(editedImageUrl);
            
            // Update the generated images with the edited version
            setGeneratedImages(prev => ({
                ...prev,
                [POSES[0]]: { status: 'done', url: editedImageUrl }
            }));
        }
        
        // Don't close the editor automatically - let user decide when to close
        // The editor will show the updated character/scene and user can continue editing or close manually
    };

    const handleDownloadIndividualImage = (pose: string) => {
        const image = generatedImages[pose];
        if (image?.status === 'done' && image.url) {
            const link = document.createElement('a');
            link.href = image.url;
            link.download = `character-crafter-${pose.replace(/\s+/g, '-')}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleDownloadCharacterSheet = (url: string) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = 'character-sheet.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setIsDownloading(false);
    };

    const handleDownloadSheet = async () => {
        setIsDownloading(true);
        try {
            const imageData = Object.entries(generatedImages)
                .filter(([, image]) => (image as GeneratedImage).status === 'done' && (image as GeneratedImage).url)
                .reduce((acc, [pose, image]) => {
                    acc[pose] = (image as GeneratedImage).url!;
                    return acc;
                }, {} as Record<string, string>);

            if (Object.keys(imageData).length < POSES.length) {
                alert("Please wait for all images to finish generating before downloading the sheet.");
                return;
            }

            await createCharacterSheet(generatedImages, (sheetDataUrl) => {
                const link = document.createElement('a');
                link.href = sheetDataUrl;
                link.download = 'character-crafter-sheet.jpg';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });

        } catch (error) {
            console.error("Failed to create or download character sheet:", error);
            alert("Sorry, there was an error creating your character sheet. Please try again.");
        } finally {
            setIsDownloading(false);
        }
    };
    
    const isGenerationComplete = appState === 'results-shown' && Object.values(generatedImages).every(img => (img as GeneratedImage).status === 'done' || (img as GeneratedImage).status === 'error');

    return (
        <main className="bg-black text-neutral-200 min-h-screen w-full flex flex-col items-center justify-center p-4 pb-32 overflow-x-hidden relative">
            <div className="absolute top-0 left-0 w-full h-full bg-grid-white/[0.05]"></div>
            
            <div className="z-10 flex flex-col items-center justify-center w-full h-full max-w-6xl mx-auto">
                <div className="text-center mb-10">
                    <h1 className="text-6xl md:text-8xl font-caveat font-bold text-neutral-100">Character Crafter</h1>
                    <p className="font-permanent-marker text-neutral-300 mt-2 text-xl tracking-wide">Turn your photo into a cartoon character sheet.</p>
                    
                </div>

                <AnimatePresence mode="wait">
                    {appState === 'idle' && (
                         <motion.div
                            key="idle"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.5 }}
                            className="flex flex-col items-center"
                         >
                            <label htmlFor="file-upload" className="cursor-pointer group transform hover:scale-105 transition-transform duration-300 p-8 border-2 border-dashed border-neutral-600 hover:border-yellow-400 hover:bg-white/5 rounded-lg w-80 text-center">
                                <div className="flex flex-col items-center justify-center h-full text-neutral-500 group-hover:text-yellow-400 transition-colors duration-300">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <span className="font-permanent-marker text-xl">Upload Your Photo</span>
                                    <p className="text-sm mt-2 text-neutral-600">Click here to begin</p>
                                </div>
                            </label>
                            <input id="file-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleImageUpload} />
                        </motion.div>
                    )}

                    {appState === 'style-selection' && uploadedImage && (
                        <motion.div
                            key="style-selection"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.5 }}
                            className="flex flex-col items-center gap-6 w-full max-w-5xl"
                        >
                            <img src={uploadedImage} alt="Uploaded" className="max-w-md rounded-lg shadow-lg" />
                            
                            {/* Basic Style Selection */}
                            <div className="flex flex-col items-center gap-4">
                                <h3 className="font-permanent-marker text-2xl text-neutral-200">Choose Basic Style</h3>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => {
                                            setSelectedStyle('2D');
                                            setSelectedDetailedStyle(null);
                                        }}
                                        className={`${selectedStyle === '2D' ? primaryButtonClasses : secondaryButtonClasses}`}
                                    >
                                        2D Style
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSelectedStyle('3D');
                                            setSelectedDetailedStyle(null);
                                        }}
                                        className={`${selectedStyle === '3D' ? primaryButtonClasses : secondaryButtonClasses}`}
                                    >
                                        3D Style
                                    </button>
                                </div>
                            </div>

                            {/* Detailed Art Style Selection */}
                            {selectedStyle && (
                                <div className="w-full space-y-6">
                                    <h3 className="font-permanent-marker text-2xl text-neutral-200 text-center">Choose {selectedStyle} Art Style</h3>
                                    {Object.entries(getFilteredStyles()).map(([category, styles]) => (
                                        <div key={category} className="space-y-3">
                                            <h4 className="font-permanent-marker text-lg text-yellow-400">{category}</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {styles.map((style) => (
                                                    <button
                                                        key={style.id}
                                                        onClick={() => {
                                                            console.log(`DEBUG - Style selected: "${style.id}" - ${style.name}`);
                                                            setSelectedDetailedStyle(style.id);
                                                        }}
                                                        className={`group p-4 rounded-lg border-2 transition-all duration-200 text-left overflow-hidden ${
                                                            selectedDetailedStyle === style.id
                                                                ? 'border-yellow-400 bg-yellow-400/10 text-yellow-400'
                                                                : 'border-neutral-600 bg-neutral-800/50 text-neutral-300 hover:border-neutral-500 hover:bg-neutral-700/50'
                                                        }`}
                                                    >
                                                        {/* Preview Image */}
                                                        <div 
                                                            className="w-full h-32 mb-3 bg-neutral-900 rounded border overflow-hidden flex items-center justify-center relative cursor-pointer hover:opacity-80 transition-opacity"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openLightbox(styleExamples[style.id], style.name);
                                                            }}
                                                        >
                                                            <img 
                                                                src={styleExamples[style.id]} 
                                                                alt={`${style.name} example`}
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => {
                                                                    // Fallback if image doesn't exist
                                                                    const target = e.target as HTMLImageElement;
                                                                    target.style.display = 'none';
                                                                    target.parentElement!.innerHTML = '<div class="text-xs text-neutral-500 p-4 text-center">Preview not available</div>';
                                                                }}
                                                            />
                                                            {/* Zoom indicator */}
                                                            <div className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                                                                🔍
                                                            </div>
                                                        </div>
                                                        <div className="font-permanent-marker text-sm">{style.name}</div>
                                                        <div className="text-xs text-neutral-400 mt-1">{style.description}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Generate Button */}
                            {selectedStyle && selectedDetailedStyle && (
                                <button
                                    onClick={generateBaseModel}
                                    className={primaryButtonClasses}
                                >
                                    Generate Character
                                </button>
                            )}
                        </motion.div>
                    )}

                    {appState === 'generating-base' && (
                        <motion.div
                            key="generating-base"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.5 }}
                            className="flex flex-col items-center gap-4"
                        >
                            <div className="flex items-center gap-3">
                                <div className="animate-spin h-8 w-8 border-4 border-yellow-400 border-t-transparent rounded-full"></div>
                                <span className="font-permanent-marker text-xl text-neutral-200">Generating your character...</span>
                            </div>
                        </motion.div>
                    )}

                    {appState === 'approval' && baseModelImage && (
                        <motion.div
                            key="approval"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.5 }}
                            className="flex flex-col items-center gap-6"
                        >
                            <h3 className="font-permanent-marker text-2xl text-neutral-200">How does this look?</h3>
                            <img src={baseModelImage} alt="Generated Character" className="max-w-md rounded-lg shadow-lg" />
                            <div className="flex gap-4">
                                <button
                                    onClick={() => handleOpenCharacterEditor(baseModelImage)}
                                    className={primaryButtonClasses}
                                >
                                    Edit Character
                                </button>
                                <button
                                    onClick={handleApproveAndGenerateSheet}
                                    className={primaryButtonClasses}
                                >
                                    Perfect! Generate Full Sheet
                                </button>
                                <button
                                    onClick={handleRetryBaseModel}
                                    className={secondaryButtonClasses}
                                >
                                    Try Again
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {(appState === 'generating-sheet' || appState === 'results-shown') && (
                        <motion.div
                            key="results"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.5 }}
                            className="flex flex-col items-center gap-6 w-full max-w-6xl"
                        >
                            <h3 className="font-permanent-marker text-3xl text-neutral-200">Your Character Sheet</h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 w-full">
                                {POSES.map((pose) => (
                                    <CharacterPoseCard
                                        key={pose}
                                        imageUrl={generatedImages[pose]?.url}
                                        caption={pose}
                                        status={generatedImages[pose]?.status || 'pending'}
                                        error={generatedImages[pose]?.error}
                                        onDownload={handleDownloadIndividualImage}
                                    />
                                ))}
                            </div>
                            {appState === 'results-shown' && (
                                <div className="flex gap-4 mt-6">
                                    <button
                                        onClick={async () => {
                                            setIsDownloading(true);
                                            try {
                                                await createCharacterSheet(generatedImages, handleDownloadCharacterSheet);
                                            } catch (error) {
                                                console.error('Error creating character sheet:', error);
                                                setIsDownloading(false);
                                            }
                                        }}
                                        disabled={isDownloading}
                                        className={primaryButtonClasses}
                                    >
                                        {isDownloading ? 'Preparing Download...' : 'Download Full Sheet'}
                                    </button>
                                    <button
                                        onClick={handleOpenSceneGenerator}
                                        className={primaryButtonClasses}
                                    >
                                        Scene Generator
                                    </button>
                                    <button
                                        onClick={handleReset}
                                        className={secondaryButtonClasses}
                                    >
                                        Start Over
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {appState === 'scene-generator' && (
                        <motion.div
                            key="scene-generator"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.5 }}
                            className="flex flex-col items-center gap-6 w-full max-w-4xl"
                        >
                            <h3 className="font-permanent-marker text-3xl text-neutral-200">Scene Generator</h3>
                            <p className="text-neutral-300 text-center max-w-2xl">
                                Create amazing scenes featuring your character! Describe what you want to see, and we'll generate a scene that matches your character's style.
                            </p>
                            
                            <div className="w-full max-w-2xl">
                                <label htmlFor="scene-prompt" className="block text-neutral-300 mb-2 font-permanent-marker text-lg">
                                    Describe your scene:
                                </label>
                                <textarea
                                    id="scene-prompt"
                                    value={scenePrompt}
                                    onChange={(e) => setScenePrompt(e.target.value)}
                                    placeholder="Example: Make this character ride a dragon in a fantasy world"
                                    className="w-full h-32 p-4 bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-lg text-neutral-200 placeholder-neutral-500 resize-none focus:border-yellow-400 focus:outline-none"
                                />
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={handleGenerateScene}
                                    disabled={!scenePrompt.trim()}
                                    className={`${primaryButtonClasses} ${!scenePrompt.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    Generate Scene
                                </button>
                                <button
                                    onClick={() => setAppState('results-shown')}
                                    className={secondaryButtonClasses}
                                >
                                    Back to Character Sheet
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {appState === 'generating-scene' && (
                        <motion.div
                            key="generating-scene"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.5 }}
                            className="flex flex-col items-center gap-6"
                        >
                            <h3 className="font-permanent-marker text-2xl text-neutral-200">Generating Your Scene...</h3>
                            <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-neutral-300 text-center">
                                Creating an amazing scene with your character in the style: {selectedDetailedStyle}
                            </p>
                        </motion.div>
                    )}

                    {appState === 'scene-results' && generatedScene && (
                        <motion.div
                            key="scene-results"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.5 }}
                            className="flex flex-col items-center gap-6 w-full max-w-4xl"
                        >
                            <h3 className="font-permanent-marker text-3xl text-neutral-200">Your Generated Scene</h3>
                            <p className="text-neutral-300 text-center italic">"{generatedScene.prompt}"</p>
                            
                            <div className="relative group">
                                <img 
                                    src={generatedScene.url} 
                                    alt="Generated Scene" 
                                    className="max-w-full rounded-lg shadow-2xl cursor-pointer transform transition-transform duration-300 group-hover:scale-105"
                                    onClick={() => setLightboxImage({ src: generatedScene.url, title: `Scene: ${generatedScene.prompt}` })}
                                />
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => generatedScene && handleOpenCharacterEditor(generatedScene.url, 'scene')}
                                    className={primaryButtonClasses}
                                >
                                    Edit Scene
                                </button>
                                <button
                                    onClick={handleDownloadScene}
                                    className={primaryButtonClasses}
                                >
                                    Download Scene
                                </button>
                                <button
                                    onClick={() => setAppState('scene-generator')}
                                    className={secondaryButtonClasses}
                                >
                                    Generate Another Scene
                                </button>
                                <button
                                    onClick={() => setAppState('results-shown')}
                                    className={secondaryButtonClasses}
                                >
                                    Back to Character Sheet
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Character Editor Modal */}
            {appState === 'character-editor' && editingImage && (
                <CharacterEditor
                    characterImage={editingImage}
                    onImageGenerated={handleCharacterEdited}
                    onError={(error) => {
                        console.error('Character editing error:', error);
                        alert(`Character editing error: ${error}`);
                    }}
                    onClose={handleCloseCharacterEditor}
                    stylePrompt={selectedDetailedStyle ? getStylePrompt(selectedDetailedStyle) : 'cartoon illustration style'}
                    context={editingContext}
                />
            )}

            {/* Lightbox Modal */}
            {lightboxImage && (
                <div 
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={closeLightbox}
                >
                    <div 
                        className="relative max-w-4xl max-h-full"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={closeLightbox}
                            className="absolute -top-12 right-0 text-white text-xl font-bold hover:text-yellow-400 transition-colors"
                        >
                            ✕ Close
                        </button>
                        <img
                            src={lightboxImage.src}
                            alt={lightboxImage.title}
                            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                        />
                        <div className="absolute -bottom-12 left-0 text-white font-permanent-marker text-lg">
                            {lightboxImage.title}
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}

export default App;