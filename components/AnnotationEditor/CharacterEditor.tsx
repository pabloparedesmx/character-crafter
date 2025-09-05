import React, { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Upload, Undo, Redo, Trash2, Download, Zap, Lasso, Palette, Type, Image as ImageIcon } from "lucide-react";
import { useAnnotations } from "../../hooks/useAnnotations";
import { AnnotationCanvas } from "../Canvas/AnnotationCanvas";
import {
  loadImage,
  calculateCanvasDimensions,
  canvasToDataURL,
} from "../../utils/canvas";
import { generateCharacterImage } from "../../services/geminiService";
import type { AnnotationConfig } from "../../types";

interface CharacterEditorProps {
  characterImage: string;
  onImageGenerated?: (imageUrl: string) => void;
  onError?: (error: string) => void;
  onClose?: () => void;
  stylePrompt?: string;
}

const defaultConfig: AnnotationConfig = {
  colors: {
    draw: "#000000",
    arrow: "#ef4444",
    text: "#000000",
    mask: "#3b82f6",
  },
  defaultSizes: {
    drawThickness: 3,
    arrowThickness: 3,
    fontSize: 16,
    brushSize: 30,
  },
  canvas: {
    maxWidth: 1200,
    maxHeight: 800,
    backgroundColor: "#ffffff",
  },
};

