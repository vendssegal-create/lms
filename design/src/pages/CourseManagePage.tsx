import { FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  ClipboardCheck,
  FileText,
  FileUp,
  LoaderCircle,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
  Video,
  X,
  Link as LinkIcon,
  GripVertical,
  MonitorPlay,
  Settings2,
  Users,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  UserPlus,
  Image as ImageIcon,
  Award,
  FolderOpen,
  Package,
  PlayCircle,
  Calendar,
} from 'lucide-react';
import {
  addEnrollment,
  createAssignment,
  createMeeting,
  createResource,
  createSection,
  createTeacherTest,
  deleteAssignment,
  deleteBookChapter,
  deleteCourse,
  deleteEnrollment,
  deleteFolderFile,
  deleteGlossaryEntry,
  deleteMeeting,
  deleteTeacherTest,
  deleteResource,
  deleteSection,
  fetchCourseManage,
  fetchBookChapter,
  reorderResources,
  reorderSections,
  replaceResourceFile,
  saveBookChapter,
  searchEnrollments,
  saveGlossaryEntry,
  updateAssignment,
  updateCourse,
  updateResource,
  updateSection,
  updateTeacherTest,
  uploadFolderFile,
  saveCertificateTemplate,
  saveCertificateTrigger,
  deleteCertificateTrigger,
} from '@/src/api/lms';
import type {
  BookChapterItem,
  CourseDetailAssignment,
  CourseDetailMeeting,
  CourseManageResource,
  CourseManageResponse,
  CourseManageSection,
  DashboardTestItem,
  FolderFileItem,
  GlossaryEntryItem,
  ResourceType,
} from '@/src/types';
import { cn } from '@/src/lib/utils';

// UTILS
function moveItem<T>(arr: T[], index: number, delta: number) {
  const next = [...arr];
  const target = index + delta;
  if (target < 0 || target >= next.length) return next;
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}

