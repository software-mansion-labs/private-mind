import './App.css';
import Hero from './components/Hero';
import Navigation from './components/Navigation';
import Highlights from './components/Highlights';
import SupportedModels from 'components/SupportedModels';
import FAQ from 'components/FAQ';
import Contact from 'components/Contact';
import Footer from 'components/Footer';
import { TopBarBanner, TOP_BAR_BANNER } from 'components/TopBarBanner';

function App() {
  return (
    <>
      {/* Full-bleed top bar, above the centered column. Navbar is in normal
          flow (not fixed/sticky), so the bar just pushes content down — no
          offset math needed. */}
      <TopBarBanner
        zones={TOP_BAR_BANNER.zones}
        rotateIntervalMs={TOP_BAR_BANNER.rotateIntervalMs}
      />
      <div className="app-container">
        <Navigation/>
        <Hero/>
        <Highlights/>
        <SupportedModels/>
        <FAQ/>
        <Contact/>
        <Footer />
      </div>
    </>
  );
}

export default App;
