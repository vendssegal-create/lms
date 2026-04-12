import React, { useEffect, useState, useMemo } from 'react';
import { parsePptx, PptxPresentation, PptxSlide, PptxElement } from './parser/pptx-parser';
import { ChevronLeft, ChevronRight, Loader2, AlertTriangle, Maximize2 } from 'lucide-react';

interface Props {
  data: ArrayBuffer;
}

const EMU_TO_PX = 1 / 9525;

export const PptxViewer: React.FC<Props> = ({ data }) => {
  const [pres, setPres] = useState<PptxPresentation | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    parsePptx(data)
      .then((p) => {
        if (!cancelled) {
          setPres(p);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || 'PPTX ochishda xatolik');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-500 text-sm">Yuklanmoqda...</span>
      </div>
    );
  }

  if (error || !pres) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <AlertTriangle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-gray-500">{error || 'Fayl ochilmadi'}</p>
      </div>
    );
  }

  const slide = pres.slides[currentSlide];
  const slideW = pres.slideWidth * EMU_TO_PX;
  const slideH = pres.slideHeight * EMU_TO_PX;

  return (
    <div className="flex flex-col h-full">
      {/* Slide area */}
      <div className="flex-1 flex items-center justify-center bg-gray-800 p-4 overflow-auto">
        <div
          className="bg-white shadow-2xl relative overflow-hidden"
          style={{
            width: `${slideW}px`,
            height: `${slideH}px`,
            maxWidth: '100%',
            maxHeight: '100%',
            aspectRatio: `${slideW} / ${slideH}`,
          }}
        >
          {slide && <SlideRender slide={slide} media={pres.media} />}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-center gap-4 py-3 bg-gray-900 text-white">
        <button
          onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
          disabled={currentSlide === 0}
          className="p-1.5 rounded hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-sm tabular-nums">
          {currentSlide + 1} / {pres.slides.length}
        </span>
        <button
          onClick={() => setCurrentSlide(Math.min(pres.slides.length - 1, currentSlide + 1))}
          disabled={currentSlide >= pres.slides.length - 1}
          className="p-1.5 rounded hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Thumbnail strip */}
      {pres.slides.length > 1 && (
        <div className="flex gap-1.5 p-2 bg-gray-900 overflow-x-auto">
          {pres.slides.map((s, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className={`flex-shrink-0 w-20 h-14 bg-white rounded overflow-hidden border-2 transition-colors ${
                i === currentSlide ? 'border-blue-500' : 'border-transparent hover:border-gray-500'
              }`}
            >
              <div className="w-full h-full relative" style={{ transform: `scale(${20 / slideW})`, transformOrigin: 'top left', width: slideW, height: slideH }}>
                <SlideRender slide={s} media={pres.media} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const SlideRender: React.FC<{ slide: PptxSlide; media: Map<string, Blob> }> = ({ slide, media }) => {
  return (
    <>
      {slide.elements.map((el, i) => (
        <ElementRender key={i} element={el} media={media} />
      ))}
    </>
  );
};

const ElementRender: React.FC<{ element: PptxElement; media: Map<string, Blob> }> = ({ element, media }) => {
  const style: React.CSSProperties = {
    position: 'absolute',
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
  };

  if (element.type === 'image' && element.imageId) {
    return <ImageElement style={style} imageId={element.imageId} media={media} />;
  }

  if (element.type === 'text') {
    const textStyle: React.CSSProperties = {
      ...style,
      fontSize: element.fontSize ? `${element.fontSize}px` : '14px',
      fontWeight: element.bold ? 'bold' : 'normal',
      fontStyle: element.italic ? 'italic' : 'normal',
      color: element.color ?? '#000',
      textAlign: element.alignment ?? 'left',
      padding: '4px 8px',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    };
    return <div style={textStyle}>{element.text}</div>;
  }

  if (element.type === 'shape') {
    return (
      <div
        style={{
          ...style,
          backgroundColor: element.fill ?? '#E5E7EB',
          borderRadius: element.shapeName === 'oval' ? '50%' : undefined,
        }}
      />
    );
  }

  return null;
};

const ImageElement: React.FC<{
  style: React.CSSProperties;
  imageId: string;
  media: Map<string, Blob>;
}> = ({ style, imageId, media }) => {
  const src = useMemo(() => {
    const blob = media.get(imageId);
    if (!blob) return '';
    return URL.createObjectURL(blob);
  }, [imageId, media]);

  useEffect(() => {
    return () => { if (src) URL.revokeObjectURL(src); };
  }, [src]);

  if (!src) return <div style={style} className="bg-gray-200" />;
  return <img src={src} alt="" style={{ ...style, objectFit: 'cover' }} />;
};