function toDateTimeInput(value: string | null) {
  if (!value) return '';
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateTime(value: string | null) {
  if (!value) return 'No deadline';
  return new Intl.DateTimeFormat('uz-UZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

// MODAL SHELL (Updated)
type ModalShellProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  maxWidthClass?: string;
  headerGradient?: string;
};

function ModalShell({ open, title, subtitle, onClose, children, maxWidthClass = 'max-w-3xl', headerGradient }: ModalShellProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm" onClick={onClose}>
      <div className={cn("w-full max-h-[92vh] overflow-hidden rounded-[32px] border border-border bg-white shadow-2xl flex flex-col animate-slideUp", maxWidthClass)} onClick={(event) => event.stopPropagation()}>
        <div className={cn("flex items-start justify-between gap-4 px-8 py-7 text-white", headerGradient || "bg-primary")}>
          <div className="flex-1">
            <h3 className="text-2xl font-black tracking-tight">{title}</h3>
            {subtitle ? <p className="mt-2 text-sm font-medium opacity-80">{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 text-white backdrop-blur transition-all hover:bg-white/30">
            <X size={18} />
          </button>
        </div>
        <div className="p-8 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// INITIAL FORMS
const initialSectionForm = {
  id: null as number | null,
  name: '',
  description: '',
  is_published: true,
  unlock_mode: 'open',
  prerequisite_section_id: '',
};

const initialResourceForm = {
  id: null as number | null,
  sectionId: null as number | null,
  resource_type: 'file' as Exclude<ResourceType, 'certificate'>,
  title: '',
  description: '',
  url: '',
  content: '',
  file: null as File | null,
  is_visible: true,
  require_completion: false,
  estimated_time_minutes: '',
  open_in_new_tab: true,
  video_source: 'file' as 'url' | 'youtube' | 'vimeo' | 'file',
  video_poster_url: '',
  audio_transcript: '',
  h5p_embed_code: '',
  scorm_version: '1.2',
  scorm_entry_url: 'index.html',
  embed_width: '100%',
  embed_height: '500px',
  folder_files: [] as FolderFileItem[],
  chapters: [] as BookChapterItem[],
  glossary_entries: [] as GlossaryEntryItem[],
};

const initialBookChapterForm = {
  id: null as number | null,
  title: '',
  content: '',
};

const initialGlossaryEntryForm = {
  id: null as number | null,
  term: '',
  definition: '',
};

const initialAssignmentForm = {
  id: null as number | null,
  section_id: '' as string,
  title: '',
  description: '',
  deadline: '',
  max_score: '100',
  allow_late: false,
  is_active: true,
};

const initialTestForm = {
  id: null as number | null,
  section_id: '' as string,
  name: '',
  description: '',
  control_type: 'other',
  start_datetime: '',
  end_datetime: '',
  duration_minutes: '30',
  max_score: '100',
  attempts_allowed: '1',
  question_count: '10',
  is_active: true,
  is_random_order: false,
  proctoring_enabled: false,
  face_id_required: false,
  max_tab_switches: '3',
};

const initialMeetingForm = {
  id: null as number | null,
  section_id: '' as string,
  title: '',
  meeting_url: '',
  meeting_type: 'zoom',
  start_time: '',
  duration_minutes: '60',
};

const initialCertificateTemplateForm = {
  id: null as number | null,
  name: '',
  institution_name: '',
  issued_by: '',
  position: '',
  hours_per_course: '' as string,
  docx_file: null as File | null,
  docx_file_url: null as string | null,
};

const initialCertificateTriggerForm = {
  id: null as number | null,
  template_id: null as number | null,
  trigger_type: 'course_complete',
  target_section_id: null as number | null,
  target_test_id: null as number | null,
  min_score_percentage: 80,
};

function buildResourceForm(sectionId: number | null, resource?: CourseManageResource) {
  return {
    ...initialResourceForm,
    id: resource?.id ?? null,
    sectionId,
    resource_type: (resource?.resource_type && resource.resource_type !== 'certificate'
      ? resource.resource_type
      : 'file') as Exclude<ResourceType, 'certificate'>,
    title: resource?.title || '',
    description: resource?.description || '',
    url: resource?.url || '',
    content: resource?.content || '',
    file: null,
    is_visible: resource?.is_visible ?? true,
    require_completion: resource?.require_completion ?? false,
    estimated_time_minutes: resource?.estimated_time_minutes ? String(resource.estimated_time_minutes) : '',
    open_in_new_tab: resource?.open_in_new_tab ?? true,
    video_source: resource?.video_source || 'file',
    video_poster_url: resource?.video_poster_url || '',
    audio_transcript: resource?.audio_transcript || '',
    h5p_embed_code: resource?.h5p_embed_code || '',
    scorm_version: resource?.scorm_version || '1.2',
    scorm_entry_url: resource?.scorm_entry_url || 'index.html',
    embed_width: resource?.embed_width || '100%',
    embed_height: resource?.embed_height || '500px',
    folder_files: resource?.folder_files || [],
    chapters: resource?.chapters || [],
    glossary_entries: resource?.glossary_entries || [],
  };
}

function findManageResource(data: CourseManageResponse | null, resourceId: number) {
  if (!data) return null;
  for (const section of data.sections) {
    const resource = section.resources.find((item) => item.id === resourceId);
    if (resource) {
      return { resource, sectionId: section.id };
    }
  }
  return null;
}

const MANAGE_RESOURCE_VISUALS = {
  file: { icon: FileUp, className: 'bg-blue-50 text-blue-600' },
  link: { icon: LinkIcon, className: 'bg-indigo-50 text-indigo-600' },
  video: { icon: Video, className: 'bg-purple-50 text-purple-600' },
  text: { icon: FileText, className: 'bg-slate-100 text-slate-600' },
  audio: { icon: PlayCircle, className: 'bg-pink-50 text-pink-600' },
  embed: { icon: LinkIcon, className: 'bg-cyan-50 text-cyan-600' },
  h5p: { icon: Settings2, className: 'bg-orange-50 text-orange-600' },
  scorm: { icon: Package, className: 'bg-amber-50 text-amber-700' },
  folder: { icon: FolderOpen, className: 'bg-yellow-50 text-yellow-700' },
  book: { icon: BookOpen, className: 'bg-emerald-50 text-emerald-700' },
  glossary: { icon: ClipboardCheck, className: 'bg-teal-50 text-teal-700' },
  certificate: { icon: Award, className: 'bg-amber-50 text-amber-600' },
} as const;

type ManageTab = 'content' | 'settings' | 'enrollments';

export default function CourseManagePage() {
  const params = useParams();
  const courseId = Number(params.courseId || 0);

  // LOGIC STATES
  const [data, setData] = useState<CourseManageResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>({});
  const [editMode, setEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState<ManageTab>('content');
  const [courseForm, setCourseForm] = useState({ title: '', description: '', deadline: '', is_active: true, image_url: '', image: null as File | null });
  const [enrollmentValue, setEnrollmentValue] = useState('');
  const [enrollmentSearch, setEnrollmentSearch] = useState('');
  const [enrollmentSearchResults, setEnrollmentSearchResults] = useState<Array<{ id: number; username: string; full_name: string; group_name: string; student_id_number: string }>>([]);
  const [enrollmentSearchLoading, setEnrollmentSearchLoading] = useState(false);
  const [enrollmentSearchError, setEnrollmentSearchError] = useState<string | null>(null);
  const [courseImagePreview, setCourseImagePreview] = useState<string>('');

  useEffect(() => {
    if (courseForm.image) {
      const url = URL.createObjectURL(courseForm.image);
      setCourseImagePreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setCourseImagePreview(courseForm.image_url || '');
    }
  }, [courseForm.image, courseForm.image_url]);

  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [sectionForm, setSectionForm] = useState(initialSectionForm);

  const [activitySection, setActivitySection] = useState<CourseManageSection | null>(null);
  const [activityChooserOpen, setActivityChooserOpen] = useState(false);

  const [resourceModalOpen, setResourceModalOpen] = useState(false);
  const [resourceForm, setResourceForm] = useState(initialResourceForm);
  const [bookChapterForm, setBookChapterForm] = useState(initialBookChapterForm);
  const [glossaryEntryForm, setGlossaryEntryForm] = useState(initialGlossaryEntryForm);

  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState(initialAssignmentForm);

  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testForm, setTestForm] = useState(initialTestForm);

  const [meetingModalOpen, setMeetingModalOpen] = useState(false);
  const [meetingForm, setMeetingForm] = useState(initialMeetingForm);

  const [certificateModalOpen, setCertificateModalOpen] = useState(false);
  const [certificateTemplateForm, setCertificateTemplateForm] = useState(initialCertificateTemplateForm);
  const [certificateTriggerForm, setCertificateTriggerForm] = useState(initialCertificateTriggerForm);
  const [activeCertificateTab, setActiveCertificateTab] = useState<'template' | 'triggers'>('template');

  const sections = useMemo(() => data?.sections || [], [data]);
  const [dragSectionIndex, setDragSectionIndex] = useState<number | null>(null);
  const [dragResource, setDragResource] = useState<{ sectionId: number; index: number } | null>(null);

  const bannerGradients = [
    'from-blue-600 to-indigo-700',
    'from-violet-600 to-purple-700',
    'from-emerald-600 to-teal-700',
    'from-amber-600 to-orange-700',
    'from-rose-600 to-pink-700',
    'from-cyan-600 to-sky-700'
  ];
  const bannerGradient = bannerGradients[courseId % 6];

  // DATA LOADING
  async function reloadCourseManage() {
    const response = await fetchCourseManage(courseId);
    setData(response);
    setCourseForm({
      title: response.course.title,
      description: response.course.description,
      deadline: response.course.deadline ? response.course.deadline.slice(0, 10) : '',
      is_active: response.course.is_active,
      image_url: response.course.image_url || '',
      image: null,
    });
    return response;
  }

  useEffect(() => {
    let active = true;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetchCourseManage(courseId);
        if (!active) return;
        setData(response);
        setCourseForm({
          title: response.course.title,
          description: response.course.description,
          deadline: response.course.deadline ? response.course.deadline.slice(0, 10) : '',
          is_active: response.course.is_active,
          image_url: response.course.image_url || '',
          image: null,
        });
        const initialExpanded: Record<number, boolean> = {};
        response.sections.forEach((section) => {
          initialExpanded[section.id] = true;
        });
        setExpandedSections(initialExpanded);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Manage yuklanmadi.');
      } finally {
        if (active) setIsLoading(false);
      }
    }
    if (courseId) void load();
    return () => { active = false; };
  }, [courseId]);

  // ENROLLMENT SEARCH
  useEffect(() => {
    if (!data?.permissions.can_manage_enrollments) return;
    const q = enrollmentSearch.trim();
    if (q.length < 2) {
      setEnrollmentSearchResults([]);
      setEnrollmentSearchError(null);
      return;
    }
    let alive = true;
    setEnrollmentSearchLoading(true);
    setEnrollmentSearchError(null);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await searchEnrollments(courseId, q);
          if (!alive) return;
          setEnrollmentSearchResults(response.items);
        } catch (err) {
          if (!alive) return;
          setEnrollmentSearchError(err instanceof Error ? err.message : 'Qidiruv xato.');
        } finally {
          if (alive) setEnrollmentSearchLoading(false);
        }
      })();
    }, 300);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [courseId, data?.permissions.can_manage_enrollments, enrollmentSearch]);

  // MODAL HANDLERS
  function resetSectionModal() { setSectionForm(initialSectionForm); setSectionModalOpen(false); }
  function resetActivityModals() { setActivityChooserOpen(false); setActivitySection(null); }
  function resetResourceModal() {
    setResourceForm(initialResourceForm);
    setBookChapterForm(initialBookChapterForm);
    setGlossaryEntryForm(initialGlossaryEntryForm);
    setResourceModalOpen(false);
  }
  function resetAssignmentModal() { setAssignmentForm(initialAssignmentForm); setAssignmentModalOpen(false); }
  function resetTestModal() { setTestForm(initialTestForm); setTestModalOpen(false); }
  function resetMeetingModal() { setMeetingForm(initialMeetingForm); setMeetingModalOpen(false); }
  function resetCertificateModal() { 
    setCertificateModalOpen(false); 
    setCertificateTemplateForm(initialCertificateTemplateForm);
    setCertificateTriggerForm(initialCertificateTriggerForm);
  }

  function openCreateSectionModal() { setSectionForm(initialSectionForm); setSectionModalOpen(true); }
  function openEditSectionModal(section: CourseManageSection) {
    setSectionForm({
      id: section.id,
      name: section.name,
      description: section.description || '',
      is_published: section.is_published,
      unlock_mode: section.unlock_mode || 'open',
      prerequisite_section_id: section.prerequisite_section_id ? String(section.prerequisite_section_id) : '',
    });
    setSectionModalOpen(true);
  }

  function openActivityChooser(section: CourseManageSection) { setActivitySection(section); setActivityChooserOpen(true); }

  function openCreateResourceModal(type: Exclude<ResourceType, 'certificate'>) {
    if (!activitySection) return;
    setResourceForm({ ...buildResourceForm(activitySection.id, undefined), resource_type: type });
    setBookChapterForm(initialBookChapterForm);
    setGlossaryEntryForm(initialGlossaryEntryForm);
    setActivityChooserOpen(false);
    setResourceModalOpen(true);
  }

  function openEditResourceModal(sectionId: number, resource: CourseManageResource) {
    setResourceForm(buildResourceForm(sectionId, resource));
    setBookChapterForm(initialBookChapterForm);
    setGlossaryEntryForm(initialGlossaryEntryForm);
    setResourceModalOpen(true);
  }

  function openCreateAssignmentModal(sectionId: number | null) {
    setAssignmentForm({ ...initialAssignmentForm, section_id: sectionId ? String(sectionId) : '' });
    setActivityChooserOpen(false);
    setAssignmentModalOpen(true);
  }

  function openEditAssignmentModal(assignment: CourseDetailAssignment) {
    setAssignmentForm({
      id: assignment.id,
      section_id: assignment.section_id ? String(assignment.section_id) : '',
      title: assignment.title,
      description: assignment.description || '',
      deadline: assignment.deadline ? assignment.deadline.slice(0, 16) : '',
      max_score: String(assignment.max_score),
      allow_late: assignment.allow_late,
      is_active: assignment.is_active,
    });
    setAssignmentModalOpen(true);
  }

  function openCreateTestModal(sectionId: number | null) {
    setTestForm({ ...initialTestForm, section_id: sectionId ? String(sectionId) : '' });
    setActivityChooserOpen(false);
    setTestModalOpen(true);
  }

  function openEditTestModal(test: DashboardTestItem) {
    setTestForm({
      id: test.id,
      section_id: test.section?.id ? String(test.section.id) : '',
      name: test.name,
      description: test.description || '',
      control_type: test.control_type || 'other',
      start_datetime: toDateTimeInput(test.start_datetime),
      end_datetime: toDateTimeInput(test.end_datetime),
      duration_minutes: String(test.duration_minutes || 30),
      max_score: String(test.max_score || 100),
      attempts_allowed: String(test.attempts_allowed || 1),
      question_count: String(test.question_count || 10),
      is_active: test.is_active,
      is_random_order: test.is_random_order,
      proctoring_enabled: test.proctoring_enabled,
      face_id_required: test.face_id_required,
      max_tab_switches: String(test.max_tab_switches || 3),
    });
    setTestModalOpen(true);
  }

  function openCreateMeetingModal(sectionId: number | null) {
    setMeetingForm({ ...initialMeetingForm, section_id: sectionId ? String(sectionId) : '' });
    setActivityChooserOpen(false);
    setMeetingModalOpen(true);
  }

  function openEditMeetingModal(meeting: CourseDetailMeeting) {
    setMeetingForm({
      id: meeting.id,
      section_id: meeting.section_id ? String(meeting.section_id) : '',
      title: meeting.title,
      meeting_url: meeting.meeting_url,
      meeting_type: meeting.meeting_type || 'zoom',
      start_time: toDateTimeInput(meeting.start_time),
      duration_minutes: String(meeting.duration_minutes || 60),
    });
    setMeetingModalOpen(true);
  }

  function openCertificateModal() {
    const t = data?.certificates?.templates?.[0];
    if (t) {
      setCertificateTemplateForm({
        id: t.id,
        name: t.name || '',
        institution_name: t.institution_name || '',
        issued_by: t.issued_by || '',
        position: t.position || '',
        hours_per_course: t.hours_per_course != null ? String(t.hours_per_course) : '',
        docx_file: null,
        docx_file_url: t.docx_file ?? null,
      });
    } else {
      setCertificateTemplateForm(initialCertificateTemplateForm);
    }
    setCertificateModalOpen(true);
    setActivityChooserOpen(false);
  }

  function syncResourceFormFromData(nextData: CourseManageResponse | null, resourceId: number) {
    const found = findManageResource(nextData, resourceId);
    if (!found) return;
    setResourceForm(buildResourceForm(found.sectionId, found.resource));
  }

  // SAVE HANDLERS
  async function saveCourse(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      if (courseForm.image) {
        const fd = new FormData();
        fd.set('title', courseForm.title);
        fd.set('description', courseForm.description);
        fd.set('deadline', courseForm.deadline);
        fd.set('is_active', String(courseForm.is_active));
        fd.set('image_url', courseForm.image_url);
        fd.set('image', courseForm.image);
        await updateCourse(courseId, fd);
      } else {
        await updateCourse(courseId, {
          title: courseForm.title,
          description: courseForm.description,
          deadline: courseForm.deadline,
          is_active: courseForm.is_active,
          image_url: courseForm.image_url,
        });
      }
      await reloadCourseManage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Saqlanmadi.');
    } finally { setIsSaving(false); }
  }

  async function saveSection(event: FormEvent) {
    event.preventDefault();
    if (!sectionForm.name.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      const payload = {
        name: sectionForm.name.trim(),
        description: sectionForm.description.trim(),
        is_published: sectionForm.is_published,
        unlock_mode: sectionForm.unlock_mode,
        prerequisite_section_id: sectionForm.prerequisite_section_id ? Number(sectionForm.prerequisite_section_id) : null,
      };
      if (sectionForm.id) { await updateSection(sectionForm.id, payload); }
      else { await createSection(courseId, payload); }
      await reloadCourseManage();
      resetSectionModal();
    } catch (err) { setError(err instanceof Error ? err.message : 'Bolim saqlanmadi.'); }
    finally { setIsSaving(false); }
  }

  async function saveResource(event: FormEvent) {
    event.preventDefault();
    if (!resourceForm.sectionId || !resourceForm.title.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      let persistedResourceId = resourceForm.id;
      const trimmedTitle = resourceForm.title.trim();
      const trimmedDescription = resourceForm.description.trim();
      const trimmedUrl = resourceForm.url.trim();
      const trimmedContent = resourceForm.content;
      const trimmedTime = resourceForm.estimated_time_minutes.trim();
      const basePayload: Record<string, unknown> = {
        title: trimmedTitle,
        description: trimmedDescription,
        is_visible: resourceForm.is_visible,
        require_completion: resourceForm.require_completion,
        estimated_time_minutes: trimmedTime ? Number(trimmedTime) : null,
      };

      const appendCommonFields = (fd: FormData) => {
        fd.set('resource_type', resourceForm.resource_type);
        fd.set('title', trimmedTitle);
        fd.set('description', trimmedDescription);
        fd.set('is_visible', String(resourceForm.is_visible));
        fd.set('require_completion', String(resourceForm.require_completion));
        if (trimmedTime) {
          fd.set('estimated_time_minutes', trimmedTime);
        }
      };

      if (resourceForm.id) {
        const payload: Record<string, unknown> = { ...basePayload };

        if (resourceForm.resource_type === 'link' || resourceForm.resource_type === 'embed') {
          payload.url = trimmedUrl;
          payload.open_in_new_tab = resourceForm.open_in_new_tab;
        }
        if (resourceForm.resource_type === 'embed') {
          payload.embed_width = resourceForm.embed_width;
          payload.embed_height = resourceForm.embed_height;
        }
        if (resourceForm.resource_type === 'text' || resourceForm.resource_type === 'book') {
          payload.content = trimmedContent;
        }
        if (resourceForm.resource_type === 'video') {
          payload.video_source = resourceForm.video_source;
          payload.url = resourceForm.video_source === 'file' ? '' : trimmedUrl;
          payload.video_poster_url = resourceForm.video_poster_url.trim() || null;
        }
        if (resourceForm.resource_type === 'audio') {
          payload.url = trimmedUrl;
          payload.audio_transcript = resourceForm.audio_transcript;
        }
        if (resourceForm.resource_type === 'h5p') {
          payload.h5p_embed_code = resourceForm.h5p_embed_code;
        }
        if (resourceForm.resource_type === 'scorm') {
          payload.scorm_version = resourceForm.scorm_version;
          payload.scorm_entry_url = resourceForm.scorm_entry_url;
        }

        await updateResource(resourceForm.id, payload);
        if (
          resourceForm.file
          && ['file', 'audio', 'video', 'scorm'].includes(resourceForm.resource_type)
        ) {
          await replaceResourceFile(resourceForm.id, resourceForm.file);
        }
      } else {
        const useMultipart = (
          resourceForm.resource_type === 'file'
          || resourceForm.resource_type === 'scorm'
          || (resourceForm.resource_type === 'audio' && !!resourceForm.file)
          || (resourceForm.resource_type === 'video' && resourceForm.video_source === 'file' && !!resourceForm.file)
        );

        if (useMultipart) {
          const fd = new FormData();
          appendCommonFields(fd);
          if (resourceForm.file) {
            fd.set('file', resourceForm.file);
          }
          if (resourceForm.resource_type === 'video') {
            fd.set('video_source', resourceForm.video_source);
            if (resourceForm.video_poster_url.trim()) {
              fd.set('video_poster_url', resourceForm.video_poster_url.trim());
            }
          }
          if (resourceForm.resource_type === 'audio' && resourceForm.audio_transcript.trim()) {
            fd.set('audio_transcript', resourceForm.audio_transcript.trim());
          }
          if (resourceForm.resource_type === 'scorm') {
            fd.set('scorm_version', resourceForm.scorm_version);
            fd.set('scorm_entry_url', resourceForm.scorm_entry_url);
          }
          const response = await createResource(resourceForm.sectionId, fd);
          persistedResourceId = response.resource?.id ?? persistedResourceId;
        } else {
          const payload: Record<string, unknown> = {
            resource_type: resourceForm.resource_type,
            ...basePayload,
          };

          if (resourceForm.resource_type === 'link' || resourceForm.resource_type === 'embed') {
            payload.url = trimmedUrl;
            payload.open_in_new_tab = resourceForm.open_in_new_tab;
          }
          if (resourceForm.resource_type === 'embed') {
            payload.embed_width = resourceForm.embed_width;
            payload.embed_height = resourceForm.embed_height;
          }
          if (resourceForm.resource_type === 'text' || resourceForm.resource_type === 'book') {
            payload.content = trimmedContent;
          }
          if (resourceForm.resource_type === 'video') {
            payload.video_source = resourceForm.video_source;
            payload.url = trimmedUrl;
            payload.video_poster_url = resourceForm.video_poster_url.trim() || null;
          }
          if (resourceForm.resource_type === 'audio') {
            payload.url = trimmedUrl;
            payload.audio_transcript = resourceForm.audio_transcript;
          }
          if (resourceForm.resource_type === 'h5p') {
            payload.h5p_embed_code = resourceForm.h5p_embed_code;
          }
          if (resourceForm.resource_type === 'scorm') {
            payload.scorm_version = resourceForm.scorm_version;
            payload.scorm_entry_url = resourceForm.scorm_entry_url;
          }
          const response = await createResource(resourceForm.sectionId, payload);
          persistedResourceId = response.resource?.id ?? persistedResourceId;
        }
      }
      const nextData = await reloadCourseManage();
      if (
        persistedResourceId
        && ['folder', 'book', 'glossary'].includes(resourceForm.resource_type)
      ) {
        syncResourceFormFromData(nextData, persistedResourceId);
      } else {
        resetResourceModal();
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Resurs saqlanmadi.'); }
    finally { setIsSaving(false); }
  }

  async function saveAssignment(event: FormEvent) {
    event.preventDefault();
    if (!assignmentForm.title.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      const payload = {
        section_id: assignmentForm.section_id ? Number(assignmentForm.section_id) : null,
        title: assignmentForm.title.trim(),
        description: assignmentForm.description,
        max_score: Number(assignmentForm.max_score) || 100,
        deadline: assignmentForm.deadline || null,
        allow_late: assignmentForm.allow_late,
        is_active: assignmentForm.is_active,
      };
      if (assignmentForm.id) { await updateAssignment(assignmentForm.id, payload); }
      else { await createAssignment(courseId, payload); }
      await reloadCourseManage();
      resetAssignmentModal();
    } catch (err) { setError(err instanceof Error ? err.message : 'Topshiriq saqlanmadi.'); }
    finally { setIsSaving(false); }
  }

  async function saveTest(event: FormEvent) {
    event.preventDefault();
    if (!testForm.name.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      const payload = {
        course_id: courseId,
        section_id: testForm.section_id ? Number(testForm.section_id) : null,
        name: testForm.name.trim(),
        description: testForm.description.trim(),
        control_type: testForm.control_type,
        start_datetime: testForm.start_datetime || null,
        end_datetime: testForm.end_datetime || null,
        duration_minutes: Number(testForm.duration_minutes) || 30,
        max_score: Number(testForm.max_score) || 100,
        attempts_allowed: Number(testForm.attempts_allowed) || 1,
        question_count: Number(testForm.question_count) || 10,
        is_active: testForm.is_active,
        is_random_order: testForm.is_random_order,
        proctoring_enabled: testForm.proctoring_enabled,
        face_id_required: testForm.face_id_required,
        max_tab_switches: Number(testForm.max_tab_switches) || 3,
      };
      if (testForm.id) { await updateTeacherTest(testForm.id, payload); }
      else { await createTeacherTest(payload); }
      await reloadCourseManage();
      resetTestModal();
    } catch (err) { setError(err instanceof Error ? err.message : 'Test saqlanmadi.'); }
    finally { setIsSaving(false); }
  }

  async function saveMeeting(event: FormEvent) {
    event.preventDefault();
    if (!meetingForm.title.trim() || !meetingForm.meeting_url.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      if (meetingForm.id) { await deleteMeeting(meetingForm.id); }
      await createMeeting(courseId, {
        title: meetingForm.title.trim(),
        meeting_url: meetingForm.meeting_url.trim(),
        meeting_type: meetingForm.meeting_type,
        start_time: meetingForm.start_time,
        duration_minutes: Number(meetingForm.duration_minutes) || 60,
        section_id: meetingForm.section_id ? Number(meetingForm.section_id) : null,
      });
      await reloadCourseManage();
      resetMeetingModal();
    } catch (err) { setError(err instanceof Error ? err.message : 'Meeting saqlanmadi.'); }
    finally { setIsSaving(false); }
  }

  async function ensureCertificateResourceInSection(sectionId: number, title: string) {
    const fresh = await fetchCourseManage(courseId);
    const sec = fresh.sections.find((s) => s.id === sectionId);
    if (!sec) return;
    if (sec.resources.some((r) => r.resource_type === 'certificate')) return;
    await createResource(sectionId, {
      resource_type: 'certificate',
      title: title.trim() || 'Sertifikat',
    });
  }

  async function handleSaveCertificateTemplate(e: FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const hoursVal = certificateTemplateForm.hours_per_course.trim();
      const resp = await saveCertificateTemplate(courseId, {
        id: certificateTemplateForm.id ?? undefined,
        name: certificateTemplateForm.name.trim(),
        institution_name: certificateTemplateForm.institution_name.trim(),
        issued_by: certificateTemplateForm.issued_by.trim(),
        position: certificateTemplateForm.position.trim(),
        hours_per_course: hoursVal === '' ? null : Number(hoursVal),
        docx_file: certificateTemplateForm.docx_file,
      });
      if (resp && resp.template) {
        const tpl = resp.template as {
          id: number;
          name: string;
          docx_file?: string | null;
        };
        setCertificateTemplateForm((prev) => ({
          ...prev,
          id: tpl.id,
          name: tpl.name,
          docx_file: null,
          docx_file_url: tpl.docx_file ?? prev.docx_file_url,
        }));
      }

      const tplName =
        (resp && resp.template && (resp.template as { name?: string }).name) ||
        certificateTemplateForm.name ||
        'Sertifikat';
      if (activitySection) {
        await ensureCertificateResourceInSection(activitySection.id, tplName);
      }

      await reloadCourseManage();
      setSuccess("Sertifikat dizayni muvaffaqiyatli saqlandi!");
      if (activitySection) {
        setTimeout(() => resetCertificateModal(), 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sertifikat saqlanmadi.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddCertificateLinkToSectionOnly() {
    if (!activitySection || !certificateTemplateForm.id) return;
    setIsSaving(true);
    setError(null);
    try {
      await ensureCertificateResourceInSection(
        activitySection.id,
        certificateTemplateForm.name || 'Sertifikat',
      );
      await reloadCourseManage();
      setSuccess("Sertifikat bo‘limga qo‘shildi.");
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Qo‘shilmadi.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveCertificateTrigger(e: FormEvent) {
    e.preventDefault();
    if (!certificateTemplateForm.id) return;
    setIsSaving(true);
    try {
      await saveCertificateTrigger(courseId, {
        ...certificateTriggerForm,
        template_id: certificateTemplateForm.id
      });
      await reloadCourseManage();
      setCertificateTriggerForm(initialCertificateTriggerForm);
      setSuccess("Sertifikat berish sharti qo'shildi!");
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Shart saqlanmadi.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemoveTrigger(id: number) {
    if (!window.confirm("Shart o'chirilsinmi?")) return;
    try {
      await deleteCertificateTrigger(courseId, id);
      await reloadCourseManage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ochirilmadi.');
    }
  }

  // REORDER HANDLERS
  async function reorder(sectionIndex: number, delta: number) {
    if (!data) return;
    const next = moveItem<CourseManageSection>(data.sections, sectionIndex, delta);
    setData({ ...data, sections: next });
    try { await reorderSections(courseId, next.map((s) => s.id)); } catch (err) {
      setError(err instanceof Error ? err.message : 'Reorder xato.');
      await reloadCourseManage();
    }
  }

  async function reorderRes(sectionId: number, index: number, delta: number) {
    if (!data) return;
    const section = data.sections.find((item) => item.id === sectionId);
    if (!section) return;
    const nextResources = moveItem<CourseManageResource>(section.resources, index, delta);
    setData({
      ...data,
      sections: data.sections.map((item) => item.id === sectionId ? { ...item, resources: nextResources } : item),
    });
    try { await reorderResources(sectionId, nextResources.map((item) => item.id)); } catch (err) {
      setError(err instanceof Error ? err.message : 'Reorder xato.');
      await reloadCourseManage();
    }
  }

  // REMOVE HANDLERS
  async function removeSection(sectionId: number) {
    if (!window.confirm('Bolim ochirilsinmi?')) return;
    setIsSaving(true);
    setError(null);
    try { await deleteSection(sectionId); await reloadCourseManage(); } catch (err) {
      setError(err instanceof Error ? err.message : 'Ochirilmadi.');
    } finally { setIsSaving(false); }
  }

  async function saveBookChapterItem() {
    if (!resourceForm.id || !bookChapterForm.title.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      await saveBookChapter(resourceForm.id, {
        id: bookChapterForm.id || undefined,
        title: bookChapterForm.title.trim(),
        content: bookChapterForm.content,
      });
      const nextData = await reloadCourseManage();
      syncResourceFormFromData(nextData, resourceForm.id);
      setBookChapterForm(initialBookChapterForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bob saqlanmadi.');
    } finally {
      setIsSaving(false);
    }
  }

  async function removeBookChapterItem(chapterId: number) {
    if (!resourceForm.id || !window.confirm("Bob o'chirilsinmi?")) return;
    setIsSaving(true);
    setError(null);
    try {
      await deleteBookChapter(resourceForm.id, chapterId);
      const nextData = await reloadCourseManage();
      syncResourceFormFromData(nextData, resourceForm.id);
      if (bookChapterForm.id === chapterId) {
        setBookChapterForm(initialBookChapterForm);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bob o‘chirilmadi.');
    } finally {
      setIsSaving(false);
    }
  }

  async function editBookChapterItem(chapter: BookChapterItem) {
    if (!resourceForm.id) return;
    setIsSaving(true);
    setError(null);
    try {
      const loaded = await fetchBookChapter(resourceForm.id, chapter.id);
      setBookChapterForm({
        id: loaded.id,
        title: loaded.title,
        content: loaded.content || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bob yuklanmadi.');
    } finally {
      setIsSaving(false);
    }
  }

  async function saveGlossaryEntryItem() {
    if (!resourceForm.id || !glossaryEntryForm.term.trim() || !glossaryEntryForm.definition.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      await saveGlossaryEntry(resourceForm.id, {
        id: glossaryEntryForm.id || undefined,
        term: glossaryEntryForm.term.trim(),
        definition: glossaryEntryForm.definition.trim(),
      });
      const nextData = await reloadCourseManage();
      syncResourceFormFromData(nextData, resourceForm.id);
      setGlossaryEntryForm(initialGlossaryEntryForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Atama saqlanmadi.');
    } finally {
      setIsSaving(false);
    }
  }

  async function removeGlossaryEntryItem(entryId: number) {
    if (!resourceForm.id || !window.confirm("Atama o'chirilsinmi?")) return;
    setIsSaving(true);
    setError(null);
    try {
      await deleteGlossaryEntry(resourceForm.id, entryId);
      const nextData = await reloadCourseManage();
      syncResourceFormFromData(nextData, resourceForm.id);
      if (glossaryEntryForm.id === entryId) {
        setGlossaryEntryForm(initialGlossaryEntryForm);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Atama o‘chirilmadi.');
    } finally {
      setIsSaving(false);
    }
  }

  async function uploadFolderResourceFile(file: File | null) {
    if (!resourceForm.id || !file) return;
    setIsSaving(true);
    setError(null);
    try {
      await uploadFolderFile(resourceForm.id, file);
      const nextData = await reloadCourseManage();
      syncResourceFormFromData(nextData, resourceForm.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fayl yuklanmadi.');
    } finally {
      setIsSaving(false);
    }
  }

  async function removeFolderResourceFile(fileId: number) {
    if (!resourceForm.id || !window.confirm("Papkadagi fayl o'chirilsinmi?")) return;
    setIsSaving(true);
    setError(null);
    try {
      await deleteFolderFile(resourceForm.id, fileId);
      const nextData = await reloadCourseManage();
      syncResourceFormFromData(nextData, resourceForm.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fayl o‘chirilmadi.');
    } finally {
      setIsSaving(false);
    }
  }

  async function removeRes(resourceId: number) {
    if (!window.confirm('Resurs ochirilsinmi?')) return;
    setIsSaving(true);
    setError(null);
    try { await deleteResource(resourceId); await reloadCourseManage(); } catch (err) {
      setError(err instanceof Error ? err.message : 'Ochirilmadi.');
    } finally { setIsSaving(false); }
  }

  async function removeAssignment(assignmentId: number) {
    if (!window.confirm('Topshiriq ochirilsinmi?')) return;
    setIsSaving(true);
    setError(null);
    try { await deleteAssignment(assignmentId); await reloadCourseManage(); } catch (err) {
      setError(err instanceof Error ? err.message : 'Ochirilmadi.');
    } finally { setIsSaving(false); }
  }

  async function removeMeeting(meetingId: number) {
    if (!window.confirm('Meeting ochirilsinmi?')) return;
    setIsSaving(true);
    setError(null);
    try { await deleteMeeting(meetingId); await reloadCourseManage(); } catch (err) {
      setError(err instanceof Error ? err.message : 'Ochirilmadi.');
    } finally { setIsSaving(false); }
  }

  async function removeTest(testId: number) {
    if (!window.confirm("Test, unga biriktirilgan savollar va urinishlar ochirilsinmi?")) return;
    setIsSaving(true);
    setError(null);
    try { await deleteTeacherTest(testId); await reloadCourseManage(); } catch (err) {
      setError(err instanceof Error ? err.message : 'Ochirilmadi.');
    } finally { setIsSaving(false); }
  }

  // ENROLLMENT LOGIC
  async function addStudent(event: FormEvent) {
    event.preventDefault();
    if (!data?.permissions.can_manage_enrollments) return;
    const val = enrollmentValue.trim();
    if (!val) return;
    setIsSaving(true);
    setError(null);
    try {
      const isDigits = /^\d+$/.test(val);
      await addEnrollment(courseId, isDigits ? { student_id_number: val } : { username: val });
      await reloadCourseManage();
      setEnrollmentValue('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Biriktirilmadi.'); }
    finally { setIsSaving(false); }
  }

  async function addStudentByUsername(username: string) {
    if (!data?.permissions.can_manage_enrollments) return;
    setIsSaving(true);
    setError(null);
    try {
      await addEnrollment(courseId, { username });
      await reloadCourseManage();
      setEnrollmentSearch('');
      setEnrollmentSearchResults([]);
    } catch (err) { setError(err instanceof Error ? err.message : 'Biriktirilmadi.'); }
    finally { setIsSaving(false); }
  }

  async function removeEnrollment(enrollmentId: number) {
    if (!window.confirm('Talaba kursdan chiqarilsinmi?')) return;
    setIsSaving(true);
    setError(null);
    try { await deleteEnrollment(enrollmentId); await reloadCourseManage(); } catch (err) {
      setError(err instanceof Error ? err.message : 'Ochirilmadi.');
    } finally { setIsSaving(false); }
  }

  async function removeCourse() {
    if (!window.confirm('Kurs ochirilsinmi?')) return;
    setIsSaving(true);
    setError(null);
    try {
      await deleteCourse(courseId);
      window.location.href = '/courses/manage';
    } catch (err) { setError(err instanceof Error ? err.message : 'Ochirilmadi.'); }
    finally { setIsSaving(false); }
  }

  // DRAG & DROP
  function handleSectionDrop(targetIndex: number) {
    if (dragSectionIndex === null || dragSectionIndex === targetIndex || !data) return;
    const next = moveItem<CourseManageSection>(data.sections, dragSectionIndex, targetIndex - dragSectionIndex);
    setData({ ...data, sections: next });
    void reorderSections(courseId, next.map((s) => s.id));
    setDragSectionIndex(null);
  }

  function handleResourceDrop(sectionId: number, targetIndex: number) {
    if (!dragResource || dragResource.sectionId !== sectionId || !data) return;
    const section = data.sections.find((item) => item.id === sectionId);
    if (!section) return;
    const nextResources = moveItem<CourseManageResource>(section.resources, dragResource.index, targetIndex - dragResource.index);
    setData({
      ...data,
      sections: data.sections.map((item) => item.id === sectionId ? { ...item, resources: nextResources } : item),
    });
    void reorderResources(sectionId, nextResources.map((item) => item.id));
    setDragResource(null);
  }

  function toggleSection(sectionId: number) { setExpandedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] })); }
  function expandAll(expand: boolean) {
    if (!data) return;
    const next: Record<number, boolean> = {};
    data.sections.forEach((section) => { next[section.id] = expand; });
    setExpandedSections(next);
  }

  // RENDER HELPERS
  if (isLoading) {
    return (
      <div className="space-y-8 animate-slideUp">
        <div className="h-64 rounded-[40px] bg-slate-200 animate-pulse shimmer" />
        <div className="flex bg-slate-100 p-1.5 rounded-[24px] w-fit">
           <div className="h-10 w-32 bg-slate-200 rounded-[20px] shimmer" />
           <div className="h-10 w-32 bg-slate-200 rounded-[20px] ml-2 shimmer" />
           <div className="h-10 w-32 bg-slate-200 rounded-[20px] ml-2 shimmer" />
        </div>
        <div className="space-y-4">
           {[...Array(3)].map((_, i) => (
             <div key={i} className="h-24 rounded-[28px] bg-slate-50 shimmer" />
           ))}
        </div>
      </div>
    );
  }

  if (!data) {
     return (
       <div className="card p-12 text-center">
         <div className="h-16 w-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} />
         </div>
         <h3 className="text-xl font-black text-text-primary">Kurs topilmadi</h3>
         <p className="mt-2 text-text-secondary max-w-sm mx-auto">{error || "Ma'lumotlarni yuklab bo'lmadi."}</p>
         <Link to="/courses/manage" className="btn btn-primary mt-8 px-8">Kurslar ro'yxatiga qaytish</Link>
       </div>
     );
  }

  return (
    <div className="space-y-10 animate-slideUp">
      
      {/* SECTION 1: MANAGE BANNER */}
      <section className={cn(
        "relative overflow-hidden rounded-[40px] bg-gradient-to-br px-10 py-12 text-white shadow-2xl",
        bannerGradient
      )}>
        <div className="relative z-10 flex flex-col lg:flex-row items-start justify-between gap-10">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-sm font-bold text-white/70">
               <Link to="/courses/manage" className="hover:text-white transition-colors">Kurslarni boshqarish</Link>
               <ChevronRight size={14} />
               <span className="text-white truncate max-w-[200px]">{data.course.title}</span>
            </div>
            <h1 className="mt-6 text-4xl font-black tracking-tight leading-tight max-w-2xl">{data.course.title}</h1>
            
            <div className="mt-8 flex flex-wrap gap-3">
              <span className={cn(
                "flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-black",
                data.course.is_active ? "bg-emerald-500/20 text-emerald-100" : "bg-slate-500/20 text-slate-100"
              )}>
                <div className={cn("h-2 w-2 rounded-full", data.course.is_active ? "bg-emerald-400" : "bg-slate-400")} />
                {data.course.is_active ? 'Faol kurs' : 'Nofaol kurs'}
              </span>
              {data.course.deadline && (
                <span className="flex items-center gap-2 rounded-full bg-amber-500/20 px-4 py-1.5 text-xs font-black text-amber-100">
                  <Calendar size={14} />
                  Muddati: {formatDateTime(data.course.deadline).split(',')[0]}
                </span>
              )}
            </div>

            <Link 
              to={`/courses/${data.course.id}`} 
              className="mt-10 inline-flex items-center gap-2.5 rounded-2xl border border-white/20 bg-white/10 px-6 py-3.5 text-sm font-black text-white backdrop-blur transition hover:bg-white/20"
            >
              <MonitorPlay size={18} />
              Kursni ko'rish
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-4 w-full lg:w-auto">
            {[
              { label: 'Talaba', value: data.course.students_count || 0, icon: <Users size={16} /> },
              { label: 'Mavzu', value: data.sections.length, icon: <BookOpen size={16} /> },
              { label: 'Test', value: data.course.tests_count || 0, icon: <ClipboardCheck size={16} /> },
              { label: 'Vazifa', value: data.course.assignments_count || 0, icon: <Upload size={16} /> }
            ].map((stat, i) => (
              <div key={i} className="bg-white/10 backdrop-blur rounded-[24px] p-5 text-center min-w-[100px] border border-white/10">
                <div className="text-2xl font-black">{stat.value}</div>
                <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-white/60">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 2: TAB NAVIGATION */}
      <div className="flex bg-slate-100/50 p-1.5 rounded-[24px] border border-border/40 w-fit">
        <button
          onClick={() => setActiveTab('content')}
          className={cn(
            "px-6 py-2.5 rounded-[20px] text-sm font-bold transition-all flex items-center gap-2",
            activeTab === 'content' ? "bg-white text-primary shadow-premium" : "text-text-secondary hover:text-text-primary"
          )}
        >
          <BookOpen size={16} />
          Kurs tarkibi
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={cn(
            "px-6 py-2.5 rounded-[20px] text-sm font-bold transition-all flex items-center gap-2",
            activeTab === 'settings' ? "bg-white text-primary shadow-premium" : "text-text-secondary hover:text-text-primary"
          )}
        >
          <Settings2 size={16} />
          Sozlamalar
        </button>
        <button
          onClick={() => setActiveTab('enrollments')}
          className={cn(
            "px-6 py-2.5 rounded-[20px] text-sm font-bold transition-all flex items-center gap-2",
            activeTab === 'enrollments' ? "bg-white text-primary shadow-premium" : "text-text-secondary hover:text-text-primary"
          )}
        >
          <Users size={16} />
          Talabalar
          <span className="opacity-50 ml-1">({data.course.students_count || 0})</span>
        </button>
      </div>

      {/* TAB CONTENT */}
      <div className="min-h-[400px]">
        {activeTab === 'content' && (
          <div className="space-y-8 animate-slideUp">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                 <h2 className="text-2xl font-black text-text-primary">Kurs tarkibi</h2>
                 <p className="mt-1 text-sm text-text-secondary">Mavzularni tartiblash va materiallarni boshqarish.</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <div 
                    onClick={() => setEditMode(!editMode)}
                    className={cn(
                      "h-6 w-11 rounded-full cursor-pointer transition-colors relative",
                      editMode ? "bg-primary" : "bg-slate-300"
                    )}
                  >
                    <div className={cn(
                      "h-5 w-5 rounded-full bg-white shadow absolute top-0.5 transition-all",
                      editMode ? "left-[22px]" : "left-0.5"
                    )} />
                  </div>
                  <span className="text-xs font-bold text-text-primary uppercase tracking-wider">Tahrirlash rejimi</span>
                </div>
                <button
                  type="button"
                  onClick={openCreateSectionModal}
                  className="btn btn-primary px-6 py-3 rounded-2xl gap-2 shadow-premium"
                >
                  <Plus size={18} />
                  Mavzu qo'shish
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {sections.map((section, index) => (
                <div
                  key={section.id}
                  className="card group overflow-hidden"
                  draggable={editMode}
                  onDragStart={() => editMode && setDragSectionIndex(index)}
                  onDragOver={(event) => editMode && event.preventDefault()}
                  onDrop={() => editMode && handleSectionDrop(index)}
                  onDragEnd={() => setDragSectionIndex(null)}
                >
                  <div className={cn(
                    "flex flex-col md:flex-row items-center gap-4 px-6 py-5 cursor-pointer text-left transition-colors",
                    expandedSections[section.id] ? "bg-slate-50/60" : "hover:bg-slate-50/30"
                  )} onClick={() => toggleSection(section.id)}>
                    {editMode && (
                      <div className="h-10 w-10 flex items-center justify-center rounded-2xl bg-white border border-border shadow-sm shrink-0 cursor-grab active:cursor-grabbing">
                        <GripVertical size={16} className="text-text-muted" />
                      </div>
                    )}
                    <div className={cn(
                      "h-10 w-10 flex items-center justify-center rounded-[16px] font-black text-sm shrink-0 transition-colors",
                      expandedSections[section.id] ? "bg-primary text-white shadow-premium" : "bg-white border border-border text-text-secondary"
                    )}>
                      {String(index + 1).padStart(2, '0')}
                    </div>
                    <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-3">
                         <h3 className="text-lg font-black text-text-primary truncate">{section.name}</h3>
                         {!section.is_published && (
                           <span className="status-pill status-pill-warning scale-75">Qoralama</span>
                         )}
                         <span className="text-xs font-bold text-text-muted uppercase tracking-tight">
                           {section.resources.length + section.meetings.length + section.tests.length + section.assignments.length} material
                         </span>
                       </div>
                       {section.description && (
                         <p className="mt-1 text-sm text-text-secondary truncate max-w-xl">{section.description}</p>
                       )}
                    </div>
                    <div className="flex items-center gap-2">
                       {editMode && (
                         <div className="flex items-center gap-2 mr-4 border-r border-border/60 pr-4">
                           <button type="button" onClick={(e) => { e.stopPropagation(); reorder(index, -1); }} className="h-9 w-9 flex items-center justify-center rounded-xl bg-white border border-border text-text-muted hover:text-primary hover:border-primary transition-all shadow-sm">
                             <ArrowUp size={16} />
                           </button>
                           <button type="button" onClick={(e) => { e.stopPropagation(); reorder(index, 1); }} className="h-9 w-9 flex items-center justify-center rounded-xl bg-white border border-border text-text-muted hover:text-primary hover:border-primary transition-all shadow-sm">
                             <ArrowDown size={16} />
                           </button>
                           <button type="button" onClick={(e) => { e.stopPropagation(); openEditSectionModal(section); }} className="h-9 w-9 flex items-center justify-center rounded-xl bg-white border border-border text-text-muted hover:text-primary transition-all shadow-sm">
                             <Pencil size={16} />
                           </button>
                           <button type="button" onClick={(e) => { e.stopPropagation(); removeSection(section.id); }} className="h-9 w-9 flex items-center justify-center rounded-xl bg-rose-50 border border-rose-100 text-rose-500 hover:bg-rose-100 transition-all shadow-sm">
                             <Trash2 size={16} />
                           </button>
                         </div>
                       )}
                       <div className={cn("transition-transform duration-300", expandedSections[section.id] ? "rotate-180" : "")}>
                         <ArrowDown size={18} className="text-text-muted" />
                       </div>
                    </div>
                  </div>

                  {expandedSections[section.id] && (
                    <div className="px-6 pb-6 pt-2 divide-y divide-dashed divide-border/40">
                      
                      {/* Resources */}
                      {section.resources.map((res, resIdx) => {
                        const visual = MANAGE_RESOURCE_VISUALS[res.resource_type as keyof typeof MANAGE_RESOURCE_VISUALS] || MANAGE_RESOURCE_VISUALS.text;
                        const Icon = visual.icon;
                        return (
                        <div key={`res-${res.id}`} 
                          className="flex items-center justify-between gap-4 py-3.5 group/item"
                          draggable={editMode}
                          onDragStart={() => editMode && setDragResource({ sectionId: section.id, index: resIdx })}
                          onDragOver={(e) => editMode && e.preventDefault()}
                          onDrop={() => editMode && handleResourceDrop(section.id, resIdx)}
                          onDragEnd={() => setDragResource(null)}
                        >
                          <div 
                            className="flex items-center gap-4 cursor-pointer"
                            onClick={() => res.resource_type === 'certificate' ? openCertificateModal() : (editMode && openEditResourceModal(section.id, res))}
                          >
                             <div className={cn("h-10 w-10 flex items-center justify-center rounded-2xl", visual.className)}>
                               <Icon size={16} />
                             </div>
                             <div>
                               <p className="text-sm font-bold text-text-primary">{res.title}</p>
                               <div className="flex flex-wrap items-center gap-2">
                                 <span className="text-[10px] font-black uppercase tracking-widest opacity-50">{res.resource_type_label}</span>
                                 {res.require_completion ? (
                                   <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-700">
                                     Majburiy
                                   </span>
                                 ) : null}
                                 {!res.is_visible ? (
                                   <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-rose-700">
                                     Yashirin
                                   </span>
                                 ) : null}
                               </div>
                             </div>
                          </div>
                          {editMode && (
                            <div className="flex items-center gap-1.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                               <button onClick={() => reorderRes(section.id, resIdx, -1)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-text-muted">
                                 <ArrowUp size={14} />
                               </button>
                               <button onClick={() => reorderRes(section.id, resIdx, 1)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-text-muted">
                                 <ArrowDown size={14} />
                               </button>
                               <button 
                                 onClick={() => res.resource_type === 'certificate' ? openCertificateModal() : openEditResourceModal(section.id, res)} 
                                 className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-text-muted"
                               >
                                 <Pencil size={14} />
                               </button>
                               <button onClick={() => removeRes(res.id)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-rose-50 text-rose-500">
                                 <Trash2 size={14} />
                               </button>
                            </div>
                          )}
                        </div>
                        )})}

                      {/* Meetings */}
                      {section.meetings.map((m) => (
                        <div key={`meeting-${m.id}`} className="flex items-center justify-between gap-4 py-3.5 group/item">
                          <div className="flex items-center gap-4">
                             <div className="h-10 w-10 flex items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                               <MonitorPlay size={16} />
                             </div>
                             <div>
                               <p className="text-sm font-bold text-text-primary">{m.title}</p>
                               <span className="text-[10px] font-black uppercase tracking-widest opacity-50">{formatDateTime(m.start_time)}</span>
                             </div>
                          </div>
                          {editMode && (
                             <div className="flex items-center gap-1.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                               <button onClick={() => openEditMeetingModal(m)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-text-muted">
                                 <Pencil size={14} />
                               </button>
                               <button onClick={() => removeMeeting(m.id)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-rose-50 text-rose-500">
                                 <Trash2 size={14} />
                               </button>
                             </div>
                          )}
                        </div>
                      ))}

                      {/* Assignments */}
                      {section.assignments.map((a) => (
                        <div key={`assignment-${a.id}`} className="flex items-center justify-between gap-4 py-3.5 group/item">
                          <div className="flex items-center gap-4">
                             <div className="h-10 w-10 flex items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                               <Upload size={16} />
                             </div>
                             <div>
                               <p className="text-sm font-bold text-text-primary">{a.title}</p>
                               <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Vazifa • {formatDateTime(a.deadline)}</span>
                             </div>
                          </div>
                          {editMode && (
                             <div className="flex items-center gap-1.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                               <button onClick={() => openEditAssignmentModal(a)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-text-muted">
                                 <Pencil size={14} />
                               </button>
                               <button onClick={() => removeAssignment(a.id)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-rose-50 text-rose-500">
                                 <Trash2 size={14} />
                               </button>
                             </div>
                          )}
                        </div>
                      ))}

                      {/* Tests */}
                      {section.tests.map((t) => (
                        <div key={`test-${t.id}`} className="flex items-center justify-between gap-4 py-3.5 group/item">
                          <div className="flex items-center gap-4">
                             <div className="h-10 w-10 flex items-center justify-center rounded-2xl bg-green-50 text-green-600">
                               <ClipboardCheck size={16} />
                             </div>
                             <div>
                               <p className="text-sm font-bold text-text-primary">{t.name}</p>
                               <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Test • {formatDateTime(t.end_datetime)}</span>
                             </div>
                          </div>
                          {editMode && (
                             <div className="flex items-center gap-1.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                               <button onClick={() => openEditTestModal(t)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-text-muted">
                                 <Pencil size={14} />
                               </button>
                               <button onClick={() => removeTest(t.id)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-rose-50 text-rose-500">
                                 <Trash2 size={14} />
                               </button>
                             </div>
                          )}
                        </div>
                      ))}

                      {editMode && (
                        <button 
                          onClick={() => openActivityChooser(section)}
                          className="flex items-center gap-2 text-xs font-bold text-primary border border-dashed border-primary/30 rounded-2xl px-4 py-2.5 w-full justify-center hover:bg-primary/5 transition-colors mt-4"
                        >
                          <Plus size={14} />
                          Faoliyat qo'shish
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="grid lg:grid-cols-[minmax(0,1.4fr)_300px] gap-10 animate-slideUp">
            <div className="card p-10">
              <div className="flex items-center gap-3 mb-8">
                 <Settings2 className="text-primary" size={24} />
                 <h2 className="text-2xl font-black text-text-primary">Kurs sozlamalari</h2>
              </div>
              
              <form onSubmit={saveCourse} className="space-y-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-text-secondary">Kurs nomi</label>
                    <input
                      className="input"
                      value={courseForm.title}
                      onChange={(e) => setCourseForm(p => ({ ...p, title: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-text-secondary">Tavsif</label>
                    <textarea
                      rows={6}
                      className="input resize-none py-4"
                      value={courseForm.description}
                      onChange={(e) => setCourseForm(p => ({ ...p, description: e.target.value }))}
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-text-secondary">Yakuniy muddat</label>
                      <input
                        type="date"
                        className="input"
                        value={courseForm.deadline}
                        onChange={(e) => setCourseForm(p => ({ ...p, deadline: e.target.value }))}
                      />
                    </div>
                    
                    <div className="space-y-2">
                       <label className="text-sm font-bold text-text-secondary block">Holat</label>
                       <div className="flex items-center gap-3 mt-4">
                          <div 
                            onClick={() => setCourseForm(p => ({ ...p, is_active: !p.is_active }))}
                            className={cn(
                              "h-6 w-11 rounded-full cursor-pointer transition-colors relative",
                              courseForm.is_active ? "bg-emerald-500" : "bg-slate-300"
                            )}
                          >
                            <div className={cn(
                              "h-5 w-5 rounded-full bg-white shadow absolute top-0.5 transition-all",
                              courseForm.is_active ? "left-[22px]" : "left-0.5"
                            )} />
                          </div>
                          <span className="text-sm font-bold text-text-primary">Faol kurs</span>
                       </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-border/40 space-y-6">
                    <div className="flex items-center gap-3">
                       <ImageIcon size={20} className="text-primary" />
                       <h3 className="text-lg font-black text-text-primary">Kurs rasmi</h3>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8 items-start">
                      <div className="space-y-4">
                         <div className="space-y-2">
                           <label className="text-xs font-black text-text-muted uppercase tracking-wider">Rasm havolasi (URL)</label>
                           <input
                             className="input"
                             value={courseForm.image_url}
                             onChange={(e) => setCourseForm(p => ({ ...p, image_url: e.target.value }))}
                             placeholder="https://example.com/image.jpg"
                           />
                         </div>

                         <div className="space-y-2">
                           <label className="text-xs font-black text-text-muted uppercase tracking-wider">Yoki rasm yuklash</label>
                           <div className="relative border-2 border-dashed border-border rounded-2xl p-6 text-center bg-slate-50 hover:border-primary/50 transition-colors group">
                              <input
                                type="file"
                                accept="image/*"
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                onChange={(e) => setCourseForm(p => ({ ...p, image: e.target.files?.[0] || null }))}
                              />
                              <div className="flex flex-col items-center">
                                 <Upload size={20} className="text-text-muted group-hover:text-primary transition-colors mb-2" />
                                 <span className="text-xs font-bold text-text-secondary">
                                   {courseForm.image ? courseForm.image.name : "Faylni tanlang"}
                                 </span>
                              </div>
                           </div>
                         </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-black text-text-muted uppercase tracking-wider">Preview</label>
                        <div className="aspect-video rounded-2xl overflow-hidden border border-border bg-slate-100 flex items-center justify-center relative shadow-inner">
                           {courseImagePreview ? (
                             <img 
                               src={courseImagePreview} 
                               alt="Preview" 
                               className="w-full h-full object-cover" 
                             />
                           ) : (
                             <div className="flex flex-col items-center text-text-muted">
                               <ImageIcon size={32} />
                               <span className="text-[10px] font-bold uppercase mt-2">Rasm mavjud emas</span>
                             </div>
                           )}
                           <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] font-black text-white uppercase tracking-tighter">
                             Live Preview
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 pt-10 border-t border-border/40">
                   <button type="button" onClick={removeCourse} className="btn border border-rose-200 text-rose-600 bg-rose-50 hover:bg-rose-100 flex items-center gap-2 px-6">
                     <Trash2 size={18} />
                     Kursni o'chirish
                   </button>
                   <button type="submit" disabled={isSaving} className="btn btn-primary px-8 gap-2 shadow-premium">
                     {isSaving ? <LoaderCircle size={18} className="animate-spin" /> : <Save size={18} />}
                     Saqlash
                   </button>
                </div>
              </form>
            </div>

            <div className="space-y-6">
               <div className="card p-8">
                  <h3 className="text-xl font-black text-text-primary mb-6">Kurs statistikasi</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b border-border/40">
                       <span className="text-sm text-text-secondary">O'qituvchi</span>
                       <span className="text-sm font-bold text-text-primary">{data.course.teacher.full_name}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/40">
                       <span className="text-sm text-text-secondary">Talabalar</span>
                       <span className="text-sm font-bold text-text-primary">{data.course.students_count || 0}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                       <span className="text-sm text-text-secondary">Forum xabarlari</span>
                       <span className="text-sm font-bold text-text-primary">Tez kunda</span>
                    </div>
                  </div>
                  
                  <div className="mt-10 space-y-3">
                     <Link to={`/courses/${courseId}`} className="btn btn-outline w-full justify-between group">
                        Kursga o'tish
                        <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                     </Link>
                     <Link to={`/courses/${courseId}/gradebook`} className="btn btn-outline w-full justify-between group text-emerald-600 border-emerald-100 hover:bg-emerald-50">
                        Baholar (Gradebook)
                        <TrendingUp size={16} className="group-hover:-translate-y-1 transition-transform" />
                     </Link>
                  </div>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'enrollments' && (
          <div className="grid lg:grid-cols-[minmax(0,1.35fr)_300px] gap-10 animate-slideUp">
            <div className="card overflow-hidden">
               <div className="p-8 border-b border-border/40 bg-slate-50/50 flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-black text-text-primary">Talabalar</h2>
                    <p className="mt-1 text-sm text-text-secondary">Kursga biriktirilgan barcha talabalar ro'yxati.</p>
                  </div>
                  <div className="text-right">
                     <div className="text-2xl font-black text-primary">{data.course.students_count || 0}</div>
                     <div className="text-[10px] font-black uppercase tracking-widest text-text-muted">Jami talaba</div>
                  </div>
               </div>

               {data.permissions.can_manage_enrollments && (
                 <>
                   {/* Student Search Panel */}
                   <div className="p-8 border-b border-border/40 space-y-4 relative">
                      <div className="relative">
                        <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={20} />
                        <input
                          className="input pl-12 h-14"
                          placeholder="F.I.SH. yoki username bo'yicha qidirish..."
                          value={enrollmentSearch}
                          onChange={(e) => setEnrollmentSearch(e.target.value)}
                        />
                        {enrollmentSearchLoading && (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2">
                             <LoaderCircle className="animate-spin text-primary" size={18} />
                          </div>
                        )}
                      </div>

                      {enrollmentSearchResults.length > 0 && (
                        <div className="absolute top-24 left-8 right-8 z-30 bg-white rounded-[24px] border border-border shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] max-h-72 overflow-y-auto p-4 space-y-2 animate-slideUp">
                          {enrollmentSearchResults.map(s => (
                            <div key={s.id} className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-colors">
                               <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-primary/10 text-primary font-black text-sm">
                                     {s.full_name[0]}
                                  </div>
                                  <div>
                                     <p className="text-sm font-bold text-text-primary">{s.full_name}</p>
                                     <span className="text-[10px] text-text-muted uppercase font-black">{s.group_name} • {s.student_id_number}</span>
                                  </div>
                               </div>
                               <button 
                                 onClick={() => addStudentByUsername(s.username)}
                                 className="h-9 w-9 flex items-center justify-center rounded-xl bg-primary text-white hover:opacity-90 transition-opacity"
                               >
                                 <Plus size={18} />
                               </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <form onSubmit={addStudent} className="flex gap-3 pt-2">
                        <input
                          className="input !h-12 flex-1"
                          placeholder="ID raqami yoki username"
                          value={enrollmentValue}
                          onChange={(e) => setEnrollmentValue(e.target.value)}
                        />
                        <button type="submit" disabled={isSaving} className="btn btn-primary px-8 rounded-2xl gap-2 shadow-premium whitespace-nowrap">
                          {isSaving ? <LoaderCircle size={18} className="animate-spin" /> : <UserPlus size={18} />}
                          Talaba qo'shish
                        </button>
                      </form>
                   </div>
                 </>
               )}

               <div className="p-0 overflow-x-auto">
                 {data.enrollments.length > 0 ? (
                   <table className="w-full text-left">
                     <thead className="bg-slate-50 border-b border-border/40 text-[10px] font-black text-text-muted uppercase tracking-widest">
                        <tr>
                          <th className="px-8 py-4 w-16">#</th>
                          <th className="px-8 py-4">Ismi va familiyasi</th>
                          <th className="px-8 py-4">Guruh</th>
                          <th className="px-8 py-4">ID raqam</th>
                          <th className="px-8 py-4 w-16 text-right">Amallar</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-border/40">
                        {data.enrollments.map((e, i) => (
                          <tr key={e.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-8 py-4 text-sm font-bold text-text-muted">{i + 1}</td>
                            <td className="px-8 py-4">
                               <div className="flex items-center gap-3">
                                  <div className="h-9 w-9 flex items-center justify-center rounded-xl bg-slate-100 text-text-secondary font-black text-xs">
                                     {e.full_name[0]}
                                  </div>
                                  <span className="text-sm font-bold text-text-primary">{e.full_name}</span>
                               </div>
                            </td>
                            <td className="px-8 py-4 text-sm font-semibold text-text-secondary">{e.group_name}</td>
                            <td className="px-8 py-4 text-sm font-semibold text-text-secondary font-mono">{e.student_id_number}</td>
                            <td className="px-8 py-4 text-right">
                               {data.permissions.can_manage_enrollments && (
                                 <button 
                                   onClick={() => removeEnrollment(e.id)}
                                   className="h-9 w-9 inline-flex items-center justify-center rounded-xl text-rose-500 hover:bg-rose-50 transition-colors"
                                 >
                                   <Trash2 size={18} />
                                 </button>
                               )}
                            </td>
                          </tr>
                        ))}
                     </tbody>
                   </table>
                 ) : (
                   <div className="py-24 text-center">
                      <div className="h-20 w-20 rounded-[32px] bg-slate-50 text-slate-200 flex items-center justify-center mx-auto mb-6">
                        <Users size={48} />
                      </div>
                      <h3 className="text-xl font-black text-text-primary">Talaba topilmadi</h3>
                      <p className="mt-2 text-text-secondary max-w-xs mx-auto">Sizda hali biriktirilgan talabalar mavjud emas.</p>
                   </div>
                 )}
               </div>
            </div>

            <div className="space-y-6">
               <div className="card p-8">
                  <h3 className="text-xl font-black text-text-primary mb-6">Enrollment info</h3>
                  <div className="space-y-6 text-center">
                    <div className="h-32 w-32 rounded-full border-4 border-primary/10 flex items-center justify-center mx-auto relative group">
                       <span className="text-4xl font-black text-primary">{data.course.students_count || 0}</span>
                       <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin opacity-20" />
                    </div>
                    <p className="text-sm font-medium text-text-secondary px-2">Hozirda ushbu kursga jami {data.course.students_count || 0} ta talaba biriktirilgan.</p>
                  </div>
               </div>

               <div className="card p-8">
                  <h4 className="text-sm font-black text-text-muted uppercase tracking-widest mb-6">Tezkor havolalar</h4>
                  <div className="space-y-2">
                     <Link to={`/courses/${courseId}/gradebook`} className="flex items-center justify-between p-4 rounded-[20px] bg-slate-50 transition hover:bg-slate-100 group">
                        <span className="text-sm font-bold text-text-primary">Gradebook (Baholash)</span>
                        <ChevronRight size={16} className="text-text-muted transition group-hover:translate-x-1" />
                     </Link>
                     <Link to={`/courses/${courseId}/forum`} className="flex items-center justify-between p-4 rounded-[20px] bg-slate-50 transition hover:bg-slate-100 group">
                        <span className="text-sm font-bold text-text-primary">Kurs forumi</span>
                        <ChevronRight size={16} className="text-text-muted transition group-hover:translate-x-1" />
                     </Link>
                  </div>
               </div>
            </div>
          </div>
        )}
      </div>

      {/* SUCCESS TOAST */}
      {success && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[120] rounded-[32px] bg-emerald-50 border border-emerald-100 p-5 shadow-[0_20px_50px_rgba(16,185,129,0.2)] flex items-center gap-4 min-w-[320px] animate-slideUp">
           <div className="h-10 w-10 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <ClipboardCheck size={20} />
           </div>
           <p className="flex-1 text-sm font-bold text-emerald-600 pr-4">{success}</p>
           <button onClick={() => setSuccess(null)} className="h-8 w-8 flex items-center justify-center rounded-xl bg-white/20 text-emerald-500 hover:bg-emerald-100 transition-colors">
              <X size={16} />
           </button>
        </div>
      )}

      {/* ERROR TOAST */}
      {error && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[110] rounded-[32px] bg-rose-50 border border-rose-100 p-5 shadow-[0_20px_50px_rgba(239,68,68,0.2)] flex items-center gap-4 min-w-[320px] animate-slideUp">
           <div className="h-10 w-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <AlertCircle size={20} />
           </div>
           <p className="flex-1 text-sm font-bold text-rose-600 pr-4">{error}</p>
           <button onClick={() => setError(null)} className="h-8 w-8 flex items-center justify-center rounded-xl bg-white/20 text-rose-500 hover:bg-rose-100 transition-colors">
              <X size={16} />
           </button>
        </div>
      )}

      {/* MODALS */}
      <ModalShell 
        open={sectionModalOpen} 
        title={sectionForm.id ? 'Mavzuni tahrirlash' : 'Yangi mavzu qo\'shish'} 
        subtitle="Dars mavzusi va sozlamalarini o'zgartiring"
        onClose={resetSectionModal}
        headerGradient={bannerGradient}
      >
        <form onSubmit={saveSection} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-text-secondary ml-1">Mavzu nomi</label>
            <input
              className="input"
              value={sectionForm.name}
              onChange={(event) => setSectionForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Masalan: 1-Mavzu. Kirish"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-text-secondary ml-1">Tavsif (ixtiyoriy)</label>
            <textarea
              rows={3}
              className="input resize-none"
              value={sectionForm.description}
              onChange={(event) => setSectionForm((prev) => ({ ...prev, description: event.target.value }))}
            />
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-bold text-text-secondary ml-1">Ochilish rejimi</label>
              <select
                className="input"
                value={sectionForm.unlock_mode}
                onChange={(event) => setSectionForm((prev) => ({ ...prev, unlock_mode: event.target.value }))}
              >
                <option value="open">Ochiq</option>
                <option value="scheduled">Sana bo'yicha</option>
                <option value="prerequisite">Prerekvizit</option>
              </select>
            </div>
            {sectionForm.unlock_mode === 'prerequisite' && (
              <div className="space-y-2">
                <label className="text-sm font-bold text-text-secondary ml-1">Prerekvizit mavzu ID</label>
                <input
                  type="number"
                  className="input"
                  value={sectionForm.prerequisite_section_id}
                  onChange={(event) => setSectionForm((prev) => ({ ...prev, prerequisite_section_id: event.target.value }))}
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 py-2">
             <div 
               onClick={() => setSectionForm(p => ({ ...p, is_published: !p.is_published }))}
               className={cn(
                 "h-6 w-11 rounded-full cursor-pointer transition-colors relative",
                 sectionForm.is_published ? "bg-emerald-500" : "bg-slate-300"
               )}
             >
               <div className={cn(
                 "h-5 w-5 rounded-full bg-white shadow absolute top-0.5 transition-all text-[8px] flex items-center justify-center font-black",
                 sectionForm.is_published ? "left-[22px] text-emerald-500" : "left-0.5 text-slate-400"
               )} />
             </div>
             <span className="text-sm font-bold text-text-primary uppercase tracking-tight">Nashr etish</span>
          </div>
          <div className="flex justify-end gap-3 pt-6 border-t border-border/40">
            <button type="button" onClick={resetSectionModal} className="btn border border-border px-6">Bekor qilish</button>
            <button type="submit" disabled={isSaving} className="btn btn-primary px-8 gap-2 shadow-premium">
              {isSaving ? <LoaderCircle size={18} className="animate-spin" /> : <Save size={18} />}
              Saqlash
            </button>
          </div>
        </form>
      </ModalShell>

      <ModalShell 
        open={activityChooserOpen} 
        title="Faoliyat turini tanlang" 
        subtitle={activitySection ? `Bo'lim: ${activitySection.name}` : undefined} 
        onClose={resetActivityModals}
        headerGradient={bannerGradient}
        maxWidthClass="max-w-2xl"
      >
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
           {[
             { key: 'file', label: 'Fayl', icon: <FileUp size={24} />, colorClass: 'bg-blue-50 text-blue-600', action: () => openCreateResourceModal('file') },
             { key: 'link', label: 'Havola', icon: <LinkIcon size={24} />, colorClass: 'bg-indigo-50 text-indigo-600', action: () => openCreateResourceModal('link') },
             { key: 'video', label: 'Video', icon: <Video size={24} />, colorClass: 'bg-purple-50 text-purple-600', action: () => openCreateResourceModal('video') },
             { key: 'text', label: 'Matnli dars', icon: <FileText size={24} />, colorClass: 'bg-slate-100 text-slate-600', action: () => openCreateResourceModal('text') },
             { key: 'audio', label: 'Audio', icon: <PlayCircle size={24} />, colorClass: 'bg-pink-50 text-pink-600', action: () => openCreateResourceModal('audio') },
             { key: 'embed', label: 'Embed', icon: <LinkIcon size={24} />, colorClass: 'bg-cyan-50 text-cyan-600', action: () => openCreateResourceModal('embed') },
             { key: 'h5p', label: 'H5P', icon: <Settings2 size={24} />, colorClass: 'bg-orange-50 text-orange-600', action: () => openCreateResourceModal('h5p') },
             { key: 'scorm', label: 'SCORM', icon: <Package size={24} />, colorClass: 'bg-amber-50 text-amber-700', action: () => openCreateResourceModal('scorm') },
             { key: 'folder', label: 'Papka', icon: <FolderOpen size={24} />, colorClass: 'bg-yellow-50 text-yellow-700', action: () => openCreateResourceModal('folder') },
             { key: 'book', label: 'Kitob', icon: <BookOpen size={24} />, colorClass: 'bg-emerald-50 text-emerald-700', action: () => openCreateResourceModal('book') },
             { key: 'glossary', label: 'Glossariy', icon: <ClipboardCheck size={24} />, colorClass: 'bg-teal-50 text-teal-700', action: () => openCreateResourceModal('glossary') },
             { key: 'assignment', label: 'Vazifa', icon: <Upload size={24} />, colorClass: 'bg-amber-50 text-amber-600', action: () => openCreateAssignmentModal(activitySection?.id ?? null) },
             { key: 'test', label: 'Test', icon: <ClipboardCheck size={24} />, colorClass: 'bg-green-50 text-green-600', action: () => openCreateTestModal(activitySection?.id ?? null) },
             { key: 'certificate', label: 'Sertifikat', icon: <Award size={24} />, colorClass: 'bg-amber-100 text-amber-700', action: openCertificateModal }
           ].map((type) => (
             <button 
               key={type.key}
               onClick={type.action}
               className="h-32 rounded-[28px] border border-border p-6 flex flex-col items-center justify-center gap-3 transition-all hover:border-primary hover:bg-primary/5 hover:scale-[1.02] active:scale-95 group shadow-sm bg-white"
             >
                <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", type.colorClass)}>
                   {type.icon}
                </div>
                <span className="text-sm font-extrabold text-text-primary">{type.label}</span>
             </button>
           ))}
           <button 
              onClick={() => openCreateMeetingModal(activitySection?.id ?? null)}
              className="col-span-2 md:col-span-3 h-20 rounded-[28px] border border-border p-4 flex items-center justify-center gap-4 transition-all hover:border-primary hover:bg-primary/5 hover:scale-[1.02] active:scale-95 group shadow-sm bg-white"
           >
              <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform">
                 <MonitorPlay size={20} />
              </div>
              <span className="text-base font-black text-text-primary">Online dars (Meeting) yaratish</span>
           </button>
        </div>
      </ModalShell>

      <ModalShell 
        open={resourceModalOpen} 
        title={resourceForm.id ? 'Resurs tahrirlash' : 'Yangi resurs'} 
        onClose={resetResourceModal}
        headerGradient={bannerGradient}
        maxWidthClass="max-w-5xl"
      >
        <form onSubmit={saveResource} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-text-secondary ml-1">Sarlavha</label>
              <input
                className="input"
                value={resourceForm.title}
                onChange={(event) => setResourceForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Material nomini kiriting"
                required
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-text-secondary ml-1">Qisqa tavsif</label>
              <textarea
                rows={3}
                className="input resize-none py-4"
                value={resourceForm.description}
                onChange={(event) => setResourceForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Talabaga bu resurs nima berishini yozing..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-text-secondary ml-1">Taxminiy vaqt (daqiqada)</label>
              <input
                type="number"
                className="input"
                value={resourceForm.estimated_time_minutes}
                onChange={(event) => setResourceForm((prev) => ({ ...prev, estimated_time_minutes: event.target.value }))}
                placeholder="Masalan: 15"
              />
            </div>

            <div className="flex flex-wrap items-center gap-6 pt-8">
              <div className="flex items-center gap-3">
                <div
                  onClick={() => setResourceForm((prev) => ({ ...prev, is_visible: !prev.is_visible }))}
                  className={cn("h-6 w-11 rounded-full cursor-pointer transition-colors relative", resourceForm.is_visible ? "bg-emerald-500" : "bg-slate-300")}
                >
                  <div className={cn("h-5 w-5 rounded-full bg-white shadow absolute top-0.5 transition-all", resourceForm.is_visible ? "left-[22px]" : "left-0.5")} />
                </div>
                <span className="text-xs font-black uppercase tracking-tight text-text-primary">Ko'rinadi</span>
              </div>
              <div className="flex items-center gap-3">
                <div
                  onClick={() => setResourceForm((prev) => ({ ...prev, require_completion: !prev.require_completion }))}
                  className={cn("h-6 w-11 rounded-full cursor-pointer transition-colors relative", resourceForm.require_completion ? "bg-amber-500" : "bg-slate-300")}
                >
                  <div className={cn("h-5 w-5 rounded-full bg-white shadow absolute top-0.5 transition-all", resourceForm.require_completion ? "left-[22px]" : "left-0.5")} />
                </div>
                <span className="text-xs font-black uppercase tracking-tight text-text-primary">Majburiy</span>
              </div>
            </div>
          </div>

          {(resourceForm.resource_type === 'file'
            || resourceForm.resource_type === 'audio'
            || resourceForm.resource_type === 'scorm'
            || (resourceForm.resource_type === 'video' && resourceForm.video_source === 'file')) ? (
            <div className="space-y-2">
              <label className="text-sm font-bold text-text-secondary ml-1">
                {resourceForm.resource_type === 'audio' ? 'Audio fayl' : resourceForm.resource_type === 'scorm' ? 'SCORM zip fayl' : 'Faylni tanlang'}
              </label>
              <div className="border-2 border-dashed border-border rounded-2xl p-8 text-center bg-slate-50 relative group cursor-pointer hover:border-primary/50 transition-colors">
                <input
                  type="file"
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  onChange={(event) => setResourceForm((prev) => ({ ...prev, file: event.target.files?.[0] ?? null }))}
                />
                <div className="flex flex-col items-center">
                  <div className="h-12 w-12 rounded-2xl bg-white border border-border flex items-center justify-center shadow-sm text-primary mb-3">
                    <FileUp size={24} />
                  </div>
                  <p className="text-sm font-bold text-text-primary">
                    {resourceForm.file ? resourceForm.file.name : 'Faylni bosing yoki sudrab keling'}
                  </p>
                  <p className="text-xs text-text-muted mt-1">Hajmi 50MB gacha ruxsat etiladi</p>
                </div>
              </div>
            </div>
          ) : null}

          {(resourceForm.resource_type === 'link'
            || resourceForm.resource_type === 'embed'
            || (resourceForm.resource_type === 'audio' && !resourceForm.file)
            || (resourceForm.resource_type === 'video' && resourceForm.video_source !== 'file')) ? (
            <div className="space-y-2">
              <label className="text-sm font-bold text-text-secondary ml-1">Havola (URL)</label>
              <input
                className="input"
                value={resourceForm.url}
                onChange={(event) => setResourceForm((prev) => ({ ...prev, url: event.target.value }))}
                placeholder="https://..."
                required={resourceForm.resource_type !== 'audio'}
              />
            </div>
          ) : null}

          {resourceForm.resource_type === 'video' ? (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-bold text-text-secondary ml-1">Video manbasi</label>
                <select
                  className="input"
                  value={resourceForm.video_source}
                  onChange={(event) => setResourceForm((prev) => ({ ...prev, video_source: event.target.value as typeof prev.video_source, file: null, url: '' }))}
                >
                  <option value="file">Fayl</option>
                  <option value="youtube">YouTube</option>
                  <option value="vimeo">Vimeo</option>
                  <option value="url">To'g'ridan-to'g'ri URL</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-text-secondary ml-1">Poster rasmi URL</label>
                <input
                  className="input"
                  value={resourceForm.video_poster_url}
                  onChange={(event) => setResourceForm((prev) => ({ ...prev, video_poster_url: event.target.value }))}
                  placeholder="https://..."
                />
              </div>
            </div>
          ) : null}

          {(resourceForm.resource_type === 'link' || resourceForm.resource_type === 'embed') ? (
            <div className="flex items-center gap-3">
              <div
                onClick={() => setResourceForm((prev) => ({ ...prev, open_in_new_tab: !prev.open_in_new_tab }))}
                className={cn("h-6 w-11 rounded-full cursor-pointer transition-colors relative", resourceForm.open_in_new_tab ? "bg-blue-500" : "bg-slate-300")}
              >
                <div className={cn("h-5 w-5 rounded-full bg-white shadow absolute top-0.5 transition-all", resourceForm.open_in_new_tab ? "left-[22px]" : "left-0.5")} />
              </div>
              <span className="text-xs font-black uppercase tracking-tight text-text-primary">Yangi tabda ochish</span>
            </div>
          ) : null}

          {resourceForm.resource_type === 'embed' ? (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-bold text-text-secondary ml-1">Kenglik</label>
                <input
                  className="input"
                  value={resourceForm.embed_width}
                  onChange={(event) => setResourceForm((prev) => ({ ...prev, embed_width: event.target.value }))}
                  placeholder="100%"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-text-secondary ml-1">Balandlik</label>
                <input
                  className="input"
                  value={resourceForm.embed_height}
                  onChange={(event) => setResourceForm((prev) => ({ ...prev, embed_height: event.target.value }))}
                  placeholder="500px"
                />
              </div>
            </div>
          ) : null}

          {resourceForm.resource_type === 'audio' ? (
            <div className="space-y-2">
              <label className="text-sm font-bold text-text-secondary ml-1">Transkript</label>
              <textarea
                rows={5}
                className="input resize-none py-4"
                value={resourceForm.audio_transcript}
                onChange={(event) => setResourceForm((prev) => ({ ...prev, audio_transcript: event.target.value }))}
                placeholder="Audio uchun matnli transcript..."
              />
            </div>
          ) : null}

          {(resourceForm.resource_type === 'text' || resourceForm.resource_type === 'book') ? (
            <div className="space-y-2">
              <label className="text-sm font-bold text-text-secondary ml-1">
                {resourceForm.resource_type === 'book' ? 'Kirish sahifasi / qisqa intro (HTML mumkin)' : "Ma'ruza matni (HTML ruxsat etiladi)"}
              </label>
              <textarea
                rows={10}
                className="input py-4 font-mono text-xs"
                value={resourceForm.content}
                onChange={(event) => setResourceForm((prev) => ({ ...prev, content: event.target.value }))}
                placeholder="Bu yerga dars matnini kiriting..."
              />
            </div>
          ) : null}

          {resourceForm.resource_type === 'h5p' ? (
            <div className="space-y-2">
              <label className="text-sm font-bold text-text-secondary ml-1">H5P embed kodi</label>
              <textarea
                rows={8}
                className="input py-4 font-mono text-xs"
                value={resourceForm.h5p_embed_code}
                onChange={(event) => setResourceForm((prev) => ({ ...prev, h5p_embed_code: event.target.value }))}
                placeholder="<iframe ...></iframe>"
              />
            </div>
          ) : null}

          {resourceForm.resource_type === 'scorm' ? (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-bold text-text-secondary ml-1">SCORM versiyasi</label>
                <select
                  className="input"
                  value={resourceForm.scorm_version}
                  onChange={(event) => setResourceForm((prev) => ({ ...prev, scorm_version: event.target.value }))}
                >
                  <option value="1.2">SCORM 1.2</option>
                  <option value="2004">SCORM 2004</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-text-secondary ml-1">Entry fayl</label>
                <input
                  className="input"
                  value={resourceForm.scorm_entry_url}
                  onChange={(event) => setResourceForm((prev) => ({ ...prev, scorm_entry_url: event.target.value }))}
                  placeholder="index.html"
                />
              </div>
            </div>
          ) : null}

          {resourceForm.resource_type === 'folder' ? (
            <div className="space-y-4 rounded-[28px] border border-border/60 bg-slate-50/70 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-black text-text-primary uppercase tracking-wider">Papka fayllari</h4>
                  <p className="mt-1 text-xs font-medium text-text-secondary">Resurs saqlangach papkaga fayl yuklash mumkin.</p>
                </div>
                {resourceForm.id ? (
                  <label className="btn btn-primary gap-2 cursor-pointer">
                    <FileUp size={16} />
                    Fayl qo'shish
                    <input
                      type="file"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        void uploadFolderResourceFile(file);
                        event.target.value = '';
                      }}
                    />
                  </label>
                ) : null}
              </div>
              {!resourceForm.id ? (
                <p className="text-sm font-medium text-text-secondary">Avval papka resursini saqlang.</p>
              ) : resourceForm.folder_files.length === 0 ? (
                <p className="text-sm font-medium text-text-secondary">Hali fayl yuklanmagan.</p>
              ) : (
                <div className="space-y-3">
                  {resourceForm.folder_files.map((file) => (
                    <div key={file.id} className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3 border border-border/60">
                      <div>
                        <p className="text-sm font-bold text-text-primary">{file.original_filename}</p>
                        <p className="text-xs font-medium text-text-secondary">{[file.mime_type || 'Fayl', file.file_size ? `${Math.round(file.file_size / 1024)} KB` : null].filter(Boolean).join(' • ')}</p>
                      </div>
                      <button type="button" onClick={() => void removeFolderResourceFile(file.id)} className="h-9 w-9 flex items-center justify-center rounded-xl text-rose-500 hover:bg-rose-50">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {resourceForm.resource_type === 'book' ? (
            <div className="space-y-4 rounded-[28px] border border-border/60 bg-slate-50/70 p-5">
              <div>
                <h4 className="text-sm font-black text-text-primary uppercase tracking-wider">Boblar</h4>
                <p className="mt-1 text-xs font-medium text-text-secondary">Book resursi saqlangach boblarni alohida boshqarish mumkin.</p>
              </div>
              {!resourceForm.id ? (
                <p className="text-sm font-medium text-text-secondary">Avval kitob resursini saqlang.</p>
              ) : (
                <>
                  <div className="space-y-3 rounded-2xl bg-white p-4 border border-border/60">
                    <input
                      className="input"
                      value={bookChapterForm.title}
                      onChange={(event) => setBookChapterForm((prev) => ({ ...prev, title: event.target.value }))}
                      placeholder="Bob nomi"
                      required
                    />
                    <textarea
                      rows={6}
                      className="input py-4"
                      value={bookChapterForm.content}
                      onChange={(event) => setBookChapterForm((prev) => ({ ...prev, content: event.target.value }))}
                      placeholder="Bob matni"
                    />
                    <div className="flex justify-end gap-3">
                      {bookChapterForm.id ? (
                        <button type="button" onClick={() => setBookChapterForm(initialBookChapterForm)} className="btn border border-border px-5">
                          Bekor qilish
                        </button>
                      ) : null}
                      <button type="button" onClick={() => void saveBookChapterItem()} className="btn btn-primary px-5 gap-2">
                        <Save size={16} />
                        {bookChapterForm.id ? 'Bobni saqlash' : "Bob qo'shish"}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {resourceForm.chapters.map((chapter) => (
                      <div key={chapter.id} className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3 border border-border/60">
                        <div>
                          <p className="text-sm font-bold text-text-primary">{chapter.title}</p>
                          <p className="text-xs font-medium text-text-secondary">Tartib: {chapter.order}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => void editBookChapterItem(chapter)} className="h-9 w-9 flex items-center justify-center rounded-xl text-text-muted hover:bg-slate-100">
                            <Pencil size={16} />
                          </button>
                          <button type="button" onClick={() => void removeBookChapterItem(chapter.id)} className="h-9 w-9 flex items-center justify-center rounded-xl text-rose-500 hover:bg-rose-50">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : null}

          {resourceForm.resource_type === 'glossary' ? (
            <div className="space-y-4 rounded-[28px] border border-border/60 bg-slate-50/70 p-5">
              <div>
                <h4 className="text-sm font-black text-text-primary uppercase tracking-wider">Glossariy atamalari</h4>
                <p className="mt-1 text-xs font-medium text-text-secondary">Atama va ta'riflar bu yerda boshqariladi.</p>
              </div>
              {!resourceForm.id ? (
                <p className="text-sm font-medium text-text-secondary">Avval glossary resursini saqlang.</p>
              ) : (
                <>
                  <div className="space-y-3 rounded-2xl bg-white p-4 border border-border/60">
                    <input
                      className="input"
                      value={glossaryEntryForm.term}
                      onChange={(event) => setGlossaryEntryForm((prev) => ({ ...prev, term: event.target.value }))}
                      placeholder="Atama"
                      required
                    />
                    <textarea
                      rows={4}
                      className="input py-4"
                      value={glossaryEntryForm.definition}
                      onChange={(event) => setGlossaryEntryForm((prev) => ({ ...prev, definition: event.target.value }))}
                      placeholder="Ta'rif"
                      required
                    />
                    <div className="flex justify-end gap-3">
                      {glossaryEntryForm.id ? (
                        <button type="button" onClick={() => setGlossaryEntryForm(initialGlossaryEntryForm)} className="btn border border-border px-5">
                          Bekor qilish
                        </button>
                      ) : null}
                      <button type="button" onClick={() => void saveGlossaryEntryItem()} className="btn btn-primary px-5 gap-2">
                        <Save size={16} />
                        {glossaryEntryForm.id ? 'Atamani saqlash' : "Atama qo'shish"}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {resourceForm.glossary_entries.map((entry) => (
                      <div key={entry.id} className="flex items-start justify-between gap-4 rounded-2xl bg-white px-4 py-3 border border-border/60">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-text-primary">{entry.term}</p>
                          <p className="mt-1 text-xs font-medium leading-6 text-text-secondary">{entry.definition}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button type="button" onClick={() => setGlossaryEntryForm({ id: entry.id, term: entry.term, definition: entry.definition })} className="h-9 w-9 flex items-center justify-center rounded-xl text-text-muted hover:bg-slate-100">
                            <Pencil size={16} />
                          </button>
                          <button type="button" onClick={() => void removeGlossaryEntryItem(entry.id)} className="h-9 w-9 flex items-center justify-center rounded-xl text-rose-500 hover:bg-rose-50">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : null}

          <div className="flex justify-end gap-3 pt-6 border-t border-border/40">
            <button type="button" onClick={resetResourceModal} className="btn border border-border px-6">Bekor qilish</button>
            <button type="submit" disabled={isSaving} className="btn btn-primary px-8 gap-2 shadow-premium">
               {isSaving ? <LoaderCircle size={18} className="animate-spin" /> : <Save size={18} />}
               Saqlash
            </button>
          </div>
        </form>
      </ModalShell>

      <ModalShell 
        open={assignmentModalOpen} 
        title={assignmentForm.id ? 'Vazifani tahrirlash' : 'Yangi vazifa'} 
        onClose={resetAssignmentModal}
        headerGradient={bannerGradient}
      >
        <form onSubmit={saveAssignment} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-text-secondary ml-1">Sarlavha</label>
            <input
              className="input"
              value={assignmentForm.title}
              onChange={(e) => setAssignmentForm(p => ({ ...p, title: e.target.value }))}
              placeholder="Vazifa nomini kiriting"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-text-secondary ml-1">Vazifa sharti va tavsifi</label>
            <textarea
              rows={4}
              className="input resize-none py-4"
              value={assignmentForm.description}
              onChange={(e) => setAssignmentForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Talaba nima qilishi kerakligi haqida yozing..."
            />
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-bold text-text-secondary ml-1">Muddati (Deadline)</label>
              <input
                type="datetime-local"
                className="input"
                value={assignmentForm.deadline}
                onChange={(e) => setAssignmentForm(p => ({ ...p, deadline: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-text-secondary ml-1">Maksimal ball</label>
              <input
                type="number"
                className="input"
                value={assignmentForm.max_score}
                onChange={(e) => setAssignmentForm(p => ({ ...p, max_score: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-2 py-2">
            <div className="flex items-center gap-3">
               <div 
                 onClick={() => setAssignmentForm(p => ({ ...p, allow_late: !p.allow_late }))}
                 className={cn(
                   "h-6 w-11 rounded-full cursor-pointer transition-colors relative",
                   assignmentForm.allow_late ? "bg-amber-500" : "bg-slate-300"
                 )}
               >
                 <div className={cn("h-5 w-5 rounded-full bg-white shadow absolute top-0.5 transition-all", assignmentForm.allow_late ? "left-[22px]" : "left-0.5")} />
               </div>
               <span className="text-xs font-black text-text-primary uppercase tracking-tight">Kechikishga ruxsat</span>
            </div>
            <div className="flex items-center gap-3">
               <div 
                 onClick={() => setAssignmentForm(p => ({ ...p, is_active: !p.is_active }))}
                 className={cn(
                   "h-6 w-11 rounded-full cursor-pointer transition-colors relative",
                   assignmentForm.is_active ? "bg-emerald-500" : "bg-slate-300"
                 )}
               >
                 <div className={cn("h-5 w-5 rounded-full bg-white shadow absolute top-0.5 transition-all", assignmentForm.is_active ? "left-[22px]" : "left-0.5")} />
               </div>
               <span className="text-xs font-black text-text-primary uppercase tracking-tight">Faol</span>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-6 border-t border-border/40">
            <button type="button" onClick={resetAssignmentModal} className="btn border border-border px-6">Bekor qilish</button>
            <button type="submit" disabled={isSaving} className="btn btn-primary px-8 gap-2 shadow-premium">
               {isSaving ? <LoaderCircle size={18} className="animate-spin" /> : <Save size={18} />}
               Saqlash
            </button>
          </div>
        </form>
      </ModalShell>

      <ModalShell 
        open={testModalOpen} 
        title={testForm.id ? 'Testni tahrirlash' : 'Yangi test'} 
        onClose={resetTestModal} 
        maxWidthClass="max-w-5xl"
        headerGradient={bannerGradient}
      >
        <form onSubmit={saveTest} className="grid md:grid-cols-2 gap-8 animate-slideUp">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-text-secondary ml-1">Test nomi</label>
              <input
                className="input"
                value={testForm.name}
                onChange={(e) => setTestForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Test nomini kiriting"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-text-secondary ml-1">Tavsif</label>
              <textarea
                rows={4}
                className="input resize-none py-4"
                value={testForm.description}
                onChange={(e) => setTestForm(p => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-text-secondary ml-1">Boshlanish sanasi</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={testForm.start_datetime}
                  onChange={(e) => setTestForm(p => ({ ...p, start_datetime: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-text-secondary ml-1">Tugash sanasi</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={testForm.end_datetime}
                  onChange={(e) => setTestForm(p => ({ ...p, end_datetime: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="bg-slate-50/50 p-8 rounded-[32px] border border-border/60 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-text-secondary ml-1">Davomiyligi (min)</label>
                <input type="number" className="input bg-white" value={testForm.duration_minutes} onChange={(e) => setTestForm(p => ({ ...p, duration_minutes: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-text-secondary ml-1">Maksimal ball</label>
                <input type="number" className="input bg-white" value={testForm.max_score} onChange={(e) => setTestForm(p => ({ ...p, max_score: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-text-secondary ml-1">Urinishlar soni</label>
                <input type="number" className="input bg-white" value={testForm.attempts_allowed} onChange={(e) => setTestForm(p => ({ ...p, attempts_allowed: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-text-secondary ml-1">Savollar soni</label>
                <input type="number" className="input bg-white" value={testForm.question_count} onChange={(e) => setTestForm(p => ({ ...p, question_count: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-2 gap-y-4 pt-4 border-t border-border/60">
               {[
                 { label: 'Faol', key: 'is_active', color: 'emerald' },
                 { label: 'Tasodifiy tartib', key: 'is_random_order', color: 'blue' },
                 { label: 'Proctoring', key: 'proctoring_enabled', color: 'indigo' },
                 { label: 'FaceID', key: 'face_id_required', color: 'violet' }
               ].map((toggle) => (
                 <div key={toggle.key} className="flex items-center gap-2">
                    <div 
                      onClick={() => setTestForm(p => ({ ...p, [toggle.key]: !p[toggle.key as keyof typeof testForm] }))}
                      className={cn(
                        "h-5 w-10 rounded-full cursor-pointer transition-colors relative",
                        testForm[toggle.key as keyof typeof testForm] ? `bg-${toggle.color}-500` : "bg-slate-300"
                      )}
                    >
                      <div className={cn("h-4 w-4 rounded-full bg-white shadow absolute top-0.5 transition-all", testForm[toggle.key as keyof typeof testForm] ? "left-[22px]" : "left-0.5")} />
                    </div>
                    <span className="text-[10px] font-black text-text-primary uppercase">{toggle.label}</span>
                 </div>
               ))}
            </div>

            <div className="flex justify-end gap-3 pt-6">
              <button type="button" onClick={resetTestModal} className="btn border border-border px-6 bg-white">Bekor qilish</button>
              <button type="submit" disabled={isSaving} className="btn btn-primary flex-1 gap-2 shadow-premium">
                 {isSaving ? <LoaderCircle size={18} className="animate-spin" /> : <Save size={18} />}
                 Saqlash
              </button>
            </div>
          </div>
        </form>
      </ModalShell>

      <ModalShell 
        open={meetingModalOpen} 
        title={meetingForm.id ? 'Meetingni tahrirlash' : 'Yangi online dars'} 
        onClose={resetMeetingModal}
        headerGradient={bannerGradient}
      >
        <form onSubmit={saveMeeting} className="space-y-6">
           <div className="space-y-2">
            <label className="text-sm font-bold text-text-secondary ml-1">Dars nomi</label>
            <input
              className="input"
              value={meetingForm.title}
              onChange={(e) => setMeetingForm(p => ({ ...p, title: e.target.value }))}
              placeholder="Online dars mavzusini kiriting"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-text-secondary ml-1">Havola (Zoom, Google Meet, h.k.)</label>
            <input
              className="input"
              value={meetingForm.meeting_url}
              onChange={(e) => setMeetingForm(p => ({ ...p, meeting_url: e.target.value }))}
              placeholder="https://zoom.us/j/..."
              required
            />
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-bold text-text-secondary ml-1">Boshlanish vaqti</label>
              <input
                type="datetime-local"
                className="input"
                value={meetingForm.start_time}
                onChange={(e) => setMeetingForm(p => ({ ...p, start_time: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-text-secondary ml-1">Davomiyligi (daqiqa)</label>
              <input
                type="number"
                className="input"
                value={meetingForm.duration_minutes}
                onChange={(e) => setMeetingForm(p => ({ ...p, duration_minutes: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-6 border-t border-border/40">
            <button type="button" onClick={resetMeetingModal} className="btn border border-border px-6">Bekor qilish</button>
            <button type="submit" disabled={isSaving} className="btn btn-primary px-8 gap-2 shadow-premium">
               {isSaving ? <LoaderCircle size={18} className="animate-spin" /> : <Save size={18} />}
               Saqlash
            </button>
          </div>
        </form>
      </ModalShell>
      <ModalShell
        open={certificateModalOpen}
        title="Sertifikat sozlamalari"
        subtitle="DOCX shablon (LibreOffice orqali PDF) va berish shartlari"
        onClose={resetCertificateModal}
        headerGradient="bg-gradient-to-r from-amber-500 to-orange-600"
      >
        <div className="space-y-6">
          {activitySection ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm font-semibold text-amber-900">
              Tanlangan bo‘lim: <span className="font-black">{activitySection.name}</span>
              {certificateTemplateForm.id ? (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void handleAddCertificateLinkToSectionOnly()}
                  className="ml-3 inline-flex rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  Bo‘limga havola qo‘shish
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="flex bg-slate-100 p-1 rounded-2xl">
            <button 
              onClick={() => setActiveCertificateTab('template')}
              className={cn("flex-1 py-2 rounded-xl text-sm font-bold transition-all", activeCertificateTab === 'template' ? "bg-white text-primary shadow-sm" : "text-text-muted hover:text-text-primary")}
            >
              DOCX shablon
            </button>
            <button 
              onClick={() => setActiveCertificateTab('triggers')}
              className={cn("flex-1 py-2 rounded-xl text-sm font-bold transition-all", activeCertificateTab === 'triggers' ? "bg-white text-primary shadow-sm" : "text-text-muted hover:text-text-primary")}
            >
              Shartlar (Triggers)
            </button>
          </div>

          {activeCertificateTab === 'template' && (
            <form onSubmit={handleSaveCertificateTemplate} className="space-y-4">
               <div className="space-y-2">
                 <label className="text-sm font-bold text-text-secondary">Sertifikat nomi</label>
                 <input 
                   className="input" 
                   value={certificateTemplateForm.name} 
                   onChange={e => setCertificateTemplateForm(p => ({ ...p, name: e.target.value }))}
                   placeholder="Masalan: Kursni tugatganlik haqida"
                   required
                 />
               </div>
               <div className="space-y-2">
                 <label className="text-sm font-bold text-text-secondary">DOCX fayl</label>
                 <input
                   type="file"
                   accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                   className="input text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-bold"
                   onChange={(e) =>
                     setCertificateTemplateForm((p) => ({
                       ...p,
                       docx_file: e.target.files?.[0] ?? null,
                     }))
                   }
                 />
                 {certificateTemplateForm.docx_file ? (
                   <p className="text-xs font-medium text-text-secondary">Tanlandi: {certificateTemplateForm.docx_file.name}</p>
                 ) : certificateTemplateForm.docx_file_url ? (
                   <div className="space-y-1.5">
                     <p className="text-xs font-medium text-emerald-700">
                       Joriy fayl:{' '}
                       <a href={certificateTemplateForm.docx_file_url} className="underline" target="_blank" rel="noreferrer">
                         ko‘rish / yuklab olish
                       </a>
                     </p>
                     {certificateTemplateForm.id && (
                       <button
                         type="button"
                         className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                         onClick={() => window.open(`/editor/certificate/${certificateTemplateForm.id}`, '_blank')}
                       >
                         Editorда tahrirlash
                       </button>
                     )}
                   </div>
                 ) : (
                   <p className="text-[11px] text-text-muted">
                     Bo‘sh qoldirsangiz loyiha ichidagi default <code className="rounded bg-slate-100 px-1">certificate_template.docx</code> ishlatiladi.
                   </p>
                 )}
               </div>
               <div className="grid gap-4 sm:grid-cols-2">
                 <div className="space-y-2 sm:col-span-2">
                   <label className="text-sm font-bold text-text-secondary">Muassasa nomi (sertifikatda)</label>
                   <input
                     className="input"
                     value={certificateTemplateForm.institution_name}
                     onChange={(e) => setCertificateTemplateForm((p) => ({ ...p, institution_name: e.target.value }))}
                     placeholder="Masalan: Universitet nomi"
                   />
                 </div>
                 <div className="space-y-2">
                   <label className="text-sm font-bold text-text-secondary">Imzo (F.I.Sh)</label>
                   <input
                     className="input"
                     value={certificateTemplateForm.issued_by}
                     onChange={(e) => setCertificateTemplateForm((p) => ({ ...p, issued_by: e.target.value }))}
                   />
                 </div>
                 <div className="space-y-2">
                   <label className="text-sm font-bold text-text-secondary">Lavozim</label>
                   <input
                     className="input"
                     value={certificateTemplateForm.position}
                     onChange={(e) => setCertificateTemplateForm((p) => ({ ...p, position: e.target.value }))}
                   />
                 </div>
                 <div className="space-y-2">
                   <label className="text-sm font-bold text-text-secondary">Kurs soatlari (ixtiyoriy)</label>
                   <input
                     type="number"
                     min={0}
                     className="input"
                     value={certificateTemplateForm.hours_per_course}
                     onChange={(e) => setCertificateTemplateForm((p) => ({ ...p, hours_per_course: e.target.value }))}
                     placeholder="Masalan: 120"
                   />
                 </div>
               </div>
               <p className="text-[10px] leading-relaxed text-text-muted">
                 DOCX ichida placeholderlar: {'{{ student_name }}, {{ course_name }}, {{ certificate_date }}, {{ serial_number }}, '}
                 {'{{ hours }}, {{ score }}, {{ max_score }}, {{ issued_by }}, {{ position }}, {{ verify_url }}, {{ qr_placeholder }}, {{ institution_name }}'}
               </p>
               <div className="pt-4 flex justify-end">
                  <button type="submit" disabled={isSaving} className="btn btn-primary px-10 gap-2">
                    {isSaving ? <LoaderCircle size={18} className="animate-spin" /> : <Save size={18} />}
                    Saqlash
                  </button>
               </div>
            </form>
          )}

          {activeCertificateTab === 'triggers' && (
            <div className="space-y-6">
               {!certificateTemplateForm.id && (
                 <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 text-amber-800 text-xs font-bold flex items-start gap-3">
                   <AlertCircle size={16} className="shrink-0" />
                   Shartlarni qo'shish uchun avval "Dizayn" panelida sertifikatni saqlashingiz kerak.
                 </div>
               )}
               <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                  <h4 className="text-sm font-black text-amber-800 uppercase tracking-wider mb-3">Yangi shart qo'shish</h4>
                  <form onSubmit={handleSaveCertificateTrigger} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <select 
                       className="input" 
                       value={certificateTriggerForm.trigger_type}
                       onChange={e => setCertificateTriggerForm(p => ({ ...p, trigger_type: e.target.value }))}
                     >
                        <option value="course_complete">Butun kurs tugallanganda</option>
                        <option value="section_complete">Mavzu tugallanganda</option>
                        <option value="test_score">Test natijasiga ko'ra</option>
                     </select>
                     
                     {certificateTriggerForm.trigger_type === 'section_complete' && (
                       <select 
                         className="input" 
                         value={certificateTriggerForm.target_section_id || ''}
                         onChange={e => setCertificateTriggerForm(p => ({ ...p, target_section_id: Number(e.target.value) }))}
                       >
                          <option value="">Mavzuni tanlang</option>
                          {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                       </select>
                     )}

                     {certificateTriggerForm.trigger_type === 'test_score' && (
                       <>
                         <select 
                           className="input" 
                           value={certificateTriggerForm.target_test_id || ''}
                           onChange={e => setCertificateTriggerForm(p => ({ ...p, target_test_id: Number(e.target.value) }))}
                         >
                            <option value="">Testni tanlang</option>
                            {sections.flatMap(s => s.tests).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                         </select>
                         <input 
                           type="number" 
                           className="input" 
                           placeholder="Min % ball" 
                           value={certificateTriggerForm.min_score_percentage || ''}
                           onChange={e => setCertificateTriggerForm(p => ({ ...p, min_score_percentage: Number(e.target.value) }))}
                         />
                       </>
                     )}

                     <button type="submit" disabled={isSaving || !certificateTemplateForm.id} className="btn btn-primary md:ml-auto px-6 gap-2">
                        {isSaving ? <LoaderCircle size={18} className="animate-spin" /> : <Plus size={18} />}
                        Qo'shish
                     </button>
                  </form>
               </div>

               <div className="space-y-2">
                  <h4 className="text-xs font-black text-text-muted uppercase tracking-widest ml-1">Amaldagi shartlar</h4>
                  {(data?.certificates?.triggers || []).map((tr) => {
                    const tid = tr.id as number;
                    const ttype = String(tr.trigger_type || '');
                    return (
                    <div key={tid} className="flex items-center justify-between p-4 rounded-2xl border border-border bg-slate-50">
                       <div>
                          <p className="text-sm font-bold text-text-primary capitalize">
                            {ttype.replace('_', ' ')}
                            {ttype === 'test_score' && ` (Min: ${tr.min_score_percentage}%)`}
                          </p>
                          <span className="text-[10px] text-text-muted uppercase font-black">
                            {ttype === 'section_complete' ? `ID: ${tr.target_section_id}` : ttype === 'test_score' ? `Test ID: ${tr.target_test_id}` : 'Barcha mavzular'}
                          </span>
                       </div>
                       <button type="button" onClick={() => handleRemoveTrigger(tid)} className="h-9 w-9 flex items-center justify-center rounded-xl text-rose-500 hover:bg-rose-100">
                          <Trash2 size={16} />
                       </button>
                    </div>
                  );})}
               </div>
            </div>
          )}
        </div>
      </ModalShell>
    </div>
  );
}
