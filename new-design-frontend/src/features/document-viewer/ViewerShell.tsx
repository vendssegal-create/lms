import React, { useEffect, useState, useMemo } from 'react';
import { DocxViewer } from './DocxViewer';
import { PptxViewer } from './PptxViewer';
import { PdfViewerEnhanced } from './PdfViewerEnhanced';
import { X, Download, Maximize2, Minimize2, Loader2, AlertTriangle } from 'lucide-react';
import { loadResourceFile } from '@/src/api/documents';

interface Props {
  resourceId: number;
  fileName: string;
  fileUrl?: string;
  mimeType?: string;
  onClose: () => void;
}

function getExtension(name: string): string {
  return (name.split('.').pop() ?? '').toLowerCase();
}

export const ViewerShell: React.FC<Props> = ({ resourceId, fileName, fileUrl, mimeType, onClose }) => {
  const [data, setData] = useState<ArrayBuffer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const ext = useMemo(() => getExtension(fileName), [fileName]);
  const needsBytes = ext === 'docx' || ext === 'doc' || ext === 'pptx' || ext === 'ppt';
  const isPdf = ext === 'pdf';

  useEffect(() => {
    if (!needsBytes) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    loadResourceFile(resourceId)
      .then((buf) => {
        if (!cancelled) {
          setData(buf);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || 'Fayl yuklanmadi');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [resourceId, needsBytes]);

  const handleDownload = () => {
    if (fileUrl) {
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = fileName;
      a.click();
    }
  };

  const content = useMemo(() => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          <span className="text-gray-500 text-sm">Yuklanmoqda...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3">
          <AlertTriangle className="w-10 h-10 text-red-400" />
          <p className="text-sm text-gray-500">{error}</p>
          <button
            onClick={handleDownload}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Yuklab olish
          </button>
        </div>
      );
    }

    if ((ext === 'docx' || ext === 'doc') && data) {
      return <DocxViewer data={data} />;
    }

    if ((ext === 'pptx' || ext === 'ppt') && data) {
      return <PptxViewer data={data} />;
    }

    if (isPdf) {
      return <PdfViewerEnhanced url={fileUrl} />;
    }

    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
        <p className="text-sm">Bu fayl turini ko'rib bo'lmaydi</p>
        <button
          onClick={handleDownload}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Yuklab olish
        </button>
      </div>
    );
  }, [loading, error, ext, data, fileUrl, isPdf]);

  return (
    <div className={`fixed inset-0 z-50 flex flex-col bg-white ${fullscreen ? '' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
        <h2 className="text-sm font-medium text-gray-700 truncate max-w-[50%]">{fileName}</h2>
        <div className="flex items-center gap-1">
          <button onClick={handleDownload} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Yuklab olish">
            <Download size={16} />
          </button>
          <button
            onClick={() => setFullscreen(!fullscreen)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
            title="To'liq ekran"
          >
            {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Yopish">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {content}
      </div>
    </div>
  );
};
