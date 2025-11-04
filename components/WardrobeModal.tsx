/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import type { WardrobeItem } from '../types';
import { UploadCloudIcon, CheckCircleIcon } from './icons';

interface WardrobePanelProps {
  onGarmentSelect: (garmentFile: File, garmentInfo: WardrobeItem) => void;
  activeGarmentIds: string[];
  isLoading: boolean;
  wardrobe: WardrobeItem[];
  onClearWardrobe: () => void;
}

type Category = 'garment' | 'accessory';

// Helper to convert image URL to a File object using a canvas to bypass potential CORS issues.
const urlToFile = (url: string, filename: string): Promise<File> => {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.setAttribute('crossOrigin', 'anonymous');

        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject(new Error('Could not get canvas context.'));
            }
            ctx.drawImage(image, 0, 0);

            canvas.toBlob((blob) => {
                if (!blob) {
                    return reject(new Error('Canvas toBlob failed.'));
                }
                const mimeType = blob.type || 'image/png';
                const file = new File([blob], filename, { type: mimeType });
                resolve(file);
            }, 'image/png');
        };

        image.onerror = (error) => {
            reject(new Error(`Could not load image from URL for canvas conversion. Error: ${error}`));
        };

        image.src = url;
    });
};

const WardrobePanel: React.FC<WardrobePanelProps> = ({ onGarmentSelect, activeGarmentIds, isLoading, wardrobe, onClearWardrobe }) => {
    const [error, setError] = useState<string | null>(null);
    const [activeCategory, setActiveCategory] = useState<Category>('garment');

    const handleGarmentClick = async (item: WardrobeItem) => {
        if (isLoading || activeGarmentIds.includes(item.id)) return;
        setError(null);
        try {
            // If the item was from an upload, its URL is a blob URL. We need to fetch it to create a file.
            // If it was a default item, it's a regular URL. This handles both.
            const file = await urlToFile(item.url, item.name);
            onGarmentSelect(file, item);
        } catch (err) {
            const detailedError = `Failed to load wardrobe item. This is often a CORS issue. Check the developer console for details.`;
            setError(detailedError);
            console.error(`[CORS Check] Failed to load and convert wardrobe item from URL: ${item.url}. The browser's console should have a specific CORS error message if that's the issue.`, err);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (!file.type.startsWith('image/')) {
                setError('Please select an image file.');
                return;
            }
            const customGarmentInfo: WardrobeItem = {
                id: `custom-${Date.now()}`,
                name: file.name,
                url: URL.createObjectURL(file),
                category: activeCategory,
            };
            onGarmentSelect(file, customGarmentInfo);
        }
    };
    
    const handleClearClick = () => {
        if (window.confirm('Are you sure you want to clear all your uploaded wardrobe items? This cannot be undone.')) {
            onClearWardrobe();
        }
    };
    
    const hasCustomItems = wardrobe.some(item => item.id.startsWith('custom-'));
    const filteredWardrobe = wardrobe.filter(item => item.category === activeCategory);

  return (
    <div className="pt-6 border-t border-gray-400/50">
        <div className="flex items-center justify-between mb-3">
            <div className="flex items-baseline gap-3">
                <h2 className="text-xl font-serif tracking-wider text-gray-800">Wardrobe</h2>
                {hasCustomItems && (
                    <button 
                        onClick={handleClearClick}
                        disabled={isLoading}
                        className="text-xs font-semibold text-gray-500 hover:text-red-600 transition-colors disabled:opacity-50"
                        aria-label="Clear all uploaded wardrobe items"
                    >
                        Clear Uploads
                    </button>
                )}
            </div>
            <div className="flex items-center border border-gray-300 rounded-full p-0.5 text-sm">
                <button
                    onClick={() => setActiveCategory('garment')}
                    className={`px-3 py-1 rounded-full transition-colors ${activeCategory === 'garment' ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                    Garments
                </button>
                <button
                    onClick={() => setActiveCategory('accessory')}
                    className={`px-3 py-1 rounded-full transition-colors ${activeCategory === 'accessory' ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                    Accessories
                </button>
            </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
            {filteredWardrobe.map((item) => {
            const isActive = activeGarmentIds.includes(item.id);
            return (
                <button
                key={item.id}
                onClick={() => handleGarmentClick(item)}
                disabled={isLoading || isActive}
                className="relative aspect-square border rounded-lg overflow-hidden transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-800 group disabled:opacity-60 disabled:cursor-not-allowed"
                aria-label={`Select ${item.name}`}
                >
                <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-white text-xs font-bold text-center p-1">{item.name}</p>
                </div>
                {isActive && (
                    <div className="absolute inset-0 bg-gray-900/70 flex items-center justify-center">
                        <CheckCircleIcon className="w-8 h-8 text-white" />
                    </div>
                )}
                </button>
            );
            })}
            <label htmlFor="custom-garment-upload" className={`relative aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-gray-500 transition-colors ${isLoading ? 'cursor-not-allowed bg-gray-100' : 'hover:border-gray-400 hover:text-gray-600 cursor-pointer'}`}>
                <UploadCloudIcon className="w-6 h-6 mb-1"/>
                <span className="text-xs text-center">Upload</span>
                <input id="custom-garment-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/webp, image/avif, image/heic, image/heif" onChange={handleFileChange} disabled={isLoading}/>
            </label>
        </div>
        {filteredWardrobe.length === 0 && (
             <p className="text-center text-sm text-gray-500 mt-4">Your uploaded items for this category will appear here.</p>
        )}
        {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
    </div>
  );
};

export default WardrobePanel;