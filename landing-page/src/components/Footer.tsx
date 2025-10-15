import React from 'react';
import swmLogo from 'assets/SoftwareMansionContour.svg';
import twitterLogo from 'assets/twitterLogo.svg';
import facebookLogo from 'assets/facebookLogo.svg';
import ghLogo from 'assets/ghLogo.svg';
import instaLogo from 'assets/instaLogo.svg';
import ytLogo from 'assets/ytLogo.svg';
import linkedLogo from 'assets/linkedLogo.svg';
import dribbleLogo from 'assets/dribbleLogo.svg';
import discordLogo from 'assets/discordLogo.svg';
import googlePlayLogo from 'assets/googleplay.svg';
import appstoreLog from 'assets/appstore.svg';
import pmLogo from 'assets/PrivateMindLogo.svg';
import './Footer.css';

function Footer() {
  return (
    <div className="footer-container">
      <div className="footer-left">
        <div>
          <a href="https://swmansion.com/" target='_blank' rel="noopener noreferrer" className="footer-logo-section">
            <img src={swmLogo} alt="" />
            © 2025 Software Mansion
          </a>
        </div>
        <div className="footer-social-links">
          <a href="https://twitter.com/swmansion" target='_blank' rel="noopener noreferrer" className='footer-social-logo'>
            <img alt='' src={twitterLogo} />
          </a>
          <a href="https://www.facebook.com/SoftwareMansion/" target='_blank' rel="noopener noreferrer" className='footer-social-logo'>
            <img alt='' src={facebookLogo} />
          </a>
          <a href="https://github.com/software-mansion" target='_blank' rel="noopener noreferrer" className='footer-social-logo'>
            <img alt='' src={ghLogo} />
          </a>
          <a href="https://www.instagram.com/swmansion/" target='_blank' rel="noopener noreferrer" className='footer-social-logo'>
            <img alt='' src={instaLogo} />
          </a>
          <a href="https://www.youtube.com/c/SoftwareMansion" target='_blank' rel="noopener noreferrer" className='footer-social-logo'>
            <img alt='' src={ytLogo} />
          </a>
          <a href="https://www.linkedin.com/company/software-mansion/" target='_blank' rel="noopener noreferrer" className='footer-social-logo'>
            <img alt='' src={linkedLogo} />
          </a>
          <a href="https://dribbble.com/softwaremansion" target='_blank' rel="noopener noreferrer" className='footer-social-logo'>
            <img alt='' src={dribbleLogo} />
          </a>
          <a href="https://discord.com/invite/2gjSqPQc9Q" target='_blank' rel="noopener noreferrer" className='footer-social-logo'>
            <img alt='' src={discordLogo} />
          </a>
        </div>
      </div>
      <div className="footer-right">
        <div className="footer-pm-logo">
          <img alt='' src={pmLogo} />
        </div>
        <div>
          Download our app
          <div className="footer-download">
            <a href="https://play.google.com/store/apps/details?id=com.swmansion.privatemind" target='_blank' rel="noopener noreferrer" className='footer-social-logo'>
              <img alt='' src={googlePlayLogo} />
            </a>
            <a href="https://apps.apple.com/app/private-mind/id6746713439" target='_blank' rel="noopener noreferrer" className='footer-social-logo'>
              <img alt='' src={appstoreLog} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Footer;
