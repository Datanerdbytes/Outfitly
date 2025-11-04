/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StartScreen from './components/StartScreen';
import Canvas from './components/Canvas';
import WardrobePanel from './components/WardrobeModal';
import OutfitStack from './components/OutfitStack';
import { generateVirtualTryOnImage, addAccessoryToImage, generatePoseVariation, changeBackgroundImage, changeBackgroundImageWithImage, changeImageAspectRatio, editImageWithMask } from './services/geminiService';
import { OutfitLayer, WardrobeItem, SavedOutfit } from './types';
import { ChevronDownIcon, ChevronUpIcon } from './components/icons';
import { defaultWardrobe } from './wardrobe';
import Footer from './components/Footer';
import { getFriendlyErrorMessage } from './lib/utils';
import Spinner from './components/Spinner';
import BackgroundPanel from './components/BackgroundPanel';
import LookbookPanel from './components/LookbookPanel';
import AnnotationModal from './components/AnnotationModal';

const INITIAL_POSE_INSTRUCTIONS = [
  "Full frontal view, hands on hips",
  "Slightly turned, 3/4 view",
  "Side profile view",
  "Walking towards camera",
  "Leaning against a wall",
  "Sitting on a stool",
  "Arms crossed, looking confident",
  "Hands in pockets, casual stance",
  "Jumping in the air, mid-action shot",
  "Looking over the shoulder",
  "Dynamic fashion pose, one leg forward",
  "Lounging on a sofa",
];

const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);

    // DEPRECATED: mediaQueryList.addListener(listener);
    mediaQueryList.addEventListener('change', listener);
    
    // Check again on mount in case it changed between initial state and effect runs
    if (mediaQueryList.matches !== matches) {
      setMatches(mediaQueryList.matches);
    }

    return () => {
      // DEPRECATED: mediaQueryList.removeListener(listener);
      mediaQueryList.removeEventListener('change', listener);
    };
  }, [query, matches]);

  return matches;
};


