
import React, { useContext, useState } from 'react';
import { TokenProvider, TokenContext } from './contexts/TokenContext';
import { LibraryProvider, LibraryContext } from './contexts/LibraryContext';
import UploadScreen from './components/UploadScreen';
import ConfirmationScreen from './components/ConfirmationScreen';
import GeneratorScreen from './components/GeneratorScreen';
import TokenScreen from './components/TokenScreen';
import LibraryKeyScreen from './components/LibraryKeyScreen';
import { RefreshIcon } from './components/Icons';
import { useLocalStorage } from './hooks/useLocalStorage';

const AppContent: React.FC = () => {
  const { isValidated, uses, clearToken, isLoading: isTokenLoading } = useContext(TokenContext);
  const { libraryKey, hasChosenMode, clearLibraryKey } = useContext(LibraryContext);

  const [baseCharacterImage, setBaseCharacterImage, clearBaseCharacterImage] = useLocalStorage<string | null>('baseCharacterImage', null);
  const [baseCharacterName, setBaseCharacterName, clearBaseCharacterName] = useLocalStorage<string>('baseCharacterName', 'Base Character');
  
  // Fix: Add useState import from react
  const [mainFile, setMainFile] = useState<File | null>(null);
  const [candidateImage, setCandidateImage] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleReset = React.useCallback(() => {
    clearBaseCharacterImage();
    clearBaseCharacterName();
    setCandidateImage(null);
    setMainFile(null);
    setError(null);
  }, [clearBaseCharacterImage, clearBaseCharacterName]);
  
  if (!isValidated || isTokenLoading) {
    return <TokenScreen />;
  }

  if (!hasChosenMode) {
      return <LibraryKeyScreen />;
  }

  const renderAppContent = () => {
    if (baseCharacterImage) {
      return (
        <GeneratorScreen
          baseCharacterImage={baseCharacterImage}
          baseCharacterName={baseCharacterName}
          onSetBaseCharacterName={setBaseCharacterName}
          onReset={handleReset}
          onSetBase={setBaseCharacterImage}
        />
      );
    }
    if (candidateImage && !isLoading) {
      return (
        <ConfirmationScreen
          candidateImage={candidateImage}
          onConfirm={() => {
            if (candidateImage) {
              setBaseCharacterImage(candidateImage);
              setCandidateImage(null);
              setMainFile(null);
            }
          }}
          onTryAgain={() => {
            setCandidateImage(null);
            setError(null);
          }}
        />
      );
    }
    return (
      <UploadScreen
        isLoading={isLoading}
        setIsLoading={setIsLoading}
        error={error}
        setError={setError}
        mainFile={mainFile}
        onMainFileChange={setMainFile}
        setCandidateImage={setCandidateImage}
        setBaseCharacterName={setBaseCharacterName}
      />
    );
  };

  return (
    <div className="min-h-screen bg-[#110d24] bg-gradient-to-br from-[#1a103c] to-[#110d24] text-gray-200 font-sans selection:bg-purple-500 selection:text-white">
      <header className="bg-black/20 backdrop-blur-lg p-4 shadow-lg sticky top-0 z-50 border-b border-purple-500/10">
        <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
            <div className="flex items-center gap-4">
              <img src="https://raw.githubusercontent.com/Success009/portfolio/refs/heads/main/logo.png" alt="Logo" className="h-10 w-10 md:h-12 md:w-12 rounded-full border-2 border-purple-500/50" />
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-left bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 text-transparent bg-clip-text animate-fade-in">
                Success's Expression Creator
              </h1>
            </div>
            <div className="flex items-center gap-3 text-sm">
                <div className="text-right">
                    <span className="font-bold text-purple-300">{uses}</span>
                    <span className="text-purple-300/60"> uses left</span>
                </div>
                <button onClick={clearToken} className="p-2 rounded-full bg-purple-500/10 hover:bg-purple-500/20 transition-colors" title="Change Token">
                    <RefreshIcon className="w-4 h-4 text-purple-300" />
                </button>
            </div>
        </div>
      </header>
      <main className="p-4 sm:p-6 md:p-8 max-w-[90rem] mx-auto">
        {renderAppContent()}
      </main>
       <footer className="text-center p-6 text-purple-300/50 text-xs sm:text-sm">
          <p>© 2024 Success's Expression Creator. All Rights Reserved.</p>
       </footer>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <TokenProvider>
      <LibraryProvider>
        <AppContent />
      </LibraryProvider>
    </TokenProvider>
  )
}

export default App;