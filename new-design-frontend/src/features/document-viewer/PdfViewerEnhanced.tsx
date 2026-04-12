import React, { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Loader2, AlertTriangle } from 'lucide-react';

if (!pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
}

interface Props {
  /** Plain URL string — preferred for simple loading */
  url?: string;
  /** Raw PDF bytes — used when loaded from API */
  data?: ArrayBuffer;
}

export const PdfViewerEnhanced: React.FC<Props> = ({ url, data }) => {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [error, setError] = useState(false);

  const onDocumentLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setCurrentPage(1);
    setError(false);
  }, []);

  // react-pdf accepts: string URL, { data: ArrayBuffer }, or { url: string }
  // Plain string is most reliable for URL-based loading
  const source = data ? { data } : url ?? undefined;

  if (!source) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        PDF manba ko'rsatilmagan
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-center gap-3 py-2 px-4 bg-gray-50 border-b border-gray-200">
        <button
          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="p-1 rounded hover:bg-gray-200 disabled:opacity-30"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm text-gray-600 tabular-nums min-w-[80px] text-center">
          {currentPage} / {numPages}
        </span>
        <button
          onClick={() => setCurrentPage(Math.min(numPages, currentPage + 1))}
          disabled={currentPage >= numPages}
          className="p-1 rounded hover:bg-gray-200 disabled:opacity-30"
        >
          <ChevronRight size={18} />
        </button>

        <div className="w-px h-5 bg-gray-300 mx-1" />

        <button
          onClick={() => setScale(Math.max(0.25, scale - 0.25))}
          disabled={scale <= 0.25}
          className="p-1 rounded hover:bg-gray-200 disabled:opacity-30"
        >
          <ZoomOut size={18} />
        </button>
        <span className="text-sm text-gray-600 tabular-nums min-w-[50px] text-center">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={() => setScale(Math.min(3, scale + 0.25))}
          disabled={scale >= 3}
          className="p-1 rounded hover:bg-gray-200 disabled:opacity-30"
        >
          <ZoomIn size={18} />
        </button>
      </div>

      {/* PDF content */}
      <div className="flex-1 overflow-auto flex justify-center bg-gray-100 p-4">
        <Document
          file={source}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={() => setError(true)}
          loading={
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Yuklanmoqda...</span>
            </div>
          }
          error={
            <div className="flex flex-col items-center gap-2 text-gray-500">
              <AlertTriangle className="w-8 h-8 text-red-400" />
              <span className="text-sm">PDF ochishda xatolik</span>
            </div>
          }
        >
          <Page
            pageNumber={currentPage}
            scale={scale}
            className="shadow-md"
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      </div>
    </div>
  );
};
