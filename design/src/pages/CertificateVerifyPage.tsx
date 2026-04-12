import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Award, CheckCircle2, LoaderCircle, XCircle } from 'lucide-react';

interface VerifyResult {
  valid: boolean;
  serial_number?: string;
  student_name?: string;
  course_name?: string;
  issued_at?: string;
  institution?: string;
  message: string;
}

async function verifyCertificate(serial: string): Promise<VerifyResult> {
  const res = await fetch(`/api/lms/verify/${encodeURIComponent(serial)}/`);
  const data = (await res.json()) as VerifyResult;
  if (!res.ok) {
    return { valid: false, message: data.message || 'Sertifikat topilmadi.' };
  }
  return data;
}

export default function CertificateVerifyPage() {
  const { serial } = useParams<{ serial: string }>();
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!serial) {
      setResult({ valid: false, message: "Seriya raqam ko'rsatilmagan." });
      setLoading(false);
      return;
    }
    verifyCertificate(serial)
      .then(setResult)
      .catch(() => setResult({ valid: false, message: 'Tekshirishda xatolik yuz berdi.' }))
      .finally(() => setLoading(false));
  }, [serial]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoaderCircle className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  const ok = result?.valid;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-lg rounded-[32px] border border-border bg-white p-8 shadow-premium">
        <div className="flex flex-col items-center text-center">
          <div
            className={`mb-6 flex h-16 w-16 items-center justify-center rounded-2xl ${
              ok ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
            }`}
          >
            {ok ? <CheckCircle2 size={36} /> : <XCircle size={36} />}
          </div>
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-text-secondary">
            <Award size={18} className="text-amber-500" />
            Sertifikat tekshiruvi
          </div>
          <h1 className="text-xl font-black text-text-primary">
            {ok ? 'Sertifikat tasdiqlandi' : 'Tasdiqlanmadi'}
          </h1>
          <p className="mt-3 text-sm font-medium text-text-secondary">{result?.message}</p>
          {ok && result && (
            <dl className="mt-8 w-full space-y-3 rounded-2xl bg-slate-50 p-5 text-left text-sm">
              {result.serial_number && (
                <div className="flex justify-between gap-4">
                  <dt className="font-bold text-text-muted">Seriya</dt>
                  <dd className="font-mono text-text-primary">{result.serial_number}</dd>
                </div>
              )}
              {result.student_name && (
                <div className="flex justify-between gap-4">
                  <dt className="font-bold text-text-muted">Talaba</dt>
                  <dd className="text-text-primary">{result.student_name}</dd>
                </div>
              )}
              {result.course_name && (
                <div className="flex justify-between gap-4">
                  <dt className="font-bold text-text-muted">Kurs</dt>
                  <dd className="text-text-primary">{result.course_name}</dd>
                </div>
              )}
              {result.issued_at && (
                <div className="flex justify-between gap-4">
                  <dt className="font-bold text-text-muted">Berilgan sana</dt>
                  <dd className="text-text-primary">{result.issued_at}</dd>
                </div>
              )}
              {result.institution && (
                <div className="flex justify-between gap-4">
                  <dt className="font-bold text-text-muted">Muassasa</dt>
                  <dd className="text-text-primary">{result.institution}</dd>
                </div>
              )}
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}