const App: React.FC = () => {
  const [modelImageUrl, setModelImageUrl] = useState<string | null>(null);
  const [outfitHistory, setOutfitHistory] = useState<OutfitLayer[]>([]);
  const [currentOutfitIndex, setCurrentOutfitIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [poseInstructions, setPoseInstructions] = useState(INITIAL_POSE_INSTRUCTIONS);
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  const [pendingPoseIndex, setPendingPoseIndex] = useState<number | null>(null);
  const [isSheetCollapsed, setIsSheetCollapsed] = useState(false);
  const [isBackgroundPanelCollapsed, setIsBackgroundPanelCollapsed] = useState(false);
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>(defaultWardrobe);
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [currentAspectRatio, setCurrentAspectRatio] = useState('2:3');
  const [undoStack, setUndoStack] = useState<(() => void)[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const isMobile = useMediaQuery('(max-width: 767px)');

  useEffect(() => {
    try {
      const storedOutfits = localStorage.getItem('my-fit-check-lookbook');
      if (storedOutfits) {
        setSavedOutfits(JSON.parse(storedOutfits));
      }
    } catch (e) {
      console.error("Failed to load saved outfits from localStorage", e);
    }
  }, []);
  
  const activeOutfitLayers = useMemo(() => 
    outfitHistory.slice(0, currentOutfitIndex + 1), 
    [outfitHistory, currentOutfitIndex]
  );
  
  const activeGarmentIds = useMemo(() => 
    activeOutfitLayers.map(layer => layer.garment?.id).filter(Boolean) as string[], 
    [activeOutfitLayers]
  );
  
  const displayImageUrl = useMemo(() => {
    if (outfitHistory.length === 0) return modelImageUrl;
    const currentLayer = outfitHistory[currentOutfitIndex];
    if (!currentLayer) return modelImageUrl;

    const poseInstruction = poseInstructions[currentPoseIndex];
    // Return the image for the current pose, or fallback to the first available image for the current layer.
    // This ensures an image is shown even while a new pose is generating.
    return currentLayer.poseImages[poseInstruction] ?? Object.values(currentLayer.poseImages)[0];
  }, [outfitHistory, currentOutfitIndex, currentPoseIndex, modelImageUrl, poseInstructions]);

  const availablePoseKeys = useMemo(() => {
    if (outfitHistory.length === 0) return [];
    const currentLayer = outfitHistory[currentOutfitIndex];
    return currentLayer ? Object.keys(currentLayer.poseImages) : [];
  }, [outfitHistory, currentOutfitIndex]);

  const handleModelFinalized = (url: string) => {
    setModelImageUrl(url);
    setOutfitHistory([{
      garment: null,
      poseImages: { [poseInstructions[0]]: url }
    }]);
    setCurrentOutfitIndex(0);
  };

  const handleStartOver = () => {
    setModelImageUrl(null);
    setOutfitHistory([]);
    setCurrentOutfitIndex(0);
    setIsLoading(false);
    setLoadingMessage('');
    setError(null);
    setCurrentPoseIndex(0);
    setPoseInstructions(INITIAL_POSE_INSTRUCTIONS);
    setIsSheetCollapsed(false);
    setWardrobe(defaultWardrobe);
    setCurrentAspectRatio('2:3');
    setUndoStack([]);
  };

  const handleGarmentSelect = useCallback(async (garmentFile: File, garmentInfo: WardrobeItem) => {
    if (!displayImageUrl || isLoading) return;

    // Caching: Check if we are re-applying a previously generated layer
    const nextLayer = outfitHistory[currentOutfitIndex + 1];
    if (nextLayer && nextLayer.garment?.id === garmentInfo.id) {
        const previousOutfitIndex = currentOutfitIndex;
        setCurrentOutfitIndex(prev => prev + 1);
        setCurrentPoseIndex(0); // Reset pose when changing layer
        setUndoStack(prev => [...prev, () => {
            setCurrentOutfitIndex(previousOutfitIndex);
        }]);
        return;
    }

    setError(null);
    setIsLoading(true);
    setLoadingMessage(`Adding ${garmentInfo.name}...`);

    try {
      const newImageUrl = garmentInfo.category === 'accessory' 
        ? await addAccessoryToImage(displayImageUrl, garmentFile, currentAspectRatio)
        : await generateVirtualTryOnImage(displayImageUrl, garmentFile, currentAspectRatio);
      
      const currentPoseInstruction = poseInstructions[currentPoseIndex];
      
      const newLayer: OutfitLayer = { 
        garment: garmentInfo, 
        poseImages: { [currentPoseInstruction]: newImageUrl } 
      };

      setOutfitHistory(prevHistory => {
        // Cut the history at the current point before adding the new layer
        const newHistory = prevHistory.slice(0, currentOutfitIndex + 1);
        return [...newHistory, newLayer];
      });
      setCurrentOutfitIndex(prev => prev + 1);
      
      const undoAction = () => {
        setCurrentOutfitIndex(prev => prev - 1);
        setCurrentPoseIndex(0);
      };
      setUndoStack(prev => [...prev, undoAction]);
      
      // Add to personal wardrobe if it's not already there
      setWardrobe(prev => {
        if (prev.find(item => item.id === garmentInfo.id)) {
            return prev;
        }
        return [...prev, garmentInfo];
      });
    // Fix: Correctly handle errors by typing the catch clause variable as `unknown` and using a helper function for user-friendly error messages.
    } catch (err: unknown) {
      setError(getFriendlyErrorMessage(err, 'Failed to apply garment'));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [displayImageUrl, isLoading, currentPoseIndex, outfitHistory, currentOutfitIndex, currentAspectRatio, poseInstructions]);

  const handleRemoveLastGarment = () => {
    if (currentOutfitIndex > 0) {
      setCurrentOutfitIndex(prevIndex => prevIndex - 1);
      setCurrentPoseIndex(0); // Reset pose to default when removing a layer
      setUndoStack([]); // This is a destructive action, so clear undo history
    }
  };
  
  const handlePoseSelect = useCallback(async (newIndex: number) => {
    if (isLoading || outfitHistory.length === 0 || newIndex === currentPoseIndex) return;
    
    const poseInstruction = poseInstructions[newIndex];
    const currentLayer = outfitHistory[currentOutfitIndex];

    // If pose already exists, just update the index to show it.
    if (currentLayer.poseImages[poseInstruction]) {
      setCurrentPoseIndex(newIndex);
      return;
    }

    // Pose doesn't exist, so generate it.
    // Use an existing image from the current layer as the base.
    const baseImageForPoseChange = Object.values(currentLayer.poseImages)[0];
    if (!baseImageForPoseChange) return; // Should not happen

    setError(null);
    setIsLoading(true);
    setLoadingMessage(`Changing pose...`);
    
    const prevPoseIndex = currentPoseIndex;
    const originalLayer = outfitHistory[currentOutfitIndex];
    // Optimistically update the pose index so the pose name changes in the UI
    setCurrentPoseIndex(newIndex);

    try {
      const newImageUrl = await generatePoseVariation(baseImageForPoseChange, poseInstruction, currentAspectRatio);
      setOutfitHistory(prevHistory => {
        const newHistory = [...prevHistory];
        const updatedLayer = {
            ...originalLayer,
            poseImages: {
                ...originalLayer.poseImages,
                [poseInstruction]: newImageUrl,
            },
        };
        newHistory[currentOutfitIndex] = updatedLayer;
        return newHistory;
      });

      const undoAction = () => {
        setOutfitHistory(prev => {
            const newHistory = [...prev];
            newHistory[currentOutfitIndex] = originalLayer;
            return newHistory;
        });
        setCurrentPoseIndex(prevPoseIndex);
      };
      setUndoStack(prev => [...prev, undoAction]);

    } catch (err: unknown) {
      setError(getFriendlyErrorMessage(err, 'Failed to change pose'));
      // Revert pose index on failure
      setCurrentPoseIndex(prevPoseIndex);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [currentPoseIndex, outfitHistory, isLoading, currentOutfitIndex, currentAspectRatio, poseInstructions]);

    // This effect runs after poseInstructions is updated and a pending index is set.
    useEffect(() => {
        if (pendingPoseIndex !== null) {
            handlePoseSelect(pendingPoseIndex);
            setPendingPoseIndex(null);
        }
    }, [poseInstructions, pendingPoseIndex, handlePoseSelect]);

    const handleCustomPose = useCallback((prompt: string) => {
        const trimmedPrompt = prompt.trim();
        if (!trimmedPrompt || isLoading) return;

        const existingIndex = poseInstructions.indexOf(trimmedPrompt);

        if (existingIndex !== -1) {
            handlePoseSelect(existingIndex);
        } else {
            const newIndex = poseInstructions.length;
            setPoseInstructions(prev => [...prev, trimmedPrompt]);
            setPendingPoseIndex(newIndex);
        }
    }, [isLoading, poseInstructions, handlePoseSelect]);

  const handleBackgroundChange = useCallback(async (backgroundPrompt: string) => {
    if (!displayImageUrl || isLoading) return;

    setError(null);
    setIsLoading(true);
    setLoadingMessage(`Changing background...`);
    const originalLayer = outfitHistory[currentOutfitIndex];
    
    try {
        const newImageUrl = await changeBackgroundImage(displayImageUrl, backgroundPrompt, currentAspectRatio);
        const currentPoseInstruction = poseInstructions[currentPoseIndex];

        setOutfitHistory(prevHistory => {
            const newHistory = [...prevHistory];
            const updatedLayer = {
                ...originalLayer,
                poseImages: {
                    ...originalLayer.poseImages,
                    [currentPoseInstruction]: newImageUrl,
                },
            };
            newHistory[currentOutfitIndex] = updatedLayer;
            return newHistory;
        });

        const undoAction = () => {
          setOutfitHistory(prev => {
              const newHistory = [...prev];
              newHistory[currentOutfitIndex] = originalLayer;
              return newHistory;
          });
        };
        setUndoStack(prev => [...prev, undoAction]);
    } catch (err: unknown) {
        setError(getFriendlyErrorMessage(err, 'Failed to change background'));
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
    }
  }, [displayImageUrl, isLoading, currentPoseIndex, currentOutfitIndex, outfitHistory, currentAspectRatio, poseInstructions]);

  const handleCustomBackgroundChange = useCallback(async (backgroundFile: File) => {
    if (!displayImageUrl || isLoading) return;

    setError(null);
    setIsLoading(true);
    setLoadingMessage(`Changing background...`);
    const originalLayer = outfitHistory[currentOutfitIndex];
    
    try {
        const newImageUrl = await changeBackgroundImageWithImage(displayImageUrl, backgroundFile, currentAspectRatio);
        const currentPoseInstruction = poseInstructions[currentPoseIndex];

        setOutfitHistory(prevHistory => {
            const newHistory = [...prevHistory];
            const updatedLayer = {
                ...originalLayer,
                poseImages: {
                    ...originalLayer.poseImages,
                    [currentPoseInstruction]: newImageUrl,
                },
            };
            newHistory[currentOutfitIndex] = updatedLayer;
            return newHistory;
        });

        const undoAction = () => {
          setOutfitHistory(prev => {
              const newHistory = [...prev];
              newHistory[currentOutfitIndex] = originalLayer;
              return newHistory;
          });
        };
        setUndoStack(prev => [...prev, undoAction]);
    } catch (err: unknown) {
        setError(getFriendlyErrorMessage(err, 'Failed to change background'));
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
    }
  }, [displayImageUrl, isLoading, currentPoseIndex, currentOutfitIndex, outfitHistory, currentAspectRatio, poseInstructions]);

  const handleAspectRatioChange = useCallback(async (newAspectRatio: string) => {
    if (!displayImageUrl || isLoading || newAspectRatio === currentAspectRatio) return;

    setError(null);
    setIsLoading(true);
    setLoadingMessage(`Changing aspect ratio...`);
    
    const prevAspectRatio = currentAspectRatio;
    const originalLayer = outfitHistory[currentOutfitIndex];
    // Optimistically update UI
    setCurrentAspectRatio(newAspectRatio);
    
    try {
        const newImageUrl = await changeImageAspectRatio(displayImageUrl, newAspectRatio);
        const currentPoseInstruction = poseInstructions[currentPoseIndex];

        setOutfitHistory(prevHistory => {
            const newHistory = [...prevHistory];
            const updatedLayer = {
                ...originalLayer,
                poseImages: {
                    ...originalLayer.poseImages,
                    [currentPoseInstruction]: newImageUrl,
                },
            };
            newHistory[currentOutfitIndex] = updatedLayer;
            return newHistory;
        });

        const undoAction = () => {
          setOutfitHistory(prev => {
              const newHistory = [...prev];
              newHistory[currentOutfitIndex] = originalLayer;
              return newHistory;
          });
          setCurrentAspectRatio(prevAspectRatio);
        };
        setUndoStack(prev => [...prev, undoAction]);

    } catch (err: unknown) {
        setError(getFriendlyErrorMessage(err, 'Failed to change aspect ratio'));
        // Revert on failure
        setCurrentAspectRatio(prevAspectRatio);
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
    }
  }, [displayImageUrl, isLoading, currentAspectRatio, currentPoseIndex, currentOutfitIndex, outfitHistory, poseInstructions]);

  const handleImageEdit = useCallback(async (maskDataUrl: string, prompt: string) => {
    if (!displayImageUrl || isLoading) return;

    setError(null);
    setIsLoading(true);
    setLoadingMessage(`Applying your edits...`);
    setIsEditing(false); // Close modal, show main loader
    const originalLayer = outfitHistory[currentOutfitIndex];

    try {
      const newImageUrl = await editImageWithMask(displayImageUrl, maskDataUrl, prompt, currentAspectRatio);
      const currentPoseInstruction = poseInstructions[currentPoseIndex];

      setOutfitHistory(prevHistory => {
        const newHistory = [...prevHistory];
        const updatedLayer = {
            ...originalLayer,
            poseImages: {
                ...originalLayer.poseImages,
                [currentPoseInstruction]: newImageUrl,
            },
        };
        newHistory[currentOutfitIndex] = updatedLayer;
        return newHistory;
      });
      
      const undoAction = () => {
        setOutfitHistory(prev => {
            const newHistory = [...prev];
            newHistory[currentOutfitIndex] = originalLayer;
            return newHistory;
        });
      };
      setUndoStack(prev => [...prev, undoAction]);
    } catch (err: unknown) {
      setError(getFriendlyErrorMessage(err, 'Failed to apply edits'));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [displayImageUrl, isLoading, currentOutfitIndex, outfitHistory, currentAspectRatio, poseInstructions]);

  const handleSaveOutfit = useCallback(() => {
    if (!displayImageUrl || activeOutfitLayers.length <= 1) return;

    const newSavedOutfit: SavedOutfit = {
        id: `outfit-${Date.now()}`,
        previewUrl: displayImageUrl,
        outfitLayers: [...activeOutfitLayers],
        poseInstruction: poseInstructions[currentPoseIndex],
    };

    setSavedOutfits(prev => {
        const newOutfits = [...prev, newSavedOutfit];
        try {
            localStorage.setItem('my-fit-check-lookbook', JSON.stringify(newOutfits));
        } catch (e: unknown) {
            setError(getFriendlyErrorMessage(e, "Could not save outfit to your device's storage. It might be full."));
        }
        return newOutfits;
    });
    
  }, [displayImageUrl, activeOutfitLayers, currentPoseIndex, poseInstructions]);

  const handleLoadOutfit = useCallback((outfit: SavedOutfit) => {
    if (isLoading) return;

    setError(null);
    
    // Check if the saved pose exists in the current pose list. If not, add it.
    let poseIndex = poseInstructions.indexOf(outfit.poseInstruction);
    if (poseIndex === -1) {
        poseIndex = poseInstructions.length;
        setPoseInstructions(prev => [...prev, outfit.poseInstruction]);
    }

    setOutfitHistory(outfit.outfitLayers);
    setCurrentOutfitIndex(outfit.outfitLayers.length - 1);
    setCurrentPoseIndex(poseIndex);
    setUndoStack([]);
  }, [isLoading, poseInstructions]);

  const handleDeleteOutfit = useCallback((outfitId: string) => {
    setSavedOutfits(prev => {
        const newOutfits = prev.filter(o => o.id !== outfitId);
        try {
            localStorage.setItem('my-fit-check-lookbook', JSON.stringify(newOutfits));
        } catch (e: unknown) {
            setError(getFriendlyErrorMessage(e, "Could not update your saved outfits on your device's storage."));
        }
        return newOutfits;
    });
  }, []);

  const handleClearWardrobe = useCallback(() => {
    setWardrobe(defaultWardrobe);
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0 || isLoading) return;
    
    setError(null);
    const lastUndoAction = undoStack[undoStack.length - 1];
    lastUndoAction(); // Execute the undo function
    setUndoStack(prev => prev.slice(0, -1)); // Pop from stack
  }, [undoStack, isLoading]);

  const viewVariants = {
    initial: { opacity: 0, y: 15 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -15 },
  };

  return (
    <div className="font-sans">
      <AnimatePresence mode="wait">
        {!modelImageUrl ? (
          <motion.div
            key="start-screen"
            className="w-screen min-h-screen flex items-start sm:items-center justify-center bg-gray-50 p-4 pb-20"
            variants={viewVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          >
            <StartScreen onModelFinalized={handleModelFinalized} />
          </motion.div>
        ) : (
          <motion.div
            key="main-app"
            className="relative flex flex-col h-screen bg-white overflow-hidden"
            variants={viewVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          >
            <main className="flex-grow relative flex flex-col md:flex-row overflow-hidden">
              <div className="w-full h-full flex-grow flex items-center justify-center bg-white pb-16 relative">
                <Canvas 
                  displayImageUrl={displayImageUrl}
                  onStartOver={handleStartOver}
                  isLoading={isLoading}
                  loadingMessage={loadingMessage}
                  onSelectPose={handlePoseSelect}
                  onCustomPose={handleCustomPose}
                  poseInstructions={poseInstructions}
                  currentPoseIndex={currentPoseIndex}
                  availablePoseKeys={availablePoseKeys}
                  onSaveOutfit={handleSaveOutfit}
                  canSaveOutfit={activeOutfitLayers.length > 1}
                  onAspectRatioChange={handleAspectRatioChange}
                  currentAspectRatio={currentAspectRatio}
                  onUndo={handleUndo}
                  canUndo={undoStack.length > 0}
                  onEdit={() => setIsEditing(true)}
                  canEdit={!!displayImageUrl && !isLoading}
                />
              </div>

              <aside 
                className={`absolute md:relative md:flex-shrink-0 bottom-0 right-0 h-auto md:h-full w-full md:w-1/3 md:max-w-sm bg-white/80 backdrop-blur-md flex flex-col border-t md:border-t-0 md:border-l border-gray-200/60 transition-transform duration-500 ease-in-out ${isSheetCollapsed ? 'translate-y-[calc(100%-4.5rem)]' : 'translate-y-0'} md:translate-y-0`}
                style={{ transitionProperty: 'transform' }}
              >
                  <button 
                    onClick={() => setIsSheetCollapsed(!isSheetCollapsed)} 
                    className="md:hidden w-full h-8 flex items-center justify-center bg-gray-100/50"
                    aria-label={isSheetCollapsed ? 'Expand panel' : 'Collapse panel'}
                  >
                    {isSheetCollapsed ? <ChevronUpIcon className="w-6 h-6 text-gray-500" /> : <ChevronDownIcon className="w-6 h-6 text-gray-500" />}
                  </button>
                  <div className="p-4 md:p-6 pb-20 overflow-y-auto flex-grow flex flex-col gap-8">
                    {error && (
                      <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md" role="alert">
                        <p className="font-bold">Error</p>
                        <p>{error}</p>
                      </div>
                    )}
                    <OutfitStack 
                      outfitHistory={activeOutfitLayers}
                      onRemoveLastGarment={handleRemoveLastGarment}
                    />
                    <WardrobePanel
                      onGarmentSelect={handleGarmentSelect}
                      activeGarmentIds={activeGarmentIds}
                      isLoading={isLoading}
                      wardrobe={wardrobe}
                      onClearWardrobe={handleClearWardrobe}
                    />
                    <LookbookPanel
                        savedOutfits={savedOutfits}
                        onLoadOutfit={handleLoadOutfit}
                        onDeleteOutfit={handleDeleteOutfit}
                        isLoading={isLoading}
                    />
                    <BackgroundPanel
                      onBackgroundChange={handleBackgroundChange}
                      onCustomBackgroundChange={handleCustomBackgroundChange}
                      isLoading={isLoading}
                      isCollapsed={isBackgroundPanelCollapsed}
                      onToggleCollapse={() => setIsBackgroundPanelCollapsed(p => !p)}
                    />
                  </div>
              </aside>
            </main>
            <AnimatePresence>
              {isLoading && isMobile && (
                <motion.div
                  className="fixed inset-0 bg-white/80 backdrop-blur-md flex flex-col items-center justify-center z-50"
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
          </motion.div>
        )}
      </AnimatePresence>
      <Footer isOnDressingScreen={!!modelImageUrl} />
      <AnimatePresence>
          {isEditing && (
              <AnnotationModal
                  isOpen={isEditing}
                  onClose={() => setIsEditing(false)}
                  onApply={handleImageEdit}
                  baseImageUrl={displayImageUrl!}
                  isLoading={isLoading}
              />
          )}
      </AnimatePresence>
    </div>
  );
};

export default App;