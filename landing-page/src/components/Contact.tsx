import ETLogo from 'assets/ETLogo.svg';
import RagLogo from 'assets/RagLogo.svg';
import ReanimatedLogo from 'assets/ReanimatedLogo.svg';
import AudioAPILogo from 'assets/AudioAPILogo.svg';
import Message from 'assets/message.svg';
import './Contact.css';

function Contact() {
  return (
    <div className="contact-container">
      <div className="contact-header">
        <div className="contact-title-wrapper">
          <header className="contact-title-primary">
            We are&nbsp;
          </header>
          <header className="contact-title-secondary">
            Software Mansion
          </header>
        </div>
      </div>
      <div className="contact-description">
        <p>
          We create award-winning mobile apps, real-time multimedia products, and AI solutions. Private Mind is based on our own technologies: React Native ExecuTorch, React Native RAG, Reanimated and Audio API.
        </p>
        <p>
          If you'd like to introduce on-device AI models to your own app, make sure to let us know—we can help you with this whole journey from the very beginning.
        </p>
      </div>
      <div>
        <a href="mailto:ai@swmansion.com" className="contact-button-link">
          <div className="contact-button">
            <img alt='' src={Message} />
            <div>
              Get in touch
            </div>
          </div>
        </a>
      </div>
      <div id="technology" className="contact-technologies">
        <a href="https://docs.swmansion.com/react-native-executorch/" target='_blank' rel="noopener noreferrer">
          <img alt='' src={ETLogo} className='contact-technologies-logos'/>
        </a>
        <a href="https://github.com/software-mansion-labs/react-native-rag" target='_blank' rel="noopener noreferrer">
          <img alt='' src={RagLogo} className='contact-technologies-logos'/>
        </a>
        <a href="https://docs.swmansion.com/react-native-reanimated/" target='_blank' rel="noopener noreferrer">
          <img alt='' src={ReanimatedLogo} className='contact-technologies-logos'/>
        </a>
        <a href="https://docs.swmansion.com/react-native-audio-api/" target='_blank' rel="noopener noreferrer">
          <img alt='' src={AudioAPILogo} className='contact-technologies-logos'/>
        </a>
      </div>
    </div>
  );
}

export default Contact;