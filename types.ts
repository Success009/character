
export interface Base64File {
    base64: string;
    mimeType: string;
}

export interface Expression {
  id: string;
  name: string;
  image: string; // This will be the public download URL
  storagePath: string; // The path in Firebase Storage
  isFavorite: boolean;
}