export const CharacterEditor: React.FC<CharacterEditorProps> = ({
  characterImage,
  onImageGenerated,
  onError,
  onClose,
  stylePrompt = "cartoon illustration style",
}) => {
  const config = defaultConfig;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [colors, setColors] = useState(config.colors);
  const [sizes, setSizes] = useState(config.defaultSizes);
  const [isGenerating, setIsGenerating] = useState(false);
  const [maskPrompt, setMaskPrompt] = useState("");

  // Annotations hook
  const {
    annotations,
    maskStrokes,
    activeTool,
    isDrawing,
    currentPath,
    selectedAnnotationId,
    isDragging,
    dragType,
    canUndo,
    canRedo,
    startPos,
    currentMousePos,
    setActiveTool,
    startDrawing,
    continueDrawing,
    endDrawing,
    addTextAnnotation,
    addImageAnnotation,
    updateTextAnnotation,
    clearAll,
    clearMaskStrokes,
    startDragging,
    continueDragging,
    stopDragging,
    undo,
    redo,
  } = useAnnotations();

  // Load character image on mount
  React.useEffect(() => {
    const loadCharacterImage = async () => {
      try {
        const img = await loadImage(characterImage);
        const newDimensions = calculateCanvasDimensions(
          img.width,
          img.height,
          config.canvas.maxWidth,
          config.canvas.maxHeight
        );

        setImage(img);
        setDimensions(newDimensions);
      } catch (error) {
        onError?.("Failed to load character image");
        console.error("Failed to load character image:", error);
      }
    };

    loadCharacterImage();
  }, [characterImage, config.canvas, onError]);

  // Handle canvas mouse events
  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = event.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) * (canvas.width / rect.width);
      const y = (event.clientY - rect.top) * (canvas.height / rect.height);
      const point = { x, y, timestamp: Date.now() };

      // Handle tool-specific actions first
      if (activeTool === "text") {
        setTextPosition({ x, y });
        setShowTextModal(true);
        return;
      }

      if (activeTool === "image") {
        fileInputRef.current?.click();
        return;
      }

      if (activeTool === "prompt") {
        setShowPromptModal(true);
        return;
      }

      // Try to start dragging existing annotations first
      const didStartDrag = startDragging(point);
      if (didStartDrag) {
        return;
      }

      // If no dragging started and we have a drawing tool, start drawing
      if (
        activeTool === "draw" ||
        activeTool === "arrow" ||
        activeTool === "mask"
      ) {
        startDrawing(point);
      }
    },
    [
      activeTool,
      startDragging,
      startDrawing,
    ]
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = event.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) * (canvas.width / rect.width);
      const y = (event.clientY - rect.top) * (canvas.height / rect.height);
      const point = { x, y, timestamp: Date.now() };

      if (isDragging) {
        continueDragging(point);
        return;
      }

      if (isDrawing) {
        continueDrawing(point);
        return;
      }
    },
    [isDrawing, isDragging, continueDrawing, continueDragging]
  );

  const handleMouseUp = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = event.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) * (canvas.width / rect.width);
      const y = (event.clientY - rect.top) * (canvas.height / rect.height);
      const point = { x, y, timestamp: Date.now() };

      if (isDragging) {
        stopDragging();
        return;
      }

      if (isDrawing) {
        const color = colors[activeTool as keyof typeof colors] || "#000000";
        const thickness =
          activeTool === "draw"
            ? sizes.drawThickness
            : activeTool === "arrow"
            ? sizes.arrowThickness
            : activeTool === "mask"
            ? sizes.brushSize
            : 3;

        endDrawing(point, color, thickness);
        return;
      }
    },
    [isDrawing, isDragging, activeTool, colors, sizes, endDrawing, stopDragging]
  );

  // Handle color changes
  const handleColorChange = useCallback((tool: string, color: string) => {
    setColors((prev) => ({ ...prev, [tool]: color }));
  }, []);

  // Handle size changes
  const handleSizeChange = useCallback((property: string, size: number) => {
    setSizes((prev) => ({ ...prev, [property]: size }));
  }, []);

  // Handle download
  const handleDownload = useCallback(() => {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = dimensions.width;
    tempCanvas.height = dimensions.height;

    const ctx = tempCanvas.getContext("2d");
    if (!ctx) return;

    // Draw background
    ctx.fillStyle = config.canvas.backgroundColor;
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Draw image if exists
    if (image) {
      ctx.drawImage(image, 0, 0, tempCanvas.width, tempCanvas.height);
    }

    const dataUrl = canvasToDataURL(tempCanvas);
    const link = document.createElement("a");
    link.download = "edited-character.png";
    link.href = dataUrl;
    link.click();
  }, [dimensions, image, config.canvas.backgroundColor]);

  // Handle AI generation with Gemini service
  const handleGenerate = useCallback(
    async (prompt: string) => {
      if (!image) {
        onError?.("No character image loaded");
        return;
      }

      setIsGenerating(true);
      
      try {
        // Create a canvas with current image and annotations
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = dimensions.width;
        tempCanvas.height = dimensions.height;

        const ctx = tempCanvas.getContext("2d");
        if (!ctx) throw new Error("Failed to get canvas context");

        // Draw the original character image
        ctx.drawImage(image, 0, 0, tempCanvas.width, tempCanvas.height);

        // Draw annotations on top
        annotations.forEach((annotation) => {
          if (annotation.type === "draw" && annotation.path.length > 1) {
            ctx.strokeStyle = annotation.color;
            ctx.lineWidth = annotation.thickness;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";

            ctx.beginPath();
            ctx.moveTo(annotation.path[0].x, annotation.path[0].y);
            annotation.path.forEach((point) => {
              ctx.lineTo(point.x, point.y);
            });
            ctx.stroke();
          } else if (annotation.type === "text") {
            ctx.font = `${annotation.fontSize}px Arial`;
            ctx.fillStyle = annotation.color;
            ctx.fillText(annotation.text, annotation.x, annotation.y);
          }
        });

        // Convert to base64
        const imageData = canvasToDataURL(tempCanvas);

        // Create enhanced prompt for character editing
        const enhancedPrompt = `MODIFY THIS CHARACTER: ${prompt}

CHARACTER EDITING REQUIREMENTS:
- Maintain the same art style: ${stylePrompt}
- Keep the character's core identity and facial features
- Apply the requested changes while preserving character consistency
- Clean white background with consistent lighting
- High quality, detailed character illustration

CRITICAL: You must generate an image, not text. Proceed with creating the modified character immediately.

Style specifications: ${stylePrompt}`;

        // Generate the modified character
        const resultUrl = await generateCharacterImage([imageData], enhancedPrompt);
        
        // Update the character image
        const newImage = await loadImage(resultUrl);
        setImage(newImage);
        
        // Clear annotations after successful generation
        clearAll();
        
        // Notify parent component
        onImageGenerated?.(resultUrl);
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Generation failed";
        onError?.(errorMessage);
        console.error("Character editing failed:", error);
      } finally {
        setIsGenerating(false);
      }
    },
    [image, dimensions, annotations, stylePrompt, onImageGenerated, onError, clearAll]
  );

  // Modal states
  const [showTextModal, setShowTextModal] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [textPosition, setTextPosition] = useState({ x: 0, y: 0 });

  // Handle text submission
  const handleTextSubmit = useCallback(
    (text: string, color: string, fontSize: number) => {
      addTextAnnotation(
        textPosition.x,
        textPosition.y,
        text,
        color,
        fontSize
      );
      setShowTextModal(false);
    },
    [textPosition, addTextAnnotation]
  );

  const primaryButtonClasses = "font-permanent-marker text-xl text-center text-black bg-yellow-400 py-3 px-8 rounded-sm transform transition-transform duration-200 hover:scale-105 hover:-rotate-2 hover:bg-yellow-300 shadow-[2px_2px_0px_2px_rgba(0,0,0,0.2)]";
  const secondaryButtonClasses = "font-permanent-marker text-xl text-center text-white bg-white/10 backdrop-blur-sm border-2 border-white/80 py-3 px-8 rounded-sm transform transition-transform duration-200 hover:scale-105 hover:rotate-2 hover:bg-white hover:text-black";

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-full max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-2xl font-permanent-marker text-gray-900">
            Character Editor
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl font-bold"
          >
            ✕
          </button>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar */}
          <div className="w-64 p-4 bg-gray-50 border-r border-gray-200 space-y-4">
            {/* Tools */}
            <div className="space-y-2">
              <h3 className="font-permanent-marker text-lg text-gray-900">Tools</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setActiveTool(activeTool === "draw" ? null : "draw")}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    activeTool === "draw"
                      ? "border-yellow-400 bg-yellow-400/10 text-yellow-600"
                      : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                  }`}
                >
                  <Palette size={20} />
                </button>
                <button
                  onClick={() => setActiveTool(activeTool === "mask" ? null : "mask")}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    activeTool === "mask"
                      ? "border-yellow-400 bg-yellow-400/10 text-yellow-600"
                      : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                  }`}
                >
                  <Lasso size={20} />
                </button>
                <button
                  onClick={() => setActiveTool(activeTool === "text" ? null : "text")}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    activeTool === "text"
                      ? "border-yellow-400 bg-yellow-400/10 text-yellow-600"
                      : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                  }`}
                >
                  <Type size={20} />
                </button>
                <button
                  onClick={() => setActiveTool(activeTool === "image" ? null : "image")}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    activeTool === "image"
                      ? "border-yellow-400 bg-yellow-400/10 text-yellow-600"
                      : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                  }`}
                >
                  <ImageIcon size={20} />
                </button>
              </div>
            </div>

            {/* Properties */}
            {activeTool && (
              <div className="space-y-2">
                <h3 className="font-permanent-marker text-lg text-gray-900">Properties</h3>
                {activeTool === "draw" && (
                  <div className="space-y-2">
                    <label className="text-sm text-gray-700">Color</label>
                    <input
                      type="color"
                      value={colors.draw}
                      onChange={(e) => handleColorChange("draw", e.target.value)}
                      className="w-full h-8 rounded border border-gray-300"
                    />
                    <label className="text-sm text-gray-700">Thickness: {sizes.drawThickness}</label>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={sizes.drawThickness}
                      onChange={(e) => handleSizeChange("drawThickness", parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>
                )}
                {activeTool === "mask" && (
                  <div className="space-y-2">
                    <label className="text-sm text-gray-700">Brush Size: {sizes.brushSize}</label>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={sizes.brushSize}
                      onChange={(e) => handleSizeChange("brushSize", parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>
                )}
                {activeTool === "text" && (
                  <div className="space-y-2">
                    <label className="text-sm text-gray-700">Color</label>
                    <input
                      type="color"
                      value={colors.text}
                      onChange={(e) => handleColorChange("text", e.target.value)}
                      className="w-full h-8 rounded border border-gray-300"
                    />
                    <label className="text-sm text-gray-700">Font Size: {sizes.fontSize}</label>
                    <input
                      type="range"
                      min="12"
                      max="48"
                      value={sizes.fontSize}
                      onChange={(e) => handleSizeChange("fontSize", parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Canvas Area */}
          <div className="flex-1 flex items-center justify-center p-8 min-h-0 bg-gradient-to-br from-slate-50 to-slate-100">
            <div className="w-full h-full flex items-center justify-center max-w-6xl mx-auto">
              {image ? (
                <div className="relative bg-white rounded-xl shadow-xl border border-slate-200 p-4 max-w-full max-h-full">
                  <AnnotationCanvas
                    dimensions={dimensions}
                    annotations={annotations}
                    maskStrokes={maskStrokes}
                    currentPath={currentPath}
                    isDrawing={isDrawing}
                    activeTool={activeTool}
                    startPos={startPos}
                    currentMousePos={currentMousePos}
                    selectedAnnotationId={selectedAnnotationId}
                    isDragging={isDragging}
                    dragType={dragType}
                    image={image}
                    colors={colors}
                    sizes={sizes}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    className="max-w-full max-h-full object-contain rounded-lg"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12">
                  <div className="animate-spin h-8 w-8 border-4 border-yellow-400 border-t-transparent rounded-full"></div>
                  <p className="text-gray-500 mt-4">Loading character...</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Toolbar */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex gap-3 items-center justify-center">
            {/* Undo/Redo */}
            <div className="flex gap-2">
              <button
                onClick={undo}
                disabled={!canUndo || isGenerating}
                className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 rounded-lg transition-all duration-200 text-sm font-medium"
              >
                <Undo size={16} />
              </button>
              <button
                onClick={redo}
                disabled={!canRedo || isGenerating}
                className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 rounded-lg transition-all duration-200 text-sm font-medium"
              >
                <Redo size={16} />
              </button>
            </div>

            {/* Clear */}
            <button
              onClick={clearAll}
              disabled={isGenerating}
              className="flex items-center gap-2 px-3 py-2 bg-red-100 hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed text-red-700 rounded-lg transition-all duration-200 text-sm font-medium"
            >
              <Trash2 size={16} />
            </button>

            {/* Download */}
            <button
              onClick={handleDownload}
              disabled={!image || isGenerating}
              className="flex items-center gap-2 px-3 py-2 bg-green-100 hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed text-green-700 rounded-lg transition-all duration-200 text-sm font-medium"
            >
              <Download size={16} />
            </button>

            {/* Generate Button */}
            <button
              onClick={() => {
                if (activeTool === "mask" && maskStrokes.length > 0 && maskPrompt.trim()) {
                  handleGenerate(maskPrompt);
                } else {
                  setShowPromptModal(true);
                }
              }}
              disabled={!image || isGenerating}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200 text-sm font-medium"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Zap size={16} />
                  <span>Generate</span>
                </>
              )}
            </button>

            {/* Done Editing Button */}
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all duration-200 text-sm font-medium"
            >
              <span>Done Editing</span>
            </button>
          </div>
        </div>

        {/* Mask Prompt Input */}
        {activeTool === "mask" && (
          <div className="border-t border-gray-200 p-4">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={maskPrompt}
                onChange={(e) => setMaskPrompt(e.target.value)}
                placeholder="Describe how to change the selected area..."
                className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={maskStrokes.length === 0}
              />
              {maskStrokes.length > 0 && (
                <button
                  onClick={() => {
                    clearMaskStrokes();
                    setMaskPrompt("");
                  }}
                  className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-all duration-200 font-medium text-sm"
                >
                  Clear Mask
                </button>
              )}
            </div>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
        />

        {/* Simple Text Modal */}
        {showTextModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-96">
              <h3 className="text-lg font-semibold mb-4">Add Text</h3>
              <input
                type="text"
                placeholder="Enter text..."
                className="w-full p-2 border border-gray-300 rounded mb-4"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const text = (e.target as HTMLInputElement).value;
                    if (text.trim()) {
                      handleTextSubmit(text, colors.text, sizes.fontSize);
                    }
                  }
                }}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowTextModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Simple Prompt Modal */}
        {showPromptModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-96">
              <h3 className="text-lg font-semibold mb-4">Generate with AI</h3>
              <textarea
                placeholder="Describe what you want to generate or edit..."
                className="w-full p-2 border border-gray-300 rounded mb-4 h-24 resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.ctrlKey) {
                    const prompt = (e.target as HTMLTextAreaElement).value;
                    if (prompt.trim()) {
                      handleGenerate(prompt);
                      setShowPromptModal(false);
                    }
                  }
                }}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPromptModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
                    const prompt = textarea.value;
                    if (prompt.trim()) {
                      handleGenerate(prompt);
                      setShowPromptModal(false);
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Generate
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

