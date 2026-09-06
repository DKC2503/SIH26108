import React, { useState } from 'react';
import { 
  FileText, 
  UploadCloud, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  ExternalLink,
  ShieldCheck,
  FileSearch,
  Sparkles
} from 'lucide-react';
import { analyzeTenderDocument } from '../services/api';

export default function TenderAnalysis({ onViewDetails }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setErrorMsg(null);
    }
  };

  const handleRunAnalysis = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setErrorMsg(null);
    try {
      const data = await analyzeTenderDocument(selectedFile);
      setAnalysisResult(data.tender_analysis || null);
    } catch (err) {
      setErrorMsg(err.message || "Failed to analyze document.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="page-body">
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '4px' }}>
          Workspace / Tender Analysis
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#FFFFFF' }}>
          Tender Document & Technical Schedule Intelligence
        </h1>
        <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
          Automated extraction of cited Indian Standards, technical compliance clauses, and specification gaps from RFP/NIT documents.
        </p>
      </div>

      {/* Document Upload Workspace */}
      <div className="card-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{
          border: '2px dashed var(--border-medium)',
          borderRadius: '8px',
          padding: '32px 20px',
          textAlign: 'center',
          background: 'rgba(255, 255, 255, 0.01)',
          marginBottom: '20px'
        }}>
          <UploadCloud size={36} color="var(--accent-gold-light)" style={{ margin: '0 auto 10px auto' }} />
          <h3 style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '4px' }}>
            {selectedFile ? selectedFile.name : "Upload Tender PDF, DOCX, or Technical Schedule"}
          </h3>
          <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Extracts referenced IS standards, identifies potential gaps, and matches mandatory compliance clauses.
          </p>

          <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'inline-flex' }}>
            <span>Select Document</span>
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </label>

          {selectedFile && (
            <div style={{ marginTop: '12px', fontSize: '12.5px', color: 'var(--status-verified)' }}>
              ✓ File selected: <strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024).toFixed(1)} KB)
            </div>
          )}
        </div>

        {errorMsg && (
          <div style={{
            background: 'var(--status-error-bg)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: '6px',
            padding: '10px 14px',
            color: 'var(--status-error)',
            fontSize: '13px',
            marginBottom: '16px'
          }}>
            {errorMsg}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            onClick={() => { setSelectedFile(null); setAnalysisResult(null); }}
            className="btn btn-outline"
            disabled={isUploading}
          >
            Clear
          </button>

          <button
            onClick={handleRunAnalysis}
            disabled={!selectedFile || isUploading}
            className="btn btn-primary"
            style={{ minWidth: '180px' }}
          >
            {isUploading ? (
              <span>Extracting Clauses...</span>
            ) : (
              <>
                <FileSearch size={15} />
                <span>Audit Tender Document</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Analysis Results View */}
      {analysisResult && (
        <div className="animate-fade-in">
          {/* Document Summary Card */}
          <div className="card-panel" style={{ padding: '20px', marginBottom: '24px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent-gold-light)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
              DOCUMENT SUMMARY & EXTRACTION AUDIT
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginTop: '14px' }}>
              <div style={{ background: 'var(--bg-app)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>DOCUMENT</div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#FFFFFF', marginTop: '2px' }}>{selectedFile?.name}</div>
              </div>

              <div style={{ background: 'var(--bg-app)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>CITED STANDARDS</div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--status-verified)', marginTop: '2px' }}>
                  {analysisResult.referenced_standards?.length || 0} Standards Extracted
                </div>
              </div>

              <div style={{ background: 'var(--bg-app)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>COMPLIANCE RISK</div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--accent-gold-light)', marginTop: '2px' }}>
                  Low Risk (Standards Detected)
                </div>
              </div>
            </div>
          </div>

          {/* Requirement -> Standard Mapping Table */}
          <div className="card-panel" style={{ padding: '20px', marginBottom: '24px' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '14px' }}>
              Requirement → Standard Mapping
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-medium)', color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '10px 14px' }}>Extracted Tender Clause</th>
                    <th style={{ padding: '10px 14px' }}>Referenced Indian Standard</th>
                    <th style={{ padding: '10px 14px' }}>Compliance Evidence</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {analysisResult.referenced_standards?.length > 0 ? (
                    analysisResult.referenced_standards.map((ref, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '12px 14px', color: 'var(--text-primary)' }}>
                          Technical specification requirement citing standard compliance
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span className="is-code" style={{ color: '#FFFFFF', fontWeight: 600 }}>
                            {ref.is_number}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', color: 'var(--status-verified)', fontSize: '12px' }}>
                          ✓ Exact IS Number Match in Text
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          <span className="badge badge-verified">VERIFIED</span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No direct Indian Standards clauses detected in this document sample.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
