import React, { useState } from 'react';
import { 
  FileText, 
  Cpu, 
  Hash, 
  UploadCloud, 
  ArrowRight, 
  RotateCcw, 
  Sparkles,
  CheckCircle2,
  FileCheck
} from 'lucide-react';

export default function InputWorkspace({ 
  onAnalyze, 
  isLoading, 
  onClear,
  initialQuery = ""
}) {
  const [activeTab, setActiveTab] = useState('product'); // 'product', 'spec', 'isNumber', 'tender'
  const [productText, setProductText] = useState(initialQuery || '');
  
  // Technical spec state
  const [specProduct, setSpecProduct] = useState('');
  const [specPower, setSpecPower] = useState('');
  const [specVoltage, setSpecVoltage] = useState('');
  const [specIpRating, setSpecIpRating] = useState('');
  const [specApplication, setSpecApplication] = useState('');

  // IS number state
  const [isNumberText, setIsNumberText] = useState('');

  // Tender upload state
  const [tenderFile, setTenderFile] = useState(null);

  // Common options
  const [includeBisLive, setIncludeBisLive] = useState(true);
  const [language, setLanguage] = useState('auto');

  const examplePrompts = [
    { label: "LED Street Lighting", query: "90W LED street lights for municipal road lighting with IP66 protection" },
    { label: "Ordinary Portland Cement", query: "Ordinary Portland Cement 43 Grade for school building construction" },
    { label: "Safety Helmets", query: "Industrial safety helmets for construction workers with chin strap" },
    { label: "Fire Extinguisher", query: "Portable water type gas cartridge fire extinguishers for office premises" },
    { label: "High Tensile Rebars", query: "High strength deformed steel bars Fe 500D for concrete reinforcement" }
  ];

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (isLoading) return;

    if (activeTab === 'product') {
      if (!productText.trim()) return;
      onAnalyze(productText.trim(), 'product_description', includeBisLive);
    } else if (activeTab === 'spec') {
      const parts = [];
      if (specProduct) parts.push(specProduct);
      if (specApplication) parts.push(`for ${specApplication}`);
      if (specPower) parts.push(`${specPower} wattage`);
      if (specVoltage) parts.push(`${specVoltage} operating voltage`);
      if (specIpRating) parts.push(`with ${specIpRating} ingress protection`);
      const compiled = parts.join(' ');
      if (!compiled.trim()) return;
      onAnalyze(compiled, 'technical_specification', includeBisLive);
    } else if (activeTab === 'isNumber') {
      if (!isNumberText.trim()) return;
      onAnalyze(isNumberText.trim(), 'is_number', includeBisLive);
    } else if (activeTab === 'tender') {
      if (tenderFile) {
        onAnalyze(tenderFile, 'tender_document', includeBisLive);
      }
    }
  };

  const handleClear = () => {
    setProductText('');
    setSpecProduct('');
    setSpecPower('');
    setSpecVoltage('');
    setSpecIpRating('');
    setSpecApplication('');
    setIsNumberText('');
    setTenderFile(null);
    onClear();
  };

  const handleSelectExample = (ex) => {
    setActiveTab('product');
    setProductText(ex.query);
    onAnalyze(ex.query, 'product_description', includeBisLive);
  };

  return (
    <div className="card-panel" style={{ padding: '24px', marginBottom: '24px' }}>
      {/* Header with Procurement Context */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div>
          <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent-gold-light)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            PROCUREMENT REQUIREMENT
          </span>
          <h2 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', marginTop: '2px' }}>
            Requirement Intake & Intelligence Workspace
          </h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Input Mode:</span>
          <span className="badge badge-gold">{activeTab.toUpperCase()}</span>
        </div>
      </div>

      {/* Workspace Tabs */}
      <div className="tabs-nav" style={{ marginBottom: '16px' }}>
        <button
          className={`tab-btn ${activeTab === 'product' ? 'active' : ''}`}
          onClick={() => setActiveTab('product')}
        >
          <FileText size={15} />
          <span>Product Description</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'spec' ? 'active' : ''}`}
          onClick={() => setActiveTab('spec')}
        >
          <Cpu size={15} />
          <span>Technical Specification</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'isNumber' ? 'active' : ''}`}
          onClick={() => setActiveTab('isNumber')}
        >
          <Hash size={15} />
          <span>IS Number Search</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'tender' ? 'active' : ''}`}
          onClick={() => setActiveTab('tender')}
        >
          <UploadCloud size={15} />
          <span>Tender Document</span>
        </button>
      </div>

      {/* Form Workspace */}
      <form onSubmit={handleSubmit}>
        {/* Tab 1: Product Description */}
        {activeTab === 'product' && (
          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              What product or material are you procuring?
            </label>
            <textarea
              value={productText}
              onChange={(e) => setProductText(e.target.value)}
              rows={4}
              placeholder="e.g. LED street lights for installation along a municipal road, including electrical safety, ingress protection (IP66) and outdoor weather resistance requirements..."
              style={{
                width: '100%',
                background: 'var(--bg-app)',
                border: '1px solid var(--border-medium)',
                borderRadius: '6px',
                padding: '12px 14px',
                color: 'var(--text-primary)',
                resize: 'vertical',
                outline: 'none',
                lineHeight: '1.5'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  handleSubmit();
                }
              }}
            />
          </div>
        )}

        {/* Tab 2: Technical Specification Structured Input */}
        {activeTab === 'spec' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Primary Product / Equipment Name
              </label>
              <input
                type="text"
                value={specProduct}
                onChange={(e) => setSpecProduct(e.target.value)}
                placeholder="e.g. Luminaires for road lighting"
                style={{ width: '100%', background: 'var(--bg-app)', border: '1px solid var(--border-medium)', borderRadius: '6px', padding: '8px 12px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Intended Application / Sector
              </label>
              <input
                type="text"
                value={specApplication}
                onChange={(e) => setSpecApplication(e.target.value)}
                placeholder="e.g. Municipal highway, Hospital, Substation"
                style={{ width: '100%', background: 'var(--bg-app)', border: '1px solid var(--border-medium)', borderRadius: '6px', padding: '8px 12px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Power Rating / Capacity
              </label>
              <input
                type="text"
                value={specPower}
                onChange={(e) => setSpecPower(e.target.value)}
                placeholder="e.g. 90W, 50 kVA, 500 Liters"
                style={{ width: '100%', background: 'var(--bg-app)', border: '1px solid var(--border-medium)', borderRadius: '6px', padding: '8px 12px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Operating Voltage / Pressure
              </label>
              <input
                type="text"
                value={specVoltage}
                onChange={(e) => setSpecVoltage(e.target.value)}
                placeholder="e.g. 240V AC, 11kV, 10 bar"
                style={{ width: '100%', background: 'var(--bg-app)', border: '1px solid var(--border-medium)', borderRadius: '6px', padding: '8px 12px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Enclosure / IP Rating
              </label>
              <input
                type="text"
                value={specIpRating}
                onChange={(e) => setSpecIpRating(e.target.value)}
                placeholder="e.g. IP66, IP67, Flameproof"
                style={{ width: '100%', background: 'var(--bg-app)', border: '1px solid var(--border-medium)', borderRadius: '6px', padding: '8px 12px' }}
              />
            </div>
          </div>
        )}

        {/* Tab 3: IS Number */}
        {activeTab === 'isNumber' && (
          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Search by Official Indian Standard Number
            </label>
            <input
              type="text"
              value={isNumberText}
              onChange={(e) => setIsNumberText(e.target.value)}
              placeholder="e.g. IS 269:2015, IS 16102 (Part 1), IS 2925..."
              style={{
                width: '100%',
                background: 'var(--bg-app)',
                border: '1px solid var(--border-medium)',
                borderRadius: '6px',
                padding: '12px 14px',
                fontFamily: 'var(--font-mono)',
                fontSize: '14px',
                outline: 'none'
              }}
            />
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '6px' }}>
              Direct standard queries retrieve complete verified normative references, test methods, and amendments.
            </div>
          </div>
        )}

        {/* Tab 4: Tender Document Upload */}
        {activeTab === 'tender' && (
          <div style={{
            border: '2px dashed var(--border-medium)',
            borderRadius: '8px',
            padding: '28px',
            textAlign: 'center',
            background: 'rgba(255, 255, 255, 0.01)'
          }}>
            <UploadCloud size={32} color="var(--accent-gold-light)" style={{ margin: '0 auto 10px auto' }} />
            <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>
              {tenderFile ? tenderFile.name : "Upload Tender Document or Technical Schedule"}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 16px 0' }}>
              Supported formats: PDF, DOCX, TXT (Maximum file size: 10 MB)
            </div>
            <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'inline-flex' }}>
              <span>Browse File</span>
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setTenderFile(e.target.files[0]);
                  }
                }}
                style={{ display: 'none' }}
              />
            </label>
            {tenderFile && (
              <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--status-verified)' }}>
                ✓ {tenderFile.name} ({(tenderFile.size / 1024).toFixed(1)} KB) ready for analysis
              </div>
            )}
          </div>
        )}

        {/* Options & Action Bar */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginTop: '18px',
          paddingTop: '16px',
          borderTop: '1px solid var(--border-subtle)'
        }}>
          {/* Left Checkboxes & Language */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeBisLive}
                onChange={(e) => setIncludeBisLive(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span>Include live BIS portal verification</span>
            </label>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
              <span>Language:</span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                style={{
                  background: 'var(--bg-app)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  color: 'var(--text-secondary)',
                  fontSize: '11.5px'
                }}
              >
                <option value="auto">Auto Detect (English / Indic)</option>
                <option value="en">English (Official)</option>
                <option value="hi">Hindi (राजभाषा)</option>
              </select>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={handleClear}
              className="btn btn-outline"
              disabled={isLoading}
            >
              <RotateCcw size={14} />
              <span>Clear</span>
            </button>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
              style={{ minWidth: '190px' }}
            >
              {isLoading ? (
                <>
                  <span style={{
                    width: '14px',
                    height: '14px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#FFFFFF',
                    borderRadius: '50%',
                    display: 'inline-block',
                    animation: 'spin 0.8s linear infinite'
                  }} />
                  <span>Analyzing Requirements...</span>
                </>
              ) : (
                <>
                  <span>Analyze Requirements</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Suggested Canonical Prompts Bar */}
      <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
          Suggested Public Procurement Scenarios
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {examplePrompts.map((ex, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelectExample(ex)}
              className="btn btn-outline btn-sm"
              style={{ fontSize: '11.5px', padding: '4px 9px' }}
            >
              <Sparkles size={12} color="var(--accent-gold-light)" />
              <span>{ex.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
