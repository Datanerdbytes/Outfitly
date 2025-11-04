/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";

const fileToPart = async (file: File) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
    const { mimeType, data } = dataUrlToParts(dataUrl);
    return { inlineData: { mimeType, data } };
};

const dataUrlToParts = (dataUrl: string) => {
    const arr = dataUrl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");
    return { mimeType: mimeMatch[1], data: arr[1] };
}

const dataUrlToPart = (dataUrl: string) => {
    const { mimeType, data } = dataUrlToParts(dataUrl);
    return { inlineData: { mimeType, data } };
}

const handleApiResponse = (response: GenerateContentResponse): string => {
    if (response.promptFeedback?.blockReason) {
        const { blockReason, blockReasonMessage } = response.promptFeedback;
        const errorMessage = `Request was blocked. Reason: ${blockReason}. ${blockReasonMessage || ''}`;
        throw new Error(errorMessage);
    }

    // Find the first image part in any candidate
    for (const candidate of response.candidates ?? []) {
        const imagePart = candidate.content?.parts?.find(part => part.inlineData);
        if (imagePart?.inlineData) {
            const { mimeType, data } = imagePart.inlineData;
            return `data:${mimeType};base64,${data}`;
        }
    }

    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
        const errorMessage = `Image generation stopped unexpectedly. Reason: ${finishReason}. This often relates to safety settings.`;
        throw new Error(errorMessage);
    }
    const textFeedback = response.text?.trim();
    const errorMessage = `The AI model did not return an image. ` + (textFeedback ? `The model responded with text: "${textFeedback}"` : "This can happen due to safety filters or if the request is too complex. Please try a different image.");
    throw new Error(errorMessage);
};

// Fix: Per coding guidelines, initialize the GenAI client without a non-null assertion on the API key.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const model = 'gemini-2.5-flash-image';

export const generateModelImage = async (userImage: File, customInstructions?: string): Promise<string> => {
    const userImagePart = await fileToPart(userImage);
    
    let prompt = `You are an expert fashion photographer AI. Your primary goal is to transform the person in the provided image into an ultra-realistic, high-resolution photo based on the user's instructions, while preserving their core identity and features. The final image MUST be photorealistic with sharp details and professional lighting. Return ONLY the final image, with no artifacts.`;

    if (customInstructions && customInstructions.trim() !== '') {
        prompt += `\n\n**User Instructions:** "${customInstructions}"`;
    } else {
        prompt += `\n\n**Default Instructions (since none were provided):** Create a full-body fashion model photo suitable for a high-end e-commerce website. The background must be a clean, neutral studio backdrop (light gray, #f0f0f0). The person should have a neutral, professional model expression and be in a standard, relaxed standing model pose. Pay close attention to the textures of skin and fabric.`;
    }
    
    const response = await ai.models.generateContent({
        model,
        contents: { parts: [userImagePart, { text: prompt }] },
        config: {
            // Fix: For image generation/editing, `responseModalities` must be an array containing a single `Modality.IMAGE` element.
            responseModalities: [Modality.IMAGE],
        },
    });
    return handleApiResponse(response);
};

export const generateVirtualTryOnImage = async (modelImageUrl: string, garmentImage: File, aspectRatio: string): Promise<string> => {
    const modelImagePart = dataUrlToPart(modelImageUrl);
    const garmentImagePart = await fileToPart(garmentImage);
    const prompt = `You are an expert virtual try-on AI. Your task is to create a new, ultra-high-resolution, photorealistic image where the person from the 'model image' is wearing the clothing from the 'garment image'. The final output must be of professional photography quality.

**Crucial Rules:**
1.  **Complete Garment Replacement:** You MUST completely REMOVE and REPLACE the clothing item worn by the person in the 'model image' with the new garment. No part of the original clothing (e.g., collars, sleeves, patterns) should be visible in the final image.
2.  **Preserve the Model:** The person's face, hair, body shape, and pose from the 'model image' MUST remain unchanged.
3.  **Preserve the Background:** The entire background from the 'model image' MUST be preserved perfectly.
4.  **Apply the Garment:** Realistically fit the new garment onto the person. It should adapt to their pose with natural folds, shadows, and lighting consistent with the original scene, resulting in a seamless, high-quality, and sharp final image.
5.  **Aspect Ratio:** The final image must have a ${aspectRatio} aspect ratio.
6.  **Output:** Return ONLY the final, edited image. Do not include any text.`;
    const response = await ai.models.generateContent({
        model,
        contents: { parts: [modelImagePart, garmentImagePart, { text: prompt }] },
        config: {
            // Fix: For image generation/editing, `responseModalities` must be an array containing a single `Modality.IMAGE` element.
            responseModalities: [Modality.IMAGE],
        },
    });
    return handleApiResponse(response);
};

