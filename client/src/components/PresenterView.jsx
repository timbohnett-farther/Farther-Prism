/**
 * Presenter View - Client Presentation UI
 * 
 * Slide-based presentation viewer with Farther branding.
 */

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, ArrowLeft, Loader2, Plus, Monitor } from 'lucide-react';
import axios from 'axios';

const API_URL = 'https://farther-prism-production.up.railway.app';

const COLORS = ['#1a7a82', '#2d9da6', '#40c0ca', '#6dcfd6', '#99dfe4', '#c5eff2'];

const PRES_TYPES = [
  { id: 'review', label: 'Quarterly Review', description: 'Portfolio performance review for client meetings' },
  { id: 'onboarding', label: 'New Client Onboarding', description: 'Welcome presentation for new relationships' },
  { id: 'planning', label: 'Planning Review', description: 'Annual planning review with goals progress' },
  { id: 'custom', label: 'Custom from Outline', description: 'Create slides from your text outline' },
];

export default function PresenterView() {
  const [householdId, setHouseholdId] = useState('');
  const [presentations, setPresentations] = useState([]);
  const [currentPres, setCurrentPres] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('home'); // home, list, view, outline
  const [outlineText, setOutlineText] = useState('');
  const [selectedType, setSelectedType] = useState(null);

  const fmt = (n) => (n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const parseOutline = (text) => {
    const slides = [];
    const lines = text.split('\n').filter(line => line.trim());
    let currentSlide = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Title slide (# Title)
      if (trimmed.startsWith('# ')) {
        if (currentSlide) slides.push(currentSlide);
        currentSlide = {
          type: 'title',
          title: trimmed.substring(2).trim(),
          subtitle: '',
        };
      }
      // Section heading (## Heading)
      else if (trimmed.startsWith('## ')) {
        if (currentSlide) slides.push(currentSlide);
        currentSlide = {
          type: 'content',
          title: trimmed.substring(3).trim(),
          bullets: [],
        };
      }
      // Bullet point (- text or * text)
      else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        if (!currentSlide) {
          currentSlide = { type: 'content', title: 'Untitled', bullets: [] };
        }
        if (currentSlide.type === 'content') {
          currentSlide.bullets.push(trimmed.substring(2).trim());
        } else if (currentSlide.type === 'title') {
          currentSlide.subtitle = trimmed.substring(2).trim();
        }
      }
      // Subtitle for title slide (plain text after title)
      else if (currentSlide && currentSlide.type === 'title' && !currentSlide.subtitle) {
        currentSlide.subtitle = trimmed;
      }
      // Additional content
      else if (currentSlide && currentSlide.type === 'content' && trimmed) {
        currentSlide.bullets.push(trimmed);
      }
    }

    if (currentSlide) slides.push(currentSlide);
    return slides.length > 0 ? slides : [{ type: 'title', title: 'Presentation', subtitle: 'Go Farther' }];
  };

  const loadPresentations = async () => {
    if (!householdId) return;
    try {
      const res = await axios.get(`${API_URL}/api/v1/presenter/household/${householdId}`);
      setPresentations(res.data.presentations || []);
      setStep('list');
    } catch (e) {
      console.error('Failed to load presentations:', e);
    }
  };

  const createPresentation = async (type) => {
    // If custom type, go to outline input step
    if (type.id === 'custom') {
      setSelectedType(type);
      setStep('outline');
      return;
    }

    // Otherwise create from portfolio data
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/v1/presenter`, {
        householdId,
        title: `${type.label} - ${new Date().toLocaleDateString()}`,
        presentationType: type.id,
      });
      setCurrentPres(res.data.presentation);
      setCurrentSlide(0);
      setStep('view');
    } catch (error) {
      console.error('Failed to create presentation:', error);
      alert('Failed to create presentation');
    } finally {
      setLoading(false);
    }
  };

  const createFromOutline = async () => {
    if (!outlineText.trim()) {
      alert('Please enter an outline');
      return;
    }

    const slides = parseOutline(outlineText);
    
    // Create presentation object locally (no API call needed for custom)
    setCurrentPres({
      id: `custom-${Date.now()}`,
      title: slides[0]?.title || 'Custom Presentation',
      presentation_type: 'custom',
      slides: slides,
      created_at: new Date().toISOString(),
    });
    setCurrentSlide(0);
    setStep('view');
  };

  const slides = currentPres?.slides || [];
  const slide = slides[currentSlide];

  const nextSlide = () => setCurrentSlide(prev => Math.min(prev + 1, slides.length - 1));
  const prevSlide = () => setCurrentSlide(prev => Math.max(prev - 1, 0));

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (step !== 'view') return;
      if (e.key === 'ArrowRight' || e.key === ' ') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
      if (e.key === 'Escape') setFullscreen(false);
      if (e.key === 'f') setFullscreen(prev => !prev);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [step, currentSlide, slides.length]);

  // Household selector
  if (!householdId || step === 'home') {
    return (
      <div className="min-h-screen bg-[#333333] p-8">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl font-bold text-[#FCFDFC] mb-4">🎬 Presenter</h1>
          <p className="text-[#FCFDFC] opacity-80 mb-8">Present with confidence. Go Farther.</p>
          
          {/* Option 1: Portfolio-Based */}
          <div className="bg-[#5b6a71] rounded-lg p-8 mb-4">
            <h2 className="text-xl font-bold text-[#FCFDFC] mb-4">Create from Portfolio Data</h2>
            <p className="text-[#FCFDFC] opacity-80 text-sm mb-4">
              Auto-generate presentations with client portfolio metrics
            </p>
            <label className="block text-[#FCFDFC] font-medium mb-2">Enter Household ID</label>
            <input
              type="text"
              placeholder="UUID of household"
              className="w-full px-4 py-3 rounded-lg bg-[#333333] text-[#FCFDFC] border-2 border-[#1a7a82] mb-4"
              value={householdId}
              onChange={(e) => setHouseholdId(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') loadPresentations(); }}
            />
            <button
              onClick={loadPresentations}
              className="px-6 py-3 bg-[#1a7a82] text-[#FCFDFC] rounded-lg hover:bg-[#1a7a82]/80 font-bold"
            >
              Open Presentations
            </button>
          </div>

          {/* Option 2: Custom Outline */}
          <div className="bg-[#5b6a71] rounded-lg p-8">
            <h2 className="text-xl font-bold text-[#FCFDFC] mb-4">Create from Text Outline</h2>
            <p className="text-[#FCFDFC] opacity-80 text-sm mb-4">
              Paste your outline and generate slides instantly
            </p>
            <button
              onClick={() => { setHouseholdId('custom'); setStep('outline'); }}
              className="px-6 py-3 bg-[#1a7a82] text-[#FCFDFC] rounded-lg hover:bg-[#1a7a82]/80 font-bold"
            >
              Create Custom Presentation →
            </button>
          </div>

          <a href="/" className="inline-block mt-6 text-[#FCFDFC] opacity-60 hover:opacity-100">← Back to Dashboard</a>
        </div>
      </div>
    );
  }

  // Presentation list
  if (step === 'list') {
    return (
      <div className="min-h-screen bg-[#333333] p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => setStep('home')} className="text-[#FCFDFC] opacity-60 hover:opacity-100"><ArrowLeft className="w-5 h-5" /></button>
            <h1 className="text-3xl font-bold text-[#FCFDFC]">🎬 Presenter</h1>
          </div>

          <h2 className="text-xl font-bold text-[#FCFDFC] mb-6">Create New Presentation</h2>
          <div className="grid grid-cols-4 gap-4 mb-8">
            {PRES_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => createPresentation(type)}
                disabled={loading}
                className="bg-[#5b6a71] rounded-lg p-6 text-left hover:bg-[#5b6a71]/80 transition border-2 border-transparent hover:border-[#1a7a82] disabled:opacity-50"
              >
                <Monitor className="w-8 h-8 text-[#1a7a82] mb-3" />
                <h3 className="text-[#FCFDFC] font-bold mb-2">{type.label}</h3>
                <p className="text-[#FCFDFC] opacity-60 text-sm">{type.description}</p>
              </button>
            ))}
          </div>

          {loading && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-[#1a7a82] mx-auto mb-2" />
              <p className="text-[#FCFDFC] opacity-80">Generating presentation...</p>
            </div>
          )}

          {presentations.length > 0 && (
            <>
              <h2 className="text-xl font-bold text-[#FCFDFC] mb-4">Previous Presentations</h2>
              {presentations.map((p) => (
                <div key={p.id} className="bg-[#5b6a71] rounded-lg p-4 mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-[#FCFDFC] font-bold">{p.title}</p>
                    <p className="text-[#FCFDFC] opacity-60 text-sm">{p.presentation_type} • {(p.slides || []).length} slides • {new Date(p.created_at).toLocaleDateString()}</p>
                  </div>
                  <button
                    onClick={() => { setCurrentPres(p); setCurrentSlide(0); setStep('view'); }}
                    className="px-3 py-1 bg-[#1a7a82] text-[#FCFDFC] rounded text-sm"
                  >
                    Present
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    );
  }

  // Outline input step
  if (step === 'outline') {
    return (
      <div className="min-h-screen bg-[#333333] p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => setStep('list')} className="text-[#FCFDFC] opacity-60 hover:opacity-100">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-3xl font-bold text-[#FCFDFC]">Create Custom Presentation</h1>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Input */}
            <div className="bg-[#5b6a71] rounded-lg p-6">
              <h2 className="text-xl font-bold text-[#FCFDFC] mb-4">Paste Your Outline</h2>
              <textarea
                value={outlineText}
                onChange={(e) => setOutlineText(e.target.value)}
                placeholder={`# Opening Slide Title
Your subtitle here

## First Section
- Key point one
- Key point two
- Key point three

## Second Section
- Another important point
- Supporting detail
- Call to action

# Thank You
Go Farther Together`}
                className="w-full h-96 px-4 py-3 bg-[#333333] text-[#FCFDFC] rounded-lg border-2 border-[#1a7a82] font-mono text-sm resize-none focus:outline-none focus:border-[#1a7a82]/80"
              />
              <button
                onClick={createFromOutline}
                disabled={!outlineText.trim()}
                className="w-full mt-4 px-6 py-3 bg-[#1a7a82] text-[#FCFDFC] rounded-lg hover:bg-[#1a7a82]/80 font-bold disabled:opacity-50"
              >
                Generate Slides
              </button>
            </div>

            {/* Instructions */}
            <div className="bg-[#5b6a71] rounded-lg p-6">
              <h2 className="text-xl font-bold text-[#FCFDFC] mb-4">Format Guide</h2>
              <div className="space-y-4 text-[#FCFDFC]">
                <div>
                  <p className="font-bold text-[#1a7a82] mb-1"># Title Slide</p>
                  <p className="text-sm opacity-80">Creates a centered title slide</p>
                  <code className="block mt-1 bg-[#333333] px-2 py-1 rounded text-xs">
                    # Welcome to Farther<br/>
                    Your subtitle here
                  </code>
                </div>

                <div>
                  <p className="font-bold text-[#1a7a82] mb-1">## Content Slide</p>
                  <p className="text-sm opacity-80">Creates a slide with heading and bullets</p>
                  <code className="block mt-1 bg-[#333333] px-2 py-1 rounded text-xs">
                    ## Our Services<br/>
                    - Planning<br/>
                    - Portfolio Management<br/>
                    - Tax Optimization
                  </code>
                </div>

                <div>
                  <p className="font-bold text-[#1a7a82] mb-1">- Bullet Points</p>
                  <p className="text-sm opacity-80">Use - or * for bullet points</p>
                  <code className="block mt-1 bg-[#333333] px-2 py-1 rounded text-xs">
                    - First point<br/>
                    - Second point<br/>
                    * Also works with asterisks
                  </code>
                </div>

                <div className="pt-4 border-t border-[#333333]">
                  <p className="text-sm opacity-80">
                    <strong>Tips:</strong><br/>
                    • One blank line between slides<br/>
                    • Keep bullets concise<br/>
                    • 3-5 bullets per slide works best<br/>
                    • Start and end with title slides
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Slide viewer
  if (step === 'view' && slide) {
    return (
      <div className={`${fullscreen ? 'fixed inset-0 z-50' : 'min-h-screen'} bg-[#333333] flex flex-col`}>
        {/* Toolbar */}
        {!fullscreen && (
          <div className="bg-[#5b6a71] px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => setStep('list')} className="text-[#FCFDFC] opacity-60 hover:opacity-100"><ArrowLeft className="w-5 h-5" /></button>
              <span className="text-[#FCFDFC] font-bold">{currentPres.title}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[#FCFDFC] opacity-60 text-sm">{currentSlide + 1} / {slides.length}</span>
              <button onClick={() => setFullscreen(true)} className="text-[#FCFDFC] opacity-60 hover:opacity-100">
                <Maximize2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Slide Content */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className={`${fullscreen ? 'w-full h-full' : 'w-full max-w-5xl aspect-[16/9]'} bg-[#5b6a71] rounded-lg p-12 flex flex-col justify-center shadow-2xl relative`}>
            {/* Farther logo watermark */}
            <div className="absolute top-6 right-8 text-[#1a7a82] font-bold text-lg opacity-40">FARTHER</div>

            {/* Title Slide */}
            {slide.type === 'title' && (
              <div className="text-center">
                <h1 className="text-5xl font-bold text-[#FCFDFC] mb-6">{slide.title}</h1>
                {slide.subtitle && <p className="text-2xl text-[#1a7a82] font-medium">{slide.subtitle}</p>}
                {slide.date && <p className="text-[#FCFDFC] opacity-60 mt-4">{slide.date}</p>}
              </div>
            )}

            {/* Content Slide (bullets) */}
            {slide.type === 'content' && (
              <div>
                <h2 className="text-3xl font-bold text-[#FCFDFC] mb-8">{slide.title}</h2>
                <ul className="space-y-4">
                  {(slide.bullets || []).map((b, i) => (
                    <li key={i} className="text-xl text-[#FCFDFC] flex items-start gap-3">
                      <span className="text-[#1a7a82] mt-1">●</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Metrics Slide */}
            {slide.type === 'metrics' && (
              <div>
                <h2 className="text-3xl font-bold text-[#FCFDFC] mb-8">{slide.title}</h2>
                <div className="grid grid-cols-2 gap-6">
                  {(slide.metrics || []).map((m, i) => (
                    <div key={i} className="bg-[#333333] rounded-lg p-6 text-center">
                      <p className="text-[#FCFDFC] opacity-60 text-sm">{m.label}</p>
                      <p className={`text-3xl font-bold mt-2 ${m.positive === false ? 'text-red-400' : m.positive ? 'text-green-400' : 'text-[#FCFDFC]'}`}>
                        {m.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Allocation Slide */}
            {slide.type === 'allocation' && (
              <div>
                <h2 className="text-3xl font-bold text-[#FCFDFC] mb-8">{slide.title}</h2>
                <div className="space-y-3">
                  {(slide.data || []).map((d, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-[#FCFDFC] mb-1">
                        <span>{d.label}</span>
                        <span className="font-bold">{((d.percentage || 0) * 100).toFixed(1)}%</span>
                      </div>
                      <div className="h-6 bg-[#333333] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${(d.percentage || 0) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Table Slide */}
            {slide.type === 'table' && (
              <div>
                <h2 className="text-3xl font-bold text-[#FCFDFC] mb-8">{slide.title}</h2>
                <table className="w-full">
                  <thead>
                    <tr>
                      {(slide.headers || []).map((h, i) => (
                        <th key={i} className="text-left text-[#1a7a82] font-bold pb-3 border-b-2 border-[#1a7a82] text-lg">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(slide.rows || []).map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j} className="text-[#FCFDFC] py-3 text-lg border-b border-[#333333]">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Slide number */}
            <div className="absolute bottom-6 right-8 text-[#FCFDFC] opacity-40 text-sm">
              {currentSlide + 1} / {slides.length}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-center gap-4 py-4">
          <button
            onClick={prevSlide}
            disabled={currentSlide === 0}
            className="p-3 bg-[#5b6a71] text-[#FCFDFC] rounded-full disabled:opacity-30 hover:bg-[#5b6a71]/80"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          {/* Slide dots */}
          <div className="flex gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`w-3 h-3 rounded-full transition ${i === currentSlide ? 'bg-[#1a7a82]' : 'bg-[#5b6a71]'}`}
              />
            ))}
          </div>

          <button
            onClick={nextSlide}
            disabled={currentSlide === slides.length - 1}
            className="p-3 bg-[#5b6a71] text-[#FCFDFC] rounded-full disabled:opacity-30 hover:bg-[#5b6a71]/80"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        {/* Fullscreen exit hint */}
        {fullscreen && (
          <div className="absolute top-4 left-4 text-[#FCFDFC] opacity-30 text-xs">Press Esc to exit • F for fullscreen</div>
        )}
      </div>
    );
  }

  return null;
}
