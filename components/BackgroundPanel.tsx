/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import { ImageIcon } from './icons';

interface BackgroundPanelProps {
  onBackgroundChange: (prompt: string) => void;
  onCustomBackgroundChange: (file: File) => void;
  isLoading: boolean;
}

const BACKGROUND_CATEGORIES = [
  {
    name: 'Studio & Solid Colors',
    options: [
      { name: 'White', type: 'color', value: '#FFFFFF', prompt: 'a clean, solid white studio background' },
      { name: 'Gray', type: 'color', value: '#E5E7EB', prompt: 'a clean, solid light gray (#e5e7eb) studio background' },
      { name: 'Charcoal', type: 'color', value: '#4B5563', prompt: 'a clean, solid dark charcoal gray studio background' },
      { name: 'Sky Blue', type: 'color', value: '#A7C7E7', prompt: 'a clean, solid pastel sky blue background' },
      { name: 'Pastel Pink', type: 'color', value: '#F8C8DC', prompt: 'a clean, solid pastel pink background' },
      { name: 'Beige', type: 'prompt', value: 'Warm Beige', prompt: 'a warm, slightly textured beige wall background' },
    ]
  },
  {
    name: 'Nature',
    options: [
      { name: 'Garden', type: 'prompt', value: 'Garden', prompt: 'a softly blurred, bright garden background with bokeh' },
      { name: 'Misty Forest', type: 'prompt', value: 'Misty Forest', prompt: 'a misty, atmospheric forest with tall trees and soft light' },
      { name: 'Beach Sunset', type: 'prompt', value: 'Beach Sunset', prompt: 'a beautiful, serene beach at sunset with golden light' },
    ]
  },
  {
    name: 'Cityscapes',
    options: [
      { name: 'NYC Street', type: 'prompt', value: 'NYC Street', prompt: 'a bustling New York City street with a shallow depth of field, focusing on the model' },
      { name: 'Tokyo at Night', type: 'prompt', value: 'Tokyo at Night', prompt: 'a vibrant Tokyo street at night with neon signs and a bokeh effect' },
      { name: 'Rooftop View', type: 'prompt', value: 'Rooftop View', prompt: 'a scenic rooftop overlooking a city skyline during the day' },
    ]
  },
  {
    name: 'Abstract & Interior',
    options: [
        { name: 'Loft Wall', type: 'prompt', value: 'Loft Wall', prompt: 'a minimalist textured loft wall background with soft lighting' },
        { name: 'Geometric', type: 'prompt', value: 'Geometric', prompt: 'a modern, abstract background with subtle geometric patterns and neutral colors' },
        { name: 'Watercolor', type: 'prompt', value: 'Watercolor', prompt: 'a soft, abstract watercolor splash background in pastel colors' },
    ]
  }
];

const BackgroundPanel: React.FC<BackgroundPanelProps> = ({ onBackgroundChange, onCustomBackgroundChange, isLoading }) => {
  const [customPrompt, setCustomPrompt] = useState('');
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        if (!file.type.startsWith('image/')) {
            // Silently ignore non-image files. The main app can show an error if the API rejects it.
            return;
        }
        onCustomBackgroundChange(file);
    }
  };

  const handleGenerateClick = () => {
    if (customPrompt.trim() && !isLoading) {
      onBackgroundChange(customPrompt.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleGenerateClick();
    }
  };

  return (
    <div className="pt-6 border-t border-gray-400/50">
      <h2 className="text-xl font-serif tracking-wider text-gray-800 mb-4">Change Background</h2>
      <div className="flex flex-col gap-6">
        <div>
            <h3 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Create with AI</h3>
            <div className="flex flex-col gap-2">
                <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                    placeholder="A bustling Paris street in the rain with bokeh lights..."
                    className="w-full p-3 text-sm text-gray-800 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent transition-colors disabled:bg-gray-100"
                    rows={3}
                    aria-label="Custom background prompt"
                />
                <button
                    onClick={handleGenerateClick}
                    disabled={isLoading || !customPrompt.trim()}
                    className="w-full text-center bg-gray-900 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 ease-in-out hover:bg-gray-700 active:scale-95 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    title={ (customPrompt.trim() ? "Cmd/Ctrl + Enter to generate" : "")}
                >
                    Generate
                </button>
            </div>
        </div>

        {BACKGROUND_CATEGORIES.map((category) => (
          <div key={category.name}>
            <h3 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">{category.name}</h3>
            <div className="grid grid-cols-3 gap-3">
              {category.options.map((option) => (
                <button
                  key={option.name}
                  onClick={() => onBackgroundChange(option.prompt)}
                  disabled={isLoading}
                  className="aspect-square text-center border border-gray-300 text-gray-700 font-semibold rounded-lg transition-all duration-200 ease-in-out hover:border-gray-400 active:scale-95 text-xs flex items-center justify-center p-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100"
                  style={{ backgroundColor: option.type === 'color' ? option.value : '#FFFFFF' }}
                  aria-label={`Change background to ${option.name}`}
                >
                  <span style={{ color: option.type === 'color' && ['#4B5563'].includes(option.value) ? 'white' : 'inherit' }}>
                    {option.type === 'prompt' ? option.value : option.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}

        <div>
            <h3 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Upload Your Own</h3>
            <label htmlFor="custom-bg-upload" className={`relative aspect-video w-full border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-gray-500 transition-colors ${isLoading ? 'cursor-not-allowed bg-gray-100' : 'hover:border-gray-400 hover:text-gray-600 cursor-pointer'}`}>
                <ImageIcon className="w-8 h-8 mb-1"/>
                <span className="text-sm font-semibold text-center">Upload Image</span>
                <input id="custom-bg-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/webp, image/avif, image/heic, image/heif" onChange={handleFileChange} disabled={isLoading}/>
            </label>
        </div>
      </div>
    </div>
  );
};

export default BackgroundPanel;