export const addAccessoryToImage = async (modelImageUrl: string, accessoryImage: File, aspectRatio: string): Promise<string> => {
    const modelImagePart = dataUrlToPart(modelImageUrl);
    const accessoryImagePart = await fileToPart(accessoryImage);
    const prompt = `You are an expert virtual try-on AI. Your task is to create a new, ultra-high-resolution, photorealistic image where the person from the 'model image' is wearing the accessory from the 'accessory image'. The result should be sharp and of professional photography quality.

**Crucial Rules:**
1.  **ADD, Don't Replace:** You MUST ADD the accessory to the person. DO NOT replace their existing clothing. The accessory should be placed logically (e.g., glasses on the face, hat on the head).
2.  **Preserve Everything:** The person's face, hair, body shape, pose, and existing clothing from the 'model image' MUST remain unchanged, except where the accessory naturally covers them.
3.  **Preserve the Background:** The entire background from the 'model image' MUST be preserved perfectly.
4.  **Apply the Accessory:** Realistically fit the new accessory onto the person. It should adapt to their pose with natural shadows and lighting consistent with the original scene for a seamless integration.
5.  **Aspect Ratio:** The final image must have a ${aspectRatio} aspect ratio.
6.  **Output:** Return ONLY the final, edited image. Do not include any text.`;

    const response = await ai.models.generateContent({
        model,
        contents: { parts: [modelImagePart, accessoryImagePart, { text: prompt }] },
        config: {
            // Fix: For image generation/editing, `responseModalities` must be an array containing a single `Modality.IMAGE` element.
            responseModalities: [Modality.IMAGE],
        },
    });
    return handleApiResponse(response);
};

export const generatePoseVariation = async (tryOnImageUrl: string, poseInstruction: string, aspectRatio: string): Promise<string> => {
    const tryOnImagePart = dataUrlToPart(tryOnImageUrl);
    const prompt = `You are an expert fashion photographer AI. Take this image and regenerate it from a different perspective. The person, clothing, and background style must remain identical. The new perspective should be: "${poseInstruction}". The final image must have a ${aspectRatio} aspect ratio. The output must be an ultra-high-resolution, photorealistic image with sharp details. Return ONLY the final image.`;
    const response = await ai.models.generateContent({
        model,
        contents: { parts: [tryOnImagePart, { text: prompt }] },
        config: {
            // Fix: For image generation/editing, `responseModalities` must be an array containing a single `Modality.IMAGE` element.
            responseModalities: [Modality.IMAGE],
        },
    });
    return handleApiResponse(response);
};

export const changeBackgroundImage = async (baseImageUrl: string, backgroundPrompt: string, aspectRatio: string): Promise<string> => {
    const baseImagePart = dataUrlToPart(baseImageUrl);
    const prompt = `You are an expert photo editor AI. Your task is to perfectly replace the background of the provided image of a person with a new one.

**New Background Description:**
"${backgroundPrompt}"

**Crucial Rules:**
1.  **Isolate Subject:** Perfectly isolate the person, including their hair and clothing. Do not alter the person, their pose, or their clothes in any way.
2.  **Replace Background:** Completely replace the original background with the new one described above.
3.  **Maintain Realism:** Ensure lighting, shadows, and reflections on the person are consistent with the new background for an ultra-high-resolution, photorealistic, and seamless result.
4.  **Aspect Ratio:** The final image must have a ${aspectRatio} aspect ratio.
5.  **Output:** Return ONLY the final, edited image. Do not include any text.`;

    const response = await ai.models.generateContent({
        model,
        contents: { parts: [baseImagePart, { text: prompt }] },
        config: {
            // Fix: For image generation/editing, `responseModalities` must be an array containing a single `Modality.IMAGE` element.
            responseModalities: [Modality.IMAGE],
        },
    });
    return handleApiResponse(response);
};

