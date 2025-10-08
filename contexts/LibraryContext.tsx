import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Expression } from '../types';
import { 
    generateNewLibraryKey, 
    getExpressionsRef,
    addExpressionToLibrary,
    updateExpressionInLibrary,
    moveExpressionToDeleted,
    clearAllExpressions
} from '../services/geminiService';
import { onValue, off } from "firebase/database";

// --- TYPES ---
interface LibraryContextType {
  libraryKey: string | null;
  expressions: Expression[];
  hasChosenMode: boolean;
  isLoading: boolean;
  error: string | null;
  setLibraryKey: (key: string) => void;
  createAndSetLibraryKey: () => Promise<void>;
  clearLibraryKey: () => void;
  setHasChosenMode: (hasChosen: boolean) => void;
  addExpression: (expression: Expression) => void;
  updateExpression: (expression: Expression) => void;
  deleteExpression: (id: string) => void;
  clearLibrary: () => void;
}

// --- CONTEXT ---
export const LibraryContext = createContext<LibraryContextType>({
    libraryKey: null,
    expressions: [],
    hasChosenMode: false,
    isLoading: true,
    error: null,
    setLibraryKey: () => {},
    createAndSetLibraryKey: async () => {},
    clearLibraryKey: () => {},
    setHasChosenMode: () => {},
    addExpression: () => {},
    updateExpression: () => {},
    deleteExpression: () => {},
    clearLibrary: () => {},
});


// --- PROVIDER ---
interface LibraryProviderProps {
  children: ReactNode;
}

export const LibraryProvider: React.FC<LibraryProviderProps> = ({ children }) => {
  const [libraryKey, setLibraryKeyInStorage, clearLibraryKeyInStorage] = useLocalStorage<string | null>('library-key', null);
  const [localExpressions, setLocalExpressions] = useLocalStorage<Expression[]>('expressionHistory', []);
  const [cloudExpressions, setCloudExpressions] = useState<Expression[]>([]);
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // This state tracks if the user has passed the LibraryKeyScreen
  const [hasChosenMode, setHasChosenMode] = useState<boolean>(!!libraryKey);

  const isCloudMode = !!libraryKey;

  useEffect(() => {
    // If we have a library key, we have chosen a mode.
    if (libraryKey) {
      setHasChosenMode(true);
    }
    
    // Firebase real-time listener
    if (isCloudMode) {
      setIsLoading(true);
      const expressionsRef = getExpressionsRef(libraryKey);
      
      const listener = onValue(expressionsRef, (snapshot) => {
          const data = snapshot.val();
          const expressionsArray: Expression[] = data ? Object.values(data) : [];
          setCloudExpressions(expressionsArray);
          setIsLoading(false);
      }, (err) => {
          console.error(err);
          setError("Failed to connect to the library.");
          setIsLoading(false);
      });

      return () => off(expressionsRef, 'value', listener);
    } else {
      // Not cloud mode, so we are not loading from the cloud.
      setIsLoading(false);
    }
  }, [isCloudMode, libraryKey]);
  
  const setLibraryKey = useCallback((key: string) => {
    setLibraryKeyInStorage(key);
    setHasChosenMode(true);
  }, [setLibraryKeyInStorage]);

  const createAndSetLibraryKey = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
        const newKey = await generateNewLibraryKey();
        setLibraryKeyInStorage(newKey);
        setHasChosenMode(true);
    } catch (err) {
        console.error(err);
        setError("Could not create a new library key. Please try again.");
    } finally {
        setIsLoading(false);
    }
  }, [setLibraryKeyInStorage]);

  const clearLibraryKey = useCallback(() => {
    clearLibraryKeyInStorage();
    setCloudExpressions([]);
    setHasChosenMode(false); // Go back to the key selection screen
  }, [clearLibraryKeyInStorage]);

  const addExpression = useCallback(async (expression: Expression) => {
    if (isCloudMode) {
        await addExpressionToLibrary(libraryKey, expression);
    } else {
        setLocalExpressions(prev => [expression, ...prev]);
    }
  }, [isCloudMode, libraryKey, setLocalExpressions]);

  const updateExpression = useCallback((expression: Expression) => {
      if (isCloudMode) {
          updateExpressionInLibrary(libraryKey, expression);
      } else {
          setLocalExpressions(prev => prev.map(exp => exp.id === expression.id ? expression : exp));
      }
  }, [isCloudMode, libraryKey, setLocalExpressions]);
  
  const deleteExpression = useCallback((id: string) => {
      if (isCloudMode) {
          moveExpressionToDeleted(libraryKey, id);
      } else {
          setLocalExpressions(prev => prev.filter(exp => exp.id !== id));
      }
  }, [isCloudMode, libraryKey, setLocalExpressions]);

  const clearLibrary = useCallback(() => {
    if (isCloudMode) {
        clearAllExpressions(libraryKey);
    } else {
        setLocalExpressions([]);
    }
  }, [isCloudMode, libraryKey, setLocalExpressions]);


  const value = {
    libraryKey,
    expressions: isCloudMode ? cloudExpressions : localExpressions,
    hasChosenMode,
    isLoading,
    error,
    setLibraryKey,
    createAndSetLibraryKey,
    clearLibraryKey,
    setHasChosenMode,
    addExpression,
    updateExpression,
    deleteExpression,
    clearLibrary,
  };

  return (
    <LibraryContext.Provider value={value}>
      {children}
    </LibraryContext.Provider>
  );
};