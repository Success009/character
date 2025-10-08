
import React, { useState, useCallback, useRef, useEffect, useContext } from 'react';
import Spinner from './Spinner';
import { UploadIcon, CloseIcon, SettingsIcon, TrashIcon } from './Icons';
import { TokenContext } from '../contexts/TokenContext';
import { generateChibiCharacter, validateImage, logUpload, generateCharacterFromText } from '../services/geminiService';
import { fileToBase64 } from '../utils/fileUtils';
import { Base64File } from '../types';

interface UploadScreenProps {
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  mainFile: File | null;
  onMainFileChange: (file: File | null) => void;
  setCandidateImage: (image: string | null) => void;
  setBaseCharacterName: (name: string) => void;
}

const EMOTION_STEPS = ['Neutral', 'Happy', 'Sad', 'Angry', 'Surprise', 'Custom'];

const UploadScreen: React.FC<UploadScreenProps> = ({ 
  isLoading, setIsLoading, error, setError, mainFile, onMainFileChange, setCandidateImage, setBaseCharacterName
}) => {
  const { uses, decrementUses } = useContext(TokenContext);

  const [mode, setMode] = useState<'upload' | 'text'>('upload');
  const [textPrompt, setTextPrompt] = useState('');
  
  const [dragActive, setDragActive] = useState(false);
  const [isAlreadyChibi, setIsAlreadyChibi] = useState(false);
  const [emotionIndex, setEmotionIndex] = useState(0);
  const [customEmotion, setCustomEmotion] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [similarity, setSimilarity] = useState(75);
  const [mainPreview, setMainPreview] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);
  
  const selectedEmotion = EMOTION_STEPS[emotionIndex];

  useEffect(() => {
    if (referenceFile) {
      const objectUrl = URL.createObjectURL(referenceFile);
      setReferencePreview(objectUrl);
      fileToBase64(referenceFile).then(file => logUpload(file, 'upload-screen-reference'));
      return () => URL.revokeObjectURL(objectUrl);
    }
    setReferencePreview(null);
  }, [referenceFile]);
  
  useEffect(() => {
    if (mainFile) {
      const objectUrl = URL.createObjectURL(mainFile);
      setMainPreview(objectUrl);
      fileToBase64(mainFile).then(file => logUpload(file, 'upload-screen-main'));
      return () => URL.revokeObjectURL(objectUrl);
    }
    setMainPreview(null);
  }, [mainFile]);

  const handleFile = useCallback((file: File | null) => {
    if (file) {
      setError(null);
      onMainFileChange(file);
    }
  }, [onMainFileChange, setError]);
  
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0] || null);
    e.target.value = '';
  }, [handleFile]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFile(e.dataTransfer.files?.[0] || null);
  }, [handleFile]);

  const onUploadClick = () => {
    inputRef.current?.click();
  };

  const handleGenerateClick = async () => {
    if (!mainFile) return;
    const finalEmotionPrompt = selectedEmotion === 'Custom' ? customEmotion : selectedEmotion;
    if (selectedEmotion === 'Custom' && !customEmotion.trim()) {
      setFormError("Please enter a custom emotion or slide to a preset.");
      return;
    }
    setFormError(null);
    
    setIsLoading(true);
    setError(null);
    setCandidateImage(null);

    try {
      const { base64, mimeType } = await fileToBase64(mainFile);
      
      const validation = await validateImage(base64, mimeType);
      if (!validation.isSolo) {
        setError(`Upload failed: ${validation.reason}. Please use an image with a single character.`);
        setIsLoading(false);
        return;
      }

      let referenceImage: Base64File | undefined = undefined;
      if (referenceFile) {
          referenceImage = await fileToBase64(referenceFile);
      }
      
      let finalImage: string;
      if (isAlreadyChibi) {
        if (!validation.isChibi) {
          setError(`Upload failed: ${validation.reason}. The image does not appear to be in Chibi style. Please uncheck the box to let the AI convert it for you.`);
          setIsLoading(false);
          return;
        }
        finalImage = `data:${mimeType};base64,${base64}`;
      } else {
        const chibiImage = await generateChibiCharacter(base64, mimeType, finalEmotionPrompt, referenceImage, similarity);
        finalImage = `data:image/png;base64,${chibiImage}`;
      }
      decrementUses();
      setCandidateImage(finalImage);
      setBaseCharacterName(mainFile.name.split('.')[0].replace(/[-_]/g, ' ') || 'Base Character');

    } catch (err) {
      console.error(err);
      setError('An unexpected error occurred. Please try another image or check your API key.');
    } finally {
      setIsLoading(false);
    }
  }
  
  const handleGenerateFromText = async () => {
    if (!textPrompt.trim()) {
        setFormError("Please describe the character you want to create.");
        return;
    }
    setFormError(null);
    setIsLoading(true);
    setError(null);
    setCandidateImage(null);

    try {
        let referenceImage: Base64File | undefined = undefined;
        if (referenceFile) {
            referenceImage = await fileToBase64(referenceFile);
        }
        
        const generatedImage = await generateCharacterFromText(textPrompt, referenceImage, similarity);
        const finalImage = `data:image/png;base64,${generatedImage}`;
        
        decrementUses();
        setCandidateImage(finalImage);
        setBaseCharacterName(textPrompt.substring(0, 30).trim() || 'Generated Character');

    } catch (err) {
        console.error(err);
        setError('An unexpected error occurred during character generation. Please try again.');
    } finally {
        setIsLoading(false);
    }
  };

  const renderSharedSettings = (isTextMode: boolean) => (
      <>
        <div className="text-left border-t border-purple-500/10 pt-6">
            <p className="text-lg font-semibold text-center mb-1">Style Reference</p>
            <p className="text-xs text-center text-purple-300/60 mb-4">(Optional) Use an image to guide the art style.</p>
            <div className="flex items-center justify-center gap-4">
                {referencePreview && (
                    <div className="relative group">
                        <img src={referencePreview} alt="Reference preview" className="w-16 h-16 rounded-lg object-cover" />
                        <button onClick={() => setReferenceFile(null)} className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                            <CloseIcon className="w-4 h-4" />
                        </button>
                    </div>
                )}
                <input
                    ref={refInputRef} type="file" className="hidden" accept="image/png, image/jpeg, image/webp"
                    onChange={(e) => {setReferenceFile(e.target.files?.[0] || null); e.target.value = '';}}
                    aria-label="Reference image upload"
                />
                <button onClick={() => refInputRef.current?.click()} className="flex items-center gap-2 py-2 px-4 rounded-lg bg-purple-500/20 border border-purple-500/40 hover:bg-purple-500/30 transition-colors">
                    <UploadIcon className="w-5 h-5"/>
                    {referenceFile ? 'Change' : 'Upload'}
                </button>
            </div>
        </div>
        
        <div className="border-t border-purple-500/10 pt-6">
            <button onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center justify-center gap-2 text-sm w-full text-purple-300/70 hover:text-white transition-colors">
                <SettingsIcon className="w-4 h-4"/> Advanced Settings
            </button>
            {showAdvanced && (
            <div className="mt-4 space-y-3 p-4 bg-black/20 rounded-lg animate-fade-in">
                <label htmlFor="similarity" className="block text-sm font-medium text-gray-300">Similarity to Reference</label>
                <p className="text-xs text-purple-300/60 -mt-2">How closely should the AI follow the reference style?</p>
                <input
                    id="similarity" type="range" min="0" max="100" value={similarity}
                    onChange={(e) => setSimilarity(parseInt(e.target.value))}
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

        {isTextMode ? (
             <button 
                onClick={handleGenerateFromText}
                disabled={uses <= 0 || !textPrompt.trim()}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-3 px-4 rounded-lg hover:shadow-lg hover:shadow-purple-500/40 transition-all duration-300 flex items-center justify-center gap-2 transform active:scale-95 hover:scale-[1.02] disabled:from-gray-500 disabled:to-gray-600 disabled:shadow-none disabled:cursor-not-allowed mt-4"
            >
                {uses > 0 ? 'Generate From Text' : 'No uses left'}
            </button>
        ) : (
            <>
            <label className="flex items-center justify-center gap-3 text-gray-300 cursor-pointer select-none group pt-6 border-t border-purple-500/10">
                <input
                    type="checkbox" checked={isAlreadyChibi} onChange={(e) => setIsAlreadyChibi(e.target.checked)}
                    className="w-5 h-5 appearance-none bg-purple-500/20 border-2 border-purple-500/40 rounded-md checked:bg-gradient-to-tr checked:from-pink-500 checked:to-purple-500 checked:border-transparent focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-purple-500 transition-all duration-200"
                /> Your image is already in Chibi style
            </label>
            <button 
                onClick={handleGenerateClick}
                disabled={uses <= 0}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-3 px-4 rounded-lg hover:shadow-lg hover:shadow-purple-500/40 transition-all duration-300 flex items-center justify-center gap-2 transform active:scale-95 hover:scale-[1.02] disabled:from-gray-500 disabled:to-gray-600 disabled:shadow-none disabled:cursor-not-allowed"
            >
                {uses > 0 ? 'Generate Your Base Character' : 'No uses left'}
            </button>
            </>
        )}
      </>
  );

  const renderDropzone = () => (
     <form onDragEnter={handleDrag} onSubmit={(e) => e.preventDefault()} className="max-w-xl mx-auto">
        <input
            ref={inputRef} type="file" className="hidden"
            accept="image/png, image/jpeg, image/webp"
            onChange={handleFileChange} aria-label="Your character image upload"
        />
        <div
            className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300 ${dragActive ? 'border-purple-400 bg-purple-500/20 scale-105' : 'border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 hover:border-purple-500/50'}`}
            onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
            onClick={onUploadClick} role="button" aria-label="Upload your character image"
        >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <UploadIcon className="w-10 h-10 mb-4 text-purple-400/70" />
                <p className="mb-2 text-base text-gray-300">
                    <span className="font-semibold text-purple-300">Click to upload your character</span> or drag and drop
                </p>
                <p className="text-xs text-purple-300/50">PNG, JPG or WEBP</p>
            </div>
        </div>
    </form>
  );

  const renderTextGenerator = () => (
    <div className="max-w-xl mx-auto space-y-8 bg-black/20 backdrop-blur-lg p-6 rounded-2xl shadow-2xl shadow-purple-900/10 border border-purple-500/20 animate-fade-in">
        <textarea
            value={textPrompt}
            onChange={(e) => setTextPrompt(e.target.value)}
            placeholder="e.g., A brave knight with spiky blue hair, wearing silver armor with gold trim and a long red cape..."
            className="w-full bg-black/20 border border-purple-500/30 rounded-lg p-3 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all duration-300 h-32 resize-none placeholder:text-purple-300/40"
            rows={4}
        />
        {renderSharedSettings(true)}
    </div>
  );

  const renderUploadSettings = () => (
    <div className='grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-start'>
        <div className="text-center md:sticky md:top-28">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Your Character & Settings</h2>
            <div className="relative w-48 h-48 lg:w-64 lg:h-64 mx-auto group">
                <img src={mainPreview!} alt="Character preview" className="w-full h-full object-contain rounded-lg bg-white/5 p-2 shadow-lg" />
                <button onClick={() => onMainFileChange(null)} className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1.5 text-white opacity-0 group-hover:opacity-100 transition-opacity" title="Remove image">
                    <TrashIcon className="w-5 h-5" />
                </button>
            </div>
            <p className="text-sm text-purple-300/60 mt-4 truncate px-4" title={mainFile?.name}>{mainFile?.name}</p>
        </div>
        
        <div className="space-y-8 bg-black/20 backdrop-blur-lg p-6 rounded-2xl shadow-2xl shadow-purple-900/10 border border-purple-500/20">
             <div className="space-y-6">
                <div>
                    <h3 className="text-lg font-semibold mb-1 text-center">Base Emotion</h3>
                    <p className="text-xs text-center text-purple-300/60 mb-4">What expression should the first image have?</p>
                    <div className="max-w-md mx-auto px-4">
                        <p className="text-center font-bold text-xl mb-3 text-purple-300 transition-colors duration-300">{selectedEmotion}</p>
                        <input
                            type="range" min="0" max={EMOTION_STEPS.length - 1} value={emotionIndex}
                            onChange={(e) => setEmotionIndex(parseInt(e.target.value))}
                            className="w-full h-2 bg-purple-500/20 rounded-lg appearance-none cursor-pointer accent-pink-500"
                        />
                        </div>
                    {selectedEmotion === 'Custom' && (
                        <div className="mt-4 animate-fade-in max-w-sm mx-auto">
                            <input
                                type="text" value={customEmotion} onChange={(e) => setCustomEmotion(e.target.value)}
                                placeholder="e.g., sleepy, mischievous..."
                                className="w-full bg-black/20 border border-purple-500/30 rounded-lg p-3 text-center focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all duration-300 placeholder:text-purple-300/40"
                            />
                        </div>
                    )}
                </div>
                {renderSharedSettings(false)}
            </div>
        </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto animate-fade-in-up">
      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-4 min-h-[400px]">
          <Spinner size="lg" />
          <p className="text-lg text-purple-400 animate-pulse">Generating your masterpiece...</p>
          <p className="text-sm text-purple-300/60">This might take a moment.</p>
        </div>
      ) : (
        mainFile ? renderUploadSettings() : (
            <div className="w-full text-center">
                <h2 className="text-3xl md:text-4xl font-bold mb-4">Step 1: Create Your Base Character</h2>
                <p className="text-purple-300/70 mb-8 max-w-2xl mx-auto">Upload an image of a character, or describe one for the AI to create from scratch.</p>

                <div className="flex justify-center mb-6">
                    <div className="bg-black/20 p-1 rounded-full flex items-center gap-1">
                        <button onClick={() => setMode('upload')} className={`px-6 py-2 rounded-full text-sm font-semibold transition-colors ${mode === 'upload' ? 'bg-purple-600 text-white' : 'text-purple-300 hover:bg-purple-500/20'}`}>Upload Image</button>
                        <button onClick={() => setMode('text')} className={`px-6 py-2 rounded-full text-sm font-semibold transition-colors ${mode === 'text' ? 'bg-purple-600 text-white' : 'text-purple-300 hover:bg-purple-500/20'}`}>Generate with Text</button>
                    </div>
                </div>

                {mode === 'upload' ? renderDropzone() : renderTextGenerator()}
            </div>
        )
      )}
      
      {error && <p className="text-red-300 mt-6 text-sm bg-red-500/10 p-4 rounded-lg border border-red-500/20 animate-fade-in max-w-xl mx-auto text-center">{error}</p>}
      {formError && <p className="text-yellow-300 mt-6 text-sm bg-yellow-500/10 p-4 rounded-lg border border-yellow-500/20 animate-fade-in max-w-xl mx-auto text-center">{formError}</p>}
    </div>
  );
};

export default UploadScreen;