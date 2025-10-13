import React, { useState } from 'react';
import chevronUp from 'assets/chevronUp.svg';
import chevronDown from 'assets/chevronDown.svg';
import './Question.css';

function Question({question, answer}: {question: string, answer: string}) {
  const [active, setActive] = useState(false);
  return (
    <div className={`question-container ${active ? 'question-container-active' : 'question-container-inactive'}`}>
      <div className="question-content">
        <header className={`question-title ${active ? 'question-title-active' : 'question-title-inactive'}`}>
          {question}
        </header>
        {active && <p className="question-answer">
          {answer}
        </p>}
      </div>
      <div className="question-chevron">
        {active ? <img alt='' src={chevronUp} onClick={()=>setActive(!active)}/> : <img alt='' src={chevronDown} onClick={()=>setActive(!active)}/>}
      </div>
    </div>
  );
}
export default Question;    
