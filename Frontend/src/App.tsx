import { useEffect, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, ArrowRight, Bell, BookOpen, CalendarDays, Check, ChevronDown, CircleHelp, Clock3, Command, FileText, GraduationCap, LayoutDashboard, LockKeyhole, LogOut, Menu, MessageCircle, Search, Settings2, ShieldAlert, Sparkles, X } from 'lucide-react';
import { supabase, supabaseConfigured } from './lib/supabase';
import { apiRequest } from './lib/api';
import { useAuthStore } from './stores/authStore';
import AdminPanel from './AdminPanel';
import AssignmentsWorkspace from './AssignmentsWorkspace';
import SupportWorkspace from './SupportWorkspace';
import CampusWorkspace from './CampusWorkspace';
import QuizzesWorkspace from './QuizzesWorkspace';

type Section = 'Overview' | 'My courses' | 'Assignments' | 'Resources' | 'Quizzes' | 'Announcements' | 'Study room' | 'Help desk' | 'Administration' | 'Course management';
type CourseCard = { id?: string; description?: string | null; code: string; title: string; tutor: string; progress: number; color: string; icon: string; next: string };
const navigation: { label: Section; icon: typeof LayoutDashboard; badge?: string }[] = [
  { label: 'Overview', icon: LayoutDashboard }, { label: 'My courses', icon: BookOpen }, { label: 'Assignments', icon: FileText, badge: '3' },
  { label: 'Resources', icon: GraduationCap }, { label: 'Quizzes', icon: Activity }, { label: 'Announcements', icon: Bell }, { label: 'Study room', icon: MessageCircle }, { label: 'Help desk', icon: CircleHelp },
];
const courses = [
  { code: 'CS 304', title: 'Human–Computer Interaction', tutor: 'Dr. Maya Patel', progress: 72, color: 'violet', icon: '✳', next: 'Design critique · Today, 2:30 PM' },
  { code: 'CS 218', title: 'Data Structures & Algorithms', tutor: 'Prof. Omar Khan', progress: 48, color: 'blue', icon: '⌘', next: 'Graph traversal · Tomorrow' },
  { code: 'DS 210', title: 'Applied Machine Learning', tutor: 'Dr. Eliza Chen', progress: 86, color: 'mint', icon: '◉', next: 'Model evaluation · Nov 2' },
];
const tasks = [
  { tag: 'CS 304 · PROJECT', name: 'Prototype usability study', due: 'Today, 11:59 PM', state: 'Due today', color: 'rose' },
  { tag: 'CS 218 · PROBLEM SET', name: 'Trees & graph traversal', due: 'Tomorrow, 5:00 PM', state: 'In progress', color: 'blue' },
  { tag: 'DS 210 · LAB', name: 'Compare model performance', due: 'Nov 2, 11:59 PM', state: 'Not started', color: 'amber' },
];

