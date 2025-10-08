import React, { useState, useEffect } from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  confirmationText?: string;
  children: React.ReactNode;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, confirmationText, children }) => {
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    // Reset input when modal opens
    if (isOpen) {
      setInputValue(''); 
    }
  }, [isOpen]);
  
  if (!isOpen) return null;

  const isConfirmed = !confirmationText || (inputValue.toLowerCase() === confirmationText.toLowerCase());

  const handleConfirmClick = () => {
    if (isConfirmed) {
      onConfirm();
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="confirmation-modal-title">
      <div className="bg-[#1a103c] border border-red-500/30 rounded-2xl shadow-2xl p-6 md:p-8 max-w-md w-full animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
        <h3 id="confirmation-modal-title" className="text-2xl font-bold text-red-300 mb-4">{title}</h3>
        <div className="text-purple-300/80 space-y-4 mb-6">
          {children}
          {confirmationText && (
            <>
              <p>To confirm, please type the following phrase:</p>
              <p className="font-mono bg-black/30 text-pink-400 p-2 rounded-md text-center tracking-wider" aria-label={`Confirmation phrase: ${confirmationText}`}>{confirmationText}</p>
            </>
          )}
        </div>
        {confirmationText && (
            <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && isConfirmed && handleConfirmClick()}
            className="w-full bg-black/20 border border-purple-500/30 rounded-lg p-3 text-center focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all duration-300 placeholder:text-purple-300/40 mb-6"
            aria-label="Confirmation input"
            autoFocus
          />
        )}
        <div className="flex justify-end gap-4">
          <button onClick={onClose} className="py-2 px-4 rounded-lg bg-gray-500/20 hover:bg-gray-500/40 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleConfirmClick}
            disabled={!isConfirmed}
            className="py-2 px-4 rounded-lg bg-red-500 text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95 hover:bg-red-600"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;