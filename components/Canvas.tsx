/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import { RotateCcwIcon, ChevronLeftIcon, ChevronRightIcon, BookmarkIcon, DownloadIcon, AspectRatioIcon, UndoIcon, MagicWandIcon } from './icons';
import Spinner from './Spinner';
import { AnimatePresence, motion } from 'framer-motion';

interface CanvasProps {
  displayImageUrl: string | null;
  onStartOver: () => void;
  isLoading: boolean;
  loadingMessage: string;
  onSelectPose: (index: number) => void;
  onCustomPose: (prompt: string) => void;
  poseInstructions: string[];
  currentPoseIndex: number;
  availablePoseKeys: string[];
  onSaveOutfit: () => void;
  canSaveOutfit: boolean;
  onAspectRatioChange: (aspectRatio: string) => void;
  currentAspectRatio: string;
  onUndo: () => void;
  canUndo: boolean;
  onEdit: () => void;
  canEdit: boolean;
}

const ASPECT_RATIOS: Record<string, string> = {
  '2:3': 'Portrait',
  '1:1': 'Square',
  '16:9': 'Landscape',
};

const Canvas: React.FC<CanvasProps> = ({ 
  displayImageUrl, 
  onStartOver, 
  isLoading, 
  loadingMessage, 
  onSelectPose, 
  onCustomPose,
  poseInstructions, 
  currentPoseIndex, 
  availablePoseKeys, 
  onSaveOutfit, 
  canSaveOutfit,
  onAspectRatioChange,
  currentAspectRatio,
  onUndo,
  canUndo,
  onEdit,
  canEdit,
}) => {
  const [isPoseMenuOpen, setIsPoseMenuOpen] = useState(false);
  const [isAspectRatioMenuOpen, setIsAspectRatioMenuOpen] = useState(false);
  const [customPosePrompt, setCustomPosePrompt] = useState('');
  
  const handlePreviousPose = () => {
    if (isLoading || availablePoseKeys.length <= 1) return;

    const currentPoseInstruction = poseInstructions[currentPoseIndex];
    const currentIndexInAvailable = availablePoseKeys.indexOf(currentPoseInstruction);
    
    // Fallback if current pose not in available list (shouldn't happen)
    if (currentIndexInAvailable === -1) {
        onSelectPose((currentPoseIndex - 1 + poseInstructions.length) % poseInstructions.length);
        return;
    }

    const prevIndexInAvailable = (currentIndexInAvailable - 1 + availablePoseKeys.length) % availablePoseKeys.length;
    const prevPoseInstruction = availablePoseKeys[prevIndexInAvailable];
    const newGlobalPoseIndex = poseInstructions.indexOf(prevPoseInstruction);
    
    if (newGlobalPoseIndex !== -1) {
        onSelectPose(newGlobalPoseIndex);
    }
  };

  const handleNextPose = () => {
    if (isLoading) return;

    const currentPoseInstruction = poseInstructions[currentPoseIndex];
    const currentIndexInAvailable = availablePoseKeys.indexOf(currentPoseInstruction);

    // Fallback or if there are no generated poses yet
    if (currentIndexInAvailable === -1 || availablePoseKeys.length === 0) {
        onSelectPose((currentPoseIndex + 1) % poseInstructions.length);
        return;
    }
    
    const nextIndexInAvailable = currentIndexInAvailable + 1;
    if (nextIndexInAvailable < availablePoseKeys.length) {
        // There is another generated pose, navigate to it
        const nextPoseInstruction = availablePoseKeys[nextIndexInAvailable];
        const newGlobalPoseIndex = poseInstructions.indexOf(nextPoseInstruction);
        if (newGlobalPoseIndex !== -1) {
            onSelectPose(newGlobalPoseIndex);
        }
    } else {
        // At the end of generated poses, generate the next one from the master list
        // Find the index of the current pose in the main list
        const currentGlobalIndex = poseInstructions.indexOf(currentPoseInstruction);
        const newGlobalPoseIndex = (currentGlobalIndex + 1) % poseInstructions.length;
        onSelectPose(newGlobalPoseIndex);
    }
  };

  const handleDownload = () => {
    if (!displayImageUrl) return;
    const link = document.createElement('a');
    link.href = displayImageUrl;
    link.download = 'my-fit-check-outfit.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerateCustomPose = () => {
    if (customPosePrompt.trim()) {
      onCustomPose(customPosePrompt.trim());
      setCustomPosePrompt('');
      setIsPoseMenuOpen(false); // Close menu after generating
    }
  };

  const handleCustomPoseKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleGenerateCustomPose();
    }
  };
  
  return (
    <div className="w-full h-full flex items-center justify-center p-4 relative animate-zoom-in group">
      {/* Top Buttons */}
      <div className="absolute top-4 left-4 z-30 flex items-center gap-2 flex-wrap">
        <button 
            onClick={onStartOver}
            className="flex items-center justify-center text-center bg-white/60 border border-gray-300/80 text-gray-700 font-semibold py-2 px-4 rounded-full transition-all duration-200 ease-in-out hover:bg-white hover:border-gray-400 active:scale-95 text-sm backdrop-blur-sm"
        >
            <RotateCcwIcon className="w-4 h-4 mr-2" />
            Start Over
        </button>
        
        {canUndo && (
            <button
                onClick={onUndo}
                disabled={isLoading}
                className="flex items-center justify-center text-center bg-white/60 border border-gray-300/80 text-gray-700 font-semibold py-2 px-4 rounded-full transition-all duration-200 ease-in-out hover:bg-white hover:border-gray-400 active:scale-95 text-sm backdrop-blur-sm disabled:opacity-50"
                aria-label="Undo last action"
            >
                <UndoIcon className="w-4 h-4 mr-2" />
                Undo
            </button>
        )}
        
        {canEdit && (
            <button
                onClick={onEdit}
                disabled={isLoading}
                className="flex items-center justify-center text-center bg-white/60 border border-gray-300/80 text-gray-700 font-semibold py-2 px-4 rounded-full transition-all duration-200 ease-in-out hover:bg-white hover:border-gray-400 active:scale-95 text-sm backdrop-blur-sm disabled:opacity-50"
                aria-label="Edit image"
            >
                <MagicWandIcon className="w-4 h-4 mr-2" />
                Edit
            </button>
        )}

        {displayImageUrl && !isLoading && (
            <div className="relative">
                <button
                    onClick={() => setIsAspectRatioMenuOpen(v => !v)}
                    disabled={isLoading}
                    className="flex items-center justify-center text-center bg-white/60 border border-gray-300/80 text-gray-700 font-semibold py-2 px-4 rounded-full transition-all duration-200 ease-in-out hover:bg-white hover:border-gray-400 active:scale-95 text-sm backdrop-blur-sm disabled:opacity-50"
                    aria-label="Change aspect ratio"
                >
                    <AspectRatioIcon className="w-4 h-4 mr-2" />
                    {ASPECT_RATIOS[currentAspectRatio] || 'Ratio'}
                </button>
                <AnimatePresence>
                    {isAspectRatioMenuOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: -5, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -5, scale: 0.95 }}
                            transition={{ duration: 0.15, ease: "easeOut" }}
                            className="absolute top-full mt-2 w-40 bg-white/80 backdrop-blur-lg rounded-xl p-2 border border-gray-200/80 shadow-lg"
                        >
                            <div className="flex flex-col gap-1">
                                {Object.entries(ASPECT_RATIOS).map(([ratio, name]) => (
                                    <button
                                        key={ratio}
                                        onClick={() => {
                                            onAspectRatioChange(ratio);
                                            setIsAspectRatioMenuOpen(false);
                                        }}
                                        disabled={isLoading || ratio === currentAspectRatio}
                                        className="w-full text-left text-sm font-medium text-gray-800 p-2 rounded-md hover:bg-gray-200/70 disabled:opacity-50 disabled:bg-gray-200/70 disabled:font-bold disabled:cursor-not-allowed"
                                    >
                                        {name} ({ratio})
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        )}

        {canSaveOutfit && (
          <button
            onClick={onSaveOutfit}
            disabled={isLoading}
            className="flex items-center justify-center text-center bg-white/60 border border-gray-300/80 text-gray-700 font-semibold py-2 px-4 rounded-full transition-all duration-200 ease-in-out hover:bg-white hover:border-gray-400 active:scale-95 text-sm backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Save Outfit"
          >
            <BookmarkIcon className="w-4 h-4 mr-2" />
            Save Outfit
          </button>
        )}

        {displayImageUrl && !isLoading && (
            <button
                onClick={handleDownload}
                className="flex items-center justify-center text-center bg-white/60 border border-gray-300/80 text-gray-700 font-semibold py-2 px-4 rounded-full transition-all duration-200 ease-in-out hover:bg-white hover:border-gray-400 active:scale-95 text-sm backdrop-blur-sm"
                aria-label="Download Image"
            >
                <DownloadIcon className="w-4 h-4 mr-2" />
                Download
            </button>
        )}
      </div>

      {/* Image Display or Placeholder */}
      <div className="relative w-full h-full flex items-center justify-center">
        {displayImageUrl ? (
          <img
            key={displayImageUrl} // Use key to force re-render and trigger animation on image change
            src={displayImageUrl}
            alt="Virtual try-on model"
            className="max-w-full max-h-full object-contain transition-opacity duration-500 animate-fade-in rounded-lg"
          />
        ) : (
            <div className="w-[400px] h-[600px] bg-gray-100 border border-gray-200 rounded-lg flex flex-col items-center justify-center">
              <Spinner />
              <p className="text-md font-serif text-gray-600 mt-4">Loading Model...</p>
            </div>
        )}
        
        <AnimatePresence>
          {isLoading && (
              <motion.div
                  className="absolute inset-0 bg-white/80 backdrop-blur-md flex flex-col items-center justify-center z-20 rounded-lg"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
              >
                  <Spinner />
                  {loadingMessage && (
                      <p className="text-lg font-serif text-gray-700 mt-4 text-center px-4">{loadingMessage}</p>
                  )}
              </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Pose Controls */}
      {displayImageUrl && !isLoading && (
        <div 
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          onMouseEnter={() => setIsPoseMenuOpen(true)}
          onMouseLeave={() => setIsPoseMenuOpen(false)}
        >
          {/* Pose popover menu */}
          <AnimatePresence>
              {isPoseMenuOpen && (
                  <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="absolute bottom-full mb-3 w-72 bg-white/80 backdrop-blur-lg rounded-xl p-2 border border-gray-200/80 shadow-xl"
                  >
                      <div className="flex flex-col">
                          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2">
                              {poseInstructions.map((pose, index) => (
                                  <button
                                      key={pose}
                                      onClick={() => onSelectPose(index)}
                                      disabled={isLoading || index === currentPoseIndex}
                                      className="w-full text-left text-sm font-medium text-gray-800 p-2 rounded-md hover:bg-gray-200/70 disabled:opacity-50 disabled:bg-gray-200/70 disabled:font-bold disabled:cursor-not-allowed"
                                  >
                                      {pose}
                                  </button>
                              ))}
                          </div>
                          <div className="mt-3 pt-3 border-t border-gray-200/80">
                              <textarea
                                  value={customPosePrompt}
                                  onChange={(e) => setCustomPosePrompt(e.target.value)}
                                  onKeyDown={handleCustomPoseKeyDown}
                                  placeholder="Or type your own pose..."
                                  className="w-full p-2 text-sm text-gray-800 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-gray-800 focus:border-transparent transition-colors"
                                  rows={2}
                                  aria-label="Custom pose prompt"
                              />
                              <button
                                  onClick={handleGenerateCustomPose}
                                  disabled={isLoading || !customPosePrompt.trim()}
                                  className="w-full mt-2 text-center bg-gray-900 text-white font-semibold py-2 px-3 rounded-md transition-colors duration-200 ease-in-out hover:bg-gray-700 active:scale-95 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Cmd/Ctrl + Enter to generate"
                              >
                                  Generate Pose
                              </button>
                          </div>
                      </div>
                  </motion.div>
              )}
          </AnimatePresence>
          
          <div className="flex items-center justify-center gap-2 bg-white/60 backdrop-blur-md rounded-full p-2 border border-gray-300/50">
            <button 
              onClick={handlePreviousPose}
              aria-label="Previous pose"
              className="p-2 rounded-full hover:bg-white/80 active:scale-90 transition-all disabled:opacity-50"
              disabled={isLoading}
            >
              <ChevronLeftIcon className="w-5 h-5 text-gray-800" />
            </button>
            <span className="text-sm font-semibold text-gray-800 w-48 text-center truncate" title={poseInstructions[currentPoseIndex]}>
              {poseInstructions[currentPoseIndex]}
            </span>
            <button 
              onClick={handleNextPose}
              aria-label="Next pose"
              className="p-2 rounded-full hover:bg-white/80 active:scale-90 transition-all disabled:opacity-50"
              disabled={isLoading}
            >
              <ChevronRightIcon className="w-5 h-5 text-gray-800" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Canvas;