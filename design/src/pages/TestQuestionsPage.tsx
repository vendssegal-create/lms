import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, FileQuestion, LoaderCircle, PencilLine, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { addTeacherQuestions, deleteTeacherQuestion, fetchTeacherTestQuestions, updateTeacherQuestion } from '@/src/api/lms';
import type { TeacherQuestionItem, TeacherTestQuestionsListResponse } from '@/src/types';

const PAGE_SIZE = 20;

type EditState = {
  open: boolean;
  saving: boolean;
  error: string | null;
  question: TeacherQuestionItem | null;
};

function emptyEditState(): EditState {
  return { open: false, saving: false, error: null, question: null };
}

export default function TestQuestionsPage() {
  const params = useParams();
  const testId = Number(params.testId || 0);
  const [searchParams] = useSearchParams();

  const [data, setData] = useState<TeacherTestQuestionsListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [editState, setEditState] = useState<EditState>(emptyEditState);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [manualForm, setManualForm] = useState({
    text: '',
    option1: '',
    option2: '',
    option3: '',
    option4: '',
    correct_answer: '1',
    score: '1',
  });
  const [memoText, setMemoText] = useState('');

  async function load(nextPage = page, nextQuery = query) {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchTeacherTestQuestions(testId, nextPage, PAGE_SIZE, nextQuery);
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Savollar yuklanmadi.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!testId) return;
    void load(1, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

  useEffect(() => {
    const mode = searchParams.get('mode');
    const targetId = window.location.hash?.replace('#', '') || (mode === 'bulk' ? 'bulk-import' : mode === 'manual' ? 'manual-question' : '');
    if (!targetId) return;
    const element = document.getElementById(targetId);
    if (element) {
      window.setTimeout(() => {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  }, [searchParams]);

  async function goToPage(nextPage: number) {
    setPage(nextPage);
    await load(nextPage, query);
  }

  async function applySearch(event: FormEvent) {
    event.preventDefault();
    const nextQuery = searchInput.trim();
    setQuery(nextQuery);
    setPage(1);
    await load(1, nextQuery);
  }

  function openEditor(question: TeacherQuestionItem) {
    setEditState({ open: true, saving: false, error: null, question: { ...question } });
  }

  function closeEditor() {
    setEditState(emptyEditState());
  }

  async function saveQuestion(event: FormEvent) {
    event.preventDefault();
    if (!editState.question) return;
    setEditState((current) => ({ ...current, saving: true, error: null }));
    try {
      const response = await updateTeacherQuestion(editState.question.id, editState.question);
      setData((current) => {
        if (!current) return current;
        return {
          ...current,
          items: current.items.map((item) => (item.id === response.question.id ? response.question : item)),
        };
      });
      closeEditor();
    } catch (err) {
      setEditState((current) => ({
        ...current,
        saving: false,
        error: err instanceof Error ? err.message : 'Savol saqlanmadi.',
      }));
    }
  }

  async function removeQuestion(questionId: number) {
    try {
      await deleteTeacherQuestion(questionId);
      setData((current) => {
        if (!current) return current;
        return {
          ...current,
          total: Math.max(0, current.total - 1),
          items: current.items.filter((item) => item.id !== questionId),
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Savolni o'chirib bo'lmadi.");
    }
  }

  async function handleManualCreate(event: FormEvent) {
    event.preventDefault();
    setIsCreating(true);
    setCreateError(null);
    setCreateSuccess(null);
    try {
      const response = await addTeacherQuestions(testId, {
        ...manualForm,
        score: Number(manualForm.score) || 1,
      });
      setCreateSuccess(`${response.created.length} ta savol qo'shildi.`);
      setManualForm({
        text: '',
        option1: '',
        option2: '',
        option3: '',
        option4: '',
        correct_answer: '1',
        score: '1',
      });
      setPage(1);
      await load(1, query);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Savol qo'shilmadi.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleBulkCreate(event: FormEvent) {
    event.preventDefault();
    setIsCreating(true);
    setCreateError(null);
    setCreateSuccess(null);
    try {
      const response = await addTeacherQuestions(testId, { memo_text: memoText });
      setCreateSuccess(`${response.created.length} ta savol yuklandi.`);
      setMemoText('');
      setPage(1);
      await load(1, query);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Savollar yuklanmadi.');
    } finally {
      setIsCreating(false);
    }
  }

  const title = useMemo(() => data?.test.name || 'Test savollari', [data?.test.name]);

  return (
    <div className="space-y-8">
      <section className="card p-8 lg:p-10">
        <Link to={`/tests/${testId}/edit`} className="inline-flex items-center gap-2 text-sm font-bold text-text-secondary hover:text-text-primary">
          <ArrowLeft size={16} />
          Test tahrirlashga qaytish
        </Link>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-text-primary">{title}</h2>
        <p className="mt-2 text-sm font-semibold text-text-secondary">
          Savollar ro'yxati, qo'lda qo'shish va bulk import bir sahifada ishlaydi. Savol ustiga bosing va modalda tahrir qiling.
        </p>
      </section>

      <section className="card overflow-hidden p-0">
        <div className="bg-gradient-to-r from-indigo-600 via-primary to-sky-600 px-8 py-7 text-white">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/70">Savollar bilan ishlash</p>
              <h3 className="mt-2 text-2xl font-black">Savollar workspace</h3>
              <p className="mt-2 max-w-2xl text-sm font-semibold text-white/80">
                Savollar ro'yxatini ko'ring, bulk import qiling yoki qo'lda qo'shing. Katta testlarda pagination avtomatik ishlaydi.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a href="#manual-question" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white transition-all hover:bg-white/15">
                <Plus size={16} />
                Savol qo'shish
              </a>
              <a href="#bulk-import" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-primary shadow-lg shadow-black/20 transition-all hover:-translate-y-0.5">
                <Upload size={16} />
                Savollarni yuklash
              </a>
            </div>
          </div>
        </div>
        <div className="grid gap-4 px-8 py-7 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-slate-50 px-5 py-4">
            <p className="label-micro">Jami savollar</p>
            <p className="mt-2 text-2xl font-black text-text-primary">{data?.total || 0}</p>
          </div>
          <div className="rounded-2xl border border-border bg-slate-50 px-5 py-4">
            <p className="label-micro">Ko'rsatish usuli</p>
            <p className="mt-2 inline-flex items-center gap-2 text-sm font-black text-text-primary">
              <FileQuestion size={16} className="text-primary" />
              Pagination + modal edit
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-slate-50 px-5 py-4">
            <p className="label-micro">Tavsiya</p>
            <p className="mt-2 text-sm font-black text-text-primary">Avval savollarni tayyorlab, keyin test sozlamalarini yakunlang.</p>
          </div>
        </div>
      </section>

      {(createError || createSuccess) && (
        <section className="space-y-3">
          {createSuccess ? <div className="card border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{createSuccess}</div> : null}
          {createError ? <div className="card border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-600">{createError}</div> : null}
        </section>
      )}

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div id="manual-question" className="card p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Plus size={18} />
            </div>
            <div>
              <p className="label-micro">Manual</p>
              <h3 className="text-xl font-black text-text-primary">Yangi savol qo'shish</h3>
            </div>
          </div>
          <form className="mt-6 grid gap-3" onSubmit={(e) => void handleManualCreate(e)}>
            <textarea value={manualForm.text} onChange={(e) => setManualForm((current) => ({ ...current, text: e.target.value }))} placeholder="Savol matni" className="h-28 rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary outline-none" />
            <div className="grid gap-3 md:grid-cols-2">
              <input value={manualForm.option1} onChange={(e) => setManualForm((current) => ({ ...current, option1: e.target.value }))} placeholder="Variant 1" className="rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary outline-none" />
              <input value={manualForm.option2} onChange={(e) => setManualForm((current) => ({ ...current, option2: e.target.value }))} placeholder="Variant 2" className="rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary outline-none" />
              <input value={manualForm.option3} onChange={(e) => setManualForm((current) => ({ ...current, option3: e.target.value }))} placeholder="Variant 3" className="rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary outline-none" />
              <input value={manualForm.option4} onChange={(e) => setManualForm((current) => ({ ...current, option4: e.target.value }))} placeholder="Variant 4" className="rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary outline-none" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <select value={manualForm.correct_answer} onChange={(e) => setManualForm((current) => ({ ...current, correct_answer: e.target.value }))} className="rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary">
                <option value="1">To'g'ri javob: 1</option>
                <option value="2">To'g'ri javob: 2</option>
                <option value="3">To'g'ri javob: 3</option>
                <option value="4">To'g'ri javob: 4</option>
              </select>
              <input type="number" min={1} value={manualForm.score} onChange={(e) => setManualForm((current) => ({ ...current, score: e.target.value }))} placeholder="Ball" className="rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary outline-none" />
            </div>
            <button type="submit" disabled={isCreating} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white disabled:opacity-70">
              {isCreating ? <LoaderCircle className="animate-spin" size={16} /> : <Plus size={16} />}
              Savol qo'shish
            </button>
          </form>
        </div>

        <div id="bulk-import" className="card p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
              <Upload size={18} />
            </div>
            <div>
              <p className="label-micro">Bulk import</p>
              <h3 className="text-xl font-black text-text-primary">Savollarni yuklash</h3>
            </div>
          </div>
          <p className="mt-4 rounded-2xl border border-dashed border-border bg-slate-50 px-4 py-3 text-xs font-semibold leading-6 text-text-secondary">
            Savollarni <code>+++++</code> bilan ajrating. Variantlarni <code>====</code> bilan yozing. To'g'ri javob boshiga <code>#</code> qo'ying.
          </p>
          <form className="mt-4 grid gap-3" onSubmit={(e) => void handleBulkCreate(e)}>
            <textarea value={memoText} onChange={(e) => setMemoText(e.target.value)} placeholder={"Savol matni\n====\nVariant 1\n====\n#To'g'ri variant\n====\nVariant 3\n====\nVariant 4\n+++++\nKeyingi savol"} className="h-64 rounded-2xl border border-border bg-slate-50 px-4 py-3 font-mono text-sm font-medium text-text-primary outline-none" />
            <button type="submit" disabled={isCreating || !memoText.trim()} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-white px-5 py-3 text-sm font-black text-text-primary disabled:opacity-60">
              {isCreating ? <LoaderCircle className="animate-spin" size={16} /> : <Upload size={16} />}
              Savollarni yuklash
            </button>
          </form>
        </div>
      </section>

      <section className="card p-8">
        <form className="flex flex-col gap-3 md:flex-row" onSubmit={(e) => void applySearch(e)}>
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
            <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Savol matni bo'yicha qidirish..." className="w-full rounded-2xl border border-border bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-text-primary outline-none" />
          </div>
          <button type="submit" className="inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white">
            Qidirish
          </button>
        </form>

        {error ? <p className="mt-4 text-sm font-semibold text-rose-500">{error}</p> : null}

        {isLoading ? (
          <div className="mt-6 flex min-h-[220px] items-center justify-center gap-3 text-text-secondary">
            <LoaderCircle className="animate-spin text-primary" size={20} />
            Savollar yuklanmoqda...
          </div>
        ) : (
          <>
            <div className="mt-6 space-y-3">
              {data?.items.length ? (
                data.items.map((question, index) => (
                  <div
                    key={question.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openEditor(question)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openEditor(question);
                      }
                    }}
                    className="group flex items-start justify-between gap-4 rounded-[22px] border border-border bg-slate-50 p-4 text-left transition-all hover:border-primary/40 hover:bg-white"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-wide text-text-muted">#{(page - 1) * PAGE_SIZE + index + 1}</p>
                      <p className="mt-1 line-clamp-2 text-sm font-bold text-text-primary">{question.text}</p>
                      <p className="mt-2 text-xs font-semibold text-text-secondary">To'g'ri javob: {question.correct_answer} | Ball: {question.score}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={(event) => { event.stopPropagation(); openEditor(question); }} className="rounded-xl border border-border bg-white p-2 text-text-secondary transition-colors hover:text-primary">
                        <PencilLine size={15} />
                      </button>
                      <button type="button" onClick={(event) => { event.stopPropagation(); void removeQuestion(question.id); }} className="rounded-xl border border-border bg-white p-2 text-text-secondary transition-colors hover:text-danger">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-border p-6 text-sm font-medium text-text-secondary">
                  Savol topilmadi.
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between gap-4">
              <p className="text-xs font-bold text-text-muted">
                Jami: {data?.total || 0} ta | Sahifa: {data?.page || 1}/{Math.max(1, data?.total_pages || 1)}
              </p>
              <div className="flex items-center gap-2">
                <button type="button" disabled={!data?.has_previous} onClick={() => void goToPage(Math.max(1, page - 1))} className="rounded-xl border border-border bg-white px-3 py-2 text-xs font-bold text-text-primary disabled:opacity-50">
                  Oldingi
                </button>
                <button type="button" disabled={!data?.has_next} onClick={() => void goToPage(page + 1)} className="rounded-xl border border-border bg-white px-3 py-2 text-xs font-bold text-text-primary disabled:opacity-50">
                  Keyingi
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {editState.open && editState.question ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-black text-text-primary">Savolni tahrirlash</h3>
              <button type="button" onClick={closeEditor} className="rounded-xl border border-border bg-white p-2 text-text-secondary">
                <X size={16} />
              </button>
            </div>
            {editState.error ? <p className="mb-4 text-sm font-semibold text-rose-500">{editState.error}</p> : null}
            <form className="grid gap-3" onSubmit={(e) => void saveQuestion(e)}>
              <textarea value={editState.question.text} onChange={(e) => setEditState((current) => ({ ...current, question: current.question ? { ...current.question, text: e.target.value } : null }))} className="h-24 w-full rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary outline-none" />
              <div className="grid gap-3 md:grid-cols-2">
                <input value={editState.question.option1} onChange={(e) => setEditState((current) => ({ ...current, question: current.question ? { ...current.question, option1: e.target.value } : null }))} placeholder="Variant 1" className="rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary outline-none" />
                <input value={editState.question.option2} onChange={(e) => setEditState((current) => ({ ...current, question: current.question ? { ...current.question, option2: e.target.value } : null }))} placeholder="Variant 2" className="rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary outline-none" />
                <input value={editState.question.option3} onChange={(e) => setEditState((current) => ({ ...current, question: current.question ? { ...current.question, option3: e.target.value } : null }))} placeholder="Variant 3" className="rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary outline-none" />
                <input value={editState.question.option4} onChange={(e) => setEditState((current) => ({ ...current, question: current.question ? { ...current.question, option4: e.target.value } : null }))} placeholder="Variant 4" className="rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary outline-none" />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <select value={editState.question.correct_answer} onChange={(e) => setEditState((current) => ({ ...current, question: current.question ? { ...current.question, correct_answer: e.target.value } : null }))} className="rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary">
                  <option value="1">To'g'ri javob: 1</option>
                  <option value="2">To'g'ri javob: 2</option>
                  <option value="3">To'g'ri javob: 3</option>
                  <option value="4">To'g'ri javob: 4</option>
                </select>
                <input type="number" min={1} value={editState.question.score} onChange={(e) => setEditState((current) => ({ ...current, question: current.question ? { ...current.question, score: Number(e.target.value) || 1 } : null }))} className="rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary outline-none" />
              </div>
              <button type="submit" disabled={editState.saving} className="mt-2 inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white disabled:opacity-60">
                {editState.saving ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
