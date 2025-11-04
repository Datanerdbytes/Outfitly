/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloudIcon, CameraIcon } from './icons';
import { Compare } from './ui/compare';
import { generateModelImage } from '../services/geminiService';
import Spinner from './Spinner';
import CameraView from './CameraView';

interface StartScreenProps {
  onModelFinalized: (modelUrl: string) => void;
}

interface ErrorState {
  title: string;
  message: string;
}

// Utility function to convert a base64 data URL to a File object
const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) throw new Error('Invalid data URL: could not find MIME type.');
    const mime = mimeMatch[1];
    
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type: mime});
};

const StartScreen: React.FC<StartScreenProps> = ({ onModelFinalized }) => {
  const [userImageUrl, setUserImageUrl] = useState<string | null>(null);
  const [generatedModelUrl, setGeneratedModelUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const [customInstructions, setCustomInstructions] = useState('');
  const [view, setView] = useState<'upload' | 'camera'>('upload');

  const handleFileSelect = useCallback(async (file: File, instructions: string) => {
    if (!file.type.startsWith('image/')) {
        setError({
          title: 'Invalid File Type',
          message: 'Please select an image file (e.g., PNG, JPEG, WEBP).'
        });
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        setUserImageUrl(dataUrl);
        setIsGenerating(true);
        setGeneratedModelUrl(null);
        setError(null);
        try {
            const result = await generateModelImage(file, instructions);
            setGeneratedModelUrl(result);
        } catch (err) {
            const rawMessage = err instanceof Error ? err.message : String(err);

            if (rawMessage.toLowerCase().includes('blocked') || rawMessage.toLowerCase().includes('safety')) {
                setError({
                    title: 'Image Content Error',
                    message: 'This image could not be processed due to content policies. Please try a different photo.'
                });
            } else if (rawMessage.toLowerCase().includes('unsupported mime type')) {
                setError({
                    title: 'Unsupported File Type',
                    message: 'Please use a standard image format like PNG, JPEG, or WEBP.'
                });
            } else if (rawMessage.toLowerCase().includes('did not return an image')) {
                setError({
                    title: 'Model Creation Failed',
                    message: "We couldn't generate a model from this photo. Try using a clearer, high-quality image of a person."
                });
            } else {
                setError({
                    title: 'An Error Occurred',
                    message: 'Something went wrong during model generation. Please try again.'
                });
            }
            setUserImageUrl(null);
        } finally {
            setIsGenerating(false);
        }
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0], customInstructions);
    }
  };

  const handlePhotoTaken = (dataUrl: string) => {
    const file = dataURLtoFile(dataUrl, `photo-${Date.now()}.jpg`);
    handleFileSelect(file, customInstructions);
    setView('upload'); // Switch back to the upload view to show the comparison screen
  };

  const reset = () => {
    setUserImageUrl(null);
    setGeneratedModelUrl(null);
    setIsGenerating(false);
    setError(null);
    setCustomInstructions('');
    setView('upload');
  };

  const screenVariants = {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
  };

  const renderContent = () => {
    if (userImageUrl) {
      return (
        <motion.div
          key="compare"
          className="w-full max-w-6xl mx-auto h-full flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12"
          variants={screenVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.4, ease: "easeInOut" }}
        >
          <div className="md:w-1/2 flex-shrink-0 flex flex-col items-center md:items-start">
            <div className="text-center md:text-left">
              <h1 className="text-4xl md:text-5xl font-serif font-bold text-gray-900 leading-tight">
                The New You
              </h1>
              <p className="mt-2 text-md text-gray-600">
                Drag the slider to see your transformation.
              </p>
            </div>
            
            {isGenerating && (
              <div className="flex items-center gap-3 text-lg text-gray-700 font-serif mt-6">
                <Spinner />
                <span>Generating your model...</span>
              </div>
            )}

            {error && (
              <div className="mt-6 w-full max-w-md bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative" role="alert">
                <strong className="font-bold block">{error.title}</strong>
                <span className="block mt-1">{error.message}</span>
                <div className="mt-4 text-center md:text-left">
                  <button onClick={reset} className="font-bold text-red-800 hover:underline">
                    Try a Different Photo
                  </button>
                </div>
              </div>
            )}
            
            <AnimatePresence>
              {generatedModelUrl && !isGenerating && !error && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.5 }}
                  className="flex flex-col sm:flex-row items-center gap-4 mt-8"
                >
                  <button 
                    onClick={reset}
                    className="w-full sm:w-auto px-6 py-3 text-base font-semibold text-gray-700 bg-gray-200 rounded-md cursor-pointer hover:bg-gray-300 transition-colors"
                  >
                    Use Different Photo
                  </button>
                  <button 
                    onClick={() => onModelFinalized(generatedModelUrl)}
                    className="w-full sm:w-auto relative inline-flex items-center justify-center px-8 py-3 text-base font-semibold text-white bg-gray-900 rounded-md cursor-pointer group hover:bg-gray-700 transition-colors"
                  >
                    Proceed to Styling &rarr;
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="md:w-1/2 w-full flex items-center justify-center">
            <div 
              className={`relative rounded-[1.25rem] transition-all duration-700 ease-in-out ${isGenerating ? 'border border-gray-300 animate-pulse' : 'border border-transparent'}`}
            >
              <Compare
                firstImage={userImageUrl}
                secondImage={generatedModelUrl ?? userImageUrl}
                slideMode="drag"
                className="w-[280px] h-[420px] sm:w-[320px] sm:h-[480px] lg:w-[400px] lg:h-[600px] rounded-2xl bg-gray-200"
              />
            </div>
          </div>
        </motion.div>
      );
    }
    
    if (view === 'camera') {
      return (
        <CameraView
          key="camera"
          onPhotoTaken={handlePhotoTaken}
          onCancel={() => setView('upload')}
        />
      );
    }

    return (
      <motion.div
        key="uploader"
        className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12"
        variants={screenVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.4, ease: "easeInOut" }}
      >
        <div className="lg:w-1/2 flex flex-col items-center lg:items-start text-center lg:text-left">
          <div className="max-w-lg">
            <h1 className="text-5xl md:text-6xl font-serif font-bold text-gray-900 leading-tight">
              Create Your Model for Any Look.
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              Ever wondered how an outfit would look on you? Stop guessing. Upload a photo or use your camera to see for yourself.
            </p>
            <hr className="my-8 border-gray-200" />
            <div className="flex flex-col items-center lg:items-start w-full gap-3">
                <div className="w-full flex flex-col sm:flex-row gap-3">
                    <label htmlFor="image-upload-start" className="flex-1 relative flex items-center justify-center px-8 py-3 text-base font-semibold text-white bg-gray-900 rounded-md cursor-pointer group hover:bg-gray-700 transition-colors">
                        <UploadCloudIcon className="w-5 h-5 mr-3" />
                        Upload Photo
                    </label>
                    <button 
                        onClick={() => setView('camera')}
                        className="flex-1 sm:flex-none relative flex items-center justify-center px-8 py-3 text-base font-semibold text-gray-800 bg-transparent border-2 border-gray-300 rounded-md cursor-pointer group hover:bg-gray-100 transition-colors"
                    >
                        <CameraIcon className="w-5 h-5 mr-3" />
                        Use Camera
                    </button>
                </div>
                <input id="image-upload-start" type="file" className="hidden" accept="image/png, image/jpeg, image/webp, image/avif, image/heic, image/heif" onChange={handleFileChange} />
              
              <textarea
                id="custom-instructions"
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="Optional: Describe your desired model or background (e.g., 'professional headshot on a blurred office background', 'smiling, casual pose')."
                className="w-full mt-2 p-3 text-sm text-gray-700 bg-gray-50 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-800 focus:border-transparent transition-colors"
                rows={3}
                aria-label="Custom instructions for model generation"
              />

              <p className="text-gray-500 text-sm">Select a clear, full-body photo. Face-only photos also work, but full-body is preferred for best results.</p>
              <p className="text-gray-500 text-xs mt-1">By uploading, you agree not to create harmful, explicit, or unlawful content. This service is for creative and responsible use only.</p>
              {error && (
                <div className="w-full bg-red-100 border-l-4 border-red-500 text-red-700 p-3 mt-2 rounded-md" role="alert">
                  <p className="font-bold text-sm">{error.title}</p>
                  <p className="text-sm">{error.message}</p>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="w-full lg:w-1/2 flex flex-col items-center justify-center">
          <Compare
            firstImage="https://storage.googleapis.com/gemini-95-icons/asr-tryon.jpg"
            secondImage="https://storage.googleapis.com/gemini-95-icons/asr-tryon-model.png"
            slideMode="drag"
            className="w-full max-w-sm aspect-[2/3] rounded-2xl bg-gray-200"
          />
        </div>
      </motion.div>
    );
  };

  return (
    <AnimatePresence mode="wait">
        {renderContent()}
    </AnimatePresence>
  );
};

export default StartScreen;