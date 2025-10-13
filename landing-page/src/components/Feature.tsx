import React from 'react';
import x from "assets/CustomizationIcon.svg";
import './Feature.css';

function Feature({icon, title, text}: {icon: any, title: string, text: string}) {
  return (
    <div className="feature-container">
      <div>
        <img src={icon}/>
      </div>
      <header className="feature-title">
        {title}
      </header>
      <p className="feature-text">
        {text}
      </p>
    </div>
  );
}

export default Feature;