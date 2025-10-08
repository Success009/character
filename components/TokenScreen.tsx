import React, { useState, useContext } from 'react';
import { TokenContext } from '../contexts/TokenContext';
import Spinner from './Spinner';

const TokenScreen: React.FC = () => {
  const { setToken, isLoading, error } = useContext(TokenContext);
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      setToken(inputValue.trim());
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 animate-fade-in-up">
      <div className="w-full max-w-md text-center">
        <div className="bg-black/20 backdrop-blur-lg rounded-2xl p-8 shadow-2xl shadow-purple-900/10 border border-purple-500/20">
          <img src="https://raw.githubusercontent.com/Success009/portfolio/refs/heads/main/logo.png" alt="Logo" className="h-20 w-20 rounded-full border-2 border-purple-500/50 mx-auto mb-6" />
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 text-transparent bg-clip-text">
            Enter Your Token
          </h1>
          <p className="text-purple-300/70 mb-8">Please enter a valid token to access the Expression Creator.</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Your token here..."
              className="w-full bg-black/20 border border-purple-500/30 rounded-lg p-4 text-center text-lg focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all duration-300 placeholder:text-purple-300/40 tracking-wider"
              aria-label="Access Token"
              disabled={isLoading}
              autoFocus
            />
            
            {error && (
              <p className="text-red-300 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20 animate-fade-in">{error}</p>
            )}

            <button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-3 px-4 rounded-lg hover:shadow-lg hover:shadow-purple-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2 transform active:scale-95 hover:scale-[1.02]"
            >
              {isLoading ? (
                <>
                  <Spinner size="sm" />
                  <span>Validating...</span>
                </>
              ) : (
                'Unlock'
              )}
            </button>
          </form>
        </div>
        <footer className="text-center p-6 text-purple-300/50 text-xs sm:text-sm">
          <p>© 2024 Success's Expression Creator. All Rights Reserved.</p>
        </footer>
      </div>
    </div>
  );
};

export default TokenScreen;
