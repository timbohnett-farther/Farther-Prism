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
];

export default function PresenterView() {
  const [householdId, setHouseholdId] = useState('');
  const [presentations, setPresentations] = useState([]);
  const [currentPres, setCurrentPres] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('home'); // home, list, view

  const fmt = (n) => (n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

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
          <div className="bg-[#5b6a71] rounded-lg p-8">
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
          <div className="grid grid-cols-3 gap-4 mb-8">
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
