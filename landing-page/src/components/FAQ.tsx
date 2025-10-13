import React from 'react';
import Question from './Question';
import faq from 'assets/faq.json';
import './FAQ.css';

function FAQ() {
  return (
    <div id="faq" className="faq-container">
      <div className="faq-header">
        <div className="faq-title-wrapper">
          <header className="faq-title-primary">
            Frequently asked&nbsp;
          </header>
          <header className="faq-title-secondary">
            questions
          </header>
        </div>
      </div>
      <div className="faq-questions">
        {faq.map((question) => <Question question={question.question} answer={question.answer}/>)}
      </div>
    </div>
  );
}

export default FAQ;