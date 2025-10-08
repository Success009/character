import React, { useState, useCallback, useEffect, useMemo, useContext } from 'react';
import { generateExpression, logUpload } from '../services/geminiService';
import Spinner from './Spinner';
import { DownloadIcon, RefreshIcon, CopyIcon, TrashIcon, SwapIcon, CheckIcon, PencilIcon, StarIcon, SettingsIcon, UploadIcon, CloseIcon, LogoutIcon, KeyIcon } from './Icons';
import ConfirmationModal from './ConfirmationModal';
import { Expression, Base64File } from '../types';
import { fileToBase64, blobToBase64 } from '../utils/fileUtils';
import { TokenContext } from '../contexts/TokenContext';
import { LibraryContext } from '../contexts/LibraryContext';
// Fix: Import useLocalStorage hook
import { useLocalStorage } from '../hooks/useLocalStorage';

// --- PROPS INTERFACES ---
interface GeneratorScreenProps {
  baseCharacterImage: string;
  baseCharacterName: string;
  onSetBaseCharacterName: (name: string) => void;
  onReset: () => void;
  onSetBase: (image: string) => void;
}

interface ControlPanelProps {
  baseCharacterImage: string;
  baseCharacterName: string;
  onSetBaseCharacterName: (name: string) => void;
  onReset: () => void;
  prompt: string;
  onPromptChange: (value: string) => void;
  onGenerate: () => void;
  isLoading: boolean;
  error: string | null;
  referenceFile: File | null;
  referencePreview: string | null;
  onReferenceFileChange: (file: File | null) => void;
  similarity: number;
  onSimilarityChange: (value: number) => void;
}

interface ExpressionItemProps {
  expression: Expression;
  copiedId: string | null;
  onToggleFavorite: (id: string) => void;
  onCopy: (image: string, id: string) => void;
  onSetAsBase: (expression: Expression) => void;
  onDelete: (expression: Expression) => void;
  onRename: (expression: Expression) => void;
}

// --- UTILITY FUNCTIONS ---
const copyImageToClipboard = async (imageUrl: string): Promise<boolean> => {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    if (navigator.clipboard && navigator.clipboard.write) {
       await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob,
        }),
      ]);
      return true;
    }
    console.warn('Clipboard API not available. This may be due to an insecure context (HTTP).');
    return false;
  } catch (error) {
    console.error('Failed to copy image:', error);
    return false;
  }
};

const copyTextToClipboard = async (text: string): Promise<boolean> => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        console.error('Failed to copy text:', error);
        return false;
    }
}

// --- MEMOIZED SUB-COMPONENTS ---

