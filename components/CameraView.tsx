/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Spinner from './Spinner';

interface CameraViewProps {
  onPhotoTaken: (dataUrl: string) => void;
  onCancel: () => void;
}

const CameraView: React.FC<CameraViewProps> = ({ onPhotoTaken, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);

  const startCamera = useCallback(async () => {
    // Stop any existing stream before starting a new one
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    
    setIsCameraLoading(true);
    setError(null);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      setError("Could not access camera. Please check your browser's permissions for this site and try again.");
      console.error("Camera access error:", err);
    } finally {
      setIsCameraLoading(false);
    }
  }, [stream]); // Dependency on stream to ensure cleanup

  useEffect(() => {
    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only on initial mount

  const handleTakePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        // Flip the image horizontally for a mirror effect, which is more intuitive for selfies
        context.translate(video.videoWidth, 0);
        context.scale(-1, 1);
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
        // Stop the stream
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          setStream(null);
        }
      }
    }
  };
  
  const handleRetake = () => {
    setCapturedImage(null);
    startCamera();
  };

  const handleConfirm = () => {
    if (capturedImage) {
      onPhotoTaken(capturedImage);
    }
  };

  const containerVariants = {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
  };

  return (
    <motion.div
        key="camera-view"
        className="w-full max-w-lg mx-auto flex flex-col items-center justify-center gap-4 p-4"
        variants={containerVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      <div className="w-full aspect-[2/3] rounded-2xl bg-gray-900 overflow-hidden relative flex items-center justify-center">
        <AnimatePresence mode="wait">
            {error ? (
                <motion.div key="error" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} className="p-8 text-center text-white">
                    <p className="font-semibold">Camera Error</p>
                    <p className="text-sm mt-2 text-gray-300">{error}</p>
                </motion.div>
            ) : capturedImage ? (
                <motion.img 
                    key="capture"
                    src={capturedImage} 
                    alt="Captured" 
                    className="w-full h-full object-cover"
                    initial={{opacity: 0, scale: 1.1}}
                    animate={{opacity: 1, scale: 1}}
                    exit={{opacity: 0, scale: 1.1}}
                />
            ) : (
                <motion.div key="video" className="w-full h-full" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}}>
                    {isCameraLoading && (
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                            <Spinner />
                        </div>
                    )}
                    <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        muted
                        className="w-full h-full object-cover transform -scale-x-100" // Mirrored view
                    />
                </motion.div>
            )}
        </AnimatePresence>
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="w-full flex items-center justify-center h-20">
        <AnimatePresence mode="wait">
          {capturedImage ? (
              <motion.div 
                key="confirm-controls"
                className="flex items-center justify-between w-full"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                  <button onClick={handleRetake} className="px-6 py-2 text-base font-semibold text-gray-700 bg-gray-200 rounded-md cursor-pointer hover:bg-gray-300 transition-colors">
                      Retake
                  </button>
                  <button onClick={handleConfirm} className="px-8 py-3 text-base font-semibold text-white bg-gray-900 rounded-md cursor-pointer hover:bg-gray-700 transition-colors">
                      Use Photo
                  </button>
              </motion.div>
          ) : (
              <motion.div 
                key="capture-controls"
                className="flex items-center justify-center w-full relative"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                  <button onClick={onCancel} className="absolute left-0 px-4 py-2 text-base font-semibold text-gray-600 rounded-md cursor-pointer hover:bg-gray-100 transition-colors">
                      Cancel
                  </button>
                  <button 
                      onClick={handleTakePhoto}
                      disabled={isCameraLoading || !!error}
                      className="w-16 h-16 rounded-full bg-white border-4 border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-50 focus:ring-gray-800 transition-transform active:scale-90"
                      aria-label="Take Photo"
                  />
              </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default CameraView;
