import React, { useState, useEffect, useRef } from 'react';
import FaceIcon from '@mui/icons-material/Face';

export function PersonThumb({ url, size = 60 }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef(null);
  
  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
  }, [url]);

  // Fix for React cached image bug (onLoad missing on browser-cached images)
  useEffect(() => {
    if (imgRef.current && imgRef.current.complete) {
      setIsLoaded(true);
    }
  }, [url]);

  if (!url) {
    return <FaceIcon style={{fontSize: size, color:'#94a3b8'}} />;
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {(!isLoaded || hasError) && (
        <FaceIcon style={{fontSize: size, color:'#94a3b8', position: 'absolute'}} />
      )}
      {!hasError && (
        <img 
          ref={imgRef}
          src={url} 
          loading="lazy"
          style={{width: '100%', height: '100%', objectFit: 'cover', opacity: isLoaded ? 1 : 0, transition: 'opacity 0.2s ease', position: 'relative', zIndex: 1}} 
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)} 
        />
      )}
    </div>
  );
}