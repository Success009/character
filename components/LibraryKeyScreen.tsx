
import React, { useState, useContext } from 'react';
import Spinner from './Spinner';
import { LibraryContext } from '../contexts/LibraryContext';
import { KeyIcon, UploadIcon } from './Icons';

const LibraryKeyScreen: React.FC = () => {
    const { setLibraryKey, createAndSetLibraryKey, setHasChosenMode, isLoading, error } = useContext(LibraryContext);
    const [inputValue, setInputValue] = useState('');

    const handleLoadSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputValue.trim()) {
            setLibraryKey(inputValue.trim());
        }
    };
    
    const handleCreateNew = async () => {
        await createAndSetLibraryKey();
    };

    const handleContinueLocal = () => {
        setHasChosenMode(true);
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 animate-fade-in-up">
            <div className="w-full max-w-lg text-center">
                <div className="bg-black/20 backdrop-blur-lg rounded-2xl p-8 shadow-2xl shadow-purple-900/10 border border-purple-500/20">
                    <KeyIcon className="h-16 w-16 text-purple-400 mx-auto mb-6" />
                    <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 text-transparent bg-clip-text">
                        Your Expression Library
                    </h1>
                    <p className="text-purple-300/70 mb-8">
                        Enter a key to load your synced cloud library, or create a new one to get started.
                    </p>

                    <form onSubmit={handleLoadSubmit} className="space-y-4">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="Enter your library key..."
                            className="w-full bg-black/20 border border-purple-500/30 rounded-lg p-4 text-center text-lg focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all duration-300 placeholder:text-purple-300/40 tracking-wider"
                            aria-label="Library Key"
                            disabled={isLoading}
                            autoFocus
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !inputValue.trim()}
                            className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold py-3 px-4 rounded-lg hover:shadow-lg hover:shadow-blue-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2 transform active:scale-95 hover:scale-[1.02]"
                        >
                            {isLoading ? <Spinner size="sm" /> : <UploadIcon className="w-5 h-5" />}
                            Load Library
                        </button>
                    </form>

                    <div className="my-6 flex items-center gap-4">
                        <hr className="flex-grow border-purple-500/20" />
                        <span className="text-purple-300/60">OR</span>
                        <hr className="flex-grow border-purple-500/20" />
                    </div>

                    <button
                        onClick={handleCreateNew}
                        disabled={isLoading}
                        className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-3 px-4 rounded-lg hover:shadow-lg hover:shadow-purple-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2 transform active:scale-95 hover:scale-[1.02]"
                    >
                        {isLoading ? (
                            <>
                                <Spinner size="sm" />
                                <span>Creating...</span>
                            </>
                        ) : (
                           "Create New Cloud Library"
                        )}
                    </button>
                    
                    {error && (
                        <p className="text-red-300 mt-4 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20 animate-fade-in">{error}</p>
                    )}

                    <button onClick={handleContinueLocal} className="mt-8 text-sm text-purple-300/60 hover:text-purple-300 transition-colors">
                        Continue with a local library (this device only)
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LibraryKeyScreen;