function App() {
  const session = useAuthStore((state) => state.session);
  const setSession = useAuthStore((state) => state.setSession);
  const coursesQuery = useQuery({
    queryKey: ['courses', session?.user.id],
    enabled: Boolean(session?.access_token),
    queryFn: () => apiRequest<{ courses: { id: string; title: string; description: string | null }[] }>('/api/courses', session?.access_token),
  });
  const profileQuery = useQuery({
    queryKey: ['profile', session?.user.id],
    enabled: Boolean(session?.access_token),
    queryFn: () => apiRequest<{ profile: { full_name: string | null; role: string } }>('/api/me', session?.access_token),
  });
  const dashboardQuery = useQuery({
    queryKey: ['dashboard', session?.user.id],
    enabled: Boolean(session?.access_token),
    queryFn: () => apiRequest<{ metrics: { activeCourses: number; hoursLearned: number; averageScore: number | null; upcomingAssignments: number }; upcomingAssignments: { id: string; title: string; due_date: string }[] }>('/api/dashboard', session?.access_token),
  });
  const healthQuery = useQuery({
    queryKey: ['backend-health'],
    queryFn: async () => {
      const response = await fetch(`${(import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000'}/health`);
      const data = await response.json();
      return data as { connected?: { database?: boolean }; databaseError?: string };
    },
    refetchInterval: 30_000,
  });
  const accountName = profileQuery.data?.profile.full_name?.trim()
    || session?.user.user_metadata?.full_name?.trim()
    || session?.user.email?.split('@')[0]
    || 'GUTech member';
  const accountInitials = accountName.split(/\s+/).slice(0, 2).map((part: string) => part[0]?.toUpperCase()).join('') || 'GU';
  const accountRole = profileQuery.data?.profile.role ?? (session ? 'loading' : 'guest');
  const roleLabel = accountRole === 'admin' ? 'Administrator' : accountRole === 'teacher' ? 'Faculty' : accountRole === 'student' ? 'Student' : accountRole === 'loading' ? 'Checking access…' : 'Guest preview';
  const roleNavigation = accountRole === 'admin'
    ? [{ label: 'Overview' as Section, icon: LayoutDashboard }, { label: 'Administration' as Section, icon: Settings2 }, { label: 'Course management' as Section, icon: BookOpen }, { label: 'Assignments' as Section, icon: FileText }, { label: 'Announcements' as Section, icon: Bell }, { label: 'Help desk' as Section, icon: CircleHelp }]
    : accountRole === 'teacher'
      ? [{ label: 'Overview' as Section, icon: LayoutDashboard }, { label: 'Course management' as Section, icon: BookOpen }, { label: 'Assignments' as Section, icon: FileText }, { label: 'Resources' as Section, icon: GraduationCap }, { label: 'Quizzes' as Section, icon: Activity }, { label: 'Announcements' as Section, icon: Bell }, { label: 'Help desk' as Section, icon: CircleHelp }]
      : navigation;
  const courseCards: CourseCard[] = session
    ? (coursesQuery.data?.courses ?? []).map((course, index) => ({ ...course, code: `COURSE ${index + 1}`, tutor: 'Your instructor', progress: 0, color: index % 2 ? 'blue' : 'violet', icon: index % 2 ? '⌘' : '✳', next: 'Course materials and schedule' }))
    : courses;
  const upcomingTasks = session
    ? (dashboardQuery.data?.upcomingAssignments ?? []).map((assignment) => ({ tag: 'COURSE WORK', name: assignment.title, due: new Date(assignment.due_date).toLocaleString(), state: 'Upcoming', color: 'blue' }))
    : tasks;
  const [section, setSection] = useState<Section>('Overview');
  const [mobileNav, setMobileNav] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, [setSession]);

  async function signIn(event: FormEvent) {
    event.preventDefault(); setAuthMessage('');
    if (!supabase) { setAuthMessage('Connect your Supabase project in .env.local to enable sign in.'); return; }
    setAuthBusy(true);
    const { error } = authMode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
    setAuthBusy(false);
    if (error) setAuthMessage(error.message);
    else if (authMode === 'signup') setAuthMessage('Check your inbox for the confirmation email to finish creating your account.');
    else setShowAuth(false);
  }
  async function recoverPassword() {
    setAuthMessage('');
    if (!supabase) { setAuthMessage('Connect your Supabase project in .env.local to enable password recovery.'); return; }
    if (!email) { setAuthMessage('Enter your email address first.'); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    setAuthMessage(error?.message ?? 'If an account exists, a secure reset link is on its way.');
  }
  async function signInWithGoogle() {
    if (!supabase) { setAuthMessage('Connect your Supabase project in .env.local to enable sign in.'); return; }
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (error) setAuthMessage(error.message);
  }

  if (window.location.pathname === '/reset-password') return <ResetPassword />;

  return <div className="app-frame">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><span>g</span><i /></div><div className="brand-copy"><strong>gut<span>ech</span></strong><small>LEARN · CAMPUS PORTAL</small></div><button className="icon-button close-nav" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={18} /></button></div>
      <div className="workspace-switch"><div className="uni-stamp">G</div><div className="workspace-copy"><strong>GUTech University</strong><span>{accountRole === 'admin' ? 'Administration workspace' : accountRole === 'teacher' ? 'Faculty workspace' : accountRole === 'loading' ? 'Loading permissions…' : 'Student workspace'}</span></div><ChevronDown size={15} /></div>
      <div className="side-label">{accountRole === 'admin' ? 'ADMIN CONTROL' : accountRole === 'teacher' ? 'TEACHING SPACE' : 'LEARNING SPACE'}</div>
      <nav className="side-nav" aria-label="Main navigation">{roleNavigation.map(({ label, icon: Icon }) => <button key={label} className={"nav-item " + (section === label ? 'active' : '')} onClick={() => { setSection(label); setMobileNav(false); }}><Icon size={18} strokeWidth={1.8} /><span>{label}</span>{label === 'Assignments' && dashboardQuery.data?.metrics.upcomingAssignments ? <b>{dashboardQuery.data.metrics.upcomingAssignments}</b> : null}</button>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><span className="help-spark"><Sparkles size={14} /></span><strong>Study smarter</strong><p>Your AI study partner is ready to help with any topic.</p><button onClick={() => setSection('Study room')}>Ask your AI tutor <ArrowRight size={14} /></button></div><button className="nav-item settings" onClick={() => setShowAuth(true)}><Settings2 size={18} /><span>Account settings</span></button><div className="profile-row"><div className="avatar avatar-photo">{accountInitials}</div><div className="profile-copy"><strong>{session ? accountName : 'Guest preview'}</strong><span>{roleLabel}</span></div>{session ? <button className="icon-button" aria-label="Sign out" onClick={() => supabase?.auth.signOut()}><LogOut size={16} /></button> : <ChevronDown size={15} />}</div></div>
    </aside>
    {mobileNav && <button className="nav-scrim" aria-label="Close menu" onClick={() => setMobileNav(false)} />}
    <main className="main-area">
      <header className="topbar"><button className="icon-button mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu size={20} /></button><div className="crumb"><span>GUTech</span><span className="crumb-slash">/</span><strong>{section}</strong></div><div className="topbar-actions"><label className="search-box"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search anything…" /><kbd><Command size={11} /> K</kbd></label><button className="icon-button notification-button" aria-label="Notifications" onClick={() => setSection('Announcements')}><Bell size={18} /><i /></button><span className={"role-badge role-" + accountRole}>{roleLabel}</span><div className="top-avatar">{accountInitials}</div><button className="top-profile" onClick={() => setShowAuth(true)}>{session ? accountName : 'Connect account'}<ChevronDown size={14} /></button></div></header>
      <div className="config-banner"><ShieldAlert size={16} /><span>{!supabaseConfigured ? <><strong>Preview mode</strong> · Add your Supabase URL and anon key in <code>Frontend/.env.local</code> to enable live sign-in.</> : healthQuery.data?.connected?.database ? <><strong>Database connected</strong> · Your account, courses, submissions, quizzes, resources, announcements, chat, study sessions, and support use live Supabase data. AI tutor, summaries, generated quizzes, and remediation still need their provider integration.</> : <><strong>Database setup needed</strong> · Supabase settings are present, but the database tables could not be reached. Apply the two SQL files in <code>Backend/supabase/migrations</code>. {healthQuery.data?.databaseError && <span>{healthQuery.data.databaseError}</span>}</>}</span><button onClick={() => setShowAuth(true)}>{session ? 'Account settings' : 'Connect account'} <ArrowRight size={14} /></button></div>
      <div className="content-wrap">{section === 'Overview' && session && (accountRole === 'admin' || accountRole === 'teacher') ? <RoleHome role={accountRole} name={accountName} courses={courseCards} onNavigate={setSection} /> : section === 'Overview' ? <>
        <div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-dot" /> FRIDAY, OCTOBER 30, 2026 <span className="weather">·</span> WEEK 08</div><h1>Good morning, {session ? accountName.split(/\s+/)[0] : 'there'} <span className="wave">✳</span></h1><p className="welcome-sub">{session ? 'Your account is connected. Course and activity data will appear as it is added.' : 'A little progress each day adds up to remarkable results.'}</p></div><button className="primary-button" onClick={() => setSection('My courses')}><BookOpen size={16} /> Explore courses <ArrowRight size={15} /></button></div>
        <div className="hero-card"><div className="hero-grain" /><div className="hero-content"><div className="hero-kicker"><span className="live-dot" /> YOUR LEARNING PULSE</div><h2>You're finding<br />your <em>rhythm.</em></h2><p>{session ? 'Your learning activity and progress live in this account.' : <>Sign in to track your courses and study time.<br />A little progress each day adds up.</>}</p><button className="hero-button" onClick={() => setSection('My courses')}>Continue learning <ArrowRight size={15} /></button><div className="hero-foot"><span><span className="tiny-check"><Check size={9} /></span> {session ? `${dashboardQuery.data?.metrics.activeCourses ?? 0} active courses` : 'Sample dashboard'}</span><span>·</span><span>{session ? `${dashboardQuery.data?.metrics.hoursLearned ?? 0} recorded hours` : 'Sign in to see your progress'}</span></div></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="orbit orbit-three"/><div className="orbit-core"><span>g</span></div><div className="orbit-dot dot-one"/><div className="orbit-dot dot-two"/><div className="orbit-dot dot-three"/><div className="art-caption"><Sparkles size={12} /> YOU'RE IN FLOW</div></div><div className="hero-index">01 <span>/ 03</span></div></div>
        <section className="stats-grid" aria-label="Learning statistics"><article className="stat-card"><div className="stat-top"><span>COURSES ACTIVE</span><span className="stat-icon violet-icon"><BookOpen size={16} /></span></div><div className="stat-value">{session ? dashboardQuery.data?.metrics.activeCourses ?? '—' : '—'} <small>enrolled</small></div><div className="stat-foot"><span>From your course enrollments</span></div></article><article className="stat-card"><div className="stat-top"><span>HOURS LEARNED</span><span className="stat-icon blue-icon"><Clock3 size={16} /></span></div><div className="stat-value">{session ? dashboardQuery.data?.metrics.hoursLearned ?? '—' : '—'} <small>hrs</small></div><div className="stat-foot"><span>Recorded study sessions</span></div></article><article className="stat-card"><div className="stat-top"><span>AVERAGE SCORE</span><span className="stat-icon mint-icon"><Activity size={16} /></span></div><div className="stat-value">{session ? dashboardQuery.data?.metrics.averageScore ?? '—' : '—'}<small>{session && dashboardQuery.data?.metrics.averageScore !== null && dashboardQuery.data?.metrics.averageScore !== undefined ? '%' : ''}</small></div><div className="stat-foot"><span>From completed quizzes</span></div></article><article className="stat-card"><div className="stat-top"><span>UPCOMING WORK</span><span className="stat-icon amber-icon"><CalendarDays size={16} /></span></div><div className="stat-value">{session ? dashboardQuery.data?.metrics.upcomingAssignments ?? '—' : '—'} <small>items</small></div><div className="stat-foot"><span>Upcoming assignments</span></div></article></section>
        <div className="section-row"><div><div className="section-overline">YOUR SEMESTER</div><h2 className="section-title">Pick up where you left off <span>↗</span></h2></div><button className="text-link" onClick={() => setSection('My courses')}>All courses <ArrowRight size={15} /></button></div>
        <section className="course-grid">{courseCards.map((course) => <article key={course.code} className={`course-card ${course.color}`}><div className="course-head"><span className="course-code">{course.code}</span><button className="course-menu" aria-label={`Open ${course.title}`} onClick={() => setSection('My courses')}>···</button></div><div className="course-icon">{course.icon}</div><h3>{course.title}</h3><p className="course-tutor">{course.tutor}</p>{!session && <div className="course-progress"><div className="progress-meta"><span>COURSE PROGRESS</span><strong>{course.progress}%</strong></div><div className="progress-track"><i style={{ width: `${course.progress}%` }} /></div></div>}<div className="course-next"><span className="next-icon"><CalendarDays size={13} /></span>{course.next}</div></article>)}</section>
        <div className="lower-grid"><section className="tasks-panel"><div className="panel-head"><div><div className="section-overline">AHEAD OF THE CURVE</div><h2 className="section-title">Upcoming work</h2></div><button className="text-link" onClick={() => setSection('Assignments')}>View calendar <ArrowRight size={15} /></button></div><div className="task-list">{upcomingTasks.length ? upcomingTasks.map((task, i) => <article key={task.name} className="task-row"><div className={`task-marker ${task.color}`}>{i === 0 ? <FileText size={16} /> : i === 1 ? <Activity size={16} /> : <BookOpen size={16} />}</div><div className="task-info"><span>{task.tag}</span><strong>{task.name}</strong><small><CalendarDays size={12} /> {task.due}</small></div><span className={`task-state state-${task.color}`}>{task.state}</span><button className="icon-button task-arrow" aria-label={`Open ${task.name}`} onClick={() => setSection('Assignments')}><ArrowRight size={16} /></button></article>) : <p className="welcome-sub">{session ? 'No upcoming assignments yet.' : 'Sign in to see your work.'}</p>}</div></section><aside className="insight-card"><div className="insight-head"><span><Sparkles size={15} /> STUDY TIP · PREVIEW</span><span className="insight-dots">···</span></div><div className="insight-art"><div className="insight-ring ring-a"/><div className="insight-ring ring-b"/><div className="insight-core"><Sparkles size={22}/></div><span className="insight-star star-a">✳</span><span className="insight-star star-b">✧</span></div><h3>Try a focused study session</h3><p>Use the Study room timer to record time spent learning. AI personalized insights are not connected yet.</p><button onClick={() => setSection('Study room')}>Start a focus session <ArrowRight size={15}/></button><span className="insight-source">STUDY TIME SAVES TO YOUR ACCOUNT</span></aside></div>
        <footer className="page-footer"><span>© 2026 GUTech Learn <span className="footer-dot">·</span> Built for curious minds</span><span><span className="status-light"/> {session ? dashboardQuery.isError || coursesQuery.isError ? 'Live data unavailable — check database setup' : dashboardQuery.isLoading ? 'Loading your live data…' : 'Account data from your LMS' : 'Sign in to view your account data'} <span className="footer-dot">·</span> Privacy <span className="footer-dot">·</span> Help</span></footer>
      </> : <SectionView section={section} search={search} courseList={courseCards} token={session?.access_token ?? ''} role={profileQuery.data?.profile.role ?? 'student'} userId={session?.user.id ?? ''} />}</div>
    </main>
    {showAuth && <div className="modal-scrim" onClick={() => setShowAuth(false)}><section className="auth-modal" onClick={(e) => e.stopPropagation()}><button className="icon-button modal-close" onClick={() => setShowAuth(false)} aria-label="Close"><X size={18}/></button><div className="auth-mark"><LockKeyhole size={19}/></div><div className="section-overline">GUTECH SECURE ACCESS</div><h2>{session ? 'Your account' : authMode === 'signin' ? 'Welcome back' : 'Create your account'}</h2><p>Sign in to continue your learning journey.</p>{session ? <div className="signed-in-box"><div className="avatar">{session.user.email?.slice(0, 2).toUpperCase()}</div><span>{session.user.email}</span><button className="secondary-button" onClick={() => { supabase?.auth.signOut(); setShowAuth(false); }}>Sign out</button></div> : <form onSubmit={signIn} className="auth-form">{authMode === 'signup' && <label>Full name<input autoComplete="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name"/></label>}<label>Email address<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@university.edu"/></label><label>Password<input type="password" autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" minLength={6}/></label>{authMessage && <div className="auth-message">{authMessage}</div>}<button className="primary-button auth-submit" disabled={authBusy}>{authBusy ? 'Please wait…' : authMode === 'signin' ? 'Sign in securely' : 'Create account'}<ArrowRight size={15}/></button>{authMode === 'signin' && <><button className="oauth-button" type="button" onClick={signInWithGoogle}>Continue with Google</button><button className="forgot-link" type="button" onClick={recoverPassword}>Forgot your password?</button></>}<button className="forgot-link" type="button" onClick={() => { setAuthMessage(''); setAuthMode(authMode === 'signin' ? 'signup' : 'signin'); }}>{authMode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}</button></form>}{!supabaseConfigured && <div className="modal-config"><ShieldAlert size={14}/> Add Supabase credentials to <code>.env.local</code> to connect.</div>}</section></div>}
  </div>;
}

function ResetPassword() {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function updatePassword(event: FormEvent) {
    event.preventDefault(); setMessage('');
    if (!supabase) { setMessage('Supabase is not configured for this project.'); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setMessage(error.message);
    else { setMessage('Your password has been updated. You can now sign in.'); window.history.replaceState({}, '', '/'); }
  }
  return <main className="reset-page"><section className="auth-modal"><div className="auth-mark"><LockKeyhole size={19}/></div><div className="section-overline">ACCOUNT RECOVERY</div><h2>Choose a new password</h2><p>Use at least six characters. Your account stays protected.</p><form onSubmit={updatePassword} className="auth-form"><label>New password<input type="password" autoComplete="new-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}/></label>{message && <div className="auth-message">{message}</div>}<button className="primary-button auth-submit" disabled={busy}>{busy ? 'Updating…' : 'Update password'}<ArrowRight size={15}/></button></form></section></main>;
}

function RoleHome({ role, name, courses, onNavigate }: { role: 'admin' | 'teacher'; name: string; courses: CourseCard[]; onNavigate: (section: Section) => void }) {
  const isAdmin = role === 'admin';
  const firstName = name.split(/\s+/)[0] || 'there';
  return <section className={"role-home " + (isAdmin ? 'role-home-admin' : 'role-home-teacher')}>
    <div className="role-home-hero">
      <div className="role-home-kicker"><span className="role-home-dot" /> {isAdmin ? 'ADMINISTRATOR CONSOLE' : 'FACULTY WORKSPACE'}</div>
      <h1>{isAdmin ? 'Welcome to your control center,' : 'Welcome to your teaching space,'} <em>{firstName}</em></h1>
      <p>{isAdmin ? 'Manage accounts, access, and the learning environment from one place.' : 'Manage your courses, assignments, and student learning from one place.'}</p>
      <div className="role-home-actions">
        {isAdmin && <button className="role-home-primary" onClick={() => onNavigate('Administration')}><Settings2 size={16}/> Manage accounts <ArrowRight size={15}/></button>}
        <button className={isAdmin ? 'role-home-secondary' : 'role-home-primary'} onClick={() => onNavigate('Course management')}><BookOpen size={16}/> {isAdmin ? 'Manage courses' : 'Open course management'} <ArrowRight size={15}/></button>
        <button className="role-home-secondary" onClick={() => onNavigate('Assignments')}><FileText size={16}/> {isAdmin ? 'Review course work' : 'Assignments and grading'} <ArrowRight size={15}/></button>
      </div>
    </div>
    <div className="role-home-stats">
      <article><span>{isAdmin ? 'PORTAL ROLE' : 'YOUR ROLE'}</span><strong>{isAdmin ? 'Administrator' : 'Faculty member'}</strong><small>{isAdmin ? 'Full portal management access' : 'Teaching and course tools enabled'}</small></article>
      <article><span>{isAdmin ? 'COURSES IN VIEW' : 'YOUR COURSES'}</span><strong>{courses.length}</strong><small>{courses.length ? 'Open course management to continue' : 'Create or join courses to get started'}</small></article>
      <article><span>{isAdmin ? 'ADMIN TOOLS' : 'TEACHING TOOLS'}</span><strong>{isAdmin ? 'Accounts · Roles · Courses' : 'Courses · Assignments · Grading'}</strong><small>{isAdmin ? 'Manage access from Administration' : 'Use your course workspace to teach'}</small></article>
    </div>
    <div className="role-home-section">
      <div><div className="section-overline">{isAdmin ? 'PORTAL MANAGEMENT' : 'TEACHING WORKSPACE'}</div><h2>{isAdmin ? 'Administration tools' : 'Your teaching tools'}</h2><p>{isAdmin ? 'The controls below are for your administrator account.' : 'Your faculty workspace is focused on teaching and course work.'}</p></div>
      {isAdmin && <button className="role-home-secondary" onClick={() => onNavigate('Administration')}>Open administration <ArrowRight size={15}/></button>}
    </div>
    <section className="role-home-tools">
      {(isAdmin ? [
        { icon: ShieldAlert, title: 'Accounts and roles', text: 'Review portal accounts and assign student or teacher roles.', target: 'Administration' as Section },
        { icon: BookOpen, title: 'Course oversight', text: 'Create courses and manage student enrollments.', target: 'Course management' as Section },
        { icon: Activity, title: 'Course work', text: 'View assignment and quiz workspaces.', target: 'Assignments' as Section },
      ] : [
        { icon: BookOpen, title: 'Course management', text: 'Create and organize the courses you teach.', target: 'Course management' as Section },
        { icon: FileText, title: 'Assignments and grading', text: 'Create assignments and review student submissions.', target: 'Assignments' as Section },
        { icon: Bell, title: 'Announcements', text: 'Share updates with students in your courses.', target: 'Announcements' as Section },
      ]).map(({ icon: Icon, title, text, target }) => <button key={title} className="role-home-tool" onClick={() => onNavigate(target)}><span><Icon size={19}/></span><strong>{title}</strong><small>{text}</small><em>Open workspace <ArrowRight size={14}/></em></button>)}
    </section>
  </section>;
}

function SectionView({ section, search, courseList, token, role, userId }: { section: Section; search: string; token: string; role: string; userId: string; courseList: CourseCard[] }) {
  const [query, setQuery] = useState('');
  const subtitle: Record<Section, string> = {
    Overview: 'Your learning at a glance.', 'My courses': 'Everything you are learning this term.', Assignments: 'Deadlines, drafts, and submitted work.',
    Resources: 'Your course notes and study materials.', Quizzes: 'Practice, review, and track your progress.', Announcements: 'The latest from your courses and campus.',
    'Study room': 'A quiet space to think, ask, and learn together.', 'Help desk': 'We’re here to help you get unstuck.', Administration: 'Manage roles and accounts.', 'Course management': 'Create and organize courses.',
  };
  const filtered = courseList.filter((c) => `${c.code} ${c.title} ${c.tutor}`.toLowerCase().includes((query || search).toLowerCase()));
  if (section === 'Administration' || section === 'Course management') return <AdminPanel token={token} role={role} />;
  if (section === 'Resources' || section === 'Announcements' || section === 'Study room') return token ? <CampusWorkspace section={section} courses={courseList.flatMap((course) => course.id ? [{ id: course.id, title: course.title }] : [])} role={role} userId={userId} token={token}/> : <div className="feature-placeholder"><h2>Sign in to open this learning space</h2><p>Course resources and updates are connected to your account and enrollment.</p></div>;
  if (section === 'Assignments') return token ? <AssignmentsWorkspace token={token} role={role} userId={userId} /> : <div className="feature-placeholder"><h2>Sign in to view assignments</h2><p>Your course assignments and submissions appear here.</p></div>;
  if (section === 'Quizzes') return token ? <QuizzesWorkspace token={token} role={role} userId={userId} courses={courseList.flatMap((course) => course.id ? [{ id: course.id, title: course.title }] : [])}/> : <div className="feature-placeholder"><h2>Sign in to view quizzes</h2><p>Quizzes are connected to course enrollment.</p></div>;
  if (section === 'Help desk') return token ? <SupportWorkspace token={token} role={role} userId={userId} /> : <div className="feature-placeholder"><h2>Sign in to contact support</h2><p>Support requests are linked to your account.</p></div>;
  return <div className="section-view"><div className="section-overline">LEARNING SPACE</div><div className="section-view-head"><div><h1>{section}</h1><p>{subtitle[section]}</p></div>{section === 'My courses' && <label className="inner-search"><Search size={15}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter courses"/></label>}</div>
    {filtered.length ? <section className="course-grid expanded">{filtered.map((course) => <article key={course.code} className={`course-card ${course.color}`}><div className="course-head"><span className="course-code">{course.code}</span></div><div className="course-icon">{course.icon}</div><h3>{course.title}</h3><p className="course-tutor">{course.tutor}</p>{!course.id && <div className="course-progress"><div className="progress-meta"><span>COURSE PROGRESS</span><strong>{course.progress}%</strong></div><div className="progress-track"><i style={{ width: `${course.progress}%` }}/></div></div>}<div className="course-next"><CalendarDays size={13}/>{course.next}</div></article>)}</section> : <div className="feature-placeholder"><div className="placeholder-icon"><BookOpen/></div><h2>No courses found</h2><p>When an instructor enrolls you in a course, it will appear here.</p></div>}
  </div>;
}

export default App;
