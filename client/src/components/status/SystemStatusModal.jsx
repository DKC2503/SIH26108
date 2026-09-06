import React from 'react';
import { 
  X, 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  Database, 
  Cpu, 
  Globe, 
  Layers, 
  RefreshCw 
} from 'lucide-react';

export default function SystemStatusModal({ 
  isOpen, 
  onClose, 
  status = {}, 
  onRefresh 
}) {
  if (!isOpen) return null;

  const isApiOk = status.api === 'online';
  const isBisOk = status.bis === 'available';
  const isMongoOk = status.mongodb === 'connected' || (typeof status.mongodb === 'string' && status.mongodb.includes('ok'));
  const isGeminiOk = status.gemini === 'available' || status.gemini === 'AVAILABLE';
  const isLocalIndexOk = status.localIndex === 'ready';

  const components = [
    {
      id: 'api',
      title: 'REST API Engine',
      isOk: isApiOk,
      statusText: isApiOk ? 'Operational' : 'Offline',
      description: isApiOk 
        ? 'Express backend responding with sub-millisecond route dispatch.' 
        : 'Backend server connection could not be established.',
      icon: Activity
    },
    {
      id: 'localIndex',
      title: 'Local Verified Standards Index',
      isOk: isLocalIndexOk,
      statusText: isLocalIndexOk ? 'Ready (In-Memory)' : 'Uninitialized',
      description: isLocalIndexOk
        ? 'Canonical Indian Standards indexed in-memory (< 2ms hybrid vector & keyword retrieval).'
        : 'In-memory index is being initialized from verified repository.',
      icon: Layers
    },
    {
      id: 'bis',
      title: 'Live BIS Portal Discovery',
      isOk: isBisOk,
      statusText: isBisOk ? 'Available (Operational)' : 'Unavailable',
      description: isBisOk
        ? 'Headless browser runtime verified. Dynamic discovery on standards.bis.gov.in active.'
        : 'Live BIS verification unavailable — offline verified local index remains active.',
      icon: Globe
    },
    {
      id: 'gemini',
      title: 'Gemini Generative Engine',
      isOk: isGeminiOk,
      statusText: isGeminiOk ? 'Available' : 'Deterministic Fallback Active',
      description: isGeminiOk
        ? 'Google Gemini model active for semantic technical requirement structuring.'
        : 'AI enhancement unavailable — deterministic NLP analysis remains active.',
      icon: Cpu
    },
    {
      id: 'mongo',
      title: 'MongoDB Cloud Standards Cache',
      isOk: isMongoOk,
      statusText: isMongoOk ? 'Connected' : 'Offline Fallback Active',
      description: isMongoOk
        ? 'Cloud Atlas database connected for standards persistence and historical caching.'
        : 'Cloud database unavailable — local standards index remains active.',
      icon: Database
    }
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '560px',
          background: '#FFFFFF',
          border: '1px solid var(--border-medium)',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)'
        }}
      >
        {/* Modal Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          background: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} color="var(--primary-blue)" />
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)' }}>
              System Health & Service Architecture
            </h3>
          </div>
          <button 
            onClick={onClose}
            style={{ padding: '4px', borderRadius: '4px', color: 'var(--text-secondary)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px', background: '#F8FAFC' }}>
          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
            ISRA employs high-availability zero-dependency fallbacks. Even when external cloud APIs are offline, deterministic local intelligence handles procurement queries seamlessly.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {components.map((comp) => {
              const Icon = comp.icon;
              return (
                <div
                  key={comp.id}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px'
                  }}
                >
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    background: comp.isOk ? 'var(--status-verified-bg)' : 'var(--status-warning-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px'
                  }}>
                    <Icon size={15} color={comp.isOk ? 'var(--status-verified)' : 'var(--status-warning)'} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                        {comp.title}
                      </span>
                      <span className={`badge ${comp.isOk ? 'badge-verified' : 'badge-warning'}`}>
                        {comp.statusText}
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.4 }}>
                      {comp.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-subtle)',
          background: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            ISRA Engine • Indian Standards Retrieval Architecture
          </span>

          <button
            onClick={onRefresh}
            className="btn btn-secondary btn-sm"
          >
            <RefreshCw size={12} />
            <span>Re-check Services</span>
          </button>
        </div>
      </div>
    </div>
  );
}
