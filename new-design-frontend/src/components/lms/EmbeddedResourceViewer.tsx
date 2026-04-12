import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import DOMPurify from 'dompurify';
import {
  AlertCircle,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FolderOpen,
  Lock,
  Maximize2,
  Minimize2,
  Package,
  PlayCircle,
  LoaderCircle,
  Printer,
  Search,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { apiRequest } from '@/src/api/client';
import { fetchBookChapter } from '@/src/api/lms';
import type { BookChapterItem, CourseDetailResource, FolderFileItem, GlossaryEntryItem } from '@/src/types';
import { cn } from '@/src/lib/utils';
import { loadResourceFile } from '@/src/api/documents';

const DocxViewerLazy = lazy(() => import('@/src/features/document-viewer/DocxViewer').then(m => ({ default: m.DocxViewer })));
const PptxViewerLazy = lazy(() => import('@/src/features/document-viewer/PptxViewer').then(m => ({ default: m.PptxViewer })));

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

const OFFICE_EXTENSIONS = new Set(['doc', 'docx', 'ppt', 'pptx']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'ogg', 'mov', 'm4v']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac']);
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

type OfficeProvider = 'microsoft' | 'google';

type CertificateStatusResponse = {
  is_eligible: boolean;
  message: string;
  has_certificate: boolean;
  download_url: string | null;
  print_url: string | null;
};

function getFileExtension(url: string | null | undefined) {
  if (!url) return '';
  const path = url.split('?')[0].split('#')[0];
  const parts = path.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

function formatBytes(bytes: number | null | undefined) {
  if (!bytes || bytes <= 0) return null;
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

function buildAbsoluteUrl(url: string | null | undefined) {
  if (!url) return null;
  try {
    return new URL(url, window.location.origin).toString();
  } catch {
    return null;
  }
}

function isPrivateHostname(hostname: string) {
  if (LOCAL_HOSTS.has(hostname) || hostname.endsWith('.local')) {
    return true;
  }
  if (/^10\./.test(hostname) || /^192\.168\./.test(hostname)) {
    return true;
  }
  const private172 = hostname.match(/^172\.(\d{1,3})\./);
  if (private172) {
    const secondOctet = Number(private172[1]);
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }
  return false;
}

function getPublicViewerUrl(url: string | null | undefined) {
  const absoluteUrl = buildAbsoluteUrl(url);
  if (!absoluteUrl) return null;

  try {
    const parsed = new URL(absoluteUrl);
    if (!['http:', 'https:'].includes(parsed.protocol) || isPrivateHostname(parsed.hostname)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function buildOfficeViewerUrl(fileUrl: string, provider: OfficeProvider) {
  if (provider === 'google') {
    return `https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`;
  }
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
}

function getYoutubeId(url: string | null | undefined) {
  if (!url) return null;
  const patterns = [
    /youtu\.be\/([A-Za-z0-9_-]{6,})/,
    /youtube\.com\/watch\?v=([A-Za-z0-9_-]{6,})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function getVimeoId(url: string | null | undefined) {
  if (!url) return null;
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return match ? match[1] : null;
}

function sanitizeRichHtml(html: string) {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'loading', 'referrerpolicy', 'scrolling', 'style', 'target'],
  });
}

function PreviewSkeleton({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[360px] flex-col gap-4 bg-slate-100/70 p-6">
      <div className="h-3 w-32 rounded shimmer bg-slate-200" />
      <div className="h-10 w-full rounded-2xl shimmer bg-slate-200" />
      <div className="grid flex-1 gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="rounded-[28px] border border-border/60 bg-white/70 p-5">
          <div className="h-full min-h-[280px] rounded-[20px] shimmer bg-slate-200" />
        </div>
        <div className="space-y-3 rounded-[28px] border border-border/60 bg-white/70 p-5">
          <div className="h-5 w-28 rounded shimmer bg-slate-200" />
          <div className="h-4 w-full rounded shimmer bg-slate-200" />
          <div className="h-4 w-5/6 rounded shimmer bg-slate-200" />
          <div className="h-10 w-full rounded-2xl shimmer bg-slate-200" />
        </div>
      </div>
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-text-muted">{label}</p>
    </div>
  );
}

function UnsupportedPreview({
  title,
  description,
  downloadUrl,
  externalUrl,
}: {
  title: string;
  description: string;
  downloadUrl: string | null;
  externalUrl: string | null;
}) {
  return (
    <div className="flex h-full min-h-[420px] flex-col items-center justify-center bg-slate-100 px-6 py-10 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-white text-amber-600 shadow-premium">
        <AlertCircle size={34} />
      </div>
      <h4 className="mt-6 text-2xl font-black tracking-tight text-text-primary">{title}</h4>
      <p className="mt-3 max-w-xl text-sm font-medium leading-7 text-text-secondary">{description}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {downloadUrl ? (
          <a
            href={downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-premium"
          >
            <Download size={16} />
            Yuklab olish
          </a>
        ) : null}
        {externalUrl ? (
          <a
            href={externalUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-2xl border border-border bg-white px-5 py-3 text-sm font-bold text-text-primary"
          >
            <ExternalLink size={16} />
            Tashqi oynada ochish
          </a>
        ) : null}
      </div>
    </div>
  );
}

function HtmlContent({
  html,
  emptyMessage,
}: {
  html: string | null | undefined;
  emptyMessage: string;
}) {
  const safeHtml = sanitizeRichHtml(html || '');
  if (!safeHtml.trim()) {
    return <p className="text-sm font-medium text-text-secondary">{emptyMessage}</p>;
  }
  return <div className="prose max-w-none text-text-secondary" dangerouslySetInnerHTML={{ __html: safeHtml }} />;
}

function PdfPreview({ fileUrl, title }: { fileUrl: string; title: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [containerWidth, setContainerWidth] = useState(960);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  useEffect(() => {
    setZoom(1);
    setLoadingError(null);
  }, [fileUrl]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === 'undefined') {
      return;
    }

    const updateWidth = () => {
      setContainerWidth(Math.max(node.clientWidth - 48, 280));
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  if (loadingError) {
    return (
      <UnsupportedPreview
        title="PDF preview ochilmadi"
        description={loadingError}
        downloadUrl={fileUrl}
        externalUrl={fileUrl}
      />
    );
  }

  const pageWidth = Math.max(Math.floor(containerWidth * zoom), 260);

  return (
    <div className="flex h-full min-h-[420px] flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-text-muted">
          <span className="rounded-full bg-white px-3 py-1 text-[11px] text-primary shadow-sm">PDF</span>
          {pageCount ? <span>{pageCount}-bet</span> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom((current) => Math.max(0.5, Number((current - 0.15).toFixed(2))))}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white text-text-primary"
            title="Kichraytirish"
          >
            <ZoomOut size={18} />
          </button>
          <span className="min-w-16 text-center text-sm font-black text-text-primary">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((current) => Math.min(2.5, Number((current + 0.15).toFixed(2))))}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white text-text-primary"
            title="Kattalashtirish"
          >
            <ZoomIn size={18} />
          </button>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 overflow-auto bg-slate-200/70 p-4 sm:p-6">
        <Document
          file={fileUrl}
          loading={<PreviewSkeleton label="PDF yuklanmoqda" />}
          onLoadSuccess={({ numPages }) => setPageCount(numPages)}
          onLoadError={(err) => { console.error("[PdfPreview]", err); setLoadingError("PDF yuklanmadi"); }}
          error={<PreviewSkeleton label="PDF tayyorlanmoqda" />}
          className="flex flex-col items-center gap-4"
        >
          {Array.from({ length: pageCount }, (_, i) => (
            <div key={i} className="rounded-2xl bg-white p-2 shadow-xl">
              <Page
                pageNumber={i + 1}
                width={pageWidth}
                renderTextLayer
                renderAnnotationLayer
                loading={<div className="flex items-center justify-center" style={{ width: pageWidth, height: pageWidth * 1.4 }}><LoaderCircle className="w-6 h-6 animate-spin text-blue-400" /></div>}
              />
            </div>
          ))}
        </Document>
      </div>
      <div className="border-t border-border/60 bg-white px-4 py-3 text-xs font-medium text-text-secondary sm:px-6">
        <span className="font-bold text-text-primary">{title}</span> — scroll qilib barcha sahifalarni ko'ring, zoom bilan kattalashtiring.
      </div>
    </div>
  );
}

function OfficePreview({ fileUrl }: { fileUrl: string }) {
  const [provider, setProvider] = useState<OfficeProvider>('microsoft');
  const [isLoading, setIsLoading] = useState(true);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    setTimedOut(false);
    const timer = window.setTimeout(() => {
      setTimedOut(true);
    }, 7000);
    return () => window.clearTimeout(timer);
  }, [fileUrl, provider]);

  const viewerUrl = buildOfficeViewerUrl(fileUrl, provider);

  return (
    <div className="relative flex h-full min-h-[420px] flex-col bg-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-primary shadow-sm">
            Office Preview
          </span>
          <span className="text-xs font-medium text-text-secondary">Agar birinchi viewer ishlamasa, ikkinchisiga o‘ting.</span>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-white p-1">
          <button
            type="button"
            onClick={() => setProvider('microsoft')}
            className={cn(
              'rounded-xl px-3 py-2 text-xs font-bold transition-colors',
              provider === 'microsoft' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'
            )}
          >
            Microsoft
          </button>
          <button
            type="button"
            onClick={() => setProvider('google')}
            className={cn(
              'rounded-xl px-3 py-2 text-xs font-bold transition-colors',
              provider === 'google' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'
            )}
          >
            Google
          </button>
        </div>
      </div>

      <div className="relative flex-1">
        {isLoading ? (
          <div className="absolute inset-0 z-10">
            <PreviewSkeleton label="Office fayli yuklanmoqda" />
          </div>
        ) : null}
        <iframe
          src={viewerUrl}
          title="office-resource-preview"
          className="h-[70vh] w-full border-none bg-white"
          onLoad={() => setIsLoading(false)}
        />
      </div>

      {timedOut ? (
        <div className="border-t border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 sm:px-6">
          Preview sekin yuklanyapti. Server URL public bo‘lishi, `CORS` ruxsatlari va `iframe` bloklanmasligi kerak.
        </div>
      ) : null}
    </div>
  );
}

function VideoPanel({ resource }: { resource: CourseDetailResource }) {
  const youtubeId = getYoutubeId(resource.url);
  const vimeoId = getVimeoId(resource.url);
  const fileUrl = buildAbsoluteUrl(resource.file_url || resource.url);
  const extension = getFileExtension(resource.file_url || resource.url);

  if ((resource.video_source === 'youtube' || youtubeId) && youtubeId) {
    return (
      <div className="flex h-full min-h-[420px] flex-col bg-slate-950">
        <div className="aspect-video w-full">
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}?rel=0`}
            title={resource.title}
            className="h-full w-full border-none"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <div className="border-t border-white/10 bg-slate-950 px-5 py-4 text-sm text-white/70">
          YouTube video ichki oynada ochildi.
        </div>
      </div>
    );
  }

  if ((resource.video_source === 'vimeo' || vimeoId) && vimeoId) {
    return (
      <div className="flex h-full min-h-[420px] flex-col bg-slate-950">
        <div className="aspect-video w-full">
          <iframe
            src={`https://player.vimeo.com/video/${vimeoId}`}
            title={resource.title}
            className="h-full w-full border-none"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
        <div className="border-t border-white/10 bg-slate-950 px-5 py-4 text-sm text-white/70">
          Vimeo video ichki oynada ochildi.
        </div>
      </div>
    );
  }

  if (fileUrl && (resource.file_url || VIDEO_EXTENSIONS.has(extension))) {
    return (
      <div className="flex h-full min-h-[420px] flex-col bg-slate-950">
        <video
          className="h-full max-h-[78vh] w-full bg-black"
          controls
          playsInline
          preload="metadata"
          poster={resource.video_poster_url || undefined}
          src={fileUrl}
        />
      </div>
    );
  }

  return (
    <UnsupportedPreview
      title="Video preview tayyor emas"
      description="Video manbasi topilmadi yoki bu URL ichki oynada ko‘rsatib bo‘lmadi."
      downloadUrl={fileUrl}
      externalUrl={fileUrl}
    />
  );
}

function AudioPanel({ resource }: { resource: CourseDetailResource }) {
  const audioUrl = buildAbsoluteUrl(resource.file_url || resource.url);
  const extension = getFileExtension(resource.file_url || resource.url);

  if (!audioUrl && !AUDIO_EXTENSIONS.has(extension)) {
    return (
      <UnsupportedPreview
        title="Audio topilmadi"
        description="Audio fayl yoki URL mavjud emas."
        downloadUrl={null}
        externalUrl={null}
      />
    );
  }

  return (
    <div className="flex h-full min-h-[420px] flex-col justify-center bg-gradient-to-b from-rose-50 via-white to-white px-6 py-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 rounded-[32px] border border-border/60 bg-white p-8 shadow-premium">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-rose-100 text-rose-600">
            <PlayCircle size={30} />
          </div>
          <div>
            <h4 className="text-2xl font-black tracking-tight text-text-primary">{resource.title}</h4>
            <p className="mt-1 text-sm font-medium text-text-secondary">Audio material</p>
          </div>
        </div>

        {audioUrl ? (
          <audio className="w-full" controls preload="metadata" src={audioUrl}>
            Brauzeringiz audio preview’ni qo‘llab-quvvatlamaydi.
          </audio>
        ) : null}

        {resource.audio_transcript ? (
          <details className="rounded-[24px] border border-border/60 bg-slate-50 p-5">
            <summary className="cursor-pointer list-none text-sm font-black text-text-primary">
              Transkriptni ko‘rish
            </summary>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-text-secondary">{resource.audio_transcript}</p>
          </details>
        ) : null}
      </div>
    </div>
  );
}

function EmbedPanel({
  resource,
  label,
}: {
  resource: CourseDetailResource;
  label: string;
}) {
  const embedUrl = buildAbsoluteUrl(resource.url);
  if (!embedUrl) {
    return (
      <UnsupportedPreview
        title={`${label} ochilmadi`}
        description="URL topilmadi yoki noto‘g‘ri formatda."
        downloadUrl={null}
        externalUrl={null}
      />
    );
  }

  return (
    <div className="flex h-full min-h-[420px] flex-col bg-slate-100">
      <div className="flex items-center justify-between border-b border-border/60 bg-white px-5 py-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-text-muted">{label}</p>
          <p className="mt-1 text-sm font-medium text-text-secondary">External sahifa iframe orqali ko‘rsatilmoqda.</p>
        </div>
        <a
          href={embedUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-2xl border border-border bg-white px-4 py-2 text-sm font-bold text-text-primary"
        >
          <ExternalLink size={16} />
          Tashqi oynada ochish
        </a>
      </div>
      <iframe
        src={embedUrl}
        title={resource.title}
        className="w-full flex-1 border-none bg-white"
        style={{ height: resource.embed_height || '500px' }}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}

function H5PPanel({ resource }: { resource: CourseDetailResource }) {
  if (!resource.h5p_embed_code.trim()) {
    return (
      <UnsupportedPreview
        title="H5P kodi topilmadi"
        description="H5P resursi uchun embed kod kiritilmagan."
        downloadUrl={null}
        externalUrl={null}
      />
    );
  }

  const safeHtml = sanitizeRichHtml(resource.h5p_embed_code);

  return (
    <div className="flex h-full min-h-[420px] flex-col bg-gradient-to-b from-orange-50 via-white to-white px-6 py-8">
      <div className="rounded-[32px] border border-border/60 bg-white p-5 shadow-premium">
        <div className="mb-4">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-600">H5P Interactive</p>
          <p className="mt-1 text-sm font-medium text-text-secondary">Interaktiv kontent xavfsiz filtrlab render qilinmoqda.</p>
        </div>
        <div className="overflow-hidden rounded-[24px] border border-border/60 bg-slate-50 p-3" dangerouslySetInnerHTML={{ __html: safeHtml }} />
      </div>
    </div>
  );
}

function ScormPanel({ resource }: { resource: CourseDetailResource }) {
  const scormUrl = resource.url
    ? buildAbsoluteUrl(resource.url)
    : resource.scorm_entry_url.startsWith('/')
      ? buildAbsoluteUrl(resource.scorm_entry_url)
      : null;
  const downloadUrl = buildAbsoluteUrl(resource.file_url);
  if (scormUrl) {
    return (
      <div className="flex h-full min-h-[420px] flex-col bg-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-white px-5 py-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-600">SCORM {resource.scorm_version || 'paket'}</p>
            <p className="mt-1 text-sm font-medium text-text-secondary">SCORM entry sahifasi iframe orqali ishga tushirildi.</p>
          </div>
          {downloadUrl ? (
            <a
              href={downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl border border-border bg-white px-4 py-2 text-sm font-bold text-text-primary"
            >
              <Download size={16} />
              Paketni yuklab olish
            </a>
          ) : null}
        </div>
        <iframe
          src={scormUrl}
          title={resource.title}
          className="w-full flex-1 border-none bg-white"
          style={{ minHeight: '70vh' }}
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[420px] flex-col items-center justify-center bg-gradient-to-b from-amber-50 to-white px-6 py-10 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-amber-100 text-amber-600 shadow-premium">
        <Package size={34} />
      </div>
      <h4 className="mt-6 text-2xl font-black tracking-tight text-text-primary">{resource.title}</h4>
      <p className="mt-3 max-w-xl text-sm font-medium leading-7 text-text-secondary">
        Hozircha SCORM paketning ichki `index.html` manzili chiqarilmagan. Paketni yuklab olib alohida ochish mumkin.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {downloadUrl ? (
          <a
            href={downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 text-sm font-bold text-white shadow-premium"
          >
            <Download size={16} />
            SCORM paketni yuklab olish
          </a>
        ) : null}
      </div>
      <div className="mt-6 rounded-[24px] border border-border/60 bg-white px-5 py-4 text-left shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-text-muted">Meta</p>
        <p className="mt-2 text-sm text-text-secondary">Versiya: <span className="font-bold text-text-primary">{resource.scorm_version || '1.2'}</span></p>
        <p className="mt-1 text-sm text-text-secondary">Entry URL: <span className="font-bold text-text-primary">{resource.scorm_entry_url || 'index.html'}</span></p>
      </div>
    </div>
  );
}

function FolderItem({ item }: { key?: number; item: FolderFileItem }) {
  const downloadUrl = buildAbsoluteUrl(item.file_url);
  return (
    <div className="flex items-center gap-4 rounded-[24px] border border-border/60 bg-white px-5 py-4 shadow-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-50 text-yellow-700">
        <FolderOpen size={22} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-text-primary">{item.original_filename}</p>
        <p className="mt-1 text-xs font-medium text-text-secondary">
          {[item.mime_type || 'Fayl', formatBytes(item.file_size)].filter(Boolean).join(' • ')}
        </p>
      </div>
      {downloadUrl ? (
        <a
          href={downloadUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-2xl border border-border bg-white px-4 py-2 text-sm font-bold text-text-primary"
        >
          <Download size={16} />
          Yuklab olish
        </a>
      ) : null}
    </div>
  );
}

function FolderPanel({ resource }: { resource: CourseDetailResource }) {
  const files = resource.folder_files || [];
  if (files.length === 0) {
    return (
      <UnsupportedPreview
        title="Papka hozircha bo‘sh"
        description="Bu papka resursiga hali fayl yuklanmagan."
        downloadUrl={null}
        externalUrl={null}
      />
    );
  }

  return (
    <div className="flex h-full min-h-[420px] flex-col bg-gradient-to-b from-yellow-50 via-white to-white px-6 py-8">
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-yellow-100 text-yellow-700">
          <FolderOpen size={28} />
        </div>
        <div>
          <h4 className="text-2xl font-black tracking-tight text-text-primary">{resource.title}</h4>
          <p className="mt-1 text-sm font-medium text-text-secondary">{files.length} ta fayl mavjud</p>
        </div>
      </div>
      <div className="space-y-3">
        {files.map((item) => (
          <FolderItem key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

function BookPanel({ resource }: { resource: CourseDetailResource }) {
  const chapters = [...(resource.chapters || [])].sort((a, b) => a.order - b.order);
  const chapterSignature = chapters.map((item) => item.id).join(',');
  const [activeChapterId, setActiveChapterId] = useState<number | null>(chapters[0]?.id || null);
  const [chapter, setChapter] = useState<BookChapterItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setActiveChapterId(chapters[0]?.id || null);
  }, [chapterSignature, resource.id]);

  useEffect(() => {
    let active = true;
    if (!activeChapterId) {
      setChapter(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    void fetchBookChapter(resource.id, activeChapterId)
      .then((data) => {
        if (!active) return;
        setChapter(data);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Bob yuklanmadi.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activeChapterId, resource.id]);

  if (chapters.length === 0) {
    return (
      <UnsupportedPreview
        title="Kitob sahifalari yo‘q"
        description="Bu book resursiga hali bob qo‘shilmagan."
        downloadUrl={null}
        externalUrl={null}
      />
    );
  }

  const currentIndex = chapters.findIndex((item) => item.id === activeChapterId);
  const prevChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null;
  const nextChapter = currentIndex >= 0 && currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null;

  return (
    <div className="grid min-h-[420px] gap-0 bg-slate-100 md:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="border-r border-border/60 bg-white p-5">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <BookOpen size={22} />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-text-muted">Book</p>
            <h4 className="text-lg font-black text-text-primary">{resource.title}</h4>
          </div>
        </div>
        <div className="space-y-2">
          {chapters.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveChapterId(item.id)}
              className={cn(
                'w-full rounded-[20px] border px-4 py-3 text-left transition-colors',
                activeChapterId === item.id
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border/60 bg-white text-text-secondary hover:border-primary/30 hover:text-text-primary'
              )}
            >
              <p className="text-[11px] font-black uppercase tracking-[0.18em] opacity-60">Bob {index + 1}</p>
              <p className="mt-1 text-sm font-bold">{item.title}</p>
            </button>
          ))}
        </div>
      </aside>

      <div className="flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-white px-5 py-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-text-muted">Mavjud bob</p>
            <h4 className="mt-1 text-lg font-black text-text-primary">{chapter?.title || 'Bob tanlanmagan'}</h4>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => prevChapter && setActiveChapterId(prevChapter.id)}
              disabled={!prevChapter}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => nextChapter && setActiveChapterId(nextChapter.id)}
              disabled={!nextChapter}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-white px-6 py-8 sm:px-8">
          {isLoading ? <PreviewSkeleton label="Bob yuklanmoqda" /> : null}
          {!isLoading && error ? <p className="text-sm font-medium text-red-500">{error}</p> : null}
          {!isLoading && !error ? (
            <HtmlContent html={chapter?.content} emptyMessage="Bu bob uchun kontent topilmadi." />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function GlossaryRow({ entry }: { key?: number; entry: GlossaryEntryItem }) {
  return (
    <div className="rounded-[24px] border border-border/60 bg-white p-5 shadow-sm">
      <h5 className="text-base font-black tracking-tight text-text-primary">{entry.term}</h5>
      <p className="mt-2 text-sm leading-7 text-text-secondary">{entry.definition}</p>
    </div>
  );
}

function GlossaryPanel({ resource }: { resource: CourseDetailResource }) {
  const [query, setQuery] = useState('');
  const entries = resource.glossary_entries || [];
  const filtered = entries.filter((item) => {
    const haystack = `${item.term} ${item.definition}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  return (
    <div className="flex h-full min-h-[420px] flex-col bg-gradient-to-b from-teal-50 via-white to-white px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-teal-600">Glossary</p>
          <h4 className="mt-1 text-2xl font-black tracking-tight text-text-primary">{resource.title}</h4>
        </div>
        <label className="flex min-w-[240px] items-center gap-3 rounded-[20px] border border-border/60 bg-white px-4 py-3 shadow-sm">
          <Search size={18} className="text-text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Atama yoki ta'rif bo'yicha qidirish"
            className="w-full bg-transparent text-sm font-medium text-text-primary outline-none placeholder:text-text-muted"
          />
        </label>
      </div>

      {entries.length === 0 ? (
        <UnsupportedPreview
          title="Glossariy bo‘sh"
          description="Bu glossary resursiga hali atama qo‘shilmagan."
          downloadUrl={null}
          externalUrl={null}
        />
      ) : filtered.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-border/60 bg-white px-6 py-12 text-center">
          <p className="text-sm font-medium text-text-secondary">Qidiruv bo‘yicha hech narsa topilmadi.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => (
            <GlossaryRow key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

function CertificateResourcePanel({
  resource,
  downloadUrl,
}: {
  resource: CourseDetailResource;
  downloadUrl: string | null;
}) {
  const [status, setStatus] = useState<'loading' | 'eligible' | 'not_eligible' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [certDownloadUrl, setCertDownloadUrl] = useState<string | null>(null);
  const [certPrintUrl, setCertPrintUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const checkUrl = resource.certificate_check_url
      || resource.certificate_download_url?.replace('/certificate/download/', '/certificate/check/')
      || downloadUrl?.replace('/certificate/download/', '/certificate/check/')
      || null;

    async function loadStatus() {
      if (!checkUrl) {
        if (!active) return;
        setStatus('error');
        setMessage('Sertifikat URL topilmadi.');
        return;
      }

      try {
        const data = await apiRequest<CertificateStatusResponse>(checkUrl);
        if (!active) return;

        if (data.is_eligible || data.has_certificate) {
          setStatus('eligible');
          setMessage(data.message || 'Sertifikat tayyor!');
          setCertDownloadUrl(data.download_url || resource.certificate_download_url || downloadUrl);
          setCertPrintUrl(data.print_url ?? resource.certificate_print_url ?? null);
          return;
        }

        setStatus('not_eligible');
        setMessage(data.message || 'Sertifikat olish shartlari bajarilmagan.');
      } catch (error) {
        if (!active) return;
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Sertifikat holatini tekshirishda xato yuz berdi.');
      }
    }

    void loadStatus();
    return () => {
      active = false;
    };
  }, [downloadUrl, resource.certificate_check_url, resource.certificate_download_url, resource.certificate_print_url]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-gradient-to-b from-amber-50 to-white px-6 py-12 text-center">
      <div
        className={cn(
          'flex h-24 w-24 items-center justify-center rounded-[32px] shadow-premium',
          status === 'eligible' ? 'bg-amber-400 text-white' : 'bg-slate-100 text-slate-400'
        )}
      >
        <Award size={48} />
      </div>

      <div>
        <h3 className="text-2xl font-black tracking-tight text-text-primary">{resource.title}</h3>
        <p className="mt-2 text-sm font-medium text-text-secondary">Kurs sertifikati</p>
      </div>

      {status === 'loading' ? (
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Tekshirilmoqda...
        </div>
      ) : null}

      {status === 'eligible' ? (
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 rounded-2xl bg-success/10 px-5 py-3 text-sm font-bold text-success">
            <CheckCircle2 size={18} />
            {message}
          </div>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            {certDownloadUrl ? (
              <a
                href={certDownloadUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl bg-amber-400 px-8 py-4 text-base font-black text-white shadow-premium transition hover:bg-amber-500"
              >
                <Download size={20} />
                Sertifikatni yuklab olish
              </a>
            ) : null}
            {certPrintUrl ? (
              <a
                href={certPrintUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl border-2 border-amber-400 bg-white px-8 py-4 text-base font-black text-amber-800 shadow-sm transition hover:bg-amber-50"
              >
                <Printer size={20} />
                Chop etish (PDF)
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      {status === 'not_eligible' ? (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-5 py-3 text-sm font-bold text-text-secondary">
            <Lock size={18} />
            Qulflangan
          </div>
          <p className="max-w-md text-sm leading-7 text-text-secondary">{message}</p>
        </div>
      ) : null}

      {status === 'error' ? <p className="text-sm text-red-500">{message}</p> : null}
    </div>
  );
}


function InlineDocumentViewer({ resourceId, extension }: { resourceId: number; extension: string }) {
  const [data, setData] = useState<ArrayBuffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadResourceFile(resourceId)
      .then((buf) => { if (!cancelled) { setData(buf); setLoading(false); } })
      .catch((err) => { if (!cancelled) { setError(err?.message || 'Fayl yuklanmadi'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [resourceId]);

  if (loading) return <div className="flex items-center justify-center h-full gap-2"><LoaderCircle className="w-6 h-6 animate-spin text-blue-500" /><span className="text-gray-500 text-sm">Yuklanmoqda...</span></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-full gap-2"><AlertCircle className="w-8 h-8 text-red-400" /><p className="text-sm text-gray-500">{error}</p></div>;
  if (!data) return null;

  const isDocx = extension === 'docx' || extension === 'doc';
  const isPptx = extension === 'pptx' || extension === 'ppt';

  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full"><LoaderCircle className="w-6 h-6 animate-spin text-blue-500" /></div>}>
      {isDocx && <DocxViewerLazy data={data} />}
      {isPptx && <PptxViewerLazy data={data} />}
    </Suspense>
  );
}

export function EmbeddedResourceViewer({
  resource,
  open,
  onClose,
  accentClassName,
}: {
  resource: CourseDetailResource | null;
  open: boolean;
  onClose: () => void;
  accentClassName?: string;
}) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!open) {
      setIsFullscreen(false);
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open || !resource) {
    return null;
  }

  const sourceUrl = resource.resource_type === 'certificate'
    ? resource.certificate_download_url || resource.file_url || resource.url
    : resource.file_url || resource.url || (resource.scorm_entry_url.startsWith('/') ? resource.scorm_entry_url : null);
  const absoluteUrl = buildAbsoluteUrl(sourceUrl);
  const publicUrl = getPublicViewerUrl(sourceUrl);
  const extension = getFileExtension(sourceUrl);
  const isPdf = extension === 'pdf';
  const isOffice = OFFICE_EXTENSIONS.has(extension);

  async function toggleFullscreen() {
    const node = modalRef.current;
    if (!node) return;

    if (!document.fullscreenElement) {
      await node.requestFullscreen();
      return;
    }

    if (document.fullscreenElement === node) {
      await document.exitFullscreen();
    }
  }

  let body = null;

  if (resource.resource_type === 'certificate') {
    body = (
      <CertificateResourcePanel
        resource={resource}
        downloadUrl={resource.certificate_download_url || resource.url || resource.file_url}
      />
    );
  } else if (resource.resource_type === 'text') {
    body = (
      <div className="flex-1 overflow-y-auto bg-white px-6 py-8 sm:px-8">
        <HtmlContent html={resource.content} emptyMessage="Matn mavjud emas." />
      </div>
    );
  } else if (resource.resource_type === 'video') {
    body = <VideoPanel resource={resource} />;
  } else if (resource.resource_type === 'audio') {
    body = <AudioPanel resource={resource} />;
  } else if (resource.resource_type === 'link') {
    body = <EmbedPanel resource={resource} label="Havola" />;
  } else if (resource.resource_type === 'embed') {
    body = <EmbedPanel resource={resource} label="Embed" />;
  } else if (resource.resource_type === 'h5p') {
    body = <H5PPanel resource={resource} />;
  } else if (resource.resource_type === 'scorm') {
    body = <ScormPanel resource={resource} />;
  } else if (resource.resource_type === 'folder') {
    body = <FolderPanel resource={resource} />;
  } else if (resource.resource_type === 'book') {
    body = <BookPanel resource={resource} />;
  } else if (resource.resource_type === 'glossary') {
    body = <GlossaryPanel resource={resource} />;
  } else if (isPdf && absoluteUrl) {
    body = <PdfPreview fileUrl={absoluteUrl} title={resource.title} />;
  } else if (isOffice) {
    body = <InlineDocumentViewer resourceId={resource.id} extension={extension} />;
  } else {
    const description = isOffice
      ? 'Office faylni ichki preview qilish uchun fayl URL manzili public bo‘lishi kerak. Lokal yoki yopiq serverlar uchun hozircha yuklab olish tavsiya etiladi.'
      : 'Ushbu fayl turi ichki preview’da qo‘llab-quvvatlanmadi yoki manba havola topilmadi.';

    body = (
      <UnsupportedPreview
        title="Preview hozircha tayyor emas"
        description={description}
        downloadUrl={absoluteUrl}
        externalUrl={absoluteUrl}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm sm:p-5"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-[32px] border border-white/10 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className={cn(
            'flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-gradient-to-r px-5 py-4 text-white sm:px-7',
            accentClassName || 'from-slate-800 to-slate-900'
          )}
        >
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-white/70">Embedded Preview</p>
            <h3 className="mt-1 truncate text-lg font-black sm:text-2xl">{resource.title}</h3>
            {resource.description ? (
              <p className="mt-1 max-w-3xl truncate text-sm font-medium text-white/70">{resource.description}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {absoluteUrl ? (
              <a
                href={absoluteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-2xl bg-white/15 px-4 text-sm font-bold text-white transition-colors hover:bg-white/25"
              >
                <Download size={16} />
                Yuklab olish
              </a>
            ) : null}
            {absoluteUrl ? (
              <a
                href={absoluteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-2xl bg-white/15 px-4 text-sm font-bold text-white transition-colors hover:bg-white/25"
              >
                <ExternalLink size={16} />
                Tashqi ochish
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 text-white transition-colors hover:bg-white/25"
              title={isFullscreen ? 'To‘liq ekrandan chiqish' : 'To‘liq ekran'}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-900 transition-colors hover:bg-slate-100"
              title="Yopish"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">{body}</div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 bg-slate-50 px-5 py-4 text-xs text-text-secondary sm:px-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-3 py-1 font-black uppercase tracking-[0.18em] text-text-primary shadow-sm">
              {resource.resource_type_label}
            </span>
            {resource.original_filename ? <span>{resource.original_filename}</span> : null}
            {resource.file_size ? <span>{formatBytes(resource.file_size)}</span> : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {resource.estimated_time_minutes ? <span>{resource.estimated_time_minutes} daqiqa</span> : null}
            {resource.require_completion ? <span>Majburiy resurs</span> : null}
            {resource.view_data?.is_completed ? (
              <span className="font-bold text-success">Tugatildi</span>
            ) : null}
            {!resource.view_data?.is_completed && resource.view_data?.view_count ? (
              <span>{resource.view_data.view_count} marta ochilgan</span>
            ) : null}
            {!resource.view_data?.is_completed && !resource.view_data?.view_count ? (
              <span>Hali ko‘rilmagan</span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
