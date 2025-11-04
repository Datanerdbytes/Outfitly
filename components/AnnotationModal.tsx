/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, BrushIcon, Trash2Icon, UndoIcon, RedoIcon, MinusIcon, PlusIcon } from './icons';
import Spinner from './Spinner';

interface AnnotationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (maskDataUrl: string, prompt: string) => void;
    baseImageUrl: string;
    isLoading: boolean;
}

interface Point {
    x: number;
    y: number;
}

const AnnotationModal: React.FC<AnnotationModalProps> = ({ isOpen, onClose, onApply, baseImageUrl, isLoading }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const [prompt, setPrompt] = useState('');
    const [brushSize, setBrushSize] = useState(20);
    const [isDrawing, setIsDrawing] = useState(false);
    const [history, setHistory] = useState<ImageData[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [zoom, setZoom] = useState(1);

    const getCanvasContext = useCallback(() => canvasRef.current?.getContext('2d'), []);

    const initializeCanvas = useCallback(() => {
        const image = imageRef.current;
        const canvas = canvasRef.current;
        if (!image || !canvas || !image.complete || image.naturalWidth === 0) {
            return;
        }

        const { clientWidth: width, clientHeight: height } = image;
        if (width === 0 || height === 0) return;

        // Avoid re-initializing if size is the same, preserving user's drawing on resize
        if (canvas.width === width && canvas.height === height) {
            return;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = getCanvasContext();
        if (ctx) {
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, width, height);
            const initialImageData = ctx.getImageData(0, 0, width, height);
            setHistory([initialImageData]);
            setHistoryIndex(0);
        }
    }, [getCanvasContext]);

    // Effect for canvas initialization and resizing
    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const image = imageRef.current;
        if (!image) return;
        
        // Reset state when modal opens
        setPrompt('');
        setZoom(1);
        
        image.addEventListener('load', initializeCanvas);
        window.addEventListener('resize', initializeCanvas);

        if (image.complete) {
            initializeCanvas();
        }

        return () => {
            image.removeEventListener('load', initializeCanvas);
            window.removeEventListener('resize', initializeCanvas);
        };
    }, [isOpen, baseImageUrl, initializeCanvas]);

    const saveHistory = useCallback(() => {
        const ctx = getCanvasContext();
        if (!ctx || !canvasRef.current) return;
        const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
        
        setHistory(prev => {
            const newHistory = prev.slice(0, historyIndex + 1);
            newHistory.push(imageData);
            return newHistory;
        });
        setHistoryIndex(prev => prev + 1);
    }, [getCanvasContext, historyIndex]);

    const handleUndo = useCallback(() => {
        if (historyIndex <= 0) return;

        const newIndex = historyIndex - 1;
        const ctx = getCanvasContext();
        if (ctx) {
            ctx.putImageData(history[newIndex], 0, 0);
        }
        setHistoryIndex(newIndex);
    }, [getCanvasContext, history, historyIndex]);

    const handleRedo = useCallback(() => {
        if (historyIndex >= history.length - 1) return;

        const newIndex = historyIndex + 1;
        const ctx = getCanvasContext();
        if (ctx) {
            ctx.putImageData(history[newIndex], 0, 0);
        }
        setHistoryIndex(newIndex);
    }, [getCanvasContext, history, historyIndex]);

    const getPoint = (e: React.MouseEvent | React.TouchEvent): Point | null => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY,
        };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        const point = getPoint(e);
        if (!point || isLoading) return;
        
        setIsDrawing(true);
        const ctx = getCanvasContext();
        const canvas = canvasRef.current;
        if (!ctx || !canvas) return;
        
        const rect = canvas.getBoundingClientRect();
        const scale = canvas.width / rect.width;

        ctx.lineWidth = brushSize * scale;
        ctx.strokeStyle = 'white';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = 'source-over';
        
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        if (!isDrawing || isLoading) return;
        const point = getPoint(e);
        const ctx = getCanvasContext();
        if (point && ctx) {
            ctx.lineTo(point.x, point.y);
            ctx.stroke();
        }
    };
    
    const stopDrawing = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        const ctx = getCanvasContext();
        if(ctx) {
            ctx.closePath();
            saveHistory();
        }
    };

    const handleClear = () => {
        const canvas = canvasRef.current;
        const ctx = getCanvasContext();
        if (canvas && ctx && history.length > 0) {
            ctx.putImageData(history[0], 0, 0); // Revert to initial black state
            setHistory(prev => [prev[0]]); // Keep only initial state
            setHistoryIndex(0);
        }
    };

    const handleApply = () => {
        if (!prompt.trim() || isLoading) return;
        const canvas = canvasRef.current;
        if (canvas) {
            const maskDataUrl = canvas.toDataURL('image/png');
            onApply(maskDataUrl, prompt);
        }
    };
    
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
                >
                    <motion.div
                        initial={{ scale: 0.95, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.95, y: 20 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        className="relative bg-gray-900/50 border border-gray-700 text-white rounded-2xl w-full h-full flex flex-col shadow-xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-700/60 flex-shrink-0">
                            <h2 className="text-xl font-serif tracking-wider">Edit Image</h2>
                            <button onClick={onClose} disabled={isLoading} className="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50">
                                <XIcon className="w-6 h-6"/>
                            </button>
                        </div>
                        
                        {/* Main Content */}
                        <div className="flex-grow flex flex-col md:flex-row gap-4 p-4 overflow-hidden">
                            {/* Image & Canvas */}
                            <div className="flex-grow flex items-center justify-center relative min-h-[300px] md:min-h-0 overflow-auto bg-black/20 rounded-lg">
                                <div
                                    className="relative transition-transform duration-300"
                                    style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
                                >
                                    <img
                                        ref={imageRef}
                                        src={baseImageUrl}
                                        alt="Image to edit"
                                        className="max-w-full max-h-full object-contain select-none pointer-events-none"
                                        crossOrigin="anonymous"
                                    />
                                    <canvas
                                        ref={canvasRef}
                                        className={`absolute top-0 left-0 mix-blend-screen opacity-50 ${isLoading ? 'cursor-not-allowed' : 'cursor-crosshair'}`}
                                        onMouseDown={startDrawing}
                                        onMouseMove={draw}
                                        onMouseUp={stopDrawing}
                                        onMouseLeave={stopDrawing}
                                        onTouchStart={startDrawing}
                                        onTouchMove={draw}
                                        onTouchEnd={stopDrawing}
                                    />
                                </div>
                                {/* Zoom Controls */}
                                <div className="absolute bottom-4 right-4 md:left-4 flex items-center gap-1 bg-gray-800/80 backdrop-blur-sm p-1 rounded-lg">
                                    <button 
                                        onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
                                        disabled={zoom <= 0.5 || isLoading}
                                        className="p-2 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
                                        aria-label="Zoom out"
                                    >
                                        <MinusIcon className="w-5 h-5" />
                                    </button>
                                    <span className="w-12 text-center text-sm font-medium tabular-nums text-white">{Math.round(zoom * 100)}%</span>
                                    <button 
                                        onClick={() => setZoom(z => Math.min(3, z + 0.25))}
                                        disabled={zoom >= 3 || isLoading}
                                        className="p-2 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
                                        aria-label="Zoom in"
                                    >
                                        <PlusIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Controls */}
                            <div className="w-full md:w-80 flex flex-col gap-6 flex-shrink-0">
                                <div className="bg-gray-800/70 p-4 rounded-lg">
                                    <h3 className="text-base font-semibold mb-3 text-gray-300">1. Draw to select an area</h3>
                                    <div className="flex flex-col gap-4">
                                        <div className="flex items-center gap-3">
                                            <BrushIcon className="w-5 h-5 text-gray-400" />
                                            <span className="text-sm flex-shrink-0">Brush Size</span>
                                            <input
                                                type="range"
                                                min="5"
                                                max="100"
                                                value={brushSize}
                                                onChange={(e) => setBrushSize(Number(e.target.value))}
                                                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                                                disabled={isLoading}
                                            />
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                            <button onClick={handleUndo} disabled={historyIndex <= 0 || isLoading} className="flex items-center justify-center gap-2 p-2 bg-gray-700/80 rounded-md hover:bg-gray-700 disabled:opacity-50 text-sm">
                                                <UndoIcon className="w-4 h-4" /> Undo
                                            </button>
                                            <button onClick={handleRedo} disabled={historyIndex >= history.length - 1 || isLoading} className="flex items-center justify-center gap-2 p-2 bg-gray-700/80 rounded-md hover:bg-gray-700 disabled:opacity-50 text-sm">
                                                <RedoIcon className="w-4 h-4" /> Redo
                                            </button>
                                            <button onClick={handleClear} disabled={historyIndex <= 0 || isLoading} className="flex items-center justify-center gap-2 p-2 bg-gray-700/80 rounded-md hover:bg-gray-700 text-sm disabled:opacity-50">
                                                <Trash2Icon className="w-4 h-4" /> Clear
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-800/70 p-4 rounded-lg flex-grow flex flex-col">
                                    <h3 className="text-base font-semibold mb-3 text-gray-300">2. Describe your change</h3>
                                    <textarea
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        disabled={isLoading}
                                        placeholder="e.g., Change the color to blue, add a logo here, make this sleeve shorter..."
                                        className="w-full p-3 text-sm text-white bg-gray-800/70 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors disabled:bg-gray-800 flex-grow"
                                        rows={4}
                                    />
                                </div>
                                <div className="mt-auto">
                                    <button
                                        onClick={handleApply}
                                        disabled={isLoading || !prompt.trim()}
                                        className="w-full text-center bg-indigo-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 ease-in-out hover:bg-indigo-500 active:scale-[0.98] text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {isLoading ? <><Spinner/> Applying...</> : 'Apply Changes'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default AnnotationModal;
