import React, { useRef } from 'react';
import logo from './logo.svg';
import './App.css';
import Hero from './components/Hero';
import Navigation from './components/Navigation';
import Highlights from './components/Highlights';
import SupportedModels from 'components/SupportedModels';
import FAQ from 'components/FAQ';
import Contact from 'components/Contact';
import Footer from 'components/Footer';

function App() {
  return (
    <div className="app-container">
      <Navigation/>
      <Hero/>
      <Highlights/>
      <SupportedModels/>
      <FAQ/>
      <Contact/>
      <Footer />
    </div>
  );
}

export default App;
