import { useLayoutEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';

/**
 * Django `/lms/courses/:id/certificate/print/` — SPA ichida tushib qolsa (masalan, Vite da proxy yo‘q),
 * `path="*"` asosiy sahifaga tashlaydi. Bu komponent to‘g‘ridan-to‘g‘ri backend HTML ga o‘tkazadi.
 */
export default function CertificatePrintRedirectPage() {
  const { courseId } = useParams();
  const { search } = useLocation();

  useLayoutEffect(() => {
    const path = `/lms/courses/${courseId}/certificate/print/${search || ''}`;
    const backend = (import.meta.env.VITE_BACKEND_ORIGIN as string | undefined)?.replace(/\/$/, '');
    if (import.meta.env.DEV && backend) {
      window.location.replace(`${backend}${path}`);
      return;
    }
    window.location.replace(path);
  }, [courseId, search]);

  return (
    <div className="flex min-h-screen items-center justify-center gap-3 bg-slate-50 p-8">
      <LoaderCircle className="animate-spin text-primary" size={24} />
      <span className="text-sm font-bold text-slate-600">Sertifikat sahifasiga o‘tilyapti…</span>
    </div>
  );
}
