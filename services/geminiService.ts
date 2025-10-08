import { GoogleGenAI, Modality, Type } from "@google/genai";
import { Base64File, Expression } from '../types';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, runTransaction, serverTimestamp, push, set, remove, update } from "firebase/database";
import { getStorage, ref as storageRef, uploadString, getDownloadURL, deleteObject, uploadBytes } from "firebase/storage";
import { base64ToBlob, compressImage } from '../utils/fileUtils';

// --- FIREBASE & GEMINI CLIENT INITIALIZATION ---

const firebaseConfig = {
  apiKey: "AIzaSyA6sANvYoAkXHYG8MjbZl6Pyq23CNdBuzA",
  authDomain: "community-canvas-255fa.firebaseapp.com",
  databaseURL: "https://community-canvas-255fa-default-rtdb.firebaseio.com",
  projectId: "community-canvas-255fa",
  storageBucket: "community-canvas-255fa.appspot.com",
  messagingSenderId: "729445267995",
  appId: "1:729445267995:web:05da6756d66c58b9ccd6be",
  measurementId: "G-FW93CB5QL7"
};

let aiPromise: Promise<GoogleGenAI> | null = null;
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const storage = getStorage(app);

const initializeAiClient = async (): Promise<GoogleGenAI> => {
    try {
        const apiKeyRef = ref(database, 'ExpressionCreator/api');
        const snapshot = await get(apiKeyRef);
        
        if (snapshot.exists()) {
            const apiKey = snapshot.val();
            if (typeof apiKey === 'string' && apiKey.trim() !== '') {
                return new GoogleGenAI({ apiKey });
            } else {
                 throw new Error("API Key found in Firebase is invalid or empty.");
            }
        } else {
            throw new Error("ExpressionCreator/api key not found in Firebase.");
        }
    } catch (error) {
        console.error("Failed to initialize Gemini AI Client from Firebase:", error);
        throw new Error("Could not configure the AI service. Please check the database connection and API key.");
    }
};

const getAiClient = (): Promise<GoogleGenAI> => {
    if (!aiPromise) {
        aiPromise = initializeAiClient();
    }
    return aiPromise;
};


// --- TOKEN MANAGEMENT ---
export const validateToken = async (token: string): Promise<{ uses: number } | null> => {
    if (!token || typeof token !== 'string' || token.trim() === '') {
        return null;
    }
    try {
        const tokenRef = ref(database, `ExpressionCreator/keys/${token.trim()}`);
        const snapshot = await get(tokenRef);
        if (snapshot.exists()) {
            const data = snapshot.val();
            const uses = typeof data === 'number' ? data : (data.uses || 0);
            return { uses };
        }
        return null;
    } catch (error) {
        console.error("Error validating token:", error);
        throw new Error("Could not connect to the server to validate your token.");
    }
};

export const decrementTokenUses = async (token: string): Promise<{ uses: number }> => {
    if (!token || typeof token !== 'string' || token.trim() === '') {
        throw new Error("Invalid token provided for decrementation.");
    }
    const tokenRef = ref(database, `ExpressionCreator/keys/${token.trim()}`);
    try {
        const { committed, snapshot } = await runTransaction(tokenRef, (currentUses) => {
            if (currentUses === null) {
                return 0; // Token doesn't exist, set uses to 0
            }
            if (typeof currentUses === 'number' && currentUses > 0) {
                return currentUses - 1;
            }
            // If it's an object or already 0, don't change it.
            return currentUses;
        });

        if (committed) {
            const newUses = snapshot.val() ?? 0;
            return { uses: typeof newUses === 'number' ? newUses : (newUses.uses || 0) };
        } else {
            throw new Error("Transaction not committed.");
        }
    } catch (error) {
        console.error("Error decrementing token uses:", error);
        throw new Error("Failed to update usage count. Please check your connection.");
    }
};

