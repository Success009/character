import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { validateToken, decrementTokenUses } from '../services/geminiService';

interface TokenContextType {
  token: string | null;
  uses: number;
  isValidated: boolean;
  isLoading: boolean;
  error: string | null;
  setToken: (token: string) => void;
  clearToken: () => void;
  decrementUses: () => void;
}

export const TokenContext = createContext<TokenContextType>({
  token: null,
  uses: 0,
  isValidated: false,
  isLoading: true,
  error: null,
  setToken: () => {},
  clearToken: () => {},
  decrementUses: () => {},
});

interface TokenProviderProps {
  children: ReactNode;
}

export const TokenProvider: React.FC<TokenProviderProps> = ({ children }) => {
  const [token, setTokenInStorage, clearTokenInStorage] = useLocalStorage<string | null>('user-token', null);
  const [uses, setUses] = useState<number>(0);
  const [isValidated, setIsValidated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const validate = useCallback(async (tokenToValidate: string | null) => {
    if (!tokenToValidate) {
      setIsValidated(false);
      setIsLoading(false);
      setError(null);
      setUses(0);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await validateToken(tokenToValidate);
      if (result !== null && result.uses > 0) {
        setUses(result.uses);
        setIsValidated(true);
      } else if (result !== null && result.uses <= 0) {
        setUses(0);
        setIsValidated(false);
        setError("This token has expired. Please enter a new one.");
        clearTokenInStorage();
      } else {
        setUses(0);
        setIsValidated(false);
        setError("Invalid token. Please check and try again.");
        clearTokenInStorage();
      }
    } catch (err: any) {
      setUses(0);
      setIsValidated(false);
      setError(err.message || "An error occurred during validation.");
      clearTokenInStorage();
    } finally {
      setIsLoading(false);
    }
  }, [clearTokenInStorage]);

  useEffect(() => {
    validate(token);
  }, [token, validate]);

  const setToken = useCallback((newToken: string) => {
    setTokenInStorage(newToken);
  }, [setTokenInStorage]);

  const clearToken = useCallback(() => {
    clearTokenInStorage();
    setUses(0);
    setIsValidated(false);
    setError(null);
  }, [clearTokenInStorage]);

  const decrementUses = useCallback(async () => {
    if (!token) return;
    try {
        const { uses: newUses } = await decrementTokenUses(token);
        setUses(newUses);
        if (newUses <= 0) {
            setError("Your token has expired. Please enter a new one to continue.");
            clearToken();
        }
    } catch (err: any) {
        setError(err.message || 'Failed to update token usage.');
    }
  }, [token, clearToken]);

  const value = {
    token,
    uses,
    isValidated,
    isLoading,
    error,
    setToken,
    clearToken,
    decrementUses,
  };

  return (
    <TokenContext.Provider value={value}>
      {children}
    </TokenContext.Provider>
  );
};
