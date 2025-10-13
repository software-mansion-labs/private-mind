import React from 'react';
import features from "assets/features.json";
import Feature from './Feature';
import {Icons, IconsType} from './Icons';
import IPhoneChat from 'assets/iPhoneChat.svg';
import './Highlights.css';

function Highlights() {
  return (
    <div id="features" className="highlights-container">
      <div className="highlights-header">
        <div className="highlights-tags">
          <div className="highlights-tag">
              Free
          </div>
          <div className="highlights-tag">
              Private
          </div>
          <div className="highlights-tag">
              Mobile-ready
          </div>
        </div>
        <div className="highlights-title-wrapper">
          <header className="highlights-title-primary">
            The best things about&nbsp;
          </header>
          <header className="highlights-title-secondary">
            Private Mind
          </header>
        </div>
      </div>
      <div className="highlights-content">
        <div className="highlights-column">
          {features.filter((_, idx) => idx%2===0).map(feature => <>
            <Feature title={feature.title} icon={Icons[feature.icon as IconsType]} text={feature.text}/>
          </>)}
        </div>
        <div className="highlights-image-container">
          <img src={IPhoneChat} className="highlights-phone"/>
        </div>
        <div className="highlights-column">
          {features.filter((_, idx) => idx%2===1).map(feature => <>
            <Feature title={feature.title} icon={Icons[feature.icon as IconsType]} text={feature.text}/>
          </>)}
        </div>
      </div>
      <div className="highlights-grid">
        {features.map(feature => <>
          <Feature title={feature.title} icon={Icons[feature.icon as IconsType]} text={feature.text}/>
        </>)}
      </div>
    </div>
  );
}

export default Highlights;