import React from 'react';
import PMLogo from 'assets/PrivateMindLogo.svg';
import ghLogo from 'assets/ghLogo.svg';
import './Navigation.css';

function Navigation() {
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="navigation-container">
      <div>
        <img src={PMLogo} alt=""/>
      </div>
      <div className="navigation-menu">
        <div className="navigation-menu-item" onClick={() => scrollToSection('features')}>
            Features
        </div>
        <div className="navigation-menu-item" onClick={() => scrollToSection('models')}>
            Models
        </div>
        <div className="navigation-menu-item" onClick={() => scrollToSection('faq')}>
            FAQ
        </div>
        <div className="navigation-menu-item" onClick={() => scrollToSection('technology')}>
            Technology
        </div>
      </div>
      <div className="navigation-github">
        <a href="https://github.com/software-mansion-labs/private-mind" target='_blank' rel="noopener noreferrer">
          <img alt='' src={ghLogo}/>
        </a>
      </div>
    </div>
  );
}

export default Navigation;