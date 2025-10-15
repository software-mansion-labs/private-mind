import React, { useState } from 'react';
import chevronUp from 'assets/chevronUp.svg';
import chevronDown from 'assets/chevronDown.svg';
import './Question.css';

function Question({question, answer}: {question: string, answer: string}) {
  const [active, setActive] = useState(false);
  return (
    <div className={`question-container ${active ? 'question-container-active' : 'question-container-inactive'}`} onClick={()=>setActive(!active)}>
      <div className="question-content">
        <header className={`question-title ${active ? 'question-title-active' : 'question-title-inactive'}`}>
          {question}
        </header>
        {active && <p className="question-answer">
          {answer}
        </p>}
      </div>
      <div className="question-chevron">
        <img alt='' src={active ? chevronUp : chevronDown} />
      </div>
    </div>
  );
}
export default Question;    
