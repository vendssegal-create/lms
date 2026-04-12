import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, CheckCircle2, ChevronLeft, ChevronRight, FlaskConical, LoaderCircle, ShieldCheck } from 'lucide-react';
import { fetchTakeTest, sendProctorLog, submitTest, verifyFace } from '@/src/api/lms';
import type { TakeTestQuestion, TakeTestResponse } from '@/src/types';

function formatTime(seconds: number) {
  const clamped = Math.max(0, seconds);
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function QuestionCard({
  index,
  question,
  value,
  onChange,
}: {
  index: number;
  question: TakeTestQuestion;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="card p-8">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-white text-sm font-black">
          {index}
        </div>
        <div className="min-w-0">
          <p className="text-lg font-black leading-7 text-text-primary">{question.text}</p>
          <div className="mt-5 space-y-3">
            {question.options.filter((opt) => opt.label).map((opt) => (
              <label key={opt.value} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-slate-50 px-4 py-4 text-sm font-semibold text-text-primary transition-all hover:border-primary/20 hover:bg-white">
                <input
                  type="radio"
                  name={`question_${question.id}`}
                  value={opt.value}
                  checked={value === opt.value}
                  onChange={() => onChange(opt.value)}
                  className="h-5 w-5 accent-primary"
                />
                <span className="leading-6">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TimerWidget({ remaining, total }: { remaining: number; total: number }) {
  const pct = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;
  const isDanger = pct <= 20;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-white px-4 py-3 dark:bg-dark-surface">
      <div className="relative h-10 w-10">
        <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90">
          <path d="M18 2a16 16 0 1 1 0 32a16 16 0 1 1 0-32" fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="3" />
          <path
            d="M18 2a16 16 0 1 1 0 32a16 16 0 1 1 0-32"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={`${pct}, 100`}
            className={isDanger ? 'text-danger' : 'text-primary'}
          />
        </svg>
      </div>
      <div>
        <p className="label-micro">Qolgan vaqt</p>
        <p className={`text-sm font-black ${isDanger ? 'text-danger' : 'text-text-primary'}`}>{formatTime(remaining)}</p>
      </div>
    </div>
  );
}

export default function TakeTestPage() {
  const params = useParams();
  const navigate = useNavigate();
  const testId = Number(params.testId || 0);

  const [data, setData] = useState<TakeTestResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreenReady, setIsFullscreenReady] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const [violations, setViolations] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [faceStatus, setFaceStatus] = useState<'idle' | 'loading' | 'verified' | 'failed'>('idle');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const referenceDescriptorRef = useRef<Float32Array | null>(null);
  const faceFailCountRef = useRef(0);
  const faceIntervalRef = useRef<number | null>(null);

  const answeredCount = useMemo(() => Object.values(answers).filter(Boolean).length, [answers]);
  const totalQuestions = data?.questions.length || 0;
  const activeQuestion = data?.questions[currentQuestion] || null;

  useEffect(() => {
    let active = true;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetchTakeTest(testId);
        if (!active) return;
        setData(response);
        setAnswers(response.attempt.answers || {});
        setRemaining(response.attempt.remaining_seconds ?? null);
      setCurrentQuestion(0);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Test yuklanmadi.');
      } finally {
        if (active) setIsLoading(false);
      }
    }
    if (testId) void load();
    return () => {
      active = false;
    };
  }, [testId]);

  useEffect(() => {
    function onVisibility() {
      if (!data?.proctoring.enabled) return;
      if (document.hidden) {
        void logViolation('tab_switch', { hidden: true });
      }
    }
    function onFullscreen() {
      if (!data?.proctoring.enabled) return;
      if (!document.fullscreenElement && isFullscreenReady) {
        void logViolation('fullscreen_exit', {});
      }
    }
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('fullscreenchange', onFullscreen);
    };
  }, [data, isFullscreenReady]);

  useEffect(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (!isFullscreenReady) return;
    if (remaining === null) return;

    timerRef.current = window.setInterval(() => {
      setRemaining((prev) => {
        if (prev === null) return prev;
        const next = Math.max(prev - 1, 0);
        if (next === 0) {
          void handleSubmit(true);
        }
        return next;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreenReady]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (faceIntervalRef.current) {
        window.clearInterval(faceIntervalRef.current);
        faceIntervalRef.current = null;
      }
    };
  }, []);

  async function logViolation(eventType: string, details: Record<string, unknown> = {}) {
    if (!data) return;
    try {
      const response = await sendProctorLog({ attempt_id: data.attempt.id, event_type: eventType, details });
      setViolations(response.violations);
      if (response.auto_submit) {
        await handleSubmit(true);
      }
    } catch {
      // ignore logging errors
    }
  }

  async function ensureFaceApiLoaded() {
    const w = window as any;
    if (w.faceapi) return w.faceapi;
    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector('script[data-faceapi="1"]') as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('FaceAPI yuklanmadi.')));
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js';
      script.async = true;
      script.dataset.faceapi = '1';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('FaceAPI yuklanmadi.'));
      document.head.appendChild(script);
    });
    return (window as any).faceapi;
  }

  async function initCamera() {
    setCameraError(null);
    if (streamRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Kamera ruxsati berilmadi.';
      setCameraError(message);
      await logViolation('camera_denied', { message });
    }
  }

  async function initFaceReference() {
    if (!data?.face.image_url) return;
    if (referenceDescriptorRef.current) return;

    setFaceStatus('loading');
    const faceapi = await ensureFaceApiLoaded();
    const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = data.face.image_url;

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Talaba rasmi yuklanmadi."));
    });

    const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
    if (!detection) {
      referenceDescriptorRef.current = null;
      setFaceStatus('failed');
      throw new Error("Talaba yuzini rasmdan topib bo'lmadi.");
    }
    referenceDescriptorRef.current = detection.descriptor;
    setFaceStatus('idle');
  }

  async function verifyFaceOnce() {
    if (!data?.face.required) return true;
    if (data.face.verified) return true;
    if (!data.face.image_url) throw new Error("FaceID uchun talaba rasmi kerak.");

    await initCamera();
    await initFaceReference();

    const faceapi = (window as any).faceapi;
    const video = videoRef.current;
    const ref = referenceDescriptorRef.current;
    if (!faceapi || !video || !ref) throw new Error("FaceID tayyor emas.");

    setFaceStatus('loading');
    const detection = await faceapi
      .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (!detection) {
      setFaceStatus('failed');
      throw new Error("Kamera yuzni ko'rmadi.");
    }
    const distance = faceapi.euclideanDistance(ref, detection.descriptor);
    if (distance > 0.6) {
      setFaceStatus('failed');
      await logViolation('face_mismatch', { distance });
      throw new Error("Yuz mos kelmadi.");
    }

    await verifyFace(testId);
    const refreshed = await fetchTakeTest(testId);
    setData(refreshed);
    setFaceStatus('verified');
    return true;
  }

  async function startFaceMonitoring() {
    if (!data?.face.required) return;
    if (!data.proctoring.enabled && !data.face.required) return;
    await initCamera();
    try {
      await initFaceReference();
    } catch {
      return;
    }
    const faceapi = (window as any).faceapi;
    const video = videoRef.current;
    const ref = referenceDescriptorRef.current;
    if (!faceapi || !video || !ref) return;

    if (faceIntervalRef.current) {
      window.clearInterval(faceIntervalRef.current);
      faceIntervalRef.current = null;
    }

    faceIntervalRef.current = window.setInterval(async () => {
      try {
        const detection = await faceapi
          .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
          .withFaceLandmarks()
          .withFaceDescriptor();
        if (!detection) {
          faceFailCountRef.current += 1;
        } else {
          const distance = faceapi.euclideanDistance(ref, detection.descriptor);
          if (distance > 0.6) {
            faceFailCountRef.current += 1;
          } else {
            faceFailCountRef.current = 0;
          }
        }

        if (faceFailCountRef.current >= 4) {
          faceFailCountRef.current = 0;
          await logViolation('face_mismatch', { reason: 'monitor' });
        }
      } catch {
        // ignore
      }
    }, 5000);
  }

  async function prepareAndStart() {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      if (data?.proctoring.enabled || data?.face.required) {
        await initCamera();
      }
      if (data?.face.required && !data.face.verified) {
        await verifyFaceOnce();
      }
      setIsFullscreenReady(true);
      void startFaceMonitoring();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fullscreen ruxsati berilmadi.");
    }
  }

  async function handleSubmit(auto = false) {
    if (!data || isSubmitting) return;
    if (!auto) {
      const ok = window.confirm("Testni yakunlaysizmi? Javoblar yuboriladi.");
      if (!ok) return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await submitTest(testId, { answers });
      await navigate(result.redirect_url || '/tests');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yuborilmadi.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="card flex min-h-[320px] items-center justify-center gap-3 p-8 text-text-secondary">
        <LoaderCircle className="animate-spin text-primary" size={20} />
        Test yuklanmoqda...
      </div>
    );
  }

  if (!data || error) {
    return (
      <div className="card p-8">
        <p className="text-lg font-black text-text-primary">Test ochilmadi</p>
        <p className="mt-3 text-sm font-medium text-rose-500">{error || 'Nomaʼlum xatolik.'}</p>
        <Link to="/tests" className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm font-bold text-text-primary">
          <ArrowLeft size={16} />
          Testlar ro'yxatiga qaytish
        </Link>
      </div>
    );
  }

  if (!isFullscreenReady) {
    return (
      <div className="card p-10">
        <p className="label-micro text-text-secondary">Testni boshlash</p>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-text-primary">{data.test.name}</h2>
        <p className="mt-4 text-sm font-medium leading-7 text-text-secondary">
          Test paytida adolatni ta'minlash uchun to'liq ekran rejimi yoqiladi. Proctoring yoqilgan bo'lsa, tab switch va fullscreen exit log qilinadi.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-wide text-text-secondary">
          <span>Savollar: {data.questions.length}</span>
          <span>Urinishlar: {data.test.attempts_done}/{data.test.attempts_allowed}</span>
          {data.face.required ? <span>Face ID: required</span> : <span>Face ID: off</span>}
        </div>
        {(data.proctoring.enabled || data.face.required) ? (
          <div className="mt-8 rounded-[28px] border border-border bg-slate-50 p-6">
            <div className="flex items-center gap-3">
              <Camera className="text-primary" size={18} />
              <p className="text-sm font-black text-text-primary">Kamera preview</p>
            </div>
            {cameraError ? <p className="mt-3 text-sm font-semibold text-rose-500">{cameraError}</p> : null}
            <video ref={videoRef} className="mt-4 h-44 w-full rounded-2xl bg-black object-cover" muted playsInline />
            {data.face.required ? (
              <p className="mt-3 text-sm font-semibold text-text-secondary">
                Face status: {faceStatus} {data.face.verified ? '(server verified)' : ''}
              </p>
            ) : null}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => void prepareAndStart()}
          className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-4 text-sm font-black text-white shadow-xl shadow-primary/20 transition-all hover:-translate-y-0.5"
        >
          <ShieldCheck size={18} />
          Ekranni tayyorlash va boshlash
        </button>
        <Link to="/tests" className="mt-6 block text-sm font-bold text-text-secondary hover:text-text-primary">Bekor qilish</Link>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background">
      <header className="flex items-center justify-between border-b border-border bg-white/80 px-4 py-3 backdrop-blur-md lg:px-6 dark:bg-dark-card/80">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-white">
            <FlaskConical size={18} />
          </div>
          <div className="min-w-0">
            <p className="label-micro">Test</p>
            <h1 className="truncate text-base font-black text-text-primary lg:text-lg">{data.test.name}</h1>
          </div>
        </div>

        <div className="hidden lg:block">
          {remaining !== null ? <TimerWidget remaining={remaining} total={(data.test.duration_minutes || 0) * 60} /> : null}
        </div>

        <div className="flex items-center gap-2 lg:gap-3">
          <span className="hidden text-sm font-bold text-text-secondary md:inline">
            {answeredCount}/{totalQuestions} javob
          </span>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void handleSubmit(false)}
            className="btn btn-primary px-4 py-2.5 text-xs lg:text-sm"
          >
            Topshirish
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-64 shrink-0 border-r border-border bg-card p-4 lg:block dark:bg-dark-card">
          <p className="label-micro">Savollar</p>
          <div className="mt-4 grid grid-cols-5 gap-2">
            {data.questions.map((q, idx) => {
              const answered = Boolean(answers[String(q.id)]);
              const active = idx === currentQuestion;
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentQuestion(idx)}
                  className={`h-10 rounded-xl text-xs font-black transition-all ${
                    active
                      ? 'bg-primary text-white'
                      : answered
                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                        : 'bg-slate-100 text-text-secondary hover:bg-slate-200'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
          <div className="mt-6 space-y-2 text-xs font-semibold text-text-secondary">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span>Javob berilgan: {answeredCount}</span>
            </div>
            <p>Qolgan: {Math.max(totalQuestions - answeredCount, 0)}</p>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden p-4 lg:p-6">
          {activeQuestion ? (
            <div className="mx-auto flex h-full w-full max-w-4xl flex-col">
              <div className="mb-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentQuestion((v) => Math.max(v - 1, 0))}
                  disabled={currentQuestion === 0}
                  className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-bold disabled:opacity-40"
                >
                  <ChevronLeft size={14} />
                  Oldingi
                </button>
                <span className="text-xs font-bold text-text-secondary">
                  Savol {currentQuestion + 1} / {totalQuestions}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentQuestion((v) => Math.min(v + 1, totalQuestions - 1))}
                  disabled={currentQuestion >= totalQuestions - 1}
                  className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-bold disabled:opacity-40"
                >
                  Keyingi
                  <ChevronRight size={14} />
                </button>
              </div>
              <QuestionCard
                index={currentQuestion + 1}
                question={activeQuestion}
                value={answers[String(activeQuestion.id)] || ''}
                onChange={(next) => setAnswers((current) => ({ ...current, [String(activeQuestion.id)]: next }))}
              />
            </div>
          ) : null}
        </main>

        <aside className="hidden w-72 shrink-0 border-l border-border bg-card p-4 xl:block dark:bg-dark-card">
          <p className="label-micro">Nazorat</p>
          <div className="mt-4 space-y-3">
            {remaining !== null ? <TimerWidget remaining={remaining} total={(data.test.duration_minutes || 0) * 60} /> : null}
            <div className="rounded-2xl border border-border bg-white p-4 text-sm font-bold text-text-primary dark:bg-dark-surface">
              Urinishlar: {data.test.attempts_done}/{data.test.attempts_allowed}
            </div>
            {(data.proctoring.enabled || data.face.required) ? (
              <div className="rounded-2xl border border-border bg-white p-4 text-sm font-bold text-text-primary dark:bg-dark-surface">
                Ogohlantirish: {violations} / {data.proctoring.max_tab_switches}
              </div>
            ) : null}
            {data.face.required ? (
              <div className="rounded-2xl border border-border bg-white p-4 dark:bg-dark-surface">
                <div className="flex items-center gap-2 text-sm font-bold text-text-primary">
                  <Camera size={16} />
                  Kamera holati
                </div>
                {cameraError ? (
                  <p className="mt-2 text-xs font-semibold text-danger">{cameraError}</p>
                ) : (
                  <p className="mt-2 text-xs font-semibold text-text-secondary">Face status: {faceStatus}</p>
                )}
                <video ref={videoRef} className="mt-3 h-32 w-full rounded-xl bg-black object-cover" muted playsInline />
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