export const changeBackgroundImageWithImage = async (baseImageUrl: string, backgroundImageFile: File, aspectRatio: string): Promise<string> => {
    const baseImagePart = dataUrlToPart(baseImageUrl);
    const backgroundImagePart = await fileToPart(backgroundImageFile);
    const prompt = `You are an expert photo editor AI. You will be given a 'base image' containing a person and a 'background image'. Your task is to perfectly replace the background of the 'base image' with the 'background image'.

**Crucial Rules:**
1.  **Isolate Subject:** Perfectly isolate the person from the 'base image', including all details like hair and clothing. Do not alter the person, their pose, or their clothes in any way.
2.  **Replace Background:** Completely replace the original background with the provided 'background image'.
3.  **Maintain Realism:** Ensure lighting, shadows, and reflections on the person are consistent with the new background for an ultra-high-resolution, photorealistic, and perfectly seamless result.
4.  **Aspect Ratio:** The final image must have a ${aspectRatio} aspect ratio.
5.  **Output:** Return ONLY the final, edited image. Do not include any text.`;

    const response = await ai.models.generateContent({
        model,
        contents: { parts: [
            { text: "This is the base image:" },
            baseImagePart,
            { text: "This is the background image:" },
            backgroundImagePart,
            { text: prompt },
        ] },
        config: {
            // Fix: For image generation/editing, `responseModalities` must be an array containing a single `Modality.IMAGE` element.
            responseModalities: [Modality.IMAGE],
        },
    });
    return handleApiResponse(response);
};

export const changeImageAspectRatio = async (baseImageUrl: string, aspectRatio: string): Promise<string> => {
    const baseImagePart = dataUrlToPart(baseImageUrl);
    const prompt = `You are an expert photo editor AI. Your task is to change the aspect ratio of this image to ${aspectRatio}.

**Crucial Rules:**
1.  **Intelligently Recompose:** Recompose the scene to fit the new aspect ratio. Do not simply crop or stretch. You may need to intelligently generate new background details.
2.  **Preserve Subject:** The person, their pose, their clothing, and all their details must remain completely unchanged and prominent in the frame.
3.  **Seamless Background:** If the background needs to be extended, do it seamlessly and photorealistically, matching the original style.
4.  **Maintain Quality:** The final output must be an ultra-high-resolution, photorealistic image.
5.  **Output:** Return ONLY the final, edited image.`;

    const response = await ai.models.generateContent({
        model,
        contents: { parts: [baseImagePart, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });
    return handleApiResponse(response);
};

export const editImageWithMask = async (baseImageUrl: string, maskImageUrl: string, userPrompt: string, aspectRatio: string): Promise<string> => {
    const baseImagePart = dataUrlToPart(baseImageUrl);
    const maskImagePart = dataUrlToPart(maskImageUrl);

    const prompt = `You are an expert photo editor AI. You are given a 'base image', a 'mask image', and an 'instruction'. Your task is to apply the instruction ONLY to the white areas of the 'mask image' on the 'base image'. The rest of the image must remain untouched. The result must be photorealistic and seamless.

Instruction: "${userPrompt}"

Crucial Rules:
1.  **Strict Masking:** Apply changes ONLY within the white areas of the mask. The black areas are protected and MUST NOT be changed.
2.  **Preserve Unmasked Areas:** All parts of the 'base image' corresponding to black areas in the 'mask image' must be perfectly preserved.
3.  **Seamless Integration:** The edited area must blend flawlessly with the rest of the image, matching lighting, texture, and shadows.
4.  **Aspect Ratio:** The final image must have a ${aspectRatio} aspect ratio.
5.  **Output:** Return ONLY the final, edited photorealistic image.`;

    const response = await ai.models.generateContent({
        model,
        contents: { parts: [
            { text: "This is the base image:" },
            baseImagePart,
            { text: "This is the mask image (edit areas are white):" },
            maskImagePart,
            { text: prompt },
        ] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });
    return handleApiResponse(response);
};