const ControlPanel = React.memo(({
  baseCharacterImage, baseCharacterName, onSetBaseCharacterName, onReset, prompt, onPromptChange,
  onGenerate, isLoading, error, referenceFile, referencePreview, onReferenceFileChange, similarity, onSimilarityChange
}: ControlPanelProps) => {
  const { uses } = useContext(TokenContext);
  const { libraryKey, clearLibraryKey } = useContext(LibraryContext);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(baseCharacterName);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isKeyCopied, setIsKeyCopied] = useState(false);
  const refInputRef = React.useRef<HTMLInputElement>(null);

  const handleNameSave = () => {
    if (tempName.trim()) {
      onSetBaseCharacterName(tempName.trim());
    }
    setIsEditingName(false);
  };

  const handleCopyKey = () => {
    if (!libraryKey) return;
    copyTextToClipboard(libraryKey).then(success => {
        if (success) {
            setIsKeyCopied(true);
            setTimeout(() => setIsKeyCopied(false), 2000);
        }
    });
  };

  return (
    <div className="w-full flex flex-col gap-6">
      <div className="bg-black/20 backdrop-blur-lg p-6 rounded-2xl shadow-2xl shadow-purple-900/10 border border-purple-500/20">
        <div className="flex items-center justify-center gap-2 group">
          {isEditingName ? (
            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
              className="text-xl font-bold bg-black/40 border border-purple-500/50 rounded p-1 text-center focus:ring-1 focus:ring-purple-400 w-full"
              autoFocus
            />
          ) : (
            <>
              <h2 className="text-xl font-bold truncate" title={baseCharacterName}>{baseCharacterName}</h2>
              <button onClick={() => { setIsEditingName(true); setTempName(baseCharacterName); }} className="shrink-0 text-purple-400/60 opacity-0 group-hover:opacity-100 transition-opacity">
                <PencilIcon className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
        <div className="w-40 h-40 md:w-48 md:h-48 bg-purple-500/10 rounded-xl overflow-hidden flex items-center justify-center p-2 shadow-inner ring-1 ring-purple-500/20 mx-auto mt-4">
          <img src={baseCharacterImage} alt="Base Character" className="object-contain max-w-full max-h-full" />
        </div>
        <div className="flex items-stretch justify-center gap-3 mt-4">
            <a href={baseCharacterImage} download={`${baseCharacterName.replace(/\s/g, '_')}_base.png`} className="flex-grow text-sm flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-green-500/80 hover:bg-green-500 text-white transition-all transform active:scale-95">
                <DownloadIcon className="w-4 h-4" /> Download
            </a>
            <button onClick={onReset} className="flex-grow text-sm flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-purple-500/20 text-purple-300/80 hover:bg-purple-500/30 transition-colors">
                <RefreshIcon className="w-4 h-4" /> Start Over
            </button>
        </div>
      </div>

      <div className="bg-black/20 backdrop-blur-lg p-6 rounded-2xl shadow-2xl shadow-purple-900/10 border border-purple-500/20">
        <h2 className="text-xl font-bold mb-3">Generate Expressions</h2>
        <p className="text-purple-300/70 mb-5 text-sm">Describe an emotion, pose, or reaction, and the AI will create it for you.</p>
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="e.g., furious with puffed cheeks, overjoyed with sparkling eyes..."
          className="w-full bg-black/20 border border-purple-500/30 rounded-lg p-3 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all duration-300 h-28 resize-none placeholder:text-purple-300/40 text-sm"
          rows={3}
        />
        <div className="mt-4">
          <p className="text-sm font-semibold text-center text-purple-300/80 mb-2">Reference (Optional)</p>
          <div className="flex items-center justify-center gap-4">
            {referencePreview && (
              <div className="relative group">
                <img src={referencePreview} alt="Reference preview" className="w-16 h-16 rounded-lg object-cover" />
                <button onClick={() => onReferenceFileChange(null)} className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  <CloseIcon className="w-4 h-4" />
                </button>
              </div>
            )}
            <input ref={refInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => onReferenceFileChange(e.target.files?.[0] || null)} />
            <button onClick={() => refInputRef.current?.click()} className="cursor-pointer flex items-center gap-2 py-2 px-4 rounded-lg bg-purple-500/20 border border-purple-500/40 hover:bg-purple-500/30 transition-colors">
              <UploadIcon className="w-5 h-5" />
              {referenceFile ? 'Change' : 'Upload'}
            </button>
          </div>
        </div>
        <div className="mt-4">
          <button onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center justify-center gap-2 text-sm w-full text-purple-300/70 hover:text-white transition-colors">
            <SettingsIcon className="w-4 h-4" /> Advanced Settings
          </button>
          {showAdvanced && (
            <div className="mt-4 space-y-3 p-4 bg-black/20 rounded-lg animate-fade-in">
              <label htmlFor="similarity" className="block text-sm font-medium text-gray-300">Similarity to Reference</label>
              <p className="text-xs text-purple-300/60 -mt-2">How closely should the AI follow the reference?</p>
              <input
                id="similarity" type="range" min="0" max="100" value={similarity}
                onChange={(e) => onSimilarityChange(parseInt(e.target.value))}
                className="w-full h-2 bg-purple-500/20 rounded-lg appearance-none cursor-pointer accent-pink-500"
                disabled={!referenceFile}
              />
              <div className="flex justify-between text-xs text-purple-300/50">
                <span>Loose</span>
                <span>Exact</span>
              </div>
            </div>
          )}
        </div>
        <button
          onClick={onGenerate} disabled={isLoading || !prompt.trim() || uses <= 0}
          className="mt-4 w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-3 px-4 rounded-lg hover:shadow-lg hover:shadow-purple-500/40 transition-all duration-300 disabled:from-gray-500 disabled:to-gray-600 disabled:shadow-none disabled:cursor-not-allowed flex items-center justify-center gap-2 transform active:scale-95 hover:scale-[1.02]"
        >
          {isLoading ? 'Generating...' : (uses > 0 ? 'Generate' : 'No uses left')}
        </button>
        {error && <p className="text-red-300 mt-4 text-center text-sm">{error}</p>}
      </div>

       <div className="bg-black/20 backdrop-blur-lg p-4 rounded-2xl shadow-lg border border-purple-500/20 text-sm">
            <div className="flex items-center gap-2 text-purple-300/80 mb-2">
                <KeyIcon className="w-5 h-5"/>
                <h3 className="font-semibold">{libraryKey ? 'Cloud Library' : 'Local Library'}</h3>
            </div>
            {libraryKey ? (
                <>
                    <div className="flex items-center gap-2">
                        <input type="text" readOnly value={libraryKey} className="w-full bg-black/40 border border-purple-500/30 rounded-md p-2 text-xs text-purple-300/70 select-all" />
                        <button onClick={handleCopyKey} className="p-2 bg-purple-500/20 rounded-md hover:bg-purple-500/30">
                            {isKeyCopied ? <CheckIcon className="w-4 h-4 text-green-400"/> : <CopyIcon className="w-4 h-4 text-purple-300"/>}
                        </button>
                    </div>
                    <button onClick={clearLibraryKey} className="mt-2 w-full text-center text-purple-300/60 hover:text-purple-300 text-xs flex items-center justify-center gap-1.5 transition-colors">
                        <LogoutIcon className="w-3 h-3"/> Switch Library
                    </button>
                </>
            ) : (
                <>
                    <p className="text-purple-300/60 text-xs mb-2">Your library is saved on this device only.</p>
                    <button onClick={clearLibraryKey} className="w-full text-center text-purple-300/80 hover:text-purple-300 font-semibold flex items-center justify-center gap-2 transition-colors">
                         <KeyIcon className="w-4 h-4"/> Connect to Cloud Library
                    </button>
                </>
            )}
       </div>
    </div>
  );
});

const ExpressionItem = React.memo(({ expression, copiedId, onToggleFavorite, onCopy, onSetAsBase, onDelete, onRename }: ExpressionItemProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(expression.name);

    const handleSaveName = () => {
        onRename({ ...expression, name: name.trim() || "Untitled" });
        setIsEditing(false);
    };

    return (
      <div className="animate-fade-in flex flex-col">
        <div className="group relative aspect-square">
          <img src={expression.image} alt={expression.name} className="w-full h-full object-contain bg-white/5 rounded-lg" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg flex items-end justify-center gap-1 p-2">
            <button onClick={() => onToggleFavorite(expression.id)} className="p-2 rounded-full bg-yellow-500/80 hover:bg-yellow-500 text-white transition-all transform hover:scale-110" title="Favorite">
              <StarIcon filled={expression.isFavorite} className="w-5 h-5" />
            </button>
            <a href={expression.image} target="_blank" rel="noopener noreferrer" download={`${expression.name.replace(/\s/g, '_')}.png`} className="p-2 rounded-full bg-green-500/80 hover:bg-green-500 text-white transition-all transform hover:scale-110" title="Download">
              <DownloadIcon className="w-5 h-5" />
            </a>
            <button onClick={() => onCopy(expression.image, expression.id)} className="p-2 rounded-full bg-blue-500/80 hover:bg-blue-500 text-white transition-all transform hover:scale-110" title="Copy Image">
              {copiedId === expression.id ? <CheckIcon className="w-5 h-5" /> : <CopyIcon className="w-5 h-5" />}
            </button>
            <button onClick={() => onSetAsBase(expression)} className="p-2 rounded-full bg-purple-500/80 hover:bg-purple-500 text-white transition-all transform hover:scale-110" title="Set as Base">
              <SwapIcon className="w-5 h-5" />
            </button>
            <button onClick={() => onDelete(expression)} className="p-2 rounded-full bg-red-500/80 hover:bg-red-500 text-white transition-all transform hover:scale-110" title="Delete">
              <TrashIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="mt-2 text-center text-sm px-1">
          {isEditing ? (
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)} onBlur={handleSaveName}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName() }} autoFocus
              className="w-full bg-black/40 border border-purple-500/50 rounded p-1 text-center text-xs focus:ring-1 focus:ring-purple-400"
            />
          ) : (
            <div className="flex items-center justify-center gap-1 group">
              <span className="truncate text-gray-300" title={expression.name}>{expression.name}</span>
              <button onClick={() => setIsEditing(true)} className="shrink-0 text-purple-400/60 opacity-0 group-hover:opacity-100 transition-opacity">
                <PencilIcon className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
});

// --- MAIN COMPONENT ---

const GeneratorScreen: React.FC<GeneratorScreenProps> = ({ baseCharacterImage, baseCharacterName, onSetBaseCharacterName, onReset, onSetBase }) => {
  const { decrementUses } = useContext(TokenContext);
  const { expressions, addExpression, deleteExpression, updateExpression, clearLibrary, isLoading: isLibraryLoading } = useContext(LibraryContext);
  
  const [prompt, setPrompt] = useState<string>('');
  const [newExpressionImage, setNewExpressionImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [saveByDefault, setSaveByDefault] = useLocalStorage<boolean>('saveByDefault', true);
  
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedNewExpression, setCopiedNewExpression] = useState(false);
  
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [expressionToDelete, setExpressionToDelete] = useState<Expression | null>(null);
  const [expressionToSetAsBase, setExpressionToSetAsBase] = useState<Expression | null>(null);
  
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [similarity, setSimilarity] = useState(75);
  
  useEffect(() => {
    if (referenceFile) {
        const objectUrl = URL.createObjectURL(referenceFile);
        setReferencePreview(objectUrl);
        fileToBase64(referenceFile).then(file => logUpload(file, 'generator-screen-reference'));
        return () => URL.revokeObjectURL(objectUrl);
    }
    setReferencePreview(null);
  }, [referenceFile]);

  const handleCopyToClipboard = useCallback(async (image: string, id: string) => {
    const success = await copyImageToClipboard(image);
    if (success) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }, []);

  const handleCopyNewExpression = useCallback(async () => {
    if (!newExpressionImage) return;
    const success = await copyImageToClipboard(newExpressionImage);
    if (success) {
      setCopiedNewExpression(true);
      setTimeout(() => setCopiedNewExpression(false), 2000);
    }
  }, [newExpressionImage]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      setError('Please enter a description for the expression.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setNewExpressionImage(null);
    try {
      const base64Data = baseCharacterImage.split(',')[1];
      const mimeType = baseCharacterImage.split(';')[0].split(':')[1];
      
      let referenceImageData: Base64File | undefined = undefined;
      if (referenceFile) {
        referenceImageData = await fileToBase64(referenceFile);
      }
      
      const generatedImage = await generateExpression(base64Data, mimeType, prompt, referenceImageData, similarity);
      const fullImageSrc = `data:image/png;base64,${generatedImage}`;
      
      decrementUses(); // Decrement on success
      setNewExpressionImage(fullImageSrc);

      if (saveByDefault) {
         const newExpression: Expression = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: prompt.trim(),
            image: fullImageSrc, // This will be a data URL
            isFavorite: false,
            // Fix: Add storagePath to conform to Expression type. It will be populated by the library service if needed.
            storagePath: '',
         };
         addExpression(newExpression);
      }

    } catch (err) {
      console.error(err);
      setError('Failed to generate expression. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [prompt, baseCharacterImage, saveByDefault, addExpression, referenceFile, similarity, decrementUses]);

  const handleConfirmDelete = () => {
    if (!expressionToDelete) return;
    deleteExpression(expressionToDelete.id);
    setExpressionToDelete(null);
  };
  
  const handleConfirmSetAsBase = async () => {
    if (!expressionToSetAsBase) return;
    try {
        // expressionToSetAsBase.image is a URL
        const response = await fetch(expressionToSetAsBase.image);
        const blob = await response.blob();
        const { dataUrl } = await blobToBase64(blob);
        onSetBase(dataUrl);

        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
        console.error("Failed to set new base image:", err);
        setError("Could not load the selected image to use as a base.");
    } finally {
        setExpressionToSetAsBase(null);
    }
  };

  const handleClearLibrary = () => {
    clearLibrary();
    setIsClearModalOpen(false);
  };
  
  const handleToggleFavorite = useCallback((id: string) => {
    const expression = expressions.find(exp => exp.id === id);
    if(expression) {
        updateExpression({ ...expression, isFavorite: !expression.isFavorite });
    }
  }, [expressions, updateExpression]);
  
  const handleRenameExpression = useCallback((updatedExpression: Expression) => {
    updateExpression(updatedExpression);
  }, [updateExpression]);

  const sortedHistory = useMemo(() => {
    return [...expressions].sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0));
  }, [expressions]);

  return (
    <div className="animate-fade-in-up">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        <div className="lg:col-span-4 lg:sticky lg:top-24">
            <ControlPanel
                baseCharacterImage={baseCharacterImage}
                baseCharacterName={baseCharacterName}
                onSetBaseCharacterName={onSetBaseCharacterName}
                onReset={onReset}
                prompt={prompt}
                onPromptChange={setPrompt}
                onGenerate={handleGenerate}
                isLoading={isLoading}
                error={error}
                referenceFile={referenceFile}
                referencePreview={referencePreview}
                onReferenceFileChange={setReferenceFile}
                similarity={similarity}
                onSimilarityChange={setSimilarity}
            />
        </div>

        <div className="lg:col-span-8 flex flex-col gap-8">
          {(isLoading && !newExpressionImage) && (
            <div className="flex flex-col items-center justify-center gap-4 bg-black/20 p-6 rounded-2xl border border-purple-500/20 min-h-[20rem]">
              <Spinner size="lg" />
              <p className="text-xl text-purple-400 animate-pulse">Creating your new expression...</p>
            </div>
          )}

          {newExpressionImage && !isLoading && (
            <div className="bg-black/20 backdrop-blur-lg p-6 rounded-2xl shadow-2xl shadow-purple-900/10 border border-purple-500/20 text-center animate-fade-in">
              <h3 className="text-2xl font-bold mb-4">Your New Expression!</h3>
              <div className="w-48 h-48 bg-white/5 rounded-xl overflow-hidden flex items-center justify-center p-2 shadow-inner ring-1 ring-purple-500/20 mx-auto">
                <img src={newExpressionImage} alt="Generated Expression" className="object-contain max-w-full max-h-full" />
              </div>
              <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center max-w-sm mx-auto">
                <a
                    href={newExpressionImage}
                    download={`expression_${prompt.slice(0, 20).replace(/\s/g, '_')}.png`}
                    className="flex-1 bg-gradient-to-r from-green-400 to-cyan-500 text-white font-bold py-3 px-4 rounded-lg hover:shadow-lg hover:shadow-green-500/40 transition-all duration-300 flex items-center justify-center gap-2 transform active:scale-95 hover:scale-[1.02]"
                >
                    <DownloadIcon className="w-5 h-5" />
                    Download
                </a>
                <button onClick={handleCopyNewExpression} className="flex-1 bg-blue-500/80 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-lg transition-all transform active:scale-95 hover:scale-[1.02] flex items-center justify-center gap-2">
                    {copiedNewExpression ? <CheckIcon className="w-5 h-5" /> : <CopyIcon className="w-5 h-5" />}
                    {copiedNewExpression ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}
          
          {isLibraryLoading && (
            <div className="flex flex-col items-center justify-center gap-4 bg-black/20 p-6 rounded-2xl border border-purple-500/20 min-h-[20rem]">
              <Spinner size="lg" />
              <p className="text-xl text-purple-400 animate-pulse">Loading Your Library...</p>
            </div>
          )}

          {!isLibraryLoading && expressions.length > 0 && (
            <div className="bg-black/20 backdrop-blur-lg p-6 rounded-2xl shadow-2xl shadow-purple-900/10 border border-purple-500/20 animate-fade-in">
              <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                  <h3 className="text-2xl font-bold">Your Expression Library</h3>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                        <input type="checkbox" checked={saveByDefault} onChange={(e) => setSaveByDefault(e.target.checked)}
                            className="w-4 h-4 appearance-none bg-purple-500/20 border-2 border-purple-500/40 rounded checked:bg-gradient-to-tr checked:from-pink-500 checked:to-purple-500 checked:border-transparent focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-purple-500 transition-all duration-200"
                        /> Auto-save to your library
                    </label>
                     <button onClick={() => setIsClearModalOpen(true)} className="text-sm text-red-400/80 hover:text-red-400 transition-colors">Clear All</button>
                  </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-6 max-h-[48rem] overflow-y-auto p-1 bg-black/10 rounded-lg -mr-2 pr-3">
                {sortedHistory.map((expression) => (
                    <ExpressionItem
                        key={expression.id}
                        expression={expression}
                        copiedId={copiedId}
                        onToggleFavorite={() => handleToggleFavorite(expression.id)}
                        onCopy={handleCopyToClipboard}
                        onSetAsBase={setExpressionToSetAsBase}
                        onDelete={setExpressionToDelete}
                        onRename={handleRenameExpression}
                    />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
       <ConfirmationModal
          isOpen={isClearModalOpen} onClose={() => setIsClearModalOpen(false)} onConfirm={handleClearLibrary}
          title="Delete Your Entire Library?" confirmationText="delete your library"
        >
          <p>This will move all expressions in your library to a 'deleted' section. It will not permanently erase the image files from storage but will remove them from your view.</p>
      </ConfirmationModal>
      <ConfirmationModal
          isOpen={!!expressionToDelete} onClose={() => setExpressionToDelete(null)} onConfirm={handleConfirmDelete}
          title="Delete Expression?"
        >
          <p>Are you sure you want to delete your expression "{expressionToDelete?.name}"? It will be moved to a 'deleted' section.</p>
      </ConfirmationModal>
       <ConfirmationModal
          isOpen={!!expressionToSetAsBase} onClose={() => setExpressionToSetAsBase(null)} onConfirm={handleConfirmSetAsBase}
          title="Set New Base Character?"
        >
          <p>This will replace your current base character with the expression "{expressionToSetAsBase?.name}". This action can be reversed by setting another character as the base.</p>
      </ConfirmationModal>
    </div>
  );
};

export default GeneratorScreen;