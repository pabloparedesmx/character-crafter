/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';


type ImageStatus = 'pending' | 'done' | 'error';

interface CharacterPoseCardProps {
    imageUrl?: string;
    caption: string;
    status: ImageStatus;
    error?: string;
    onDownload?: (caption: string) => void;
}

const LoadingSpinner = () => (
    <div className="flex items-center justify-center h-full">
        <svg className="animate-spin h-8 w-8 text-neutral-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    </div>
);

const ErrorDisplay = ({ error }: { error?: string }) => (
    <div className="flex flex-col items-center justify-center h-full text-center p-4">
         <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-red-300">Generation Failed</p>
        {error && <p className="text-xs text-neutral-400 mt-1 max-w-full truncate">{error}</p>}
    </div>
);


const CharacterPoseCard: React.FC<CharacterPoseCardProps> = ({ imageUrl, caption, status, error, onDownload }) => {
    return (
        <motion.div 
            className="bg-neutral-900/50 backdrop-blur-sm border border-white/10 p-3 flex flex-col items-center justify-start aspect-[4/5] w-full rounded-lg shadow-lg overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 100 }}
        >
            <div className="w-full bg-neutral-900 shadow-inner flex-grow relative overflow-hidden group rounded-md">
                {status === 'pending' && <LoadingSpinner />}
                {status === 'error' && <ErrorDisplay error={error}/>}
                {status === 'done' && imageUrl && (
                    <>
                         {onDownload && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDownload(caption);
                                }}
                                className="absolute top-2 right-2 z-20 p-2 bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-black/75 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white"
                                aria-label={`Download image for ${caption}`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                            </button>
                        )}
                        
                        <motion.img
                            key={imageUrl}
                            src={imageUrl}
                            alt={caption}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.5 }}
                            className="w-full h-full object-cover"
                        />
                    </>
                )}
            </div>
            <div className="text-center pt-3 w-full">
                <p className={cn(
                    "font-permanent-marker text-lg truncate",
                    'text-neutral-300'
                )}>
                    {caption}
                </p>
            </div>
        </motion.div>
    );
};

export default CharacterPoseCard;
