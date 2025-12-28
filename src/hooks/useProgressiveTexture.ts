import { useState, useEffect, useRef } from 'react';
import { useLoader } from '@react-three/fiber';
import { TextureLoader, Texture } from 'three';

export interface ProgressiveTextureResult {
  texture: Texture | null;
  isHighResLoaded: boolean;
  progress: number;
}

/**
 * Progressive texture loading hook that loads a low-res texture immediately
 * and progressively upgrades to high-res texture in the background.
 *
 * @param lowResUrl URL to low-resolution texture
 * @param highResUrl URL to high-resolution texture
 * @returns Current texture, loading state, and progress
 */
export function useProgressiveTexture(
  lowResUrl: string,
  highResUrl: string,
): ProgressiveTextureResult {
  const [currentTexture, setCurrentTexture] = useState<Texture | null>(null);
  const [isHighResLoaded, setIsHighResLoaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const lowResTextureRef = useRef<Texture | null>(null);
  const isDisposed = useRef(false);

  // Load low-res texture immediately (blocking load for fast initial render)
  const lowResTexture = useLoader(TextureLoader, lowResUrl);

  useEffect(() => {
    isDisposed.current = false;

    // Set low-res texture immediately
    if (lowResTexture && !isDisposed.current) {
      lowResTextureRef.current = lowResTexture;
      setCurrentTexture(lowResTexture);
      setProgress(50); // 50% progress when low-res is loaded
    }

    // Load high-res texture asynchronously
    const loader = new TextureLoader();
    let highResTexture: Texture | null = null;

    loader.load(
      highResUrl,
      (texture) => {
        if (isDisposed.current) {
          texture.dispose();
          return;
        }

        highResTexture = texture;
        setCurrentTexture(texture);
        setIsHighResLoaded(true);
        setProgress(100);

        // Dispose low-res texture after high-res is loaded to free memory
        if (lowResTextureRef.current && lowResTextureRef.current !== texture) {
          lowResTextureRef.current.dispose();
          lowResTextureRef.current = null;
        }
      },
      (xhr) => {
        if (!isDisposed.current && xhr.lengthComputable) {
          // Progress from 50% to 100% based on high-res load progress
          const highResProgress = (xhr.loaded / xhr.total) * 50;
          setProgress(50 + highResProgress);
        }
      },
      (error) => {
        console.warn('[useProgressiveTexture] Failed to load high-res texture:', error);
        // Keep low-res texture if high-res fails to load
        if (!isDisposed.current) {
          setProgress(100);
        }
      },
    );

    return () => {
      isDisposed.current = true;
      // Cleanup: dispose high-res texture if component unmounts
      if (highResTexture) {
        highResTexture.dispose();
      }
    };
  }, [lowResTexture, highResUrl]);

  return {
    texture: currentTexture,
    isHighResLoaded,
    progress,
  };
}
