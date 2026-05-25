'use client';

import { useEffect, useRef, useState } from 'react';
import { FileDown, Loader2, AlertCircle } from 'lucide-react';
import type { ProcessFlow } from '@/types';

/**
 * Renders a P&ID-style flow diagram from a ProcessFlow node/edge graph
 * using Mermaid.js. Provides a "Download P&ID PDF" button that captures
 * the rendered SVG and exports it as a standalone landscape A3 PDF.
 *
 * Dynamic imports throughout — mermaid and html2canvas are large libraries,
 * only loaded when this component mounts.
 */

const NODE_STYLES: Record<string, string> = {
  vessel:     'fill:#1e293b,stroke:#94a3b8,stroke-width:2px,color:#fff',
  pump:       'fill:#1e3a8a,stroke:#60a5fa,stroke-width:2px,color:#fff',
  valve:      'fill:#14532d,stroke:#4ade80,stroke-width:2px,color:#fff',
  instrument: 'fill:#78350f,stroke:#fbbf24,stroke-width:2px,color:#fff',
  equipment:  'fill:#581c87,stroke:#c084fc,stroke-width:2px,color:#fff',
  fitting:    'fill:#374151,stroke:#9ca3af,stroke-width:2px,color:#fff',
  other:      'fill:#1f2937,stroke:#6b7280,stroke-width:2px,color:#fff',
};

function sanitizeId(id: string): string {
  // Mermaid IDs must be alphanumeric / underscore — no dashes, dots, slashes
  return id.replace(/[^a-zA-Z0-9_]/g, '_');
}