// --- IMAGE STORAGE & LOGGING ---
const uploadImage = async (path: string, base64Data: string, mimeType: string): Promise<string> => {
    const imageRef = storageRef(storage, path);
    const snapshot = await uploadString(imageRef, `data:${mimeType};base64,${base64Data}`, 'data_url');
    return await getDownloadURL(snapshot.ref);
};

export const logImage = async (imageBlob: Blob, source: string) => {
    try {
        const compressedBlob = await compressImage(imageBlob); // Compress to JPEG by default
        const timestamp = Date.now();
        const logPath = `all_uploads/${source}/${timestamp}.jpg`;
        const logImageRef = storageRef(storage, logPath);

        const snapshot = await uploadBytes(logImageRef, compressedBlob);
        const imageUrl = await getDownloadURL(snapshot.ref);

        const uploadsLogRef = ref(database, `ExpressionCreator/all_uploads_log`);
        const newUploadLogRef = push(uploadsLogRef);
        await set(newUploadLogRef, {
            imageUrl,
            storagePath: logPath,
            source,
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error(`Failed to log image from source [${source}]:`, error);
        // Do not throw, logging failure should not break the main app flow
    }
};

export const logUpload = async (file: Base64File, source: string) => {
    const blob = base64ToBlob(file.base64, file.mimeType);
    await logImage(blob, source);
};


// --- LIBRARY MANAGEMENT ---

const LIBRARIES_PATH = 'ExpressionCreator/libraries';

export const generateNewLibraryKey = async (): Promise<string> => {
    const keyRef = ref(database, LIBRARIES_PATH);
    const newKey = push(keyRef).key;
    if (!newKey) {
        throw new Error("Failed to generate a new library key.");
    }
    await set(ref(database, `${LIBRARIES_PATH}/${newKey}/createdAt`), serverTimestamp());
    return newKey;
};

export const getExpressionsRef = (libraryKey: string) => {
    return ref(database, `${LIBRARIES_PATH}/${libraryKey}/expressions`);
};

export const addExpressionToLibrary = async (libraryKey: string, expression: Omit<Expression, 'storagePath'>) => {
    const [header, base64Data] = expression.image.split(',');
    const mimeType = header.match(/:(.*?);/)?.[1] || 'image/png';

    const storagePath = `expressions/${libraryKey}/${expression.id}.png`;
    const imageUrl = await uploadImage(storagePath, base64Data, mimeType);

    const expressionData: Expression & { createdAt: object } = {
        ...expression,
        image: imageUrl,
        storagePath: storagePath,
        createdAt: serverTimestamp(),
    };
    
    const expressionRef = ref(database, `${LIBRARIES_PATH}/${libraryKey}/expressions/${expression.id}`);
    await set(expressionRef, expressionData);
};

export const updateExpressionInLibrary = async (libraryKey: string, expression: Expression) => {
    const expressionRef = ref(database, `${LIBRARIES_PATH}/${libraryKey}/expressions/${expression.id}`);
    await set(expressionRef, expression);
};

export const moveExpressionToDeleted = async (libraryKey: string, expressionId: string) => {
    const sourceRef = ref(database, `${LIBRARIES_PATH}/${libraryKey}/expressions/${expressionId}`);
    const destRef = ref(database, `${LIBRARIES_PATH}/${libraryKey}/deleted_expressions/${expressionId}`);
    
    const snapshot = await get(sourceRef);
    if (snapshot.exists()) {
        const expressionData: Expression = snapshot.val();
        let finalData: any = { ...expressionData, deletedAt: serverTimestamp() };

        if (expressionData.storagePath) {
            try {
                const originalImageRef = storageRef(storage, expressionData.storagePath);
                const response = await fetch(expressionData.image);
                const blob = await response.blob();
                
                const newStoragePath = `deleted_expressions/${libraryKey}/${expressionId}.png`;
                const newImageRef = storageRef(storage, newStoragePath);
                const uploadResult = await uploadBytes(newImageRef, blob);
                const newImageUrl = await getDownloadURL(uploadResult.ref);
                
                finalData.image = newImageUrl;
                finalData.storagePath = newStoragePath;
                
                await deleteObject(originalImageRef);
            } catch (storageError) {
                console.error(`Failed to move storage file for ${expressionId}. Archiving DB record anyway.`, storageError);
            }
        }
        
        const updates: { [key: string]: any } = {};
        updates[sourceRef.path.toString().substring(sourceRef.path.root.toString().length)] = null;
        updates[destRef.path.toString().substring(destRef.path.root.toString().length)] = finalData;
        await update(ref(database), updates);
    }
};

export const clearAllExpressions = async (libraryKey: string) => {
    const expressionsRef = getExpressionsRef(libraryKey);
    const snapshot = await get(expressionsRef);

    if (snapshot.exists()) {
        const allExpressions: { [id: string]: Expression } = snapshot.val();
        
        const movePromises = Object.values(allExpressions).map(async (exp) => {
            if (!exp.storagePath) return exp;
            
            try {
                const originalImageRef = storageRef(storage, exp.storagePath);
                const response = await fetch(exp.image);
                const blob = await response.blob();
                
                const newStoragePath = `deleted_expressions/${libraryKey}/${exp.id}.png`;
                const newImageRef = storageRef(storage, newStoragePath);
                const uploadResult = await uploadBytes(newImageRef, blob);
                const newImageUrl = await getDownloadURL(uploadResult.ref);
                
                await deleteObject(originalImageRef);
                
                return { ...exp, image: newImageUrl, storagePath: newStoragePath };
            } catch (err) {
                console.error(`Failed to move file for ${exp.id} during clear all.`, err);
                return exp;
            }
        });

        const movedExpressions = await Promise.all(movePromises);

        const updates: { [key: string]: any } = {};
        updates[`${LIBRARIES_PATH}/${libraryKey}/expressions`] = null;
        
        movedExpressions.forEach(exp => {
             updates[`${LIBRARIES_PATH}/${libraryKey}/deleted_expressions/${exp.id}`] = { ...exp, deletedAt: serverTimestamp() };
        });
        
        await update(ref(database), updates);
    }
};

// --- HELPER FUNCTIONS ---

const extractBase64FromResponse = (response: any): string => {
  const part = response.candidates?.[0]?.content?.parts?.[0];
  if (part && part.inlineData && part.inlineData.data) {
    return part.inlineData.data;
  }
  throw new Error("Could not find image data in Gemini response.");
};

const getSimilarityInstruction = (similarity: number, context: 'style' | 'style-and-pose'): string => {
    const target = context === 'style' ? 'the style of the reference image' : 'the style and pose of the reference image';
    if (similarity <= 25) {
        return `be very loosely inspired by ${target}`;
    } else if (similarity <= 50) {
        return `take some creative inspiration from ${target}`;
    } else if (similarity <= 75) {
        return `adhere to ${target}`;
    } else {
        return `very closely match ${target}`;
    }
};

// --- API SERVICE FUNCTIONS ---

export interface ValidationResult {
  isChibi: boolean;
  isSolo: boolean;
  reason: string;
}

export const validateImage = async (base64Image: string, mimeType: string): Promise<ValidationResult> => {
    const ai = await getAiClient();
    const prompt = `Analyze the provided image and determine two things: 1. Is the image in a 'chibi' art style (characterized by small bodies, large heads, and cute features)? 2. Does the image contain only a single character (a solo photo)? Provide a brief reason for your determination. Respond in JSON format.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Image,
                mimeType: mimeType,
              },
            },
            {
              text: prompt,
            },
          ],
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    isChibi: {
                        type: Type.BOOLEAN,
                        description: "True if the character is in a chibi art style."
                    },
                    isSolo: {
                        type: Type.BOOLEAN,
                        description: "True if the image contains only one character."
                    },
                    reason: {
                        type: Type.STRING,
                        description: "A brief explanation for the determination."
                    }
                },
                required: ["isChibi", "isSolo", "reason"]
            }
        },
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText) as ValidationResult;
};

export const generateCharacterFromText = async (
    prompt: string, 
    referenceImage?: Base64File, 
    similarity: number = 75
): Promise<string> => {
    const ai = await getAiClient();
    
    let fullPrompt = `Generate a full-body, forward-facing chibi character based on the following description: "${prompt}". The character should have a neutral expression. The background must be a solid white color (#FFFFFF). The final image must be a square with a 1:1 aspect ratio. The art style should be clean, with clear lines and vibrant colors.`;

    const parts: any[] = [];

    if (referenceImage) {
        const similarityInstruction = getSimilarityInstruction(similarity, 'style');
        fullPrompt += ` Use the provided image as an artistic reference. The final character should ${similarityInstruction}.`;
        parts.push({
            inlineData: {
                data: referenceImage.base64,
                mimeType: referenceImage.mimeType,
            },
        });
    }

    parts.push({ text: fullPrompt });

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });

    const generatedBase64 = extractBase64FromResponse(response);
    
    const generatedBlob = base64ToBlob(generatedBase64, 'image/png');
    await logImage(generatedBlob, 'text-to-image-base');
    
    return generatedBase64;
};


export const generateChibiCharacter = async (base64Image: string, mimeType: string, emotionPrompt: string, referenceImage?: Base64File, similarity: number = 75): Promise<string> => {
  const ai = await getAiClient();
  let prompt = `Analyze the character in the first provided image. Recreate this character in a clean, consistent, and appealing chibi art style suitable for expressions. The character should have a "${emotionPrompt}" expression and be facing forward. Maintain all key design elements, colors, and clothing. The background must be solid white. The final image must be a square with a 1:1 aspect ratio.`;
  
  const parts: any[] = [{
    inlineData: {
      data: base64Image,
      mimeType: mimeType,
    },
  }];

  if (referenceImage) {
    const similarityInstruction = getSimilarityInstruction(similarity, 'style');
    prompt += ` Use the second provided image as an artistic reference. The final character should ${similarityInstruction} while retaining the core features of the main character.`;
    parts.push({
      inlineData: {
        data: referenceImage.base64,
        mimeType: referenceImage.mimeType,
      },
    });
  }
  
  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts },
    config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
    },
  });
  
  const chibiImage = extractBase64FromResponse(response);
  const generatedBlob = base64ToBlob(chibiImage, 'image/png');
  await logImage(generatedBlob, 'chibi-generation');
  return chibiImage;
};

export const generateExpression = async (baseCharacterImage: string, mimeType: string, expressionPrompt: string, referenceImage?: Base64File, similarity: number = 75): Promise<string> => {
    const ai = await getAiClient();
    let prompt = `Using the first image as the base character, generate a new expression. The character should now have the following expression or pose: "${expressionPrompt}". Make the expression very clear and expressive. IMPORTANT: You MUST strictly preserve the character's unique design, colors, and the established art style from the base image. Only the facial expression and body pose should change to match the request. The background must be solid white. The final image must be a square with a 1:1 aspect ratio.`;

    const parts: any[] = [{
        inlineData: {
            data: baseCharacterImage,
            mimeType: mimeType,
        },
    }];

    if (referenceImage) {
        const similarityInstruction = getSimilarityInstruction(similarity, 'style-and-pose');
        prompt += ` The second image is a reference. For this generation, you should ${similarityInstruction}.`;
        
        parts.push({
            inlineData: {
                data: referenceImage.base64,
                mimeType: referenceImage.mimeType,
            },
        });
    }

    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });

    const generatedImage = extractBase64FromResponse(response);
    const generatedBlob = base64ToBlob(generatedImage, 'image/png');
    await logImage(generatedBlob, 'expression-generation');
    return generatedImage;
};