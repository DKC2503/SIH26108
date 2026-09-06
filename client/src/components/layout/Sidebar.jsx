import React from 'react';
import { 
  Layers, 
  FileText, 
  Search, 
  Clock, 
  Sliders, 
  Scale, 
  Activity, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  Shield,
  FileCheck
} from 'lucide-react';

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  collapsed, 
  setCollapsed,
  onOpenStatusModal,
  onOpenCompareModal
}) {
  const workspaceItems = [
    { id: 'recommendations', label: 'Recommendations', icon: Layers },
    { id: 'tender', label: 'Tender Analysis', icon: FileText },
    { id: 'explorer', label: 'Standards Explorer', icon: Search },
    { id: 'history', label: 'History', icon: Clock },
  ];

  return (
    <aside style={{
      width: collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      transition: 'width 0.2s ease',
      flexShrink: 0,
      userSelect: 'none'
    }}>
      {/* Top Section */}
      <div>
        {/* Toggle Collapse Button */}
        <div style={{
          padding: '14px 16px 8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          borderBottom: '1px solid var(--border-subtle)'
        }}>
          {!collapsed && (
            <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Workspace
            </span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            style={{
              padding: '4px',
              borderRadius: '4px',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Main Workspace Navigation */}
        <div style={{ padding: '12px 8px' }}>
          {workspaceItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                title={collapsed ? item.label : undefined}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: collapsed ? '10px 0' : '9px 12px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  borderRadius: '6px',
                  marginBottom: '2px',
                  fontSize: '13px',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                  background: isActive ? 'var(--bg-surface-elevated)' : 'transparent',
                  border: isActive ? '1px solid var(--border-medium)' : '1px solid transparent',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={16} color={isActive ? 'var(--accent-gold-light)' : 'var(--text-muted)'} />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </div>

        {/* Tools Section */}
        <div style={{ padding: '8px 8px', borderTop: '1px solid var(--border-subtle)' }}>
          {!collapsed && (
            <div style={{ padding: '4px 12px 8px 12px', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Tools
            </div>
          )}

          <button
            onClick={() => setActiveTab('recommendations')}
            title={collapsed ? "Requirement Analyzer" : undefined}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: collapsed ? '10px 0' : '8px 12px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              borderRadius: '6px',
              marginBottom: '2px',
              fontSize: '12.5px',
              color: 'var(--text-secondary)'
            }}
          >
            <Sliders size={15} color="var(--text-muted)" />
            {!collapsed && <span>Requirement Analyzer</span>}
          </button>

          <button
            onClick={onOpenCompareModal}
            title={collapsed ? "Standards Comparison" : undefined}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: collapsed ? '10px 0' : '8px 12px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              borderRadius: '6px',
              marginBottom: '2px',
              fontSize: '12.5px',
              color: 'var(--text-secondary)'
            }}
          >
            <Scale size={15} color="var(--text-muted)" />
            {!collapsed && <span>Standards Comparison</span>}
          </button>
        </div>

        {/* System Diagnostics Section */}
        <div style={{ padding: '8px 8px', borderTop: '1px solid var(--border-subtle)' }}>
          {!collapsed && (
            <div style={{ padding: '4px 12px 8px 12px', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              System
            </div>
          )}

          <button
            onClick={onOpenStatusModal}
            title={collapsed ? "System Status" : undefined}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: collapsed ? '10px 0' : '8px 12px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              borderRadius: '6px',
              marginBottom: '2px',
              fontSize: '12.5px',
              color: 'var(--text-secondary)'
            }}
          >
            <Activity size={15} color="var(--text-muted)" />
            {!collapsed && <span>System Status</span>}
          </button>

          <button
            onClick={() => alert("Enterprise settings managed via deployment environment.")}
            title={collapsed ? "Settings" : undefined}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: collapsed ? '10px 0' : '8px 12px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              borderRadius: '6px',
              marginBottom: '2px',
              fontSize: '12.5px',
              color: 'var(--text-secondary)'
            }}
          >
            <Settings size={15} color="var(--text-muted)" />
            {!collapsed && <span>Settings</span>}
          </button>
        </div>
      </div>

      {/* Footer Branding */}
      <div style={{
        padding: collapsed ? '12px 0' : '14px 16px',
        borderTop: '1px solid var(--border-subtle)',
        textAlign: collapsed ? 'center' : 'left'
      }}>
        {collapsed ? (
          <Shield size={16} color="var(--accent-gold-light)" />
        ) : (
          <div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-primary)' }}>
              SIH 2026
            </div>
            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
              Problem Statement 26108
            </div>
            <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Ministry of Consumer Affairs / BIS
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
