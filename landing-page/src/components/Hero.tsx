import React, { useRef, useState } from 'react';
import SWMLogo from 'assets/SoftwareMansionContour.svg';
import GooglePlay from 'assets/googleplay.svg'
import AppStore from 'assets/appstore.svg'
import VideoFile from 'assets/PM_promo.webm';
import './Hero.css';

function Hero() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const handleVideoClick = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  return (
    <div className="hero-container">
      <div className="hero-content">
        <a href="https://swmansion.com/" target='_blank' className="hero-attribution">
          <p>Created by</p>
          <img src={SWMLogo} alt="" />
        </a>
        <div className="hero-heading-wrapper">
          <header className="hero-heading-primary">
            Your private AI mind.
          </header>
          <header className="hero-heading-secondary">
            In your pocket. For free.
          </header>
        </div>
        <p className="hero-description">
          A new era of AI is here - powerful, personal, and completely offline - stored and performed on your mobile device.
        </p>
        <div className="hero-download-buttons">
          <a href="https://play.google.com/store/apps/details?id=com.swmansion.privatemind" target='_blank'>
            <img alt='' src={GooglePlay} />
          </a>
          <a href="https://apps.apple.com/app/private-mind/id6746713439" target='_blank'>
            <img alt='' src={AppStore} />
          </a>
        </div>
      </div>
      <div className="hero-video-wrapper" onClick={handleVideoClick}>
        <video
          ref={videoRef}
          src={VideoFile}
          loop
          muted
          playsInline
          className="hero-video"
        />
        {!isPlaying && (
          <div className="hero-video-overlay">
            <div className="hero-play-button">
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                <circle cx="40" cy="40" r="40" fill="white" fillOpacity="0.9"/>
                <path d="M32 26L56 40L32 54V26Z" fill="var(--color-primary)"/>
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Hero;