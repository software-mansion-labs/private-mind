import React from 'react';
import Message from 'assets/message.svg';
import googlePlayLogo from 'assets/googleplay.svg';
import appstoreLogo from 'assets/appstore.svg';
import pmLogo from 'assets/PrivateMindLogo.svg';
import swmLogo from 'assets/SoftwareMansionContour.svg';
import twitterLogo from 'assets/twitterLogo.svg';
import facebookLogo from 'assets/facebookLogo.svg';
import ghLogo from 'assets/ghLogo.svg';
import instaLogo from 'assets/instaLogo.svg';
import ytLogo from 'assets/ytLogo.svg';
import linkedLogo from 'assets/linkedLogo.svg';
import dribbleLogo from 'assets/dribbleLogo.svg';
import discordLogo from 'assets/discordLogo.svg';
import BrandStrip from 'components/BrandStrip';
import './Footer.css';

const socialLinks = [
  { href: 'https://twitter.com/swmansion', label: 'Twitter', icon: twitterLogo },
  {
    href: 'https://www.facebook.com/SoftwareMansion/',
    label: 'Facebook',
    icon: facebookLogo,
  },
  {
    href: 'https://github.com/software-mansion',
    label: 'GitHub',
    icon: ghLogo,
  },
  {
    href: 'https://www.instagram.com/swmansion/',
    label: 'Instagram',
    icon: instaLogo,
  },
  {
    href: 'https://www.youtube.com/c/SoftwareMansion',
    label: 'YouTube',
    icon: ytLogo,
  },
  {
    href: 'https://www.linkedin.com/company/software-mansion/',
    label: 'LinkedIn',
    icon: linkedLogo,
  },
  {
    href: 'https://dribbble.com/softwaremansion',
    label: 'Dribbble',
    icon: dribbleLogo,
  },
  {
    href: 'https://discord.com/invite/2gjSqPQc9Q',
    label: 'Discord',
    icon: discordLogo,
  },
];

function Footer() {
  return (
    <footer id="technology" className="footer">
      <div className="footer-content">
        <h2 className="footer-title">
          We are <span className="footer-title-accent">Software Mansion</span>
        </h2>
        <div className="footer-description">
          <p>
            We create award-winning mobile apps, real-time multimedia products,
            and AI solutions. Private Mind is based on our own technologies:
            React Native ExecuTorch, React Native RAG, Reanimated and Audio API.
          </p>
          <p>
            If you'd like to introduce on-device AI models to your own app, make
            sure to let us know—we can help you with this whole journey from the
            very beginning.
          </p>
        </div>
        <a href="mailto:ai@swmansion.com" className="footer-cta">
          <img alt="" src={Message} />
          <span>Contact us</span>
        </a>
      </div>

      <BrandStrip />

      <div className="footer-download">
        <img className="footer-download-logo" alt="Private Mind" src={pmLogo} />
        <div className="footer-download-badges">
          <a
            href="https://play.google.com/store/apps/details?id=com.swmansion.privatemind"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Get it on Google Play"
          >
            <img alt="" src={googlePlayLogo} />
          </a>
          <a
            href="https://apps.apple.com/app/private-mind/id6746713439"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Download on the App Store"
          >
            <img alt="" src={appstoreLogo} />
          </a>
        </div>
      </div>

      <div className="footer-bottom-bar">
        <div className="footer-logo-group">
          <a
            href="https://swmansion.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-swm-logo"
          >
            <img src={swmLogo} alt="Software Mansion" />
          </a>
          <a
            href="https://swmansion.com/privacy/policy/"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-legal-link"
          >
            Privacy Policy
          </a>
        </div>
        <div className="footer-social-links">
          {socialLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={link.label}
              className="footer-social-link"
            >
              <img alt="" src={link.icon} width={24} height={24} />
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}

export default Footer;
