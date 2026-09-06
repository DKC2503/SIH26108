import React from 'react';
import { 
  ShieldCheck, 
  Activity, 
  HelpCircle, 
  Globe, 
  UserCheck, 
  Layers, 
  FileText, 
  Search, 
  Clock 
} from 'lucide-react';

export default function Header({ 
  activeTab, 
  setActiveTab, 
  systemStatus, 
  onOpenStatusModal 
}) {
  const isBisAvailable = systemStatus?.bis === 'available';
  const isApiOnline = systemStatus?.api === 'online';

  const navItems = [
    { id: 'recommendations', label: 'Recommendations', icon: Layers },
    { id: 'tender', label: 'Tender Analysis', icon: FileText },
    { id: 'explorer', label: 'Standards Explorer', icon: Search },
    { id: 'history', label: 'History', icon: Clock },
  ];

  return (
    <header style={{
      height: 'var(--header-height)',
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      {/* Left: Brand Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '6px',
          background: 'linear-gradient(135deg, #D97706 0%, #1E3A8A 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
        }}>
          <ShieldCheck size={18} color="#FFFFFF" strokeWidth={2.2} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '15px', fontWeight: '700', letterSpacing: '-0.02em', color: '#FFFFFF' }}>
              BISense
            </span>
            <span style={{
              fontSize: '10px',
              fontWeight: '600',
              padding: '1px 5px',
              borderRadius: '3px',
              background: 'rgba(217, 119, 6, 0.18)',
              color: '#F59E0B',
              border: '1px solid rgba(217, 119, 6, 0.3)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              SIH 2026
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1 }}>
            Indian Standards Intelligence
          </div>
        </div>
      </div>

      {/* Center: Main Section Navigation */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '7px 14px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                background: isActive ? 'var(--bg-surface-elevated)' : 'transparent',
                border: isActive ? '1px solid var(--border-medium)' : '1px solid transparent',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={15} color={isActive ? 'var(--accent-gold-light)' : 'var(--text-muted)'} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Right: Status & Utilities */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* System Status Pill */}
        <button
          onClick={onOpenStatusModal}
          title="Click to view full system health"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '16px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border-subtle)',
            fontSize: '11.5px',
            color: 'var(--text-secondary)'
          }}
        >
          <span style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: isApiOnline ? (isBisAvailable ? '#10B981' : '#F59E0B') : '#EF4444'
          }} />
          <span>{isApiOnline ? (isBisAvailable ? 'BIS Live Active' : 'Local Index Ready') : 'System Offline'}</span>
        </button>

        {/* Language */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <Globe size={14} color="var(--text-muted)" />
          <span>EN</span>
        </div>

        {/* Organization / User */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          paddingLeft: '12px',
          borderLeft: '1px solid var(--border-subtle)'
        }}>
          <div style={{
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-medium)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <UserCheck size={13} color="var(--text-secondary)" />
          </div>
          <div style={{ fontSize: '12px', lineHeight: 1.2 }}>
            <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Procurement Officer</div>
            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Public Sector Buyer</div>
          </div>
        </div>
      </div>
    </header>
  );
}