function escapeLabel(s: string): string {
  // Mermaid labels — escape quotes and pipes
  return s.replace(/"/g, "'").replace(/\|/g, '/');
}

function buildMermaidSource(flow: ProcessFlow): string {
  if (!flow.nodes || flow.nodes.length === 0) return '';

  const lines: string[] = ['flowchart LR'];

  // Nodes
  for (const node of flow.nodes) {
    const safeId = sanitizeId(node.id);
    const label = escapeLabel(`${node.id}<br/>${node.label || ''}`);
    lines.push(`  ${safeId}["${label}"]`);
  }

  // Edges
  for (const edge of flow.edges ?? []) {
    const fromId = sanitizeId(edge.from);
    const toId = sanitizeId(edge.to);
    if (edge.label) {
      lines.push(`  ${fromId} -->|${escapeLabel(edge.label)}| ${toId}`);
    } else {
      lines.push(`  ${fromId} --> ${toId}`);
    }
  }

  // Per-type styling
  for (const node of flow.nodes) {
    const safeId = sanitizeId(node.id);
    const style = NODE_STYLES[node.type] ?? NODE_STYLES.other;
    lines.push(`  style ${safeId} ${style}`);
  }

  return lines.join('\n');
}

interface ProcessFlowDiagramProps {
  flow: ProcessFlow;
  projectName: string;
}

export default function ProcessFlowDiagram({ flow, projectName }: ProcessFlowDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgHtml, setSvgHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renderLoading, setRenderLoading] = useState(true);
  const [downloadLoading, setDownloadLoading] = useState(false);

  // Render the diagram on mount
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setRenderLoading(true);
        setError(null);

        if (!flow.nodes || flow.nodes.length === 0) {
          throw new Error('No process flow data available');
        }

        const source = buildMermaidSource(flow);
        if (!source) throw new Error('Could not build diagram source');

        // Dynamic import — mermaid is ~200KB, only load when needed
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          themeVariables: {
            background: '#0f172a',
            primaryColor: '#1e293b',
            primaryTextColor: '#f1f5f9',
            primaryBorderColor: '#475569',
            lineColor: '#64748b',
            secondaryColor: '#1e3a8a',
            tertiaryColor: '#334155',
            fontFamily: 'Inter, system-ui, sans-serif',
          },
          flowchart: {
            curve: 'basis',
            nodeSpacing: 50,
            rankSpacing: 60,
            htmlLabels: false, // SVG-native text — required for canvas export (no taint)
          },
          securityLevel: 'loose',
        });

        const uniqueId = `flowid-pid-${Date.now()}`;
        const { svg } = await mermaid.render(uniqueId, source);
        if (cancelled) return;
        setSvgHtml(svg);
      } catch (e) {
        if (cancelled) return;
        console.error('[ProcessFlowDiagram] render failed:', e);
        setError(e instanceof Error ? e.message : 'Diagram render failed');
      } finally {
        if (!cancelled) setRenderLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [flow]);

  const handleDownload = async () => {
    if (!containerRef.current) return;
    setDownloadLoading(true);
    try {
      // Find the SVG element rendered by Mermaid
      const svgEl = containerRef.current.querySelector('svg');
      if (!svgEl) throw new Error('No diagram to download');

      // Get SVG dimensions for canvas sizing
      const bbox = svgEl.getBoundingClientRect();
      const width = bbox.width || svgEl.clientWidth || 1200;
      const height = bbox.height || svgEl.clientHeight || 800;

      // Ensure SVG has explicit dimensions for proper serialization
      const clone = svgEl.cloneNode(true) as SVGElement;
      clone.setAttribute('width', String(width));
      clone.setAttribute('height', String(height));
      // Mermaid sometimes uses viewBox without width/height — ensure both exist
      if (!clone.getAttribute('xmlns')) {
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      }

      // Serialize SVG to string
      const svgString = new XMLSerializer().serializeToString(clone);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      // Load SVG into Image, then draw to canvas (2x scale for crisp output)
      const SCALE = 2;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const imgLoadPromise = new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load SVG image'));
        img.src = url;
      });
      await imgLoadPromise;

      const canvas = document.createElement('canvas');
      canvas.width = width * SCALE;
      canvas.height = height * SCALE;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context not available');
      // Dark background to match the page theme
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(SCALE, SCALE);
      ctx.drawImage(img, 0, 0, width, height);

      URL.revokeObjectURL(url);

      // Convert canvas to PNG blob and trigger direct download
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Could not convert diagram to image');

      const safeName = projectName.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_');
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${safeName}_PID_Diagram.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (e) {
      console.error('[ProcessFlowDiagram] download failed:', e);
      alert(e instanceof Error ? e.message : 'Failed to download P&ID PDF');
    } finally {
      setDownloadLoading(false);
    }
  };

  // ── Render states ────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <h3 className="font-semibold text-amber-300">Diagram not available</h3>
            <p className="mt-1 text-sm text-amber-200/80">{error}</p>
            <p className="mt-2 text-xs text-amber-200/60">
              Older projects may not include process-flow data. Regenerate the project to get a diagram.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with download button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Process Flow Diagram</h3>
          <p className="text-xs text-slate-400">
            Auto-generated P&ID-style schematic showing equipment connections in physical flow order.
          </p>
        </div>
        <button
          onClick={handleDownload}
          disabled={renderLoading || downloadLoading || !svgHtml}
          className="flex shrink-0 items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-600/10 px-4 py-2 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-600/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {downloadLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparing image…
            </>
          ) : (
            <>
              <FileDown className="h-4 w-4" />
              Download P&ID Diagram
            </>
          )}
        </button>
      </div>

      {/* Diagram canvas */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        {renderLoading ? (
          <div className="flex h-64 items-center justify-center text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Rendering diagram…
          </div>
        ) : (
          <div
            ref={containerRef}
            className="flowid-pid-container overflow-x-auto"
            // mermaid renders trusted SVG output; we control input from our own AI schema
            dangerouslySetInnerHTML={{ __html: svgHtml ?? '' }}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {[
          { type: 'vessel',     label: 'Vessel / Tank',  color: 'bg-slate-700 border-slate-400' },
          { type: 'pump',       label: 'Pump',           color: 'bg-blue-900 border-blue-400' },
          { type: 'valve',      label: 'Valve',          color: 'bg-green-900 border-green-400' },
          { type: 'instrument', label: 'Instrument',     color: 'bg-amber-900 border-amber-400' },
          { type: 'equipment',  label: 'Process Equip.', color: 'bg-purple-900 border-purple-400' },
        ].map((item) => (
          <div key={item.type} className="flex items-center gap-2">
            <div className={`h-3 w-5 rounded-sm border ${item.color}`} />
            <span className="text-slate-400">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
