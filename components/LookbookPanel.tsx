/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { SavedOutfit } from '../types';
import { XIcon } from './icons';

interface LookbookPanelProps {
  savedOutfits: SavedOutfit[];
  onLoadOutfit: (outfit: SavedOutfit) => void;
  onDeleteOutfit: (outfitId: string) => void;
  isLoading: boolean;
}

const LookbookPanel: React.FC<LookbookPanelProps> = ({ savedOutfits, onLoadOutfit, onDeleteOutfit, isLoading }) => {
  const handleDelete = (e: React.MouseEvent, outfitId: string) => {
    e.stopPropagation(); // Prevent onLoadOutfit from firing
    if (window.confirm('Are you sure you want to delete this saved outfit?')) {
        onDeleteOutfit(outfitId);
    }
  }

  return (
    <div className="pt-6 border-t border-gray-400/50">
      <h2 className="text-xl font-serif tracking-wider text-gray-800 mb-3">Lookbook</h2>
      {savedOutfits.length > 0 ? (
        <div className="grid grid-cols-3 gap-3">
          {savedOutfits.map((outfit) => (
            <button
              key={outfit.id}
              onClick={() => onLoadOutfit(outfit)}
              disabled={isLoading}
              className="relative aspect-square border rounded-lg overflow-hidden transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-800 group disabled:opacity-60 disabled:cursor-not-allowed"
              aria-label={`Load saved outfit`}
            >
              <img src={outfit.previewUrl} alt="Saved outfit" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-white text-xs font-bold text-center p-1">Load Look</p>
              </div>
              <button
                onClick={(e) => handleDelete(e, outfit.id)}
                className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all"
                aria-label="Delete saved outfit"
              >
                  <XIcon className="w-3 h-3"/>
              </button>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-center text-sm text-gray-500 mt-4">Your saved looks will appear here. Add garments and click 'Save Outfit' to build your collection.</p>
      )}
    </div>
  );
};

export default LookbookPanel;
