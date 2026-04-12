import { useMemo } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { useLocation } from 'react-router-dom';

function buildEmbedUrl(pathname: string, search: string) {
  // Map SPA /legacy/... to backend /__legacy/... and add embed=1.
  const rest = pathname.startsWith('/legacy') ? pathname.slice('/legacy'.length) : pathname;
  const qs = new URLSearchParams(search || '');
  qs.set('embed', '1');
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return `/__legacy${rest}${suffix}`;
}

export default function LegacyFramePage() {
  const location = useLocation();
  const embedUrl = useMemo(() => buildEmbedUrl(location.pathname, location.search), [location.pathname, location.search]);

  return (
    <div className="space-y-6">
      <section className="card p-6 lg:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="label-micro">Legacy modul (SPA ichida)</p>
            <p className="mt-2 truncate text-sm font-black text-text-primary">{location.pathname}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                const frame = document.getElementById('legacyFrame') as HTMLIFrameElement | null;
                if (frame) frame.src = embedUrl;
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-border bg-white px-4 py-3 text-sm font-bold text-text-primary"
            >
              <RefreshCw size={16} />
              Reload
            </button>
            <a
              href={embedUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-black text-white"
            >
              <ExternalLink size={16} />
              Open backend
            </a>
          </div>
        </div>
      </section>

      <section className="card overflow-hidden p-0">
        <iframe
          id="legacyFrame"
          title="Legacy module"
          src={embedUrl}
          className="h-[80vh] w-full bg-white"
          // Allow forms and same-origin so CSRF/session work.
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads"
        />
      </section>
    </div>
  );
}

