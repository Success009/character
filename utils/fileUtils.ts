import type { Base64File } from '../types';

export const blobToBase64 = (blob: Blob): Promise<Base64File & { dataUrl: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      const mimeType = dataUrl.split(';')[0].split(':')[1];
      if (base64 && mimeType) {
        resolve({ base64, mimeType, dataUrl });
      } else {
        reject(new Error('Failed to parse blob data.'));
      }
    };
    reader.onerror = (error) => reject(error);
  });
};


export const fileToBase64 = (file: File): Promise<Base64File & { dataUrl: string }> => {
  return blobToBase64(file);
};

export const base64ToBlob = (base64: string, mimeType: string): Blob => {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
};

export const compressImage = (file: Blob, quality: number = 0.75, type: string = 'image/jpeg'): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.src = url;
    
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        return reject(new Error('Could not get canvas context'));
      }
      
      ctx.drawImage(image, 0, 0);
      
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas to Blob conversion failed'));
          }
        },
        type,
        quality
      );
    };
    
    image.onerror = (error) => {
      URL.revokeObjectURL(url);
      reject(error);
    };
  });
};