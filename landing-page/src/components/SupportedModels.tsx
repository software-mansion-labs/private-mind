import React from 'react';
import Qwen from 'assets/Qwen.svg';
import Phi4 from 'assets/Phi4.svg';
import LLaMA from 'assets/LLaMA.svg';
import SmolLM from 'assets/SmolLM.svg';
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
        <a href="https://huggingface.co/meta-llama" target="_blank">
          <img alt='' src={LLaMA} className="supported-models-logo"/>
        </a>
        <a href="https://huggingface.co/collections/HuggingFaceTB/smollm-6695016cad7167254ce15966" target="_blank">
          <img alt='' src={SmolLM} className="supported-models-logo"/>
        </a>
        <a href="https://qwen.ai/home" target="_blank">
          <img alt='' src={Qwen} className="supported-models-logo"/>
        </a>
        <a href="https://huggingface.co/microsoft/phi-4" target="_blank">
          <img alt='' src={Phi4} className="supported-models-logo"/>
        </a>
      </div>
      <div className="supported-models-footer">
        <p>
          + tons of custom models that you can<br />
          upload into the app
        </p>
      </div>
    </div>
  );
}

export default SupportedModels;