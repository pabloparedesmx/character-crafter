/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Modality } from "@google/genai";
import type { GenerateContentResponse } from "@google/genai";

const API_KEY = import.meta.env.VITE_API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

/**
 * Generates a character image from a source image and a prompt.
 * @param imageDataUrls An array of data URL strings of the source images (e.g., ['data:image/png;base64,...']).
 * @param prompt The prompt to guide the image generation.
 * @returns A promise that resolves to a base64-encoded image data URL of the generated image.
 */
export async function generateCharacterImage(imageDataUrls: string[], prompt: string): Promise<string> {

  const imageParts = imageDataUrls.map(dataUrl => {
    const match = dataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
    if (!match) {
      throw new Error("Invalid image data URL format. Expected 'data:image/...;base64,...'");
    }
    const mimeType = match[1];
    const base64Data = match[2];

    return {
      inlineData: {
        mimeType: mimeType,
        data: base64Data,
      },
    };
  });
  
  const textPart = {
    text: prompt,
  };

  const maxRetries = 3;
  const initialDelay = 2000; // Increased delay for more patient retries

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [...imageParts, textPart] },
        config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
      });
      
      const imagePartFromResponse = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

      if (imagePartFromResponse?.inlineData) {
        const { mimeType, data } = imagePartFromResponse.inlineData;
        return `data:${mimeType};base64,${data}`;
      }

      const textResponse = response.text;
      console.error("API did not return an image. Response:", textResponse);
      throw new Error(`The AI model responded with text instead of an image: "${textResponse || 'No text response received.'}"`);

    } catch (error) {
      console.error(`Error generating image from Gemini API (Attempt ${attempt}/${maxRetries}):`, error);
      
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      const isRetryableError = errorMessage.includes('"code":500') ||
                               errorMessage.includes('INTERNAL') ||
                               errorMessage.includes('"code":429') ||
                               errorMessage.includes('RESOURCE_EXHAUSTED') ||
                               errorMessage.includes('xhr error');

      if (isRetryableError && attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`Retryable error detected. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // If it's not a retryable error, or we've exhausted retries
        if (isRetryableError) {
          throw new Error("The AI service is temporarily unavailable. Please try again in a few moments.");
        }
        if (error instanceof Error) {
          throw new Error(`The AI model failed to generate an image. Details: ${error.message}`);
        }
        throw new Error(`An unknown error occurred while generating the image.`);
      }
    }
  }

  // This part should be unreachable if the loop logic is correct, but it's good practice for type safety.
  throw new Error("The AI model failed to generate an image after all retries.");
}

/**
 * Generates a scene image from character images and a scene prompt.
 * @param characterImageUrls An array of data URL strings of the character images to use as reference.
 * @param scenePrompt The prompt describing the scene to generate.
 * @param stylePrompt The style prompt to maintain visual consistency.
 * @returns A promise that resolves to a base64-encoded image data URL of the generated scene.
 */
export async function generateSceneImage(characterImageUrls: string[], scenePrompt: string, stylePrompt: string): Promise<string> {

  // Create a 16:9 gray placeholder image for aspect ratio control
  const createAspectRatioImage = (): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 1920; // 16:9 aspect ratio
    canvas.height = 1080;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#808080'; // Gray color
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  };

  const aspectRatioImage = createAspectRatioImage();

  const imageParts = characterImageUrls.map(dataUrl => {
    const match = dataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
    if (!match) {
      throw new Error("Invalid image data URL format. Expected 'data:image/<format>;base64,<data>'");
    }
    return {
      inlineData: {
        mimeType: match[1],
        data: match[2]
      }
    };
  });

  // Add the aspect ratio control image
  const aspectRatioMatch = aspectRatioImage.match(/^data:(image\/\w+);base64,(.*)$/);
  if (aspectRatioMatch) {
    imageParts.push({
      inlineData: {
        mimeType: aspectRatioMatch[1],
        data: aspectRatioMatch[2]
      }
    });
  }

  const prompt = `Create a scene featuring the character from the reference images. 

SCENE REQUIREMENTS:
${scenePrompt}

CHARACTER CONSISTENCY:
- Use the character images as reference to maintain the exact same character appearance
- Keep the same facial features, hair style, clothing, and all distinguishing characteristics
- Maintain the same art style: ${stylePrompt}

COMPOSITION:
- Create a dynamic scene that showcases the character in the described scenario
- Include appropriate background elements and environmental details
- Ensure the character is clearly visible and well-integrated into the scene

Use the aspect ratio from the blank image.`;

  const textPart = {
    text: prompt,
  };

  const maxRetries = 3;
  const initialDelay = 2000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [...imageParts, textPart] },
        config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
      });
      
      const imagePartFromResponse = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

      if (imagePartFromResponse?.inlineData) {
        const { mimeType, data } = imagePartFromResponse.inlineData;
        return `data:${mimeType};base64,${data}`;
      }

      const textResponse = response.text;
      console.error("API did not return an image. Response:", textResponse);
      throw new Error(`The AI model responded with text instead of an image: "${textResponse || 'No text response received.'}"`);

    } catch (error) {
      console.error(`Error generating scene image from Gemini API (Attempt ${attempt}/${maxRetries}):`, error);
      
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      const isRetryableError = errorMessage.includes('"code":500') ||
                               errorMessage.includes('INTERNAL') ||
                               errorMessage.includes('"code":429') ||
                               errorMessage.includes('RESOURCE_EXHAUSTED') ||
                               errorMessage.includes('xhr error');

      if (isRetryableError && attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt - 1);
        console.log(`Retryable error detected. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        if (isRetryableError) {
          throw new Error("The AI service is temporarily unavailable. Please try again in a few moments.");
        }
        if (error instanceof Error) {
          throw new Error(`The AI model failed to generate a scene image. Details: ${error.message}`);
        }
        throw new Error(`An unknown error occurred while generating the scene image.`);
      }
    }
  }

  throw new Error("The AI model failed to generate a scene image after all retries.");
}