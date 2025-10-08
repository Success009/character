import React from 'react';
import { RefreshIcon, CheckIcon, DownloadIcon } from './Icons';

interface ConfirmationScreenProps {
  candidateImage: string;
  onConfirm: () => void;
  onTryAgain: () => void;
}

const ConfirmationScreen: React.FC<ConfirmationScreenProps> = ({ candidateImage, onConfirm, onTryAgain }) => {
  return (
    <div className="max-w-3xl mx-auto text-center animate-fade-in-up">
      <div className="bg-black/20 backdrop-blur-lg rounded-2xl p-6 md:p-10 shadow-2xl shadow-purple-900/10 border border-purple-500/20">
        <h2 className="text-2xl md:text-3xl font-bold mb-4">Step 2: Confirm Your Base Character</h2>
        <p className="text-purple-300/70 mb-8 max-w-xl mx-auto">Here's the generated chibi character. If you're happy with it, confirm it to start creating expressions. Otherwise, you can go back and try again.</p>
        
        <div className="w-64 h-64 bg-purple-500/10 rounded-xl overflow-hidden flex items-center justify-center p-2 shadow-inner ring-1 ring-purple-500/20 mx-auto mt-4">
          <img src={candidateImage} alt="Generated Chibi Character" className="object-contain max-w-full max-h-full" />
        </div>

        <div className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-4">
          <button onClick={onTryAgain} className="w-full sm:w-auto flex items-center justify-center gap-2 py-3 px-6 rounded-lg bg-gray-500/20 hover:bg-gray-500/40 text-white transition-colors duration-300">
            <RefreshIcon className="w-5 h-5" /> Try Again
          </button>
          <button onClick={onConfirm} className="w-full sm:w-auto flex items-center justify-center gap-2 py-3 px-6 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold hover:shadow-lg hover:shadow-purple-500/40 transition-all duration-300 transform active:scale-95 hover:scale-[1.02]">
            <CheckIcon className="w-5 h-5" /> Confirm & Use as Base
          </button>
        </div>
        
        <div className="mt-6 flex justify-center">
            <a href={candidateImage} download="my_chibi_character.png" className="text-sm flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-green-500/20 text-green-300 hover:bg-green-500/30 transition-all">
              <DownloadIcon className="w-4 h-4" /> Download Preview
            </a>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationScreen;