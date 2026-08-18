import React from 'react';
import Qwen from 'assets/Qwen.svg';
import LiquidAI from 'assets/LiquidAI.svg'
import GemmaIcon from 'assets/gemma-color.svg'
import GemmaText from 'assets/gemma-text.svg'
import './SupportedModels.css';

function SupportedModels() {
  return (
    <div id="models" className="supported-models-container">
      <div className="supported-models-header">
        <div className="supported-models-title-wrapper">
          <header className="supported-models-title-primary">
            Supported&nbsp;
          </header>
          <header className="supported-models-title-secondary">
            AI Models
          </header>
        </div>
      </div>
      <div className="supported-models-logos">
        <a
          href="https://www.liquid.ai/models"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img alt="" src={LiquidAI} className="supported-models-logo" />
        </a>
        <a
          href="https://qwen.ai/home"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img alt="" src={Qwen} className="supported-models-logo" style={{scale: '170%'}}/>
        </a>
        <a
          href="https://deepmind.google/models/gemma/gemma-4/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <div style={{display: 'flex', flex: 'row'}}>
            <img alt="" src={GemmaIcon} className="supported-models-logo" />
            <img alt="" src={GemmaText} className="supported-models-logo" style={{height:'2.5rem', margin:'auto'}} />
          </div>
        </a>
      </div>
      <div className="supported-models-footer">
        <p>
          + tons of custom models that you can
          <br />
          upload into the app
        </p>
      </div>
    </div>
  );
}

export default SupportedModels;
