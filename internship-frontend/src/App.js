import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import {
  Briefcase, Building, GraduationCap,
  ArrowRight, X, Building2,
  CalendarDays, ClipboardList, FileText, BadgeCheck
} from 'lucide-react';
import { io } from 'socket.io-client';

/*
 * ======================================================================================
 * INTERNSHIP TRACKER - FRONTEND MAIN ENTRY POINT (App.js)
 * ======================================================================================
 * 
 * This file serves as the core of the React frontend application. It handles:
 * 1. Routing (via simple state-based view switching: 'landing', 'auth', 'main', etc.)
 * 2. Authentication (Login, Register, Password Reset) for Students, Companies, and Admins.
 * 3. User Role Management (Student vs Company vs Admin dashboards).
 * 4. Data Fetching & State Management (loading students, companies, applications).
 * 5. Real-time updates using Socket.io (reflecting changes instantly across clients).
 * 
 * STRUCTURE:
 * - Helper Constants: API URLs, Style objects, Stage metadata.
 * - Components:
 *    - StageBadge: Displays application status (Applied, Interview, Offer, etc.).
 *    - AuthForm: Handles login and registration forms.
 *    - StudentExtendedProfile: Detailed profile form for students (Resume, Skills, etc.).
 *    - CompanyProfileForm: Profile form for companies (Mission, Logo, etc.).
 *    - App: The main component containing all business logic and render views.
 * 
 * HOW TO EDIT:
 * - visual styles are mostly inline or using Tailwind classes.
 * - application logic is concentrated in the `App` component's `useEffect` hooks and handler functions.
 * - API calls are made using `axios` to the backend endpoints defined in `API` constant.
 * 
 * SIGNIFICANCE:
 * This single file creates the entire Single Page Application (SPA) experience.
 * It connects the user interface to the backend API and database.
 */

const isDev = process.env.NODE_ENV === 'development';
const devApiOrigin = process.env.REACT_APP_API_ORIGIN || 'http://localhost:3001';
const API = "/api";
const ADMIN_CONTACT_EMAIL = 'timayobrian6@gmail.com';

// This object ensures centering and blue theme regardless of Tailwind config
const styles = {
  centeredPage: {
    backgroundColor: '#020617',
    height: '100vh',
    width: '100vw',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'sans-serif',
    color: 'white',
    margin: 0
  },
  card: {
    backgroundColor: 'white',
    padding: '40px',
    borderRadius: '40px',
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
    textAlign: 'left',
    cursor: 'pointer',
    border: '1px solid #e2e8f0',
    transition: 'transform 0.2s'
  }
};

const stageMeta = {
  Applied: { label: 'Applied', bg: '#e0e7ff', color: '#4a42bb' },
  Interviewing: { label: 'Interview', bg: '#cffafe', color: '#0e7490' },
  Offer: { label: 'Offer Extended', bg: '#fef3c7', color: '#92400e' },
  Placed: { label: 'Accepted', bg: '#dcfce7', color: '#166534' },
  Waitlisted: { label: 'Waitlisted', bg: '#ede9fe', color: '#6d28d9' },
  Rejected: { label: 'Rejected', bg: '#fee2e2', color: '#b91c1c' },
  Withdrawn: { label: 'Withdrawn', bg: '#f1f5f9', color: '#475569' }
};

const getStageMeta = (stage) => stageMeta[stage] || stageMeta.Applied;

/*
 * STAGE BADGE
 * Simple component for rendering application stage labels with distinct colors.
 * Used in lists and dashboards.
 * Edit `stageMeta` above to change colors.
 */
function StageBadge({ stage }) {
  const meta = getStageMeta(stage || 'Applied');
  return (
    <span style={{ background: meta.bg, color: meta.color, padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
      {meta.label}
    </span>
  );
}

/*
 * AUTH FORM
 * Handles Sign In, Registration, Password Reset requests.
 * Props:
 * - view: 'login' | 'register' | 'forgot' | 'reset'
 * - adminOnly: if true, hides student/company toggle
 * - onSwitch: callback to switch between login/register views
 * - onSuccess: callback when auth succeeds
 */
function AuthForm({ view = 'login', resetToken = '', adminOnly = false, onSwitch = () => {}, onSuccess = () => {}, onError = () => {} }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [role, setRole] = useState('student');
  const [loading, setLoading] = useState(false);
  const [helperText, setHelperText] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setHelperText('');
    try {
      if (view === 'login') {
        const res = await axios.post(`${API}/auth/login`, { username, password, admin_only: adminOnly });
        onSuccess(res.data);
      } else if (view === 'register') {
        await axios.post(`${API}/auth/register`, { username, email, password, role });
        const res = await axios.post(`${API}/auth/login`, { username, password, admin_only: false });
        onSuccess(res.data);
      } else if (view === 'forgot') {
        await axios.post(`${API}/auth/request-password-reset`, { email });
        setHelperText('If that email exists, a reset link has been sent.');
      } else if (view === 'reset') {
        if (password !== passwordConfirm) {
          setHelperText('Passwords do not match');
          return;
        }
        await axios.post(`${API}/auth/reset-password`, { token: resetToken, password });
        setHelperText('Password updated. You can sign in now.');
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err.message;
      onError(msg);
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {view !== 'forgot' && view !== 'reset' && (
        <input placeholder="Username or Email" value={username} onChange={e => setUsername(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
      )}
      {(view === 'register' || view === 'forgot') && (
        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
      )}
      {(view === 'login' || view === 'register' || view === 'reset') && (
        <input placeholder={view === 'reset' ? 'New Password' : 'Password'} type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
      )}
      {view === 'reset' && (
        <input placeholder="Confirm Password" type="password" value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
      )}
      {view === 'register' && !adminOnly && (
        <>
          <label style={{ fontSize: 12, color: '#64748b' }}>Role</label>
          <select value={role} onChange={e => setRole(e.target.value)} style={{ padding: 8, borderRadius: 8 }}>
            <option value="student">Student</option>
            <option value="company">Company</option>
            {/* Admin registration disabled in UI to avoid accidental creation */}
          </select>
        </>
      )}
      {helperText && <div style={{ fontSize: 12, color: helperText.toLowerCase().includes('match') ? '#ef4444' : '#16a34a' }}>{helperText}</div>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded">
          {view === 'login' ? 'Sign In' : view === 'register' ? 'Register' : view === 'forgot' ? 'Send Reset Link' : 'Reset Password'}
        </button>
        {!adminOnly && (view === 'login' || view === 'register') && (
          <button type="button" onClick={() => onSwitch(view === 'login' ? 'register' : 'login')} className="px-4 py-2 rounded border">
            {view === 'login' ? 'Create account' : 'Have an account?'}
          </button>
        )}
        {(view === 'forgot' || view === 'reset') && (
          <button type="button" onClick={() => onSwitch('login')} className="px-4 py-2 rounded border">
            Back to Sign In
          </button>
        )}
      </div>
      {view === 'login' && (
        <button type="button" onClick={() => onSwitch('forgot')} style={{ background: 'transparent', border: 'none', color: '#2563eb', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
          Forgot password?
        </button>
      )}
    </form>
  );
}

/*
 * STUDENT EXTENDED PROFILE
 * Large form for students to provide their full details(Resume, CV, Transcripts, Skills).
 * This data is used by companies to decide on applications.
 * - Handles file uploads via FormData.
 * - Auto-saves based on 'studentKey'.
 * - Can be locked to prevent accidental changes after submission.
 */
function StudentExtendedProfile({ studentKey, userInfo, onLinked = () => {}, onCredentialsUpdated = () => {} }) {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);
  const [exists, setExists] = useState(false);
  const [accountUsername, setAccountUsername] = useState(userInfo?.username || '');
  const [accountPassword, setAccountPassword] = useState('');
  const [accountPasswordConfirm, setAccountPasswordConfirm] = useState('');
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountMessage, setAccountMessage] = useState('');
  const [accountToast, setAccountToast] = useState(null);
  const [skillInput, setSkillInput] = useState('');
  const [fileDrafts, setFileDrafts] = useState({
    resume: null,
    cover_letter: null,
    recommendation_letters: null,
    transcript: null,
    student_id_doc: null,
    certificates: null,
    profile_picture: null
  });
  const [profilePreview, setProfilePreview] = useState('');
  const [remoteProfileUrl, setRemoteProfileUrl] = useState('');
  const [form, setForm] = useState({
    full_name: '',
    email_address: '',
    phone_number: '',
    gender: '',
    date_of_birth: '',
    nationality: '',
    country_city: '',
    school_name: '',
    degree_program: '',
    year_of_study: '',
    expected_grad_year: '',
    gpa_academic: '',
    skills: [],
    work_experience: '',
    volunteer_experience: '',
    research_projects: '',
    leadership_roles: '',
    publications_competitions: '',
    resume_name: '',
    cover_letter_name: '',
    linkedin_url: '',
    recommendation_letters_name: '',
    transcript_name: '',
    id_name: '',
    certificates_name: '',
    profile_picture_name: ''
  });

  const pushAccountToast = (message, tone = 'success') => {
    setAccountToast({ message, tone });
    setTimeout(() => setAccountToast(null), 2500);
  };

  useEffect(() => {
    if (fileDrafts.profile_picture) {
      const url = URL.createObjectURL(fileDrafts.profile_picture);
      setProfilePreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setProfilePreview(remoteProfileUrl || '');
  }, [fileDrafts.profile_picture, remoteProfileUrl]);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    const loadProfilePicture = async () => {
      if (!studentKey || fileDrafts.profile_picture) return;
      try {
        const res = await axios.get(`${API}/student-profile/profile-picture`, { responseType: 'blob' });
        if (!active) return;
        objectUrl = URL.createObjectURL(res.data);
        setRemoteProfileUrl(objectUrl);
      } catch (e) {
        if (e?.response?.status !== 404) {
          console.error('Could not load profile picture', e);
        }
      }
    };
    loadProfilePicture();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [studentKey, fileDrafts.profile_picture]);

  useEffect(() => {
    setAccountUsername(userInfo?.username || '');
  }, [userInfo?.username]);

  const loadProfile = useCallback(async () => {
    if (!studentKey) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API}/student-profile`);
      const data = res.data || {};
      setExists(true);
      setLocked(!!data.locked);
      setForm(prev => ({
        ...prev,
        full_name: data.full_name || '',
        email_address: data.email_address || '',
        phone_number: data.phone_number || '',
        gender: data.gender || '',
        date_of_birth: data.date_of_birth || '',
        nationality: data.nationality || '',
        country_city: data.country_city || '',
        school_name: data.school_name || '',
        degree_program: data.degree_program || '',
        year_of_study: data.year_of_study || '',
        expected_grad_year: data.expected_grad_year || '',
        gpa_academic: data.gpa_academic || '',
        skills: Array.isArray(data.skills) ? data.skills : [],
        work_experience: data.work_experience || '',
        volunteer_experience: data.volunteer_experience || '',
        research_projects: data.research_projects || '',
        leadership_roles: data.leadership_roles || '',
        publications_competitions: data.publications_competitions || '',
        resume_name: data.resume_name || '',
        cover_letter_name: data.cover_letter_name || '',
        linkedin_url: data.linkedin_url || '',
        recommendation_letters_name: data.recommendation_letters_name || '',
        transcript_name: data.transcript_name || '',
        id_name: data.id_name || '',
        certificates_name: data.certificates_name || '',
        profile_picture_name: data.profile_picture_name || ''
      }));
    } catch (e) {
      if (e?.response?.status === 404) {
        setExists(false);
        setLocked(false);
      } else {
        console.error('Could not load extended profile', e);
      }
    } finally {
      setLoading(false);
    }
  }, [studentKey]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const updateField = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  const updateFile = (field, nameField) => (e) => {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    setFileDrafts(prev => ({ ...prev, [field]: file }));
    setForm(prev => ({ ...prev, [nameField]: file ? file.name : prev[nameField] }));
  };

  const addSkill = () => {
    const next = skillInput.trim();
    if (!next) return;
    if (form.skills.length >= 10) return;
    if (form.skills.includes(next)) return;
    setForm(prev => ({ ...prev, skills: [...prev.skills, next] }));
    setSkillInput('');
  };

  const removeSkill = (skill) => {
    setForm(prev => ({ ...prev, skills: prev.skills.filter(s => s !== skill) }));
  };

  const unlockProfile = async () => {
    try {
      await axios.patch(`${API}/student-profile/unlock`);
      setLocked(false);
    } catch (e) {
      console.error('Could not unlock profile', e);
    }
  };

  const lockProfile = async () => {
    try {
      await axios.patch(`${API}/student-profile/lock`);
      setLocked(true);
    } catch (e) {
      console.error('Could not lock profile', e);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('full_name', form.full_name || '');
      formData.append('email_address', form.email_address || '');
      formData.append('phone_number', form.phone_number || '');
      formData.append('gender', form.gender || '');
      formData.append('date_of_birth', form.date_of_birth || '');
      formData.append('nationality', form.nationality || '');
      formData.append('country_city', form.country_city || '');
      formData.append('school_name', form.school_name || '');
      formData.append('degree_program', form.degree_program || '');
      formData.append('year_of_study', form.year_of_study || '');
      formData.append('expected_grad_year', form.expected_grad_year || '');
      formData.append('gpa_academic', form.gpa_academic || '');
      formData.append('skills_json', JSON.stringify(form.skills || []));
      formData.append('work_experience', form.work_experience || '');
      formData.append('volunteer_experience', form.volunteer_experience || '');
      formData.append('research_projects', form.research_projects || '');
      formData.append('leadership_roles', form.leadership_roles || '');
      formData.append('publications_competitions', form.publications_competitions || '');
      formData.append('linkedin_url', form.linkedin_url || '');

      if (fileDrafts.resume) formData.append('resume', fileDrafts.resume);
      if (fileDrafts.cover_letter) formData.append('cover_letter', fileDrafts.cover_letter);
      if (fileDrafts.recommendation_letters) formData.append('recommendation_letters', fileDrafts.recommendation_letters);
      if (fileDrafts.transcript) formData.append('transcript', fileDrafts.transcript);
      if (fileDrafts.student_id_doc) formData.append('student_id_doc', fileDrafts.student_id_doc);
      if (fileDrafts.certificates) formData.append('certificates', fileDrafts.certificates);
      if (fileDrafts.profile_picture) formData.append('profile_picture', fileDrafts.profile_picture);

      const method = exists ? 'put' : 'post';
      const res = await axios({
        method,
        url: `${API}/student-profile`,
        data: formData,
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const data = res.data || {};
      setExists(true);
      setLocked(true);
      if (data.student_id) {
        onLinked({ studentId: data.student_id, displayName: data.full_name || data.email_address || '' });
      }
      setForm(prev => ({
        ...prev,
        resume_name: data.resume_name || prev.resume_name,
        cover_letter_name: data.cover_letter_name || prev.cover_letter_name,
        transcript_name: data.transcript_name || prev.transcript_name,
        certificates_name: data.certificates_name || prev.certificates_name,
        profile_picture_name: data.profile_picture_name || prev.profile_picture_name
      }));
      setFileDrafts({ resume: null, cover_letter: null, recommendation_letters: null, transcript: null, student_id_doc: null, certificates: null, profile_picture: null });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error('Could not save extended profile', e);
      alert(e?.response?.data?.error || 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  const saveAccount = async () => {
    if (accountPassword && accountPassword !== accountPasswordConfirm) {
      setAccountMessage('Passwords do not match');
      pushAccountToast('Passwords do not match', 'error');
      return;
    }
    setAccountSaving(true);
    setAccountMessage('');
    try {
      const payload = {
        username: accountUsername.trim() || undefined,
        password: accountPassword || undefined
      };
      await axios.patch(`${API}/account`, payload);
      onCredentialsUpdated({ username: accountUsername.trim() });
      setAccountPassword('');
      setAccountPasswordConfirm('');
      setAccountMessage('Account updated');
      pushAccountToast('Account updated', 'success');
    } catch (e) {
      const msg = e?.response?.data?.error || 'Could not update account';
      setAccountMessage(msg);
      pushAccountToast(msg, 'error');
    } finally {
      setAccountSaving(false);
    }
  };

  const completionScore = () => {
    const fields = [
      form.full_name,
      form.email_address,
      form.phone_number,
      form.school_name,
      form.degree_program,
      form.gpa_academic,
      (form.skills || []).length ? 'skills' : '',
      form.work_experience || form.volunteer_experience || form.research_projects,
      form.resume_name,
      form.linkedin_url
    ];
    const filled = fields.filter(Boolean).length;
    return Math.round((filled / fields.length) * 100);
  };

  const completionPercent = completionScore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'relative' }}>
      {accountToast && (
        <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 50, background: accountToast.tone === 'error' ? '#ef4444' : '#16a34a', color: 'white', padding: '10px 14px', borderRadius: 12, boxShadow: '0 10px 24px rgba(15, 23, 42, 0.2)', fontWeight: 700, fontSize: 12 }}>
          {accountToast.message}
        </div>
      )}
      {loading && <div style={{ color: '#64748b' }}>Loading profile...</div>}
      {!loading && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 800, color: locked ? '#0f172a' : '#2563eb' }}>{locked ? 'Profile Locked' : 'Editing Enabled'}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {locked ? (
                <button type="button" onClick={unlockProfile} style={{ background: '#111827', color: 'white', border: 'none', padding: '8px 12px', borderRadius: 8 }}>Edit Profile</button>
              ) : (
                <button type="button" onClick={lockProfile} style={{ background: '#64748b', color: 'white', border: 'none', padding: '8px 12px', borderRadius: 8 }}>Lock Without Changes</button>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ background: 'linear-gradient(135deg, #111827, #1d4ed8)', color: 'white', padding: 18, borderRadius: 16, display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                    {profilePreview ? <img src={profilePreview} alt="Profile" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : (form.full_name || userInfo?.username || 'U').slice(0, 1)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 18 }}>{form.full_name || 'Student Name'}</div>
                    <div style={{ color: '#c7d2fe', fontSize: 12 }}>{form.degree_program || 'Degree Program'} {form.school_name ? `• ${form.school_name}` : ''}</div>
                  </div>
                </div>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.15)', padding: '6px 10px', borderRadius: 999, fontSize: 12, cursor: locked ? 'not-allowed' : 'pointer' }}>
                  <input disabled={locked} type="file" accept="image/*" onChange={updateFile('profile_picture', 'profile_picture_name')} style={{ display: 'none' }} />
                  Upload profile photo
                  {form.profile_picture_name && <span style={{ color: '#e2e8f0' }}>{form.profile_picture_name}</span>}
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ background: 'rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: 999, fontSize: 12 }}>★ Getting Started</span>
                  {completionPercent >= 60 && <span style={{ background: 'rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: 999, fontSize: 12 }}>★ Consistent Builder</span>}
                  {completionPercent >= 100 && <span style={{ background: 'rgba(34,197,94,0.3)', padding: '4px 10px', borderRadius: 999, fontSize: 12 }}>★ Verified Candidate</span>}
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#c7d2fe' }}>{completionPercent}% Profile Complete</div>
                  <div style={{ height: 8, background: 'rgba(255,255,255,0.2)', borderRadius: 999, overflow: 'hidden', marginTop: 6 }}>
                    <div style={{ width: `${completionPercent}%`, height: '100%', background: completionPercent >= 100 ? '#22c55e' : '#93c5fd' }} />
                  </div>
                </div>
              </div>

              <div style={{ background: 'white', padding: 20, borderRadius: 12 }}>
                <h4 style={{ fontWeight: 800, marginBottom: 10 }}>Personal Information</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  <input disabled={locked} placeholder="Full Name" value={form.full_name} onChange={updateField('full_name')} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <input disabled={locked} placeholder="Email Address" value={form.email_address} onChange={updateField('email_address')} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <input disabled={locked} placeholder="Phone Number" value={form.phone_number} onChange={updateField('phone_number')} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <input disabled={locked} placeholder="Gender (optional)" value={form.gender} onChange={updateField('gender')} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <input disabled={locked} type="date" placeholder="Date of Birth" value={form.date_of_birth} onChange={updateField('date_of_birth')} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <input disabled={locked} placeholder="Nationality" value={form.nationality} onChange={updateField('nationality')} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <input disabled={locked} placeholder="Country / City" value={form.country_city} onChange={updateField('country_city')} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                </div>
              </div>

              <div style={{ background: 'white', padding: 20, borderRadius: 12 }}>
                <h4 style={{ fontWeight: 800, marginBottom: 10 }}>Education Information</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  <input disabled={locked} placeholder="University / College / High School" value={form.school_name} onChange={updateField('school_name')} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <input disabled={locked} placeholder="Degree Program" value={form.degree_program} onChange={updateField('degree_program')} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <input disabled={locked} placeholder="Year of Study (1st, 2nd, 3rd, 4th)" value={form.year_of_study} onChange={updateField('year_of_study')} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <input disabled={locked} placeholder="Expected Graduation Year" value={form.expected_grad_year} onChange={updateField('expected_grad_year')} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <input disabled={locked} placeholder="GPA / Academic Performance" value={form.gpa_academic} onChange={updateField('gpa_academic')} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                </div>
              </div>

              <div style={{ background: 'white', padding: 20, borderRadius: 12 }}>
                <h4 style={{ fontWeight: 800, marginBottom: 10 }}>Skills (up to 10)</h4>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input disabled={locked} placeholder="Add a skill" value={skillInput} onChange={(e) => setSkillInput(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0', flex: 1 }} />
                  <button type="button" onClick={addSkill} disabled={locked} style={{ background: locked ? '#94a3b8' : '#2563eb', color: 'white', border: 'none', padding: '8px 12px', borderRadius: 8 }}>Add</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  {form.skills.map(skill => (
                    <span key={skill} style={{ background: '#e2e8f0', padding: '6px 10px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {skill}
                      <button type="button" onClick={() => removeSkill(skill)} disabled={locked} style={{ background: 'transparent', border: 'none', cursor: locked ? 'default' : 'pointer' }} aria-label={`Remove ${skill}`}>
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ background: 'white', padding: 20, borderRadius: 12 }}>
                <h4 style={{ fontWeight: 800, marginBottom: 10 }}>Experience</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                  <textarea disabled={locked} placeholder="Work Experience (Company, Role, Duration)" value={form.work_experience} onChange={updateField('work_experience')} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0', minHeight: 80 }} />
                  <textarea disabled={locked} placeholder="Volunteer Experience" value={form.volunteer_experience} onChange={updateField('volunteer_experience')} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0', minHeight: 80 }} />
                  <textarea disabled={locked} placeholder="Research Projects" value={form.research_projects} onChange={updateField('research_projects')} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0', minHeight: 80 }} />
                  <textarea disabled={locked} placeholder="Leadership Roles" value={form.leadership_roles} onChange={updateField('leadership_roles')} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0', minHeight: 80 }} />
                  <textarea disabled={locked} placeholder="Publications or Competitions" value={form.publications_competitions} onChange={updateField('publications_competitions')} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0', minHeight: 80 }} />
                </div>
              </div>

              <div style={{ background: 'white', padding: 20, borderRadius: 12 }}>
                <h4 style={{ fontWeight: 800, marginBottom: 10 }}>Documents Upload</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    CV / Resume (PDF)
                    <input disabled={locked} type="file" accept="application/pdf" onChange={updateFile('resume', 'resume_name')} />
                    {form.resume_name && <span style={{ fontSize: 12, color: '#64748b' }}>{form.resume_name}</span>}
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    Cover Letter Template
                    <input disabled={locked} type="file" onChange={updateFile('cover_letter', 'cover_letter_name')} />
                    {form.cover_letter_name && <span style={{ fontSize: 12, color: '#64748b' }}>{form.cover_letter_name}</span>}
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    LinkedIn URL
                    <input disabled={locked} placeholder="https://linkedin.com/in/..." value={form.linkedin_url} onChange={updateField('linkedin_url')} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    Recommendation Letters (PDF)
                    <input disabled={locked} type="file" accept="application/pdf" onChange={updateFile('recommendation_letters', 'recommendation_letters_name')} />
                    {form.recommendation_letters_name && <span style={{ fontSize: 12, color: '#64748b' }}>{form.recommendation_letters_name}</span>}
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    Academic Transcript
                    <input disabled={locked} type="file" onChange={updateFile('transcript', 'transcript_name')} />
                    {form.transcript_name && <span style={{ fontSize: 12, color: '#64748b' }}>{form.transcript_name}</span>}
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    Student ID / National ID (optional)
                    <input disabled={locked} type="file" onChange={updateFile('student_id_doc', 'id_name')} />
                    {form.id_name && <span style={{ fontSize: 12, color: '#64748b' }}>{form.id_name}</span>}
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    Certificates (Coursera, IELTS, etc.)
                    <input disabled={locked} type="file" onChange={updateFile('certificates', 'certificates_name')} />
                    {form.certificates_name && <span style={{ fontSize: 12, color: '#64748b' }}>{form.certificates_name}</span>}
                  </label>
                </div>
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button type="button" onClick={saveProfile} disabled={locked || saving} style={{ background: locked ? '#94a3b8' : '#2563eb', color: 'white', border: 'none', padding: '8px 12px', borderRadius: 8 }}>{saving ? 'Saving...' : (exists ? 'Save and Lock' : 'Save Student Profile')}</button>
                  {saved && <span style={{ color: '#16a34a', fontWeight: 700 }}>Saved</span>}
                </div>
              </div>
            </div>

            <div style={{ position: 'sticky', top: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: 'white', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0', color: '#0f172a' }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>Account & Security</div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                  Update your username or password. Keep a field empty to leave it unchanged.
                </div>
                <div style={{ display: 'grid', gap: 10 }}>
                  <input placeholder="Username" value={accountUsername} onChange={(event) => setAccountUsername(event.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <input placeholder="New Password" type="password" value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <input placeholder="Confirm Password" type="password" value={accountPasswordConfirm} onChange={(event) => setAccountPasswordConfirm(event.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <button type="button" onClick={saveAccount} disabled={accountSaving} style={{ padding: '10px 12px', borderRadius: 10, border: 'none', background: accountSaving ? '#94a3b8' : 'linear-gradient(135deg, #f97316, #ef4444)', color: 'white', fontWeight: 700, cursor: accountSaving ? 'default' : 'pointer' }}>{accountSaving ? 'Saving...' : 'Save Account Changes'}</button>
                  {accountMessage && <div style={{ fontSize: 12, color: accountMessage.toLowerCase().includes('updated') ? '#16a34a' : '#ef4444' }}>{accountMessage}</div>}
                </div>
              </div>
              <div style={{ background: 'linear-gradient(135deg, #f8fafc, #e0f2fe)', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Profile Tips</div>
                <div style={{ fontSize: 12, color: '#475569', display: 'grid', gap: 6 }}>
                  <div>• Add project links and a short bio for recruiters.</div>
                  <div>• Upload a resume and a cover letter tailored to your target roles.</div>
                  <div>• Keep your skills list focused on the roles you want.</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/*
 * COMPANY PROFILE FORM
 * Allows companies to define their presence (Logo, Mission, Openings Count).
 * Students browse these details to decide where to apply.
 * - Supports company profile picture upload.
 */
function CompanyProfileForm({ onCreated = () => {}, onSaved = () => {}, initialData = null, submitLabel = 'Save Profile' }) {
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [openings, setOpenings] = useState(0);
  const [location, setLocation] = useState('');
  const [contact_person, setContactPerson] = useState('');
  const [contact_email, setContactEmail] = useState('');
  const [contact_phone, setContactPhone] = useState('');
  const [overview, setOverview] = useState('');
  const [mission, setMission] = useState('');
  const [vision, setVision] = useState('');
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [logoName, setLogoName] = useState('');

  useEffect(() => {
    if (!initialData) {
      setLogoName('');
      setLogoPreview('');
      setLogoFile(null);
      return;
    }
    setName(initialData.name || '');
    setIndustry(initialData.industry || '');
    setLocation(initialData.location || '');
    setContactPerson(initialData.contact_person || '');
    setContactEmail(initialData.contact_email || '');
    setContactPhone(initialData.contact_phone || '');
    setOpenings(typeof initialData.openings === 'number' ? initialData.openings : (initialData.openings || 0));
    setOverview(initialData.overview || '');
    setMission(initialData.mission || '');
    setVision(initialData.vision || '');
    setLogoName(initialData.profile_picture_name || '');
  }, [initialData]);

  useEffect(() => {
    if (!logoFile) return;
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    const loadLogo = async () => {
      if (!initialData?.id || logoFile) return;
      try {
        const res = await axios.get(`${API}/companies/${initialData.id}/profile-picture`, { responseType: 'blob' });
        if (!active) return;
        objectUrl = URL.createObjectURL(res.data);
        setLogoPreview(objectUrl);
      } catch (err) {
        if (err?.response?.status !== 404) console.error('Could not load company profile picture', err);
      }
    };
    loadLogo();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [initialData?.id, logoFile]);

  const uploadCompanyLogo = async (companyId) => {
    if (!logoFile || !companyId) return;
    const formData = new FormData();
    formData.append('profile_picture', logoFile);
    const res = await axios.put(`${API}/companies/${companyId}/profile-picture`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    setLogoName(res?.data?.profile_picture_name || logoFile.name || '');
    setLogoFile(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { name, industry, openings: openings || 0, location, contact_person, contact_email, contact_phone, overview, mission, vision };
      if (initialData && initialData.id) {
        await axios.put(`${API}/companies/${initialData.id}`, payload);
        await uploadCompanyLogo(initialData.id);
        onSaved();
      } else {
        const res = await axios.post(`${API}/companies`, payload);
        await uploadCompanyLogo(res.data.company?.id);
        onCreated(res.data.company);
      }
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 520 }}>
      <div style={{ background: 'linear-gradient(135deg, #0f172a, #1d4ed8)', color: 'white', padding: 16, borderRadius: 16, display: 'grid', gap: 10 }}>
        <div style={{ fontWeight: 800 }}>Company Profile Photo</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
            {logoPreview ? <img src={logoPreview} alt="Company" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : (name || 'C').slice(0, 1)}
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.2)', padding: '6px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer' }}>
            <input type="file" accept="image/*" onChange={(event) => setLogoFile(event.target.files && event.target.files[0] ? event.target.files[0] : null)} style={{ display: 'none' }} />
            Upload logo
            {logoName && <span style={{ color: '#e2e8f0' }}>{logoName}</span>}
          </label>
        </div>
      </div>
      <div style={{ background: 'linear-gradient(135deg, #f8fafc, #e0f2fe)', padding: 16, borderRadius: 16, border: '1px solid #e2e8f0', display: 'grid', gap: 10 }}>
        <div style={{ fontWeight: 800 }}>Company Spotlight</div>
        <textarea
          placeholder="What the company does"
          value={overview}
          onChange={e => setOverview(e.target.value)}
          style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0', minHeight: 80 }}
        />
        <textarea
          placeholder="Mission"
          value={mission}
          onChange={e => setMission(e.target.value)}
          style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0', minHeight: 70 }}
        />
        <textarea
          placeholder="Vision"
          value={vision}
          onChange={e => setVision(e.target.value)}
          style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0', minHeight: 70 }}
        />
      </div>
      <input placeholder="Company name" value={name} onChange={e => setName(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
      <input placeholder="Industry" value={industry} onChange={e => setIndustry(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
      <input placeholder="Location" value={location} onChange={e => setLocation(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
      <input placeholder="Contact person" value={contact_person} onChange={e => setContactPerson(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
      <input placeholder="Contact email" value={contact_email} onChange={e => setContactEmail(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
      <input placeholder="Contact phone" value={contact_phone} onChange={e => setContactPhone(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded">{loading ? 'Saving...' : submitLabel}</button>
      </div>
    </form>
  );
}

/*
 * MAIN APP COMPONENT
 * Coordinates the full application lifecycle.
 * - State management: `applications`, `students`, `companies`, `userInfo`.
 * - Views logic: `view === 'landing'`, `view === 'auth'`, `view === 'main'`.
 * - Role logic: switches dashboards based on `userRole` (student/company/admin).
 * - Side Effects: data fetching, socket.io listeners, browser notifications.
 */
function App() {
  // STATE MANAGEMENT
  const [view, setView] = useState('landing');
  const [userRole, setUserRole] = useState(null);
  const [token, setToken] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [authView, setAuthView] = useState('login');
  const [resetToken, setResetToken] = useState('');
  const [adminLoginMode, setAdminLoginMode] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [students, setStudents] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [stats, setStats] = useState({ total: 0, placed: 0, rate: 0 });
  const [showAddModal, setShowAddModal] = useState(false);
  const [companyProfile, setCompanyProfile] = useState(null);
  const [companyProfileLoading, setCompanyProfileLoading] = useState(false);
  const [companySubscriberCount, setCompanySubscriberCount] = useState(0);
  const [companyOpenings, setCompanyOpenings] = useState([]);
  const [openingsPublic, setOpeningsPublic] = useState([]);
  const [memberCompanies, setMemberCompanies] = useState([]);
  const [memberCompaniesLoading, setMemberCompaniesLoading] = useState(false);
  const [openingDraft, setOpeningDraft] = useState({
    department: '',
    role: '',
    expectations: '',
    slots: '',
    location: '',
    deadline: ''
  });
  const [interviewSchedule, setInterviewSchedule] = useState({});
  const [studentInterviewMap, setStudentInterviewMap] = useState({});
  const [supportTickets, setSupportTickets] = useState([]);
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportToast, setSupportToast] = useState('');
  const [supportReplyDrafts, setSupportReplyDrafts] = useState({});
  const [supportLastSeenAt, setSupportLastSeenAt] = useState(() => {
    const stored = localStorage.getItem('it_support_seen_at');
    return stored ? Number(stored) : 0;
  });
  const [adminHasNotification, setAdminHasNotification] = useState(false);
  const [adminActivity, setAdminActivity] = useState([]);
  const [adminNotificationTarget, setAdminNotificationTarget] = useState('overview');
  const [adminAlertsSeenAt, setAdminAlertsSeenAt] = useState(() => {
    const stored = localStorage.getItem('it_admin_alerts_seen_at');
    return stored ? Number(stored) : 0;
  });
  const subscribedCompanyIds = useMemo(() => (
    userRole === 'student'
      ? new Set(memberCompanies.filter(c => c.subscribed).map(c => c.id))
      : new Set()
  ), [userRole, memberCompanies]);

  /*
   * DATA LOADING FUNCTIONS
   * Fetch core data needed for the app.
   * - `loadData`: gets companies and stats. Admin gets students too.
   * - `loadSupportTickets`, `loadAuditLogs`, `loadAdmin...`: specialized data.
   */
  const loadData = useCallback(async () => {
    try {
      const promises = [axios.get(`${API}/companies`), axios.get(`${API}/stats`)];
      // fetch students only for admin (students should not see full student list)
      if (userRole === 'admin') promises.unshift(axios.get(`${API}/students`));
      const results = await Promise.all(promises);
      if (userRole === 'admin') {
        const [s, c, st] = results;
        setStudents(s.data);
        setCompanies(c.data);
        setStats(st.data);
      } else {
        const [c, st] = results;
        setStudents([]);
        setCompanies(c.data);
        setStats(st.data);
      }
    } catch (e) { console.error("Backend offline", e.message); }
  }, [userRole]);

  const loadSupportTickets = useCallback(async () => {
    if (!token) return setSupportTickets([]);
    setSupportLoading(true);
    try {
      const res = await axios.get(`${API}/support-tickets`);
      const list = res.data || [];
      setSupportTickets(list);
      setSupportReplyDrafts(Object.fromEntries(list.map(t => [t.id, t.admin_reply || ''])));
    } catch (e) {
      console.error('Could not load support tickets', e.message);
    } finally {
      setSupportLoading(false);
    }
  }, [token]);

  const loadAuditLogs = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/audit-logs?limit=200`);
      const list = res.data || [];
      setAuditLogs(list);
      setAdminActivity(list.slice(0, 10).map(item => ({
        id: `audit-${item.id}`,
        type: item.entity_type || 'activity',
        message: `${item.action_type || 'updated'} ${item.entity_type || ''}`.trim(),
        ts: new Date(item.created_at || Date.now()).getTime()
      })));
      if (list.length) {
        const entityType = list[0].entity_type;
        if (entityType === 'support') setAdminNotificationTarget('complaints');
        else if (entityType === 'application') setAdminNotificationTarget('applications');
        else if (entityType === 'student' || entityType === 'student_profile') setAdminNotificationTarget('students');
        else if (entityType === 'company' || entityType === 'opening') setAdminNotificationTarget('companies');
        else setAdminNotificationTarget('audit');
      }
      const latest = list.reduce((max, item) => {
        const time = new Date(item.created_at || 0).getTime();
        return Math.max(max, time);
      }, 0);
      if (latest && latest > adminAlertsSeenAt) {
        setAdminHasNotification(true);
      }
    } catch (e) {
      console.error('Could not load audit logs', e);
    }
  }, [adminAlertsSeenAt]);

  const submitSupportTicket = async () => {
    if (!supportSubject.trim() || !supportMessage.trim()) {
      setSupportToast('Please add a subject and message before sending.');
      return;
    }
    try {
      await axios.post(`${API}/support-tickets`, { subject: supportSubject.trim(), message: supportMessage.trim() });
      setSupportSubject('');
      setSupportMessage('');
      setShowSupportModal(false);
      setSupportToast('Thanks for reaching out. Please wait for an admin response.');
      setTimeout(() => setSupportToast(''), 4000);
      await loadSupportTickets();
    } catch (e) {
      console.error('Could not submit support ticket', e);
      setSupportToast(e?.response?.data?.error || 'Could not submit ticket');
      setTimeout(() => setSupportToast(''), 4000);
    }
  };

  const replySupportTicket = async (ticketId, status = 'answered') => {
    const reply = (supportReplyDrafts[ticketId] || '').toString().trim();
    if (!reply) return;
    try {
      await axios.patch(`${API}/support-tickets/${ticketId}/reply`, { reply, status });
      await loadSupportTickets();
      if (userRole === 'admin') {
        await loadAuditLogs();
      }
    } catch (e) {
      console.error('Could not reply to ticket', e);
      alert(e?.response?.data?.error || 'Could not send reply');
    }
  };

  const submitAdminSetup = async () => {
    if (!adminSetupEmail.trim() || !adminSetupPassword.trim() || !adminSetupToken.trim()) {
      setAdminSetupMessage('Email, password, and setup token are required.');
      return;
    }
    try {
      await axios.post(`${API}/admin/setup`, {
        email: adminSetupEmail.trim(),
        password: adminSetupPassword,
        setup_token: adminSetupToken.trim()
      });
      setAdminSetupMessage('Admin created. You can now sign in.');
    } catch (e) {
      setAdminSetupMessage(e?.response?.data?.error || 'Could not create admin');
    }
  };

  const openAdminEdit = (type, item) => {
    setAdminEditType(type);
    setAdminEditItem(item);
    if (type === 'student') {
      setAdminEditForm({
        full_name: item.full_name || '',
        major: item.major || '',
        gpa: item.gpa || '',
        age: item.age || '',
        university: item.university || '',
        phone: item.phone || '',
        email: item.email || ''
      });
    } else if (type === 'company') {
      setAdminEditForm({
        name: item.name || '',
        industry: item.industry || '',
        openings: item.openings || 0,
        location: item.location || '',
        contact_person: item.contact_person || '',
        contact_email: item.contact_email || '',
        contact_phone: item.contact_phone || '',
        overview: item.overview || '',
        mission: item.mission || '',
        vision: item.vision || ''
      });
    } else if (type === 'application') {
      setAdminEditForm({
        student_id: item.student_id || '',
        company_id: item.company_id || '',
        position: item.position || '',
        department: item.department || '',
        stage: item.stage || 'Applied',
        notes: item.notes || ''
      });
    }
  };

  const closeAdminEdit = () => {
    setAdminEditType('');
    setAdminEditItem(null);
    setAdminEditForm({});
  };

  const saveAdminEdit = async () => {
    if (!adminEditItem) return;
    try {
      if (adminEditType === 'student') {
        await axios.put(`${API}/students/${adminEditItem.id}`, {
          full_name: adminEditForm.full_name,
          major: adminEditForm.major,
          gpa: adminEditForm.gpa,
          age: adminEditForm.age,
          university: adminEditForm.university,
          phone: adminEditForm.phone,
          email: adminEditForm.email
        });
      } else if (adminEditType === 'company') {
        await axios.put(`${API}/companies/${adminEditItem.id}`, { ...adminEditForm });
      } else if (adminEditType === 'application') {
        await axios.put(`${API}/applications/${adminEditItem.id}`, { ...adminEditForm });
      }
      await loadData();
      await refreshApplications();
      closeAdminEdit();
    } catch (e) {
      console.error('Could not save admin edit', e);
      alert(e?.response?.data?.error || 'Could not save changes');
    }
  };

  /*
   * REACT EFFECTS (Lifecycle)
   * - Restore token from localStorage
   * - Setup API auth headers
   * - Check URL for reset tokens
   * - Load user-specific data after login
   */
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('it_token', token);
    } else {
      delete axios.defaults.headers.common['Authorization'];
      localStorage.removeItem('it_token');
      clearSessionState();
    }
  }, [token, clearSessionState]);

  useEffect(() => {
    const t = localStorage.getItem('it_token');
    if (t) setToken(t);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('reset_token');
    const adminToken = params.get('admin_setup_token');
    const path = window.location.pathname;
    if (tokenParam) {
      setResetToken(tokenParam);
      setAuthView('reset');
      setView('auth');
    }
    if (path === '/admin') {
      setAdminLoginMode(true);
      setAuthView('login');
      setView('auth');
    } else {
      setAdminLoginMode(false);
    }
    if (path === '/admin-setup') {
      setView('admin-setup');
    }
    if (adminToken) {
      setAdminSetupToken(adminToken);
      setView('admin-setup');
    }
  }, []);

  useEffect(() => { if (view === 'main') loadData(); }, [view, loadData]);

  useEffect(() => {
    if (userRole === 'admin' && activeTab === 'dashboard') {
      setActiveTab('overview');
    } else if (userRole && userRole !== 'admin' && activeTab === 'overview') {
      setActiveTab('dashboard');
    }
  }, [userRole, activeTab]);

  useEffect(() => {
    if (view === 'main' && token && userRole) {
      loadSupportTickets();
    }
  }, [view, token, userRole, loadSupportTickets]);

  useEffect(() => {
    if (view === 'main' && token && userRole === 'admin') {
      loadAdminUsers();
      loadAuditLogs();
      loadAdminSettings();
      loadCompanySubscriptions();
    }
  }, [view, token, userRole, loadAuditLogs]);

  useEffect(() => {
    if (userRole === 'student' || userRole === 'company') {
      const hasReply = (supportTickets || []).some(t => t.status === 'answered' && new Date(t.updated_at || t.created_at || 0).getTime() > supportLastSeenAt);
      if (hasReply) {
        setHasNotification(true);
        setNotificationTarget('support');
      }
    }
  }, [supportTickets, supportLastSeenAt, userRole]);

  useEffect(() => {
    if (userRole === 'admin') {
      const latest = (supportTickets || []).reduce((max, ticket) => {
        const time = new Date(ticket.updated_at || ticket.created_at || 0).getTime();
        return Math.max(max, time);
      }, 0);
      if (latest && latest > adminAlertsSeenAt) {
        setAdminHasNotification(true);
        const activityId = `complaint-${latest}`;
        const alreadyLogged = adminActivity.some(item => item.id === activityId);
        if (!alreadyLogged) {
          pushAdminActivity({
            id: activityId,
            type: 'complaint',
            message: 'New complaint activity received',
            ts: latest
          });
        }
      }
    }
  }, [supportTickets, adminAlertsSeenAt, userRole, adminActivity]);

  useEffect(() => {
    if (activeTab === 'support' && (userRole === 'student' || userRole === 'company')) {
      const now = Date.now();
      setSupportLastSeenAt(now);
      localStorage.setItem('it_support_seen_at', String(now));
      setHasNotification(false);
    }
  }, [activeTab, userRole]);

  useEffect(() => {
    if (userRole !== 'company' || !userInfo?.companyId) {
      setCompanyProfile(null);
      setCompanySubscriberCount(0);
      return;
    }
    if (activeTab !== 'company-profile' && activeTab !== 'dashboard') return;
    const loadCompanyProfile = async () => {
      setCompanyProfileLoading(true);
      try {
        const [profileRes, countRes] = await Promise.all([
          axios.get(`${API}/companies/${userInfo.companyId}`),
          axios.get(`${API}/companies/${userInfo.companyId}/subscribers-count`)
        ]);
        setCompanyProfile(profileRes.data || null);
        setCompanySubscriberCount(countRes.data?.count || 0);
      } catch (e) {
        console.error('Could not load company profile', e);
        setCompanyProfile(null);
        setCompanySubscriberCount(0);
      } finally {
        setCompanyProfileLoading(false);
      }
    };
    loadCompanyProfile();
  }, [userRole, userInfo?.companyId, activeTab]);

  useEffect(() => {
    if (userRole !== 'company' || !userInfo?.companyId) {
      setCompanyOpenings([]);
      setInterviewSchedule({});
      return;
    }
    const loadCompanyData = async () => {
      try {
        const [openingsRes, interviewsRes] = await Promise.all([
          axios.get(`${API}/company-openings`),
          axios.get(`${API}/company-interviews`)
        ]);
        setCompanyOpenings(openingsRes.data || []);
        const scheduleMap = Object.fromEntries((interviewsRes.data || []).map(item => [
          item.application_id,
          {
            date: item.interview_date || '',
            time: item.interview_time || '',
            mode: item.mode || '',
            location: item.location || ''
          }
        ]));
        setInterviewSchedule(scheduleMap);
      } catch (e) {
        console.error('Could not load company data', e);
      }
    };
    loadCompanyData();
  }, [userRole, userInfo?.companyId]);

  const loadOpenings = useCallback(async () => {
    if (userRole !== 'student') {
      setOpeningsPublic([]);
      return;
    }
    try {
      const res = await axios.get(`${API}/openings`);
      setOpeningsPublic(res.data || []);
    } catch (e) {
      console.error('Could not load openings', e);
    }
  }, [userRole]);

  const loadMemberCompanies = useCallback(async () => {
    if (userRole !== 'student') {
      setMemberCompanies([]);
      return;
    }
    setMemberCompaniesLoading(true);
    try {
      const res = await axios.get(`${API}/member-companies`);
      setMemberCompanies(res.data || []);
    } catch (e) {
      console.error('Could not load member companies', e);
      setMemberCompanies([]);
    } finally {
      setMemberCompaniesLoading(false);
    }
  }, [userRole]);

  useEffect(() => {
    loadOpenings();
  }, [loadOpenings]);

  useEffect(() => {
    loadMemberCompanies();
  }, [loadMemberCompanies]);

  useEffect(() => {
    if (userRole !== 'student') {
      setApplicationDrafts([]);
      return;
    }
    const draftKey = `it_drafts_${userInfo?.userId || userInfo?.username || 'student'}`;
    try {
      const stored = localStorage.getItem(draftKey);
      setApplicationDrafts(stored ? JSON.parse(stored) : []);
    } catch (e) {
      console.error('Could not load drafts', e);
      setApplicationDrafts([]);
    }
  }, [userRole, userInfo?.userId, userInfo?.username]);

  // load applications for current user when authenticated
  const [applications, setApplications] = useState([]);
  const [applyingCompany, setApplyingCompany] = useState(null);
  const [companySearch, setCompanySearch] = useState('');
  const [subscriptionBusy, setSubscriptionBusy] = useState(null);
  const [appViewMode, setAppViewMode] = useState('cards');
  const [appStageFilter, setAppStageFilter] = useState('All');
  const [companyAppViewMode, setCompanyAppViewMode] = useState('cards');
  const [companyStageFilter, setCompanyStageFilter] = useState('All');
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyCompany, setApplyCompany] = useState(null);
  const [applyOpening, setApplyOpening] = useState(null);
  const [applyForm, setApplyForm] = useState({
    why_internship: '',
    skills_fit: '',
    career_goals: '',
    relevant_experience: ''
  });
  const [applicationDrafts, setApplicationDrafts] = useState([]);
  const [viewingApplicant, setViewingApplicant] = useState(null);
  const [applicantProfile, setApplicantProfile] = useState(null);
  const [studentSummary, setStudentSummary] = useState(null);
  const [billTipIndex, setBillTipIndex] = useState(0);
  const [botQuery, setBotQuery] = useState('');
  const [botOpen, setBotOpen] = useState(false);
  const [botDragging, setBotDragging] = useState(false);
  const [botPosition, setBotPosition] = useState({ x: 24, y: 24 });
  const [botDragOffset, setBotDragOffset] = useState({ x: 0, y: 0 });
  const [hasNotification, setHasNotification] = useState(false);
  const [notificationTarget, setNotificationTarget] = useState('dashboard');
  const [openingToast, setOpeningToast] = useState('');
  const [adminSetupToken, setAdminSetupToken] = useState('');
  const [adminSetupEmail, setAdminSetupEmail] = useState('');
  const [adminSetupPassword, setAdminSetupPassword] = useState('');
  const [adminSetupMessage, setAdminSetupMessage] = useState('');
  const [adminEditType, setAdminEditType] = useState('');
  const [adminEditItem, setAdminEditItem] = useState(null);
  const [adminEditForm, setAdminEditForm] = useState({});
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminUserSearch, setAdminUserSearch] = useState('');
  const [adminUserRoleFilter, setAdminUserRoleFilter] = useState('all');
  const [adminUserStatusFilter, setAdminUserStatusFilter] = useState('all');
  const [adminSelectedUserIds, setAdminSelectedUserIds] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('all');
  const [auditEntityFilter, setAuditEntityFilter] = useState('all');
  const [adminSettings, setAdminSettings] = useState({
    branding_name: '',
    branding_mission: '',
    branding_vision: '',
    contact_email: '',
    reset_email_mode: '',
    reset_base_url: '',
    smtp_from: ''
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [companySubscriptions, setCompanySubscriptions] = useState([]);
  const [applicationRequests, setApplicationRequests] = useState([]);
  const [requestDrafts, setRequestDrafts] = useState({});
  const [requestResponseDrafts, setRequestResponseDrafts] = useState({});
  const [editApplication, setEditApplication] = useState(null);
  const [editApplicationForm, setEditApplicationForm] = useState({
    department: '',
    why_internship: '',
    skills_fit: '',
    career_goals: '',
    relevant_experience: ''
  });

  const clearSessionState = useCallback(() => {
    setStudents([]);
    setCompanies([]);
    setOpeningsPublic([]);
    setMemberCompanies([]);
    setApplications([]);
    setApplicationRequests([]);
    setRequestDrafts({});
    setRequestResponseDrafts({});
    setApplicationDrafts([]);
    setStudentSummary(null);
    setStudentInterviewMap({});
    setSupportTickets([]);
    setSupportReplyDrafts({});
    setShowApplyModal(false);
    setApplyCompany(null);
    setApplyOpening(null);
    setApplyingCompany(null);
    setActiveTab('dashboard');
  }, []);

  const handleLogout = useCallback(() => {
    clearSessionState();
    setView('landing');
    setToken(null);
    setUserRole(null);
    setUserInfo(null);
  }, [clearSessionState]);

  const refreshApplications = useCallback(async () => {
    if (!token) return setApplications([]);
    try {
      const res = await axios.get(`${API}/applications`);
      setApplications(res.data);
    } catch (e) {
      console.error('could not load applications', e.message);
    }
  }, [token]);

  const refreshRequests = useCallback(async () => {
    if (!token) return setApplicationRequests([]);
    try {
      const res = await axios.get(`${API}/application-requests`);
      const list = res.data || [];
      setApplicationRequests(list);
      setRequestDrafts(Object.fromEntries(list.map(r => [r.application_id, r.request_text || ''])));
      setRequestResponseDrafts(Object.fromEntries(list.map(r => [r.application_id, r.response_text || ''])));
    } catch (e) {
      console.error('could not load requests', e.message);
    }
  }, [token]);

  const persistCompanyOpenings = (next) => {
    setCompanyOpenings(next);
  };

  const persistInterviewSchedule = (next) => {
    setInterviewSchedule(next);
  };

  const getNextStage = (stage) => {
    if (stage === 'Applied') return 'Interviewing';
    if (stage === 'Interviewing') return 'Offer';
    if (stage === 'Offer') return 'Placed';
    return null;
  };

  const getStageActionLabel = (stage) => {
    if (stage === 'Applied') return 'Invite to Interview';
    if (stage === 'Interviewing') return 'Extend Offer';
    if (stage === 'Offer') return 'Mark Accepted';
    return null;
  };

  const updateApplicationStage = async (app, nextStage) => {
    if (!app || !nextStage) return;
    try {
      await axios.patch(`${API}/applications/${app.id}/status`, { stage: nextStage });
      await refreshApplications();
    } catch (err) {
      console.error('Could not update stage', err);
    }
  };

  const summarizeText = (value, max = 140) => {
    const raw = (value || '').toString().trim();
    if (!raw) return 'Not provided';
    if (raw.length <= max) return raw;
    return `${raw.slice(0, max).trim()}...`;
  };

  const pushAdminActivity = (entry) => {
    setAdminActivity(prev => [entry, ...prev].slice(0, 10));
    setAdminHasNotification(true);
    if (entry?.type === 'complaint' || entry?.type === 'support') {
      setAdminNotificationTarget('complaints');
    } else if (entry?.type === 'application') {
      setAdminNotificationTarget('applications');
    } else if (entry?.type === 'student' || entry?.type === 'student_profile') {
      setAdminNotificationTarget('students');
    } else if (entry?.type === 'company' || entry?.type === 'opening') {
      setAdminNotificationTarget('companies');
    } else {
      setAdminNotificationTarget('audit');
    }
  };

  const markAdminAlertsSeen = () => {
    const now = Date.now();
    setAdminAlertsSeenAt(now);
    localStorage.setItem('it_admin_alerts_seen_at', String(now));
    setAdminHasNotification(false);
  };

  const downloadStudentDoc = async (studentId, docType, fallbackName) => {
    try {
      const res = await axios.get(`${API}/student-profile/${studentId}/document/${docType}`, { responseType: 'blob' });
      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fallbackName || `${docType}_${studentId}`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert('Document not found or access denied.');
    }
  };

  const adminSendReset = async (email) => {
    if (!email) {
      alert('No email available for this account.');
      return;
    }
    try {
      const res = await axios.post(`${API}/admin/password-reset`, { email });
      if (res.data?.reset_link) {
        alert(`Reset link (console mode): ${res.data.reset_link}`);
      } else {
        alert('Reset link sent.');
      }
    } catch (e) {
      alert(e?.response?.data?.error || 'Could not send reset link');
    }
  };

  const loadAdminUsers = async () => {
    try {
      const res = await axios.get(`${API}/admin/users`);
      setAdminUsers(res.data || []);
    } catch (e) {
      console.error('Could not load users', e);
    }
  };

  const loadAdminSettings = async () => {
    try {
      const res = await axios.get(`${API}/admin/settings`);
      setAdminSettings(prev => ({ ...prev, ...(res.data || {}) }));
    } catch (e) {
      console.error('Could not load settings', e);
    }
  };

  const saveAdminSettings = async () => {
    setSettingsSaving(true);
    try {
      const payload = {
        branding_name: adminSettings.branding_name,
        branding_mission: adminSettings.branding_mission,
        branding_vision: adminSettings.branding_vision,
        contact_email: adminSettings.contact_email
      };
      await axios.put(`${API}/admin/settings`, payload);
      await loadAdminSettings();
      alert('Settings updated.');
    } catch (e) {
      alert(e?.response?.data?.error || 'Could not save settings');
    } finally {
      setSettingsSaving(false);
    }
  };

  const loadCompanySubscriptions = async () => {
    try {
      const res = await axios.get(`${API}/admin/subscriptions`);
      setCompanySubscriptions(res.data || []);
    } catch (e) {
      console.error('Could not load subscriptions', e);
    }
  };

  const updateAdminUser = async (userId, updates) => {
    try {
      await axios.patch(`${API}/admin/users/${userId}`, updates);
      await loadAdminUsers();
      await loadAuditLogs();
    } catch (e) {
      alert(e?.response?.data?.error || 'Could not update user');
    }
  };

  const toggleAdminUserSelection = (userId) => {
    setAdminSelectedUserIds(prev => (prev.includes(userId)
      ? prev.filter(id => id !== userId)
      : [...prev, userId]
    ));
  };

  const clearAdminSelection = () => setAdminSelectedUserIds([]);

  const bulkUpdateUsers = async (action) => {
    if (!adminSelectedUserIds.length) return alert('Select at least one user.');
    try {
      await axios.post(`${API}/admin/users/bulk`, { action, user_ids: adminSelectedUserIds });
      await loadAdminUsers();
      await loadAuditLogs();
      clearAdminSelection();
    } catch (e) {
      alert(e?.response?.data?.error || 'Bulk update failed');
    }
  };

  const bulkResetUsers = async () => {
    if (!adminSelectedUserIds.length) return alert('Select at least one user.');
    try {
      const res = await axios.post(`${API}/admin/users/bulk-reset`, { user_ids: adminSelectedUserIds });
      if (res.data?.results?.length) {
        const links = res.data.results
          .map(r => r.reset_link ? `${r.email}: ${r.reset_link}` : r.email)
          .join('\n');
        alert(`Reset results:\n${links}`);
      } else {
        alert('Reset links sent.');
      }
      clearAdminSelection();
    } catch (e) {
      alert(e?.response?.data?.error || 'Bulk reset failed');
    }
  };

  const bulkMessageUsers = async () => {
    if (!adminSelectedUserIds.length) return alert('Select at least one user.');
    const subject = window.prompt('Announcement subject');
    if (!subject) return;
    const message = window.prompt('Announcement message');
    if (!message) return;
    try {
      await axios.post(`${API}/admin/users/bulk-message`, { user_ids: adminSelectedUserIds, subject, message });
      alert('Announcement sent.');
      clearAdminSelection();
    } catch (e) {
      alert(e?.response?.data?.error || 'Announcement failed');
    }
  };

  const exportUsersCsv = () => {
    const users = adminSelectedUserIds.length
      ? adminUsers.filter(u => adminSelectedUserIds.includes(u.id))
      : adminUsers;
    if (!users.length) return alert('No users to export.');
    const headers = ['id', 'username', 'email', 'role', 'status', 'student_id', 'company_id'];
    const rows = users.map(u => headers.map(h => `"${(u[h] ?? '').toString().replace(/"/g, '""')}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'users_export.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const addOpening = async () => {
    if (!openingDraft.department.trim() || !openingDraft.expectations.trim()) return;
    try {
      await axios.post(`${API}/company-openings`, {
        department: openingDraft.department.trim(),
        role_title: openingDraft.role.trim(),
        expectations: openingDraft.expectations.trim(),
        slots: openingDraft.slots.trim(),
        location: openingDraft.location.trim(),
        deadline: openingDraft.deadline
      });
      const res = await axios.get(`${API}/company-openings`);
      persistCompanyOpenings(res.data || []);
      setOpeningDraft({ department: '', role: '', expectations: '', slots: '', location: '', deadline: '' });
    } catch (e) {
      console.error('Could not add opening', e);
    }
  };

  const removeOpening = async (id) => {
    try {
      await axios.delete(`${API}/company-openings/${id}`);
      const res = await axios.get(`${API}/company-openings`);
      persistCompanyOpenings(res.data || []);
    } catch (e) {
      console.error('Could not remove opening', e);
    }
  };

  const updateInterviewField = (appId, field, value) => {
    const next = {
      ...interviewSchedule,
      [appId]: {
        ...(interviewSchedule[appId] || {}),
        [field]: value
      }
    };
    persistInterviewSchedule(next);
  };

  const saveInterviewSchedule = async (appId) => {
    const schedule = interviewSchedule[appId] || {};
    try {
      await axios.put(`${API}/company-interviews/${appId}`, {
        interview_date: schedule.date || null,
        interview_time: schedule.time || null,
        mode: schedule.mode || null,
        location: schedule.location || null
      });
    } catch (e) {
      console.error('Could not save interview schedule', e);
    }
  };

  const sendRequest = async (appId) => {
    const requestText = (requestDrafts[appId] || '').trim();
    if (!requestText) return;
    try {
      await axios.post(`${API}/applications/${appId}/request`, { request_text: requestText });
      await refreshRequests();
      setNotificationTarget('company-applications');
      setHasNotification(true);
    } catch (e) {
      console.error('Could not send request', e);
    }
  };

  const respondRequest = async (appId) => {
    const responseText = (requestResponseDrafts[appId] || '').trim();
    if (!responseText) return;
    try {
      await axios.patch(`${API}/applications/${appId}/request-response`, { response_text: responseText });
      await refreshRequests();
      setNotificationTarget('applications');
      setHasNotification(true);
    } catch (e) {
      console.error('Could not respond to request', e);
    }
  };

  const exportStats = async () => {
    try {
      const response = await axios.get(`${API}/admin/export-stats`, {
        responseType: 'blob',
        headers: { Authorization: `Bearer ${token}` }
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `placement_stats_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      console.error('Export failed', e);
      alert('Failed to export statistics.');
    }
  };

  const exportCompanyStats = async () => {
    try {
      const response = await axios.get(`${API}/company/export-stats`, {
        responseType: 'blob',
        headers: { Authorization: `Bearer ${token}` }
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `company_interns_stats_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      console.error('Export failed', e);
      alert('Failed to export company statistics.');
    }
  };

  const formatDateOnly = (value) => {
    if (!value) return '';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toLocaleDateString();
  };

  const startBotDrag = (event) => {
    const point = 'touches' in event ? event.touches[0] : event;
    setBotDragging(true);
    setBotDragOffset({
      x: point.clientX - botPosition.x,
      y: point.clientY - botPosition.y
    });
  };

  const handleBotMove = useCallback((event) => {
    if (!botDragging) return;
    const point = 'touches' in event ? event.touches[0] : event;
    const nextX = Math.max(12, Math.min(window.innerWidth - 72, point.clientX - botDragOffset.x));
    const nextY = Math.max(12, Math.min(window.innerHeight - 72, point.clientY - botDragOffset.y));
    setBotPosition({ x: nextX, y: nextY });
  }, [botDragging, botDragOffset.x, botDragOffset.y]);

  const stopBotDrag = () => {
    setBotDragging(false);
  };

  useEffect(() => {
    refreshApplications();
    refreshRequests();
  }, [refreshApplications, refreshRequests]);

  useEffect(() => {
    const fetchStudentSummary = async () => {
      if (!token || userRole !== 'student') return setStudentSummary(null);
      try {
        const res = await axios.get(`${API}/student-profile`);
        setStudentSummary(res.data || null);
      } catch (e) {
        if (e?.response?.status === 404) return setStudentSummary(null);
        console.error('could not load student summary', e.message);
      }
    };
    fetchStudentSummary();
  }, [token, userRole]);

  useEffect(() => {
    const fetchStudentInterviews = async () => {
      if (!token || userRole !== 'student') return setStudentInterviewMap({});
      try {
        const res = await axios.get(`${API}/my-interviews`);
        const map = Object.fromEntries((res.data || []).map(item => [
          item.application_id,
          {
            date: item.interview_date || '',
            time: item.interview_time || '',
            mode: item.mode || '',
            location: item.location || '',
            companyName: item.company_name || ''
          }
        ]));
        setStudentInterviewMap(map);
      } catch (e) {
        console.error('could not load interview schedule', e.message);
      }
    };
    fetchStudentInterviews();
  }, [token, userRole]);

  useEffect(() => {
    const handleMove = (event) => handleBotMove(event);
    const handleUp = () => stopBotDrag();
    if (botDragging) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
      window.addEventListener('touchmove', handleMove, { passive: true });
      window.addEventListener('touchend', handleUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [botDragging, handleBotMove]);


  /*
   * SOCKET.IO REAL-TIME UPDATES
   * Listens for backend events (new application, status change, new opening).
   * Refreshes local data to keep dashboards in sync without page reload.
   * Shows toast notifications for important events.
   */
  const socketRef = useRef(null);
  useEffect(() => {
    if (!socketRef.current) {
      socketRef.current = io(isDev ? devApiOrigin : undefined);
      socketRef.current.on('connect', () => console.log('socket connected', socketRef.current.id));
      socketRef.current.on('applications:changed', (payload) => {
        // refresh applications and lists when changed
        (async () => {
          try {
            const [appsRes, studentsRes, companiesRes, statsRes, requestsRes] = await Promise.all([
              axios.get(`${API}/applications`).catch(() => ({ data: [] })),
              axios.get(`${API}/students`).catch(() => ({ data: [] })),
              axios.get(`${API}/companies`).catch(() => ({ data: [] })),
              axios.get(`${API}/stats`).catch(() => ({ data: { rate: 0 } })),
              axios.get(`${API}/application-requests`).catch(() => ({ data: [] }))
            ]);
            setApplications(appsRes.data);
            setStudents(studentsRes.data);
            setCompanies(companiesRes.data);
            setStats(statsRes.data);
            const requestList = requestsRes.data || [];
            setApplicationRequests(requestList);
            setRequestDrafts(Object.fromEntries(requestList.map(r => [r.application_id, r.request_text || ''])));
            setRequestResponseDrafts(Object.fromEntries(requestList.map(r => [r.application_id, r.response_text || ''])));

            if (userRole === 'student') {
              const pendingRequest = requestList.some(r => !r.response_text);
              const apps = appsRes.data || [];
              if (pendingRequest) setNotificationTarget('applications');
              else if (apps.some(a => ['Rejected', 'Interviewing', 'Offer', 'Placed', 'Waitlisted'].includes(a.stage || 'Applied'))) setNotificationTarget('applications');
              else setNotificationTarget('dashboard');
            }
            if (userRole === 'company') {
              const responded = requestList.some(r => r.response_text);
              const apps = appsRes.data || [];
              if (responded) setNotificationTarget('company-applications');
              else if (apps.some(a => (a.stage || 'Applied') === 'Interviewing')) setNotificationTarget('company-applications');
              else setNotificationTarget('company-applications');
            }
            if (userRole === 'admin') {
              const changedId = payload?.application?.id || payload?.applicationId || null;
              const changedApp = changedId ? (appsRes.data || []).find(app => app.id === changedId) : null;
              const companyName = changedApp ? (companiesRes.data || []).find(c => c.id === changedApp.company_id)?.name : null;
              const studentName = changedApp ? (studentsRes.data || []).find(s => s.id === changedApp.student_id)?.full_name : null;
              const actionLabel = payload?.action ? payload.action.replace('_', ' ') : 'updated';
              pushAdminActivity({
                id: `app-${Date.now()}`,
                type: 'application',
                message: `Application ${actionLabel}${studentName ? ` for ${studentName}` : ''}${companyName ? ` at ${companyName}` : ''}`,
                ts: Date.now()
              });
            }
            setHasNotification(true);
          } catch (e) { console.error('socket handler error', e); }
        })();
      });
      socketRef.current.on('admin:changed', (payload) => {
        if (userRole === 'admin') {
          setAdminHasNotification(true);
          const entityType = payload?.entityType;
          if (entityType === 'support') setAdminNotificationTarget('complaints');
          else if (entityType === 'application') setAdminNotificationTarget('applications');
          else if (entityType === 'student' || entityType === 'student_profile') setAdminNotificationTarget('students');
          else if (entityType === 'company' || entityType === 'opening') setAdminNotificationTarget('companies');
          else setAdminNotificationTarget('audit');
          loadAuditLogs();
        }
      });
    }
    return () => { /* keep socket open while app runs */ };
  }, [loadAuditLogs, userRole]);

  useEffect(() => {
    if (!socketRef.current) return;
    const handleOpeningsChanged = (payload) => {
      if (userRole === 'student') {
        if (payload?.companyId && subscribedCompanyIds.size && !subscribedCompanyIds.has(payload.companyId)) return;
        loadOpenings();
        const companyName = memberCompanies.find(c => c.id === payload?.companyId)?.name;
        const message = companyName ? `New opening from ${companyName}` : 'New opening from a subscribed company';
        setOpeningToast(message);
        setTimeout(() => setOpeningToast(''), 3000);
        setNotificationTarget('internships');
        setHasNotification(true);
      }
      if (userRole === 'admin') {
        const companyName = companies.find(c => c.id === payload?.companyId)?.name;
        pushAdminActivity({
          id: `opening-${Date.now()}`,
          type: 'opening',
          message: `Opening ${payload?.action || 'updated'}${companyName ? ` for ${companyName}` : ''}`,
          ts: Date.now()
        });
      }
    };
    socketRef.current.on('openings:changed', handleOpeningsChanged);
    return () => {
      socketRef.current.off('openings:changed', handleOpeningsChanged);
    };
  }, [userRole, memberCompanies, companies, loadOpenings, subscribedCompanyIds]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (activeTab !== 'students' && activeTab !== 'companies') {
      setShowAddModal(false);
      return;
    }
    const data = Object.fromEntries(new FormData(e.target));
    const endpoint = activeTab === 'students' ? 'students' : 'companies';
    await axios.post(`${API}/${endpoint}`, data);
    setShowAddModal(false);
    loadData();
  };

  const getDepartmentsForCompany = (company) => {
    const industry = (company?.industry || '').toLowerCase();
    if (industry.includes('tech') || industry.includes('software') || industry.includes('it')) {
      return ['Engineering', 'Product', 'Data', 'Design'];
    }
    if (industry.includes('finance') || industry.includes('bank') || industry.includes('account')) {
      return ['Accounting', 'Investment', 'Risk', 'Operations'];
    }
    if (industry.includes('health') || industry.includes('medical')) {
      return ['Clinical', 'Research', 'Operations', 'Public Health'];
    }
    if (industry.includes('education') || industry.includes('training')) {
      return ['Teaching', 'Curriculum', 'Student Success', 'Operations'];
    }
    return ['Operations', 'Marketing', 'Human Resources', 'Customer Success'];
  };

  const hasRejectionForCompany = (companyId) => (
    applications.some(app => app.company_id === companyId && (app.stage || 'Applied') === 'Rejected')
  );

  const openApplyModal = (opening) => {
    if (!opening) return;
    if (hasRejectionForCompany(opening.company_id)) {
      alert('You cannot reapply to this company in the current cycle after a rejection.');
      return;
    }
    const existingDraft = applicationDrafts.find(d => d.opening_id === opening.id);
    setApplyOpening(opening);
    setApplyCompany({
      id: opening.company_id,
      name: opening.company_name,
      industry: opening.company_industry,
      location: opening.company_location
    });
    setApplyForm(existingDraft?.form || { why_internship: '', skills_fit: '', career_goals: '', relevant_experience: '' });
    setShowApplyModal(true);
  };

  const persistDrafts = (next) => {
    setApplicationDrafts(next);
    const draftKey = `it_drafts_${userInfo?.userId || userInfo?.username || 'student'}`;
    localStorage.setItem(draftKey, JSON.stringify(next));
  };

  const saveDraft = () => {
    if (!applyOpening || !applyCompany) return;
    const draft = {
      id: Date.now(),
      opening_id: applyOpening.id,
      company_id: applyCompany.id,
      company_name: applyCompany.name,
      department: applyOpening.department,
      role_title: applyOpening.role_title || applyOpening.department,
      created_at: new Date().toISOString(),
      form: { ...applyForm }
    };
    const next = [draft, ...applicationDrafts.filter(d => d.opening_id !== applyOpening.id)];
    persistDrafts(next);
  };

  const removeDraft = (openingId) => {
    const next = applicationDrafts.filter(d => d.opening_id !== openingId);
    persistDrafts(next);
  };

  const subscribeToCompany = async (companyId) => {
    setSubscriptionBusy(companyId);
    try {
      await axios.post(`${API}/subscriptions`, { company_id: companyId });
      await loadMemberCompanies();
      await loadOpenings();
      setNotificationTarget('internships');
      setHasNotification(true);
    } catch (e) {
      console.error('Could not subscribe', e);
      alert(e?.response?.data?.error || 'Could not subscribe');
    } finally {
      setSubscriptionBusy(null);
    }
  };

  const unsubscribeFromCompany = async (companyId) => {
    setSubscriptionBusy(companyId);
    try {
      await axios.delete(`${API}/subscriptions/${companyId}`);
      await loadMemberCompanies();
      await loadOpenings();
    } catch (e) {
      console.error('Could not unsubscribe', e);
      alert(e?.response?.data?.error || 'Could not unsubscribe');
    } finally {
      setSubscriptionBusy(null);
    }
  };

  const submitApplication = async () => {
    if (!applyOpening || !applyCompany) return;
    setApplyingCompany(applyCompany.id);
    try {
      await axios.post(`${API}/applications`, {
        company_id: applyCompany.id,
        department: applyOpening.department,
        position: applyOpening.role_title || applyOpening.department,
        ...applyForm
      });
      const res = await axios.get(`${API}/applications`);
      setApplications(res.data);
      setShowApplyModal(false);
      removeDraft(applyOpening.id);
      setApplyOpening(null);
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.error || 'Could not submit application');
    } finally {
      setApplyingCompany(null);
    }
  };

  const loadApplicantProfile = async (app) => {
    setViewingApplicant(app);
    setApplicantProfile(null);
    try {
      const res = await axios.get(`${API}/student-profile/${app.student_id}`);
      setApplicantProfile(res.data);
    } catch (e) {
      console.error('Could not load applicant profile', e);
      alert(e?.response?.data?.error || 'Could not load profile');
    }
  };

  const getCompanyDeadlineDate = (company) => {
    if (company && company.deadline) return new Date(company.deadline);
    const base = new Date();
    const offset = ((company?.id || 1) * 3) % 21;
    return new Date(base.getTime() + offset * 24 * 60 * 60 * 1000);
  };

  const getCompanyDeadline = (company) => getCompanyDeadlineDate(company).toLocaleDateString();

  const isSameDay = (a, b) => a.toDateString() === b.toDateString();

  const daysSince = (value) => {
    if (!value) return null;
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return null;
    const diff = Date.now() - dt.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const openEditApplication = (app) => {
    setEditApplication(app);
    setEditApplicationForm({
      department: app.department || '',
      why_internship: app.why_internship || '',
      skills_fit: app.skills_fit || '',
      career_goals: app.career_goals || '',
      relevant_experience: app.relevant_experience || ''
    });
  };

  const submitEditApplication = async () => {
    if (!editApplication) return;
    try {
      await axios.patch(`${API}/applications/${editApplication.id}`, editApplicationForm);
      const res = await axios.get(`${API}/applications`);
      setApplications(res.data);
      setEditApplication(null);
    } catch (e) {
      console.error('Could not update application', e);
      alert(e?.response?.data?.error || 'Could not update application');
    }
  };

  /*
   * DATA DERIVATION & FILTERING
   * Compute lists for UI rendering to avoid complex logic inside JSX.
   * - `firstName`: UI label
   * - `filteredCompanies`: for search
   * - `visibleStudentApplications`: filtering for student view
   * - `actionItems`: Tasks for the dashboard "Today's 3" widget
   */
  const displayName = (userInfo?.displayName || userInfo?.username || 'User').toString().trim();
  const firstName = displayName.split(' ')[0] || 'User';
  const openingCounts = openingsPublic.reduce((acc, opening) => {
    const key = opening.company_id;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const studentCompanyDirectory = userRole === 'student' ? memberCompanies : companies;
  const filteredMemberCompanies = userRole === 'student'
    ? memberCompanies.filter(c => {
        const needle = companySearch.trim().toLowerCase();
        if (!needle) return true;
        return (c.name || '').toLowerCase().includes(needle) || (c.industry || '').toLowerCase().includes(needle);
      })
    : [];
  const filteredCompanies = userRole === 'student'
    ? companies.filter(c => {
        const needle = companySearch.trim().toLowerCase();
        if (!needle) return true;
        return (c.name || '').toLowerCase().includes(needle) || (c.industry || '').toLowerCase().includes(needle);
      })
    : companies;
  const filteredOpenings = userRole === 'student'
    ? openingsPublic.filter(o => {
        if (subscribedCompanyIds.size && !subscribedCompanyIds.has(o.company_id)) return false;
        const needle = companySearch.trim().toLowerCase();
        if (!needle) return true;
        return [o.company_name, o.company_industry, o.department, o.role_title]
          .filter(Boolean)
          .some(value => value.toLowerCase().includes(needle));
      })
    : [];
  const studentApplications = userRole === 'student' ? applications : [];
  const visibleStudentApplications = userRole === 'student' && subscribedCompanyIds.size
    ? studentApplications.filter(a => subscribedCompanyIds.has(a.company_id))
    : studentApplications;
  const filteredStudentApplications = appStageFilter === 'All'
    ? visibleStudentApplications
    : visibleStudentApplications.filter(a => (a.stage || 'Applied') === appStageFilter);
  const appliedCompanyIds = new Set(
    visibleStudentApplications
      .filter(a => !['Placed', 'Rejected', 'Withdrawn'].includes(a.stage || 'Applied'))
      .map(a => a.company_id)
  );
  const appliedCompanies = studentCompanyDirectory.filter(c => appliedCompanyIds.has(c.id));
  const suggestedOpenings = userRole === 'student'
    ? openingsPublic.filter(o => !appliedCompanyIds.has(o.company_id))
    : [];
  const studentStageCounts = visibleStudentApplications.reduce((acc, app) => {
    const stage = app.stage || 'Applied';
    acc[stage] = (acc[stage] || 0) + 1;
    return acc;
  }, { Applied: 0, Interviewing: 0, Offer: 0, Placed: 0, Waitlisted: 0, Rejected: 0, Withdrawn: 0 });
  const studentActiveCount = visibleStudentApplications.filter(a => !['Placed', 'Rejected', 'Withdrawn'].includes(a.stage || 'Applied')).length;
  const studentCompletion = (() => {
    if (!studentSummary) return 0;
    const fields = [
      studentSummary.full_name,
      studentSummary.email_address,
      studentSummary.phone_number,
      studentSummary.school_name,
      studentSummary.degree_program,
      studentSummary.gpa_academic,
      (studentSummary.skills || []).length ? 'skills' : '',
      studentSummary.work_experience || studentSummary.volunteer_experience || studentSummary.research_projects,
      studentSummary.resume_name,
      studentSummary.linkedin_url
    ];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  })();
  const companyApplications = userRole === 'company' && userInfo?.companyId
    ? applications.filter(a => String(a.company_id) === String(userInfo.companyId) && (a.stage || 'Applied') !== 'Withdrawn')
    : [];
  const companyAppIndexMap = new Map(companyApplications.map((app, index) => [app.id, index + 1]));
  const getCompanyAppNumber = (appId) => companyAppIndexMap.get(appId) || appId;
  const getCompanyAppLabel = (appId) => `Application ${getCompanyAppNumber(appId)}`;
  const getApplicantName = (app) => app.student_name || 'Student';
  const adminApplications = userRole === 'admin'
    ? [...applications].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    : [];
  const subscriptionCountMap = companySubscriptions.reduce((acc, item) => {
    acc[item.company_id] = item.subscriber_count;
    return acc;
  }, {});
  const filteredAdminUsers = adminUsers.filter(user => {
    const roleMatch = adminUserRoleFilter === 'all' || user.role === adminUserRoleFilter;
    const statusMatch = adminUserStatusFilter === 'all' || (user.status || 'active') === adminUserStatusFilter;
    const needle = adminUserSearch.trim().toLowerCase();
    const searchMatch = !needle
      || (user.username || '').toLowerCase().includes(needle)
      || (user.email || '').toLowerCase().includes(needle);
    return roleMatch && statusMatch && searchMatch;
  });
  const filteredAuditLogs = auditLogs.filter(item => {
    const actionMatch = auditActionFilter === 'all' || item.action_type === auditActionFilter;
    const entityMatch = auditEntityFilter === 'all' || item.entity_type === auditEntityFilter;
    const needle = auditSearch.trim().toLowerCase();
    const detailText = `${item.action_type || ''} ${item.entity_type || ''} ${item.details_json || ''}`.toLowerCase();
    const searchMatch = !needle || detailText.includes(needle);
    return actionMatch && entityMatch && searchMatch;
  });
  const filteredCompanyApplications = companyStageFilter === 'All'
    ? companyApplications
    : companyApplications.filter(a => (a.stage || 'Applied') === companyStageFilter);
  const companyStageCounts = companyApplications.reduce((acc, app) => {
    const stage = app.stage || 'Applied';
    acc[stage] = (acc[stage] || 0) + 1;
    return acc;
  }, { Applied: 0, Interviewing: 0, Offer: 0, Placed: 0, Waitlisted: 0, Rejected: 0 });
  const companyActiveCount = companyApplications.filter(a => !['Placed', 'Rejected', 'Withdrawn'].includes(a.stage || 'Applied')).length;
  const companyInterviewApps = companyApplications.filter(a => (a.stage || 'Applied') === 'Interviewing');
  const companyOfferApps = companyApplications.filter(a => (a.stage || 'Applied') === 'Offer');
  const companyAcceptedApps = companyApplications.filter(a => (a.stage || 'Applied') === 'Placed');
  const companyWaitlistedApps = companyApplications.filter(a => (a.stage || 'Applied') === 'Waitlisted');
  const companyRejectedApps = companyApplications.filter(a => (a.stage || 'Applied') === 'Rejected');
  const companyActionItems = [
    ...companyInterviewApps.map(app => {
      const schedule = interviewSchedule[app.id] || {};
      const dateValue = schedule.date ? new Date(schedule.date) : getCompanyDeadlineDate({ id: app.company_id });
      return {
        id: `interview-${app.id}`,
        title: `Interview for ${getCompanyAppLabel(app.id)}`,
        detail: schedule.date ? `${schedule.date} ${schedule.time || ''}`.trim() : 'Schedule interview',
        dueDate: dateValue,
        type: 'Interview'
      };
    }),
    ...companyOfferApps.map(app => ({
      id: `offer-${app.id}`,
      title: `Offer decision for ${getCompanyAppLabel(app.id)}`,
      detail: app.department || app.position || 'Candidate',
      dueDate: getCompanyDeadlineDate({ id: app.company_id }),
      type: 'Offer'
    })),
    ...companyApplications
      .filter(app => (app.stage || 'Applied') === 'Applied')
      .slice(0, 4)
      .map(app => ({
        id: `review-${app.id}`,
        title: `Review ${getCompanyAppLabel(app.id)}`,
        detail: app.department || app.position || 'Candidate',
        dueDate: getCompanyDeadlineDate({ id: app.company_id }),
        type: 'Review'
      }))
  ]
    .sort((a, b) => a.dueDate - b.dueDate)
    .slice(0, 3);
  const companyActionCount = companyActionItems.length;
  const companyTrendDays = Array.from({ length: 7 }, (_, idx) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - idx));
    return date;
  });
  const companyTrendCounts = companyTrendDays.map(day => (
    companyApplications.filter(app => app.created_at && isSameDay(new Date(app.created_at), day)).length
  ));
  const companyTrendMax = Math.max(1, ...companyTrendCounts);
  const studentInterviewApps = visibleStudentApplications.filter(a => (a.stage || 'Applied') === 'Interviewing');
  const studentOfferApps = visibleStudentApplications.filter(a => (a.stage || 'Applied') === 'Offer');
  const studentAcceptedApps = visibleStudentApplications.filter(a => (a.stage || 'Applied') === 'Placed');
  const studentRejectedApps = visibleStudentApplications.filter(a => (a.stage || 'Applied') === 'Rejected');
  const studentWaitlistedApps = visibleStudentApplications.filter(a => (a.stage || 'Applied') === 'Waitlisted');
  const today = new Date();
  const actionItems = [
    ...applicationDrafts.map(draft => ({
      id: `draft-${draft.opening_id}`,
      title: `Finish ${draft.role_title || draft.department}`,
      company: draft.company_name,
      dueDate: getCompanyDeadlineDate({ id: draft.company_id }),
      type: 'Draft'
    })),
    ...suggestedOpenings.slice(0, 6).map(opening => ({
      id: `open-${opening.id}`,
      title: opening.role_title || opening.department,
      company: opening.company_name,
      dueDate: getCompanyDeadlineDate({ id: opening.company_id }),
      type: 'New Opening'
    })),
    ...visibleStudentApplications
      .filter(app => (app.stage || 'Applied') === 'Applied')
      .map(app => ({
        id: `app-${app.id}`,
        title: app.position || app.department || 'Application',
        company: studentCompanyDirectory.find(c => c.id === app.company_id)?.name || app.company_name || 'Unknown company',
        dueDate: getCompanyDeadlineDate({ id: app.company_id }),
        type: 'Follow up'
      }))
  ]
    .sort((a, b) => a.dueDate - b.dueDate)
    .slice(0, 3);
  const requestsByApplication = Object.fromEntries((applicationRequests || []).map(r => [r.application_id, r]));
  const billTips = [
    'Use the Internships tab to search and apply fast.',
    'Drag cards in Applications to update your stage.',
    'Complete your profile for better matches.',
    'Check deadlines in the Internships list before applying.'
  ];
  const billTip = billTips[billTipIndex % billTips.length];
  const botTopics = [
    { title: 'Openings', body: 'Search openings by company, department, or role. Tap Apply to submit an application.' },
    { title: 'Applications', body: 'Track every application, edit your answers, and see stage changes in real time.' },
    { title: 'Interviews', body: 'When an interview is scheduled, the date, time, and location appear here and on your cards.' },
    { title: 'Offers', body: 'Offers appear after interviews. Check details and look for updates from the company.' },
    { title: 'Accepted', body: 'Accepted internships are grouped here for quick reference.' },
    { title: 'Profile', body: 'Keep your profile complete for stronger matches. Upload your documents once and lock it.' }
  ];
  const botResults = botQuery.trim()
    ? botTopics.filter(topic => `${topic.title} ${topic.body}`.toLowerCase().includes(botQuery.trim().toLowerCase()))
    : [];
  const dashboardBorder = '#cbd5e1';
  const dashboardMuted = '#1f2937';
  const adminOverview = {
    totalStudents: students.length,
    totalCompanies: companies.length,
    totalApplications: typeof stats.total === 'number' ? stats.total : applications.length,
    placementRate: stats.rate || 0,
    offersMade: stats.placed || 0
  };
  const adminMission = adminSettings.branding_mission || 'Connect students to real-world internships through transparent pipelines, proactive support, and accountable partnerships.';
  const adminVision = adminSettings.branding_vision || 'A campus-to-career network where every student discovers opportunities early, progresses with clarity, and graduates with confidence.';
  const studentGpaValues = students
    .map(s => Number(s.gpa))
    .filter(value => !Number.isNaN(value));
  const studentAvgGpa = studentGpaValues.length
    ? (studentGpaValues.reduce((sum, value) => sum + value, 0) / studentGpaValues.length).toFixed(2)
    : 'N/A';
  const studentMajorCounts = students.reduce((acc, student) => {
    const key = (student.major || 'Undeclared').trim() || 'Undeclared';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const topStudentMajor = Object.entries(studentMajorCounts)
    .sort((a, b) => b[1] - a[1])
    .map(entry => `${entry[0]} (${entry[1]})`)[0] || 'N/A';
  const totalOpenings = companies.reduce((sum, company) => sum + (Number(company.openings) || 0), 0);
  const companyIndustryCounts = companies.reduce((acc, company) => {
    const key = (company.industry || 'Unspecified').trim() || 'Unspecified';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const topCompanyIndustry = Object.entries(companyIndustryCounts)
    .sort((a, b) => b[1] - a[1])
    .map(entry => `${entry[0]} (${entry[1]})`)[0] || 'N/A';

  /*
   * RENDER: VIEW ROUTER (LANDING PAGE)
   * The entry point for non-authenticated users.
   */
  // 1. LANDING VIEW (Centered & Blue)
  if (view === 'landing') {
    return (
      <div style={styles.centeredPage}>
        <div style={{ backgroundColor: '#2563eb', padding: '20px', borderRadius: '25px', marginBottom: '30px', boxShadow: '0 0 40px rgba(37,99,235,0.4)' }}>
          <Briefcase size={60} />
        </div>
        <h1 style={{ fontSize: '4.5rem', fontWeight: '900', fontStyle: 'italic', margin: '0 0 10px 0' }}>Internship <span style={{ color: '#3b82f6' }}>Tracker</span></h1>
        <p style={{ color: '#94a3b8', fontSize: '1.2rem', marginBottom: '50px' }}>Identify your account type to proceed</p>
        <div style={{ display: 'flex', gap: '20px' }}>
          <button onClick={() => { setAuthView('register'); setView('auth'); }} className="bg-blue-600 hover:bg-blue-500 text-white font-black px-12 py-4 rounded-2xl uppercase tracking-widest text-xs border-none cursor-pointer">First Time User</button>
          <button onClick={() => { setAuthView('login'); setView('auth'); }} style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} className="text-slate-300 font-black px-12 py-4 rounded-2xl uppercase tracking-widest text-xs cursor-pointer">Sign In</button>
        </div>
      </div>
    );
  }

  /*
   * RENDER: VIEW ROUTER (ROLE SELECTION)
   * User chooses Student vs Company flow.
   */
  // 2. ROLE SELECTION (Professional Avatars)
  if (view === 'role-select') {
    return (
      <div style={{ ...styles.centeredPage, backgroundColor: '#f8fafc', color: '#0f172a' }}>
        <h2 style={{ fontSize: '2.5rem', fontWeight: '900', marginBottom: '60px', fontStyle: 'italic' }}>Choose Portal</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '30px', maxWidth: '900px', width: '90%' }}>
          {[
            { id: 'company', label: 'Partner', icon: <Building size={40} />, color: '#2563eb', bg: '#eff6ff' },
            { id: 'student', label: 'Student', icon: <GraduationCap size={40} />, color: '#059669', bg: '#ecfdf5' }
          ].map(role => (
            <button key={role.id} onClick={() => { setUserRole(role.id); setView('main'); }} style={styles.card}>
              <div style={{ color: role.color, backgroundColor: role.bg, width: '70px', height: '70px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>{role.icon}</div>
              <h4 style={{ fontSize: '1.6rem', fontWeight: '900', margin: '0 0 8px 0' }}>{role.label}</h4>
              <p style={{ color: '#2563eb', fontWeight: '900', fontSize: '0.75rem', margin: 0 }}>ENTER <ArrowRight size={14} style={{ verticalAlign: 'middle' }} /></p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // AUTH VIEW (login/register)
  if (view === 'auth') {
    return (
      <div style={styles.centeredPage}>
        <div style={{ backgroundColor: '#ffffff', padding: '30px', borderRadius: '20px', color: '#0f172a', width: 420 }}>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: 10 }}>
            {adminLoginMode && authView === 'login' ? 'Admin Sign In' : authView === 'login' ? 'Sign In' : authView === 'register' ? 'Register' : authView === 'forgot' ? 'Reset Password' : 'Set New Password'}
          </h3>
          <AuthForm view={authView} resetToken={resetToken} adminOnly={adminLoginMode} onSwitch={(v) => setAuthView(v)} onSuccess={(data) => {
            clearSessionState();
            setToken(data.token);
            setUserRole(data.user.role);
            setUserInfo(data.user || null);
            if (data.user?.role === 'company' && !data.user.companyId) {
              setView('create-profile-company');
            } else {
              setView('main');
            }
          }} onError={(e) => setAuthError(e)} />
          {authError && <p style={{ color: 'red' }}>{authError}</p>}
        </div>
      </div>
    );
  }

  if (view === 'create-profile-company') {
    return (
      <div style={styles.centeredPage}>
        <div style={{ backgroundColor: '#ffffff', padding: '30px', borderRadius: '20px', color: '#0f172a' }}>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: 10 }}>Create Company Profile</h3>
          <CompanyProfileForm submitLabel="Create Profile" onCreated={async (company) => { await loadData(); setUserInfo(prev => ({ ...(prev||{}), displayName: company.name, companyId: company.id })); setView('main'); }} />
        </div>
      </div>
    );
  }

  if (view === 'admin-setup') {
    return (
      <div style={styles.centeredPage}>
        <div style={{ backgroundColor: '#ffffff', padding: '30px', borderRadius: '20px', color: '#0f172a', width: 420, maxWidth: '90vw' }}>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: 10 }}>Admin Setup</h3>
          <div style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>
            This private setup screen is only for creating the first admin account.
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            <input placeholder="Admin email" value={adminSetupEmail} onChange={e => setAdminSetupEmail(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
            <input placeholder="Admin password" type="password" value={adminSetupPassword} onChange={e => setAdminSetupPassword(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
            <input placeholder="Setup token" value={adminSetupToken} onChange={e => setAdminSetupToken(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
            {adminSetupMessage && <div style={{ fontSize: 12, color: adminSetupMessage.toLowerCase().includes('created') ? '#16a34a' : '#dc2626' }}>{adminSetupMessage}</div>}
            <button onClick={submitAdminSetup} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '10px 12px', borderRadius: 10, fontWeight: 700 }}>Create Admin</button>
            <button onClick={() => { setView('landing'); }} style={{ background: 'transparent', border: '1px solid #e2e8f0', padding: '10px 12px', borderRadius: 10 }}>Back</button>
          </div>
        </div>
      </div>
    );
  }

  /*
   * RENDER: MAIN APPLICATION
   * Authenticated view with Sidebar and Role-Based Tabs.
   * Renders sidebar based on `userRole`.
   * Renders content area based on `activeTab`.
   */
  // 3. MAIN APP
  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#f1f5f9', fontFamily: 'Poppins, "Segoe UI", sans-serif' }}>
      <aside style={{ width: '300px', backgroundColor: '#0f172a', color: 'white', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '40px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Briefcase color="#3b82f6" /> <h1 style={{ fontSize: '1.2rem', fontWeight: '900' }}>InternConnect</h1>
        </div>
        <nav style={{ flex: 1, padding: '20px' }}>
          {(() => {
            const tabsForRole = userRole === 'admin'
              ? [
                  { id: 'overview', label: 'Overview' },
                  { id: 'users', label: 'Users' },
                  { id: 'students', label: 'Students' },
                  { id: 'companies', label: 'Companies' },
                  { id: 'applications', label: 'Applications' },
                  { id: 'complaints', label: 'Complaints' },
                  { id: 'audit', label: 'Audit Log' },
                  { id: 'settings', label: 'Settings' }
                ]
              : (userRole === 'company'
                ? [
                    { id: 'dashboard', label: 'Dashboard' },
                    { id: 'company-profile', label: 'Profile' },
                    { id: 'openings', label: 'Openings' },
                    { id: 'company-applications', label: 'Applications' },
                    { id: 'support', label: 'Support' }
                  ]
                : (userRole === 'student'
                  ? [
                      { id: 'dashboard', label: 'Dashboard' },
                      { id: 'profile', label: 'My Profile' },
                      { id: 'member-companies', label: 'Member Companies' },
                      { id: 'internships', label: 'Openings' },
                      { id: 'applications', label: 'Applications' },
                      { id: 'support', label: 'Support' }
                    ]
                  : [
                      { id: 'dashboard', label: 'Dashboard' },
                      { id: 'companies', label: 'Companies' }
                    ]));
            return tabsForRole.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  width: '100%',
                  padding: '15px',
                  backgroundColor: activeTab === tab.id ? '#2563eb' : 'transparent',
                  color: 'white',
                  border: 'none',
                  borderRadius: '15px',
                  marginBottom: '10px',
                  textAlign: 'left',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <span>{tab.label.toUpperCase()}</span>
                {userRole === 'company' && tab.id === 'dashboard' && companyActionCount > 0 && (
                  <span style={{ background: '#f59e0b', color: '#0f172a', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 800 }}>TODAY {companyActionCount}</span>
                )}
              </button>
            ));
          })()}
        </nav>
        <button onClick={handleLogout} style={{ padding: '30px', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>LOGOUT</button>
      </aside>

      <main style={{ flex: 1, padding: '50px', display: 'flex', flexDirection: 'column', alignItems: 'center', overflowY: 'auto' }}>
        <div style={{ maxWidth: '900px', width: '100%' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: '900' }}>Hello, {firstName}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {userRole === 'admin' && (
                <button
                  onClick={() => {
                    setActiveTab(adminNotificationTarget || 'overview');
                    markAdminAlertsSeen();
                  }}
                  style={{
                    position: 'relative',
                    background: adminHasNotification ? 'rgba(239,68,68,0.08)' : 'white',
                    border: adminHasNotification ? '1px solid #ef4444' : '1px solid #e2e8f0',
                    color: '#0f172a',
                    padding: '8px 12px',
                    borderRadius: 12,
                    cursor: 'pointer',
                    boxShadow: adminHasNotification ? '0 0 12px rgba(239,68,68,0.6)' : 'none'
                  }}
                  aria-label="Admin alerts"
                >
                  Alerts
                  {adminHasNotification && (
                    <span style={{ position: 'absolute', top: -6, right: -6, width: 12, height: 12, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 10px rgba(239,68,68,0.8)' }} />
                  )}
                </button>
              )}
              {(userRole === 'student' || userRole === 'company') && (
                <button
                  onClick={() => { setActiveTab(notificationTarget); setHasNotification(false); }}
                  style={{
                    position: 'relative',
                    background: hasNotification ? 'rgba(239,68,68,0.1)' : 'white',
                    border: hasNotification ? '1px solid #ef4444' : '1px solid #e2e8f0',
                    color: '#0f172a',
                    padding: '8px 12px',
                    borderRadius: 12,
                    cursor: 'pointer',
                    boxShadow: hasNotification ? '0 0 12px rgba(239,68,68,0.6)' : 'none'
                  }}
                  aria-label="Notifications"
                >
                  Notifications
                  {hasNotification && (
                    <span style={{ position: 'absolute', top: -6, right: -6, width: 12, height: 12, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 10px rgba(239,68,68,0.8)' }} />
                  )}
                </button>
              )}
              {(userRole === 'student' || userRole === 'company') && (
                <button
                  onClick={() => setShowSupportModal(true)}
                  style={{
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    color: '#0f172a',
                    padding: '8px 12px',
                    borderRadius: 12,
                    cursor: 'pointer'
                  }}
                >
                  Support
                </button>
              )}
              {(userRole === 'student' || userRole === 'company') && (
                <div style={{ fontSize: 12, color: '#64748b' }}>Admin: {adminSettings.contact_email || ADMIN_CONTACT_EMAIL}</div>
              )}
              {userRole === 'admin' && (activeTab === 'students' || activeTab === 'companies') && (
                <button onClick={() => setShowAddModal(true)} style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', padding: '10px 25px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>+ ADD NEW</button>
              )}
            </div>
          </header>

          {activeTab === 'overview' && userRole === 'admin' && (
            /*
             * RENDER: ADMIN DASHBOARD (Overview)
             * Displays system-wide metrics.
             * Only visible to users with role='admin'.
             */
            <div style={{ display: 'grid', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                {[
                  { label: 'Total Students', value: adminOverview.totalStudents, color: '#2563eb' },
                  { label: 'Total Companies', value: adminOverview.totalCompanies, color: '#0f172a' },
                  { label: 'Applications', value: adminOverview.totalApplications, color: '#7c3aed' },
                  { label: 'Placement Rate', value: `${adminOverview.placementRate}%`, color: '#16a34a' }
                ].map(card => (
                  <div key={card.label} style={{ backgroundColor: 'white', padding: 20, borderRadius: 20, textAlign: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                    <div style={{ color: '#94a3b8', fontWeight: 800, fontSize: 12, textTransform: 'uppercase' }}>{card.label}</div>
                    <div style={{ fontSize: '2.2rem', color: card.color, fontWeight: 900, marginTop: 8 }}>{card.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: 'white', padding: 24, borderRadius: 22, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#64748b', fontWeight: 800 }}>Overview</div>
                  <button onClick={exportStats} style={{ background: '#0f172a', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FileText size={16} /> Export Report
                  </button>
                </div>
                <h3 style={{ margin: '8px 0 10px 0' }}>{adminSettings.branding_name || 'Internship Tracker'}</h3>
                <div style={{ color: '#475569', lineHeight: 1.6 }}>
                  A single place to measure internship readiness, monitor application health, and keep stakeholders aligned from outreach to placement.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginTop: 16 }}>
                  <div style={{ background: '#f8fafc', borderRadius: 16, padding: 16, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>Mission</div>
                    <div style={{ color: '#475569', fontSize: 14 }}>{adminMission}</div>
                  </div>
                  <div style={{ background: '#f8fafc', borderRadius: 16, padding: 16, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>Vision</div>
                    <div style={{ color: '#475569', fontSize: 14 }}>{adminVision}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'dashboard' && userRole === 'company' && (
            /*
             * RENDER: COMPANY DASHBOARD
             * Applicant metrics, upcoming interview schedule, recent applications.
             * Only visible to users with role='company'.
             */
            <div style={{ display: 'grid', gap: 20 }}>
              <div style={{ background: 'linear-gradient(135deg, #1d4ed8, #0f172a)', color: '#0f172a', padding: 24, borderRadius: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.15), transparent 45%), radial-gradient(circle at 85% 0%, rgba(255,255,255,0.1), transparent 45%)' }}>
                <div>
                  <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#0f172a' }}>Company Dashboard</div>
                  <h3 style={{ fontSize: '2rem', margin: '6px 0' }}>Applicant flow at a glance</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                    <span style={{ background: 'rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: 999, fontSize: 12, color: '#0f172a' }}>Total Applicants: {companyApplications.length}</span>
                    <span style={{ background: 'rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: 999, fontSize: 12, color: '#0f172a' }}>Subscribers: {companySubscriberCount}</span>
                    <span style={{ background: 'rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: 999, fontSize: 12, color: '#0f172a' }}>In Progress: {companyActiveCount}</span>
                    <span style={{ background: 'rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: 999, fontSize: 12, color: '#0f172a' }}>Rejected: {companyStageCounts.Rejected}</span>
                  </div>
                  <button onClick={exportCompanyStats} style={{ marginTop: 12, background: 'rgba(255,255,255,0.25)', color: '#0f172a', border: 'none', padding: '8px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                    <FileText size={16} /> Export Acceptance Report (CSV)
                  </button>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.12)', padding: 16, borderRadius: 16, minWidth: 160, color: '#0f172a' }}>
                  <div style={{ fontWeight: 800, marginBottom: 4 }}>Active Pipeline</div>
                  <div style={{ fontSize: 32, fontWeight: 900 }}>{companyActiveCount}</div>
                  <div style={{ fontSize: 12, color: '#0f172a' }}>Students in motion</div>
                </div>
              </div>

              <div style={{ background: 'white', padding: 16, borderRadius: 16, border: `1px solid ${dashboardBorder}`, color: '#0f172a' }}>
                <div style={{ fontWeight: 800, marginBottom: 10 }}>Today’s 3</div>
                {companyActionItems.length === 0 && (
                  <div style={{ color: dashboardMuted }}>No urgent actions today. Keep your pipeline moving.</div>
                )}
                <div style={{ display: 'grid', gap: 8 }}>
                  {companyActionItems.map(item => {
                    const isToday = isSameDay(item.dueDate, today);
                    return (
                      <div key={item.id} style={{ border: `1px solid ${isToday ? '#f59e0b' : dashboardBorder}`, borderRadius: 12, padding: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{item.title}</div>
                          <div style={{ fontSize: 12, color: dashboardMuted }}>{item.detail} • {item.type}</div>
                        </div>
                        <div style={{ fontSize: 12, color: isToday ? '#b45309' : dashboardMuted }}>
                          Due {item.dueDate.toLocaleDateString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                {[
                  { label: 'Applied', count: companyStageCounts.Applied, tone: '#6366f1' },
                  { label: 'Interview', count: companyStageCounts.Interviewing, tone: '#0ea5e9' },
                  { label: 'Offer Extended', count: companyStageCounts.Offer, tone: '#f59e0b' },
                  { label: 'Accepted', count: companyStageCounts.Placed, tone: '#16a34a' },
                  { label: 'Waitlisted', count: companyStageCounts.Waitlisted, tone: '#7c3aed' },
                  { label: 'Rejected', count: companyStageCounts.Rejected, tone: '#ef4444' }
                ].map(card => (
                  <div key={card.label} style={{ background: 'white', padding: 16, borderRadius: 14, borderTop: `4px solid ${card.tone}`, color: '#0f172a' }}>
                    <div style={{ color: dashboardMuted, fontSize: 12 }}>{card.label}</div>
                    <div style={{ fontWeight: 900, fontSize: 26 }}>{card.count}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: 'white', padding: 16, borderRadius: 16, border: `1px solid ${dashboardBorder}`, color: '#0f172a' }}>
                <div style={{ fontWeight: 800, marginBottom: 10 }}>Last 7 days</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, alignItems: 'end', minHeight: 80 }}>
                  {companyTrendDays.map((day, idx) => (
                    <div key={day.toISOString()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: '100%', height: Math.max(6, Math.round((companyTrendCounts[idx] / companyTrendMax) * 56)), background: '#93c5fd', borderRadius: 6 }} />
                      <div style={{ fontSize: 10, color: dashboardMuted }}>{day.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2)}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: 'white', padding: 20, borderRadius: 16, color: '#0f172a' }}>
                <div style={{ fontWeight: 800, marginBottom: 12 }}>Recent Applications</div>
                {companyApplications.length === 0 && (
                  <div style={{ color: dashboardMuted, padding: 16, textAlign: 'center' }}>No applications yet. Share your openings to attract candidates.</div>
                )}
                <div style={{ display: 'grid', gap: 10 }}>
                  {companyApplications.slice(0, 5).map(app => (
                    <div key={`company-recent-${app.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${dashboardBorder}`, borderRadius: 12, padding: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{getApplicantName(app)}</div>
                        <div style={{ color: dashboardMuted, fontSize: 12 }}>{app.department || app.position || 'General'} • {getCompanyAppLabel(app.id)}</div>
                      </div>
                      <StageBadge stage={app.stage || 'Applied'} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'dashboard' && userRole === 'student' && (
            /*
             * RENDER: STUDENT DASHBOARD
             * Profile completeness, applications by stage, upcoming deadlines.
             * Only visible to users with role='student'.
             */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {openingToast && (
                <div style={{ background: '#ecfeff', border: '1px solid #a5f3fc', color: '#155e75', padding: 12, borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700 }}>{openingToast}</div>
                  <button onClick={() => setActiveTab('internships')} style={{ background: '#0ea5e9', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 8 }}>View Opening</button>
                </div>
              )}
              <div style={{ background: 'linear-gradient(135deg, #2563eb, #0f172a)', color: '#0f172a', padding: 24, borderRadius: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.15), transparent 45%), radial-gradient(circle at 80% 0%, rgba(255,255,255,0.1), transparent 45%)' }}>
                <div style={{ flex: '1 1 280px' }}>
                  <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#0f172a' }}>Student Dashboard</div>
                  <h3 style={{ fontSize: '2rem', margin: '6px 0', color: '#0f172a' }}>Welcome back, {userInfo?.username || firstName} 👋</h3>
                  <div style={{ color: '#0f172a' }}>Profile completion: {studentCompletion}%</div>
                  <div style={{ height: 8, background: 'rgba(255,255,255,0.2)', borderRadius: 999, overflow: 'hidden', marginTop: 8, maxWidth: 280 }}>
                    <div style={{ width: `${studentCompletion}%`, height: '100%', background: studentCompletion >= 100 ? '#16a34a' : '#93c5fd' }} />
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.1)', padding: 12, borderRadius: 12, color: '#0f172a', flex: '1 1 200px', maxWidth: 260 }}>
                  <div style={{ fontWeight: 800 }}>{studentCompletion >= 100 ? 'Verified Candidate' : 'Leveling Up'}</div>
                  <div style={{ fontSize: 12, color: '#0f172a' }}>Profile visible</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {[
                  { label: 'Applied', count: studentStageCounts.Applied, tone: '#6366f1' },
                  { label: 'Interview', count: studentStageCounts.Interviewing, tone: '#0ea5e9' },
                  { label: 'Offer', count: studentStageCounts.Offer, tone: '#f59e0b' },
                  { label: 'Accepted', count: studentStageCounts.Placed, tone: '#16a34a' },
                  { label: 'Waitlisted', count: studentStageCounts.Waitlisted, tone: '#7c3aed' },
                  { label: 'Rejected', count: studentStageCounts.Rejected, tone: '#ef4444' },
                  { label: 'Withdrawn', count: studentStageCounts.Withdrawn, tone: '#64748b' }
                ].map(chip => (
                  <div key={chip.label} style={{ background: 'white', border: `1px solid ${chip.tone}`, color: '#0f172a', padding: '6px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                    {chip.label}: {chip.count}
                  </div>
                ))}
              </div>

              <div style={{ background: 'white', padding: 16, borderRadius: 16, border: `1px solid ${dashboardBorder}` }}>
                <div style={{ fontWeight: 800, marginBottom: 10 }}>Today’s 3</div>
                {actionItems.length === 0 && (
                  <div style={{ color: dashboardMuted }}>No urgent actions today. Keep your momentum going.</div>
                )}
                <div style={{ display: 'grid', gap: 8 }}>
                  {actionItems.map(item => {
                    const isToday = isSameDay(item.dueDate, today);
                    return (
                      <div key={item.id} style={{ border: `1px solid ${isToday ? '#f59e0b' : dashboardBorder}`, borderRadius: 12, padding: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{item.title}</div>
                          <div style={{ fontSize: 12, color: dashboardMuted }}>{item.company} • {item.type}</div>
                        </div>
                        <div style={{ fontSize: 12, color: isToday ? '#b45309' : dashboardMuted }}>
                          Due {item.dueDate.toLocaleDateString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                <div style={{ background: 'white', padding: 16, borderRadius: 14, color: '#0f172a' }}>
                  <div style={{ color: dashboardMuted, fontSize: 12 }}>Applications Sent</div>
                  <div style={{ fontWeight: 900, fontSize: 24 }}>{studentActiveCount}</div>
                </div>
                <div style={{ background: 'white', padding: 16, borderRadius: 14, color: '#0f172a' }}>
                  <div style={{ color: dashboardMuted, fontSize: 12 }}>Upcoming Deadlines</div>
                  <div style={{ fontWeight: 900, fontSize: 24 }}>{appliedCompanies.length}</div>
                </div>
                <div style={{ background: 'white', padding: 16, borderRadius: 14, color: '#0f172a' }}>
                  <div style={{ color: dashboardMuted, fontSize: 12 }}>Interviews</div>
                  <div style={{ fontWeight: 900, fontSize: 24 }}>{visibleStudentApplications.filter(a => a.stage === 'Interviewing').length}</div>
                </div>
                <div style={{ background: 'white', padding: 16, borderRadius: 14, color: '#0f172a' }}>
                  <div style={{ color: dashboardMuted, fontSize: 12 }}>Offers</div>
                  <div style={{ fontWeight: 900, fontSize: 24 }}>{visibleStudentApplications.filter(a => a.stage === 'Offer').length}</div>
                </div>
                <div style={{ background: 'white', padding: 16, borderRadius: 14, color: '#0f172a' }}>
                  <div style={{ color: dashboardMuted, fontSize: 12 }}>Rejected</div>
                  <div style={{ fontWeight: 900, fontSize: 24 }}>{studentRejectedApps.length}</div>
                </div>
              </div>

              <div style={{ background: 'white', padding: 20, borderRadius: 16, color: '#0f172a' }}>
                <div style={{ fontWeight: 800, marginBottom: 12 }}>Applied Companies</div>
                {visibleStudentApplications.length === 0 && (
                  <div style={{ color: dashboardMuted, padding: 20, textAlign: 'center' }}>
                    You haven’t applied yet 🚀 Start your first application.
                  </div>
                )}
                <div style={{ display: 'grid', gap: 12 }}>
                  {visibleStudentApplications.map(app => {
                    const company = studentCompanyDirectory.find(c => c.id === app.company_id);
                    const submittedDate = formatDateOnly(app.created_at);
                    const deadlineDate = getCompanyDeadline(company || {});
                    const deadlineObj = getCompanyDeadlineDate(company || {});
                    const isTodayDeadline = isSameDay(deadlineObj, today);
                    return (
                      <div key={app.id} style={{ border: `1px solid ${isTodayDeadline ? '#f59e0b' : dashboardBorder}`, borderRadius: 12, padding: 12, display: 'grid', gap: 8, boxShadow: isTodayDeadline ? '0 0 0 2px rgba(245, 158, 11, 0.15)' : 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontWeight: 700 }}>{company?.name || app.company_name || 'Unknown company'}</div>
                          <StageBadge stage={app.stage || 'Applied'} />
                        </div>
                        <div style={{ color: dashboardMuted, fontSize: 13 }}>Department: {app.department || app.position || 'General'}</div>
                        <div style={{ color: dashboardMuted, fontSize: 12 }}>{submittedDate ? `Submitted: ${submittedDate}` : `Deadline: ${deadlineDate}`}</div>
                        {isTodayDeadline && <div style={{ color: '#b45309', fontSize: 12, fontWeight: 700 }}>Action due today</div>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ background: 'white', padding: 20, borderRadius: 16, color: '#0f172a' }}>
                <div style={{ fontWeight: 800, marginBottom: 12 }}>Applications In Progress</div>
                {applicationDrafts.length === 0 && (
                  <div style={{ color: dashboardMuted, padding: 16, textAlign: 'center' }}>No draft applications yet.</div>
                )}
                <div style={{ display: 'grid', gap: 10 }}>
                  {applicationDrafts.map(draft => {
                    const deadlineDate = getCompanyDeadline({ id: draft.company_id });
                    const deadlineObj = getCompanyDeadlineDate({ id: draft.company_id });
                    const isTodayDeadline = isSameDay(deadlineObj, today);
                    return (
                      <div key={`draft-${draft.opening_id}`} style={{ border: `1px solid ${isTodayDeadline ? '#f97316' : dashboardBorder}`, borderRadius: 12, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{draft.company_name}</div>
                          <div style={{ color: dashboardMuted, fontSize: 12 }}>{draft.department} • {draft.role_title}</div>
                          <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fee2e2', color: '#b91c1c', padding: '4px 8px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                            Submit before {deadlineDate}
                          </div>
                          {isTodayDeadline && <div style={{ marginTop: 6, color: '#c2410c', fontSize: 12, fontWeight: 700 }}>Due today</div>}
                        </div>
                        <button onClick={() => openApplyModal(openingsPublic.find(o => o.id === draft.opening_id) || null)} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 8 }}>Continue</button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ background: 'white', padding: 20, borderRadius: 16, color: '#0f172a' }}>
                <div style={{ fontWeight: 800, marginBottom: 12 }}>Recently Announced Openings</div>
                <div style={{ display: 'grid', gap: 10 }}>
                  {(openingsPublic.slice(0, 4)).map(opening => {
                    const isRejected = hasRejectionForCompany(opening.company_id);
                    return (
                    <div key={opening.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${dashboardBorder}`, borderRadius: 12, padding: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{opening.company_name}</div>
                        <div style={{ color: dashboardMuted, fontSize: 13 }}>{opening.department} • {opening.role_title || 'Internship'}</div>
                        <div style={{ color: dashboardMuted, fontSize: 12 }}>Deadline: {getCompanyDeadline({ id: opening.company_id })}</div>
                      </div>
                      <button
                        onClick={() => openApplyModal(opening)}
                        disabled={isRejected}
                        style={{ background: isRejected ? '#cbd5f5' : '#111827', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 8, cursor: isRejected ? 'not-allowed' : 'pointer' }}
                      >
                        {isRejected ? 'Rejected' : 'Apply'}
                      </button>
                    </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'profile' && userRole === 'student' && (
            <div style={{ marginTop: 20 }}>
              <h3>Student Profile Section (Upload Once)</h3>
              <StudentExtendedProfile
                studentKey={userInfo?.studentId || userInfo?.username || 'student'}
                onLinked={({ studentId, displayName }) => {
                  setUserInfo(prev => ({ ...(prev || {}), studentId, displayName: displayName || prev?.displayName }));
                }}
              />
            </div>
          )}

          {activeTab === 'member-companies' && userRole === 'student' && (
            <div style={{ marginTop: 20, display: 'grid', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Building2 size={20} color="#2563eb" />
                <h3 style={{ margin: 0 }}>Member Companies</h3>
              </div>
              <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 700 }}>Choose companies to follow</div>
                <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>You will get notified when new slots open. You can only apply to companies you follow.</div>
              </div>
              <div>
                <input
                  placeholder="Search companies or industries..."
                  value={companySearch}
                  onChange={(e) => setCompanySearch(e.target.value)}
                  style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0' }}
                />
              </div>
              {memberCompaniesLoading && <div style={{ color: '#64748b' }}>Loading member companies...</div>}
              {!memberCompaniesLoading && filteredMemberCompanies.length === 0 && (
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, color: '#64748b', textAlign: 'center' }}>No companies found yet.</div>
              )}
              <div style={{ display: 'grid', gap: 12 }}>
                {filteredMemberCompanies.map(company => (
                  <div key={`member-${company.id}`} style={{ background: 'white', padding: 16, borderRadius: 14, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{company.name}</div>
                      <div style={{ color: '#64748b', fontSize: 12 }}>{company.industry || 'Industry'} • {company.location || 'Location TBD'}</div>
                      {(company.overview || company.mission || company.vision) && (
                        <div style={{ marginTop: 8, background: '#f8fafc', border: '1px solid #e2e8f0', padding: 10, borderRadius: 10, fontSize: 12, color: '#0f172a' }}>
                          {company.overview && <div><strong>What they do:</strong> {summarizeText(company.overview, 120)}</div>}
                          {company.mission && <div><strong>Mission:</strong> {summarizeText(company.mission, 120)}</div>}
                          {company.vision && <div><strong>Vision:</strong> {summarizeText(company.vision, 120)}</div>}
                        </div>
                      )}
                      <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '4px 8px', borderRadius: 999, fontSize: 12 }}>
                          Openings: {openingCounts[company.id] ?? (company.openings || 0)}
                        </span>
                        {company.subscribed && (
                          <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: 999, fontSize: 12 }}>
                            Subscribed
                          </span>
                        )}
                      </div>
                      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {getDepartmentsForCompany(company).map(dep => (
                          <span key={dep} style={{ background: '#e2e8f0', padding: '4px 8px', borderRadius: 999, fontSize: 12 }}>{dep}</span>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {company.subscribed ? (
                        <button
                          onClick={() => unsubscribeFromCompany(company.id)}
                          disabled={subscriptionBusy === company.id}
                          style={{ background: 'white', color: '#ef4444', border: '1px solid #fecaca', padding: '8px 12px', borderRadius: 8, cursor: subscriptionBusy === company.id ? 'default' : 'pointer' }}
                        >
                          {subscriptionBusy === company.id ? 'Updating...' : 'Unsubscribe'}
                        </button>
                      ) : (
                        <button
                          onClick={() => subscribeToCompany(company.id)}
                          disabled={subscriptionBusy === company.id}
                          style={{ background: '#2563eb', color: 'white', border: 'none', padding: '8px 12px', borderRadius: 8, cursor: subscriptionBusy === company.id ? 'default' : 'pointer' }}
                        >
                          {subscriptionBusy === company.id ? 'Subscribing...' : 'Subscribe'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'company-profile' && userRole === 'company' && (
            <div style={{ marginTop: 20, display: 'grid', gap: 16 }}>
              <h3 style={{ marginBottom: 4 }}>Company Profile</h3>
              <div style={{ background: '#f8fafc', padding: 16, borderRadius: 14, border: '1px dashed #cbd5f5' }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Profile overview</div>
                <div style={{ color: '#64748b', fontSize: 13, marginBottom: 8 }}>Update your profile details so applicants can trust your brand.</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#e0f2fe', color: '#075985', padding: '4px 8px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                  Subscribed students: {companySubscriberCount}
                </div>
              </div>
              {companyProfileLoading && <div style={{ color: '#64748b' }}>Loading profile...</div>}
              {!companyProfileLoading && companyProfile && (
                <CompanyProfileForm
                  initialData={companyProfile}
                  submitLabel="Save Profile"
                  onSaved={async () => {
                    if (userInfo?.companyId) {
                      try {
                        const res = await axios.get(`${API}/companies/${userInfo.companyId}`);
                        setCompanyProfile(res.data || null);
                        setUserInfo(prev => ({ ...(prev || {}), displayName: res.data?.name || prev?.displayName }));
                        await loadData();
                      } catch (e) {
                        console.error('Could not refresh company profile', e);
                      }
                    }
                  }}
                />
              )}
              {!companyProfileLoading && !companyProfile && (
                <div style={{ background: '#fff7ed', padding: 16, borderRadius: 12, color: '#9a3412' }}>Profile details are unavailable right now. Refresh or try again later.</div>
              )}
            </div>
          )}

          {activeTab === 'openings' && userRole === 'company' && (
            <div style={{ marginTop: 20, display: 'grid', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <ClipboardList size={20} color="#2563eb" />
                <h3 style={{ margin: 0 }}>Internship Openings</h3>
              </div>
              <div style={{ background: 'white', padding: 16, borderRadius: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 10 }}>Create a new opening</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  <input placeholder="Department" value={openingDraft.department} onChange={(e) => setOpeningDraft(prev => ({ ...prev, department: e.target.value }))} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <input placeholder="Role / Title" value={openingDraft.role} onChange={(e) => setOpeningDraft(prev => ({ ...prev, role: e.target.value }))} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <input placeholder="Slots (optional)" value={openingDraft.slots} onChange={(e) => setOpeningDraft(prev => ({ ...prev, slots: e.target.value }))} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <input placeholder="Location (optional)" value={openingDraft.location} onChange={(e) => setOpeningDraft(prev => ({ ...prev, location: e.target.value }))} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <input type="date" placeholder="Deadline" value={openingDraft.deadline} onChange={(e) => setOpeningDraft(prev => ({ ...prev, deadline: e.target.value }))} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <textarea placeholder="Expectations (skills, projects, goals)" value={openingDraft.expectations} onChange={(e) => setOpeningDraft(prev => ({ ...prev, expectations: e.target.value }))} style={{ gridColumn: '1 / -1', minHeight: 90, padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                </div>
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={addOpening} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '8px 14px', borderRadius: 8 }}>Add Opening</button>
                </div>
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                {companyOpenings.length === 0 && (
                  <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, color: '#64748b', textAlign: 'center' }}>No openings yet. Add a department to get started.</div>
                )}
                {companyOpenings.map(opening => (
                  <div key={opening.id} style={{ background: 'white', padding: 16, borderRadius: 14, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 800 }}>{opening.department}</div>
                        <div style={{ color: '#64748b', fontSize: 12 }}>{opening.role_title || 'Internship opening'}</div>
                      </div>
                      <button onClick={() => removeOpening(opening.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}>Remove</button>
                    </div>
                    <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {opening.slots && <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '4px 8px', borderRadius: 999, fontSize: 12 }}>{opening.slots} slots</span>}
                      {opening.location && <span style={{ background: '#f1f5f9', color: '#0f172a', padding: '4px 8px', borderRadius: 999, fontSize: 12 }}>{opening.location}</span>}
                    </div>
                    <div style={{ marginTop: 10, color: '#0f172a' }}>{opening.expectations}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'company-applications' && userRole === 'company' && (
            <div style={{ marginTop: 20, display: 'grid', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <FileText size={20} color="#2563eb" />
                <h3 style={{ margin: 0 }}>Applications</h3>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {['All', 'Applied', 'Interviewing', 'Offer', 'Placed', 'Waitlisted', 'Rejected', 'Withdrawn'].map(stage => (
                  <button
                    key={stage}
                    onClick={() => setCompanyStageFilter(stage)}
                    style={{
                      background: companyStageFilter === stage ? '#0f172a' : 'white',
                      color: companyStageFilter === stage ? 'white' : '#0f172a',
                      border: '1px solid #e2e8f0',
                      padding: '6px 10px',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {stage}
                  </button>
                ))}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  <button onClick={() => setCompanyAppViewMode('cards')} style={{ background: companyAppViewMode === 'cards' ? '#2563eb' : 'white', color: companyAppViewMode === 'cards' ? 'white' : '#0f172a', border: '1px solid #e2e8f0', padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>Cards</button>
                  <button onClick={() => setCompanyAppViewMode('compact')} style={{ background: companyAppViewMode === 'compact' ? '#2563eb' : 'white', color: companyAppViewMode === 'compact' ? 'white' : '#0f172a', border: '1px solid #e2e8f0', padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>Compact</button>
                </div>
              </div>
              {filteredCompanyApplications.length === 0 && (
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, color: '#64748b', textAlign: 'center' }}>No applications yet.</div>
              )}
              <div style={{ display: 'grid', gap: 12 }}>
                {filteredCompanyApplications.map(app => {
                  const stage = app.stage || 'Applied';
                  const nextStage = getNextStage(stage);
                  const nextLabel = getStageActionLabel(stage);
                  const request = requestsByApplication[app.id];
                  const ageDays = daysSince(app.created_at);
                  const faded = typeof ageDays === 'number' && ageDays > 14;
                  if (companyAppViewMode === 'compact') {
                    return (
                      <div key={`company-app-${app.id}`} style={{ background: 'white', padding: '10px 12px', borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: faded ? 0.6 : 1 }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{getApplicantName(app)}</div>
                          <div style={{ color: '#64748b', fontSize: 13 }}>{app.role_title}</div>
                        </div>
                        <div>
                           <span style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, background: getStageMeta(stage).bg, color: getStageMeta(stage).color, fontWeight: 700 }}>{getStageMeta(stage).label}</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={`company-app-${app.id}`} style={{ background: 'white', padding: 20, borderRadius: 20, border: '1px solid #e2e8f0', opacity: faded ? 0.7 : 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 18, fontWeight: 800 }}>{getApplicantName(app)}</div>
                          <div style={{ color: '#64748b' }}>{app.role_title}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, background: getStageMeta(stage).bg, color: getStageMeta(stage).color, fontWeight: 700 }}>{getStageMeta(stage).label}</span>
                          {faded && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{ageDays}d ago</div>}
                        </div>
                      </div>
                      <div>
                        {request?.response_text && (
                          <div style={{ marginTop: 8, background: 'white', borderRadius: 8, padding: 8, border: '1px solid #fde68a', color: '#7c2d12' }}>
                            <strong>Student response:</strong> {request.response_text}
                          </div>
                        )}
                        <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                          <button onClick={() => sendRequest(app.id)} style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 8 }}>Send Request</button>
                          {request?.response_text && <span style={{ color: '#16a34a', fontWeight: 700 }}>Student responded</span>}
                        </div>
                      </div>
                      <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        <button onClick={() => loadApplicantProfile(app)} style={{ background: '#0f172a', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 8 }}>View Profile & Documents</button>
                        {nextStage && (
                          <button onClick={() => updateApplicationStage(app, nextStage)} style={{ background: '#10b981', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 8 }}>{nextLabel}</button>
                        )}
                        {stage !== 'Waitlisted' && stage !== 'Rejected' && stage !== 'Placed' && (
                          <button onClick={() => updateApplicationStage(app, 'Waitlisted')} style={{ background: '#7c3aed', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 8 }}>Waitlist</button>
                        )}
                        {stage !== 'Rejected' && (
                          <button onClick={() => updateApplicationStage(app, 'Rejected')} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 8 }}>Reject</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {companyRejectedApps.length > 0 && (
                <div style={{ background: '#fff1f2', padding: 14, borderRadius: 12, border: '1px solid #fecdd3' }}>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Rejected</div>
                  <div style={{ color: '#b91c1c', fontSize: 13 }}>{companyRejectedApps.length} applications are currently rejected.</div>
                </div>
              )}
              <div style={{ marginTop: 10, display: 'grid', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CalendarDays size={20} color="#2563eb" />
                  <h3 style={{ margin: 0 }}>Interviews</h3>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                  <button onClick={() => setCompanyAppViewMode('cards')} style={{ background: companyAppViewMode === 'cards' ? '#2563eb' : 'white', color: companyAppViewMode === 'cards' ? 'white' : '#0f172a', border: '1px solid #e2e8f0', padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>Cards</button>
                  <button onClick={() => setCompanyAppViewMode('compact')} style={{ background: companyAppViewMode === 'compact' ? '#2563eb' : 'white', color: companyAppViewMode === 'compact' ? 'white' : '#0f172a', border: '1px solid #e2e8f0', padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>Compact</button>
                </div>
                {companyInterviewApps.length === 0 && (
                  <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, color: '#64748b', textAlign: 'center' }}>No students are in the interview stage yet.</div>
                )}
                <div style={{ display: 'grid', gap: 12 }}>
                  {companyInterviewApps.map(app => {
                    const schedule = interviewSchedule[app.id] || {};
                    if (companyAppViewMode === 'compact') {
                      return (
                        <div key={`interview-${app.id}`} style={{ background: 'white', padding: '10px 12px', borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 700 }}>{getApplicantName(app)}</div>
                            <div style={{ color: '#64748b', fontSize: 12 }}>{app.department || app.position || 'General'}</div>
                          </div>
                          <StageBadge stage="Interviewing" />
                        </div>
                      );
                    }
                    return (
                      <div key={`interview-${app.id}`} style={{ background: 'white', padding: 16, borderRadius: 14, border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 800 }}>{getApplicantName(app)}</div>
                            <div style={{ color: '#64748b', fontSize: 12 }}>{app.department || app.position || 'General'} • {getCompanyAppLabel(app.id)}</div>
                          </div>
                          <StageBadge stage="Interviewing" />
                        </div>
                        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                          <input type="date" value={schedule.date || ''} onChange={(e) => updateInterviewField(app.id, 'date', e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                          <input type="time" value={schedule.time || ''} onChange={(e) => updateInterviewField(app.id, 'time', e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                          <input placeholder="Mode (Zoom, On-site)" value={schedule.mode || ''} onChange={(e) => updateInterviewField(app.id, 'mode', e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                          <input placeholder="Location / Link" value={schedule.location || ''} onChange={(e) => updateInterviewField(app.id, 'location', e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                        </div>
                        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button onClick={() => saveInterviewSchedule(app.id)} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 8 }}>Save Schedule</button>
                          <button onClick={() => updateApplicationStage(app, 'Offer')} style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 8 }}>Extend Offer</button>
                          <button onClick={() => updateApplicationStage(app, 'Rejected')} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 8 }}>Reject</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'offers' && userRole === 'company' && (
            <div style={{ marginTop: 20, display: 'grid', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <BadgeCheck size={20} color="#f59e0b" />
                <h3 style={{ margin: 0 }}>Offer Extended</h3>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                <button onClick={() => setCompanyAppViewMode('cards')} style={{ background: companyAppViewMode === 'cards' ? '#2563eb' : 'white', color: companyAppViewMode === 'cards' ? 'white' : '#0f172a', border: '1px solid #e2e8f0', padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>Cards</button>
                <button onClick={() => setCompanyAppViewMode('compact')} style={{ background: companyAppViewMode === 'compact' ? '#2563eb' : 'white', color: companyAppViewMode === 'compact' ? 'white' : '#0f172a', border: '1px solid #e2e8f0', padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>Compact</button>
              </div>
              {companyOfferApps.length === 0 && (
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, color: '#64748b', textAlign: 'center' }}>No offers extended yet.</div>
              )}
              <div style={{ display: 'grid', gap: 12 }}>
                {companyOfferApps.map(app => (
                  companyAppViewMode === 'compact' ? (
                    <div key={`offer-${app.id}`} style={{ background: 'white', padding: '10px 12px', borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{getApplicantName(app)}</div>
                        <div style={{ color: '#64748b', fontSize: 12 }}>{app.department || app.position || 'General'}</div>
                      </div>
                      <StageBadge stage="Offer" />
                    </div>
                  ) : (
                  <div key={`offer-${app.id}`} style={{ background: 'white', padding: 16, borderRadius: 14, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 800 }}>{getApplicantName(app)}</div>
                        <div style={{ color: '#64748b', fontSize: 12 }}>{app.department || app.position || 'General'} • {getCompanyAppLabel(app.id)}</div>
                      </div>
                      <StageBadge stage="Offer" />
                    </div>
                    <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button onClick={() => updateApplicationStage(app, 'Placed')} style={{ background: '#16a34a', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 8 }}>Mark Accepted</button>
                      <button onClick={() => updateApplicationStage(app, 'Rejected')} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 8 }}>Reject</button>
                    </div>
                  </div>
                  )
                ))}
              </div>
            </div>
          )}

          {activeTab === 'accepted' && userRole === 'company' && (
            <div style={{ marginTop: 20, display: 'grid', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <BadgeCheck size={20} color="#16a34a" />
                <h3 style={{ margin: 0 }}>Accepted</h3>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                <button onClick={() => setCompanyAppViewMode('cards')} style={{ background: companyAppViewMode === 'cards' ? '#2563eb' : 'white', color: companyAppViewMode === 'cards' ? 'white' : '#0f172a', border: '1px solid #e2e8f0', padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>Cards</button>
                <button onClick={() => setCompanyAppViewMode('compact')} style={{ background: companyAppViewMode === 'compact' ? '#2563eb' : 'white', color: companyAppViewMode === 'compact' ? 'white' : '#0f172a', border: '1px solid #e2e8f0', padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>Compact</button>
              </div>
              {companyAcceptedApps.length === 0 && (
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, color: '#64748b', textAlign: 'center' }}>No accepted students yet.</div>
              )}
              <div style={{ display: 'grid', gap: 12 }}>
                {companyAcceptedApps.map(app => (
                  companyAppViewMode === 'compact' ? (
                    <div key={`accepted-${app.id}`} style={{ background: 'white', padding: '10px 12px', borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{getApplicantName(app)}</div>
                        <div style={{ color: '#64748b', fontSize: 12 }}>{app.department || app.position || 'General'}</div>
                      </div>
                      <StageBadge stage="Placed" />
                    </div>
                  ) : (
                    <div key={`accepted-${app.id}`} style={{ background: 'white', padding: 16, borderRadius: 14, border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 800 }}>{getApplicantName(app)}</div>
                          <div style={{ color: '#64748b', fontSize: 12 }}>{app.department || app.position || 'General'} • {getCompanyAppLabel(app.id)}</div>
                        </div>
                        <StageBadge stage="Placed" />
                      </div>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}

          {activeTab === 'waitlisted' && userRole === 'company' && (
            <div style={{ marginTop: 20, display: 'grid', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <ClipboardList size={20} color="#7c3aed" />
                <h3 style={{ margin: 0 }}>Waitlisted</h3>
              </div>
              {companyWaitlistedApps.length === 0 && (
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, color: '#64748b', textAlign: 'center' }}>No waitlisted applicants right now.</div>
              )}
              <div style={{ display: 'grid', gap: 12 }}>
                {companyWaitlistedApps.map(app => (
                  companyAppViewMode === 'compact' ? (
                    <div key={`waitlisted-${app.id}`} style={{ background: 'white', padding: '10px 12px', borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{getApplicantName(app)}</div>
                        <div style={{ color: '#64748b', fontSize: 12 }}>{app.department || app.position || 'General'}</div>
                      </div>
                      <StageBadge stage="Waitlisted" />
                    </div>
                  ) : (
                    <div key={`waitlisted-${app.id}`} style={{ background: 'white', padding: 16, borderRadius: 14, border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 800 }}>{getApplicantName(app)}</div>
                          <div style={{ color: '#64748b', fontSize: 12 }}>{app.department || app.position || 'General'} • {getCompanyAppLabel(app.id)}</div>
                        </div>
                        <StageBadge stage="Waitlisted" />
                      </div>
                      <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button onClick={() => updateApplicationStage(app, 'Interviewing')} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 8 }}>Move to Interview</button>
                        <button onClick={() => updateApplicationStage(app, 'Rejected')} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 8 }}>Reject</button>
                      </div>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}

          {activeTab === 'rejected' && userRole === 'company' && (
            <div style={{ marginTop: 20, display: 'grid', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <X size={20} color="#ef4444" />
                <h3 style={{ margin: 0 }}>Rejected</h3>
              </div>
              {companyRejectedApps.length === 0 && (
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, color: '#64748b', textAlign: 'center' }}>No rejected applications.</div>
              )}
              <div style={{ display: 'grid', gap: 12 }}>
                {companyRejectedApps.map(app => (
                  companyAppViewMode === 'compact' ? (
                    <div key={`rejected-${app.id}`} style={{ background: 'white', padding: '10px 12px', borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{getApplicantName(app)}</div>
                        <div style={{ color: '#64748b', fontSize: 12 }}>{app.department || app.position || 'General'}</div>
                      </div>
                      <StageBadge stage="Rejected" />
                    </div>
                  ) : (
                    <div key={`rejected-${app.id}`} style={{ background: 'white', padding: 16, borderRadius: 14, border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 800 }}>{getApplicantName(app)}</div>
                          <div style={{ color: '#64748b', fontSize: 12 }}>{app.department || app.position || 'General'} • {getCompanyAppLabel(app.id)}</div>
                        </div>
                        <StageBadge stage="Rejected" />
                      </div>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}

          {activeTab === 'applications' && userRole === 'student' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20 }}>
              <h3>Applications</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {['All', 'Applied', 'Interviewing', 'Offer', 'Placed', 'Waitlisted', 'Rejected', 'Withdrawn'].map(stage => (
                  <button
                    key={stage}
                    onClick={() => setAppStageFilter(stage)}
                    style={{
                      background: appStageFilter === stage ? '#0f172a' : 'white',
                      color: appStageFilter === stage ? 'white' : '#0f172a',
                      border: '1px solid #e2e8f0',
                      padding: '6px 10px',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {stage}
                  </button>
                ))}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  <button onClick={() => setAppViewMode('cards')} style={{ background: appViewMode === 'cards' ? '#2563eb' : 'white', color: appViewMode === 'cards' ? 'white' : '#0f172a', border: '1px solid #e2e8f0', padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>Cards</button>
                  <button onClick={() => setAppViewMode('compact')} style={{ background: appViewMode === 'compact' ? '#2563eb' : 'white', color: appViewMode === 'compact' ? 'white' : '#0f172a', border: '1px solid #e2e8f0', padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>Compact</button>
                </div>
              </div>
              {applicationDrafts.length > 0 && (
                <div style={{ background: '#fff7ed', padding: 16, borderRadius: 12, border: '1px solid #fed7aa' }}>
                  <div style={{ fontWeight: 800, marginBottom: 8, color: '#9a3412' }}>Draft Applications</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {applicationDrafts.map(draft => (
                      <div key={`draft-tab-${draft.opening_id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: 10, borderRadius: 10, border: '1px solid #fde68a' }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{draft.company_name}</div>
                          <div style={{ color: '#64748b', fontSize: 12 }}>{draft.department} • {draft.role_title}</div>
                          <div style={{ color: '#b91c1c', fontSize: 12, fontWeight: 700 }}>Submit before {getCompanyDeadline({ id: draft.company_id })}</div>
                        </div>
                        <button onClick={() => openApplyModal(openingsPublic.find(o => o.id === draft.opening_id) || null)} style={{ background: '#f97316', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 8 }}>Continue</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(appStageFilter === 'All' || appStageFilter === 'Applied' || appStageFilter === 'Withdrawn') && filteredStudentApplications.length === 0 && (
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, color: '#64748b', textAlign: 'center' }}>
                  No applications in this stage. Try another filter or apply to a new opening.
                  <div style={{ marginTop: 10 }}>
                    <button onClick={() => setActiveTab('internships')} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 8 }}>Browse Openings</button>
                  </div>
                </div>
              )}
              {(appStageFilter === 'All' || appStageFilter === 'Applied' || appStageFilter === 'Withdrawn') && (
                <div style={{ display: 'grid', gap: 12 }}>
                  {filteredStudentApplications.map(app => {
                  const company = studentCompanyDirectory.find(c => c.id === app.company_id);
                  const request = requestsByApplication[app.id];
                  const ageDays = daysSince(app.created_at);
                  const faded = typeof ageDays === 'number' && ageDays > 14;
                  if (appViewMode === 'compact') {
                    return (
                      <div key={`student-app-${app.id}`} style={{ background: 'white', padding: '10px 12px', borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: faded ? 0.6 : 1 }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{company?.name || app.company_name || 'Unknown company'}</div>
                          <div style={{ color: '#64748b', fontSize: 12 }}>{app.department || app.position || 'General'} • {ageDays !== null ? `Last touched ${ageDays}d ago` : 'Updated recently'}</div>
                        </div>
                        <StageBadge stage={app.stage || 'Applied'} />
                      </div>
                    );
                  }
                  return (
                    <div key={`student-app-${app.id}`} style={{ background: 'white', padding: 16, borderRadius: 14, border: '1px solid #e2e8f0', opacity: faded ? 0.6 : 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 800 }}>{company?.name || app.company_name || 'Unknown company'}</div>
                          <div style={{ color: '#64748b', fontSize: 12 }}>{app.department || app.position || 'General'} • Application #{app.id}</div>
                        </div>
                        <StageBadge stage={app.stage || 'Applied'} />
                      </div>
                      {typeof ageDays === 'number' && (
                        <div style={{ marginTop: 8, fontSize: 12, color: faded ? '#94a3b8' : '#64748b' }}>Last touched {ageDays} day{ageDays === 1 ? '' : 's'} ago</div>
                      )}
                      <div style={{ marginTop: 10, display: 'grid', gap: 6, color: '#0f172a' }}>
                        <div><strong>Why internship:</strong> {summarizeText(app.why_internship)}</div>
                        <div><strong>Skills fit:</strong> {summarizeText(app.skills_fit)}</div>
                        <div><strong>Career goals:</strong> {summarizeText(app.career_goals)}</div>
                        <div><strong>Experience:</strong> {summarizeText(app.relevant_experience)}</div>
                      </div>
                      {request && (
                        <div style={{ marginTop: 12, background: '#fff7ed', borderRadius: 12, padding: 12, border: '1px solid #fed7aa' }}>
                          <div style={{ fontWeight: 700, color: '#9a3412', marginBottom: 6 }}>Additional details requested</div>
                          <div style={{ color: '#7c2d12', fontSize: 13 }}>{request.request_text}</div>
                          <textarea
                            placeholder="Write your response to the company..."
                            value={requestResponseDrafts[app.id] ?? ''}
                            onChange={(e) => setRequestResponseDrafts(prev => ({ ...prev, [app.id]: e.target.value }))}
                            style={{ width: '100%', marginTop: 10, minHeight: 80, padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}
                          />
                          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                            <button onClick={() => respondRequest(app.id)} style={{ background: '#f97316', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 8 }}>Send Response</button>
                            {request.response_text && <span style={{ color: '#16a34a', fontWeight: 700 }}>Response sent</span>}
                          </div>
                        </div>
                      )}
                      <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        <button onClick={() => openEditApplication(app)} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 8 }}>Edit Application</button>
                        {app.stage !== 'Withdrawn' && (
                          <button onClick={() => updateApplicationStage(app, 'Withdrawn')} style={{ background: '#0f172a', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 8 }}>Withdraw</button>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
              {(appStageFilter === 'All' || appStageFilter === 'Interviewing') && (
                <div style={{ display: 'grid', gap: 16, marginTop: 20 }}>
                <h3>Interviews</h3>
                {studentInterviewApps.length === 0 && (
                  <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, color: '#64748b', textAlign: 'center' }}>No interview invites yet.</div>
                )}
                <div style={{ display: 'grid', gap: 12 }}>
                  {studentInterviewApps.map(app => {
                    const interview = studentInterviewMap[app.id] || {};
                    const company = studentCompanyDirectory.find(c => c.id === app.company_id);
                    return (
                      <div key={`student-interview-${app.id}`} style={{ background: 'white', padding: 16, borderRadius: 14, border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 800 }}>{company?.name || app.company_name || 'Unknown company'}</div>
                            <div style={{ color: '#64748b', fontSize: 12 }}>{app.department || app.position || 'General'}</div>
                          </div>
                          <StageBadge stage="Interviewing" />
                        </div>
                        <div style={{ marginTop: 10, background: '#eef2ff', padding: 10, borderRadius: 10, color: '#312e81' }}>
                          {interview.date || 'TBD'} {interview.time ? `• ${interview.time}` : ''} {interview.mode ? `• ${interview.mode}` : ''} {interview.location ? `• ${interview.location}` : ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              )}

              {(appStageFilter === 'All' || appStageFilter === 'Offer') && (
                <div style={{ display: 'grid', gap: 16, marginTop: 20 }}>
                <h3>Offer Extended</h3>
                {studentOfferApps.length === 0 && (
                  <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, color: '#64748b', textAlign: 'center' }}>No offers yet.</div>
                )}
                <div style={{ display: 'grid', gap: 12 }}>
                  {studentOfferApps.map(app => {
                    const company = studentCompanyDirectory.find(c => c.id === app.company_id);
                    return (
                      <div key={`student-offer-${app.id}`} style={{ background: 'white', padding: 16, borderRadius: 14, border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 800 }}>{company?.name || app.company_name || 'Unknown company'}</div>
                            <div style={{ color: '#64748b', fontSize: 12 }}>{app.department || app.position || 'General'}</div>
                          </div>
                          <StageBadge stage="Offer" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              )}

              {(appStageFilter === 'All' || appStageFilter === 'Placed') && (
                <div style={{ display: 'grid', gap: 16, marginTop: 20 }}>
                <h3>Accepted</h3>
                {studentAcceptedApps.length === 0 && (
                  <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, color: '#64748b', textAlign: 'center' }}>No accepted internships yet.</div>
                )}
                <div style={{ display: 'grid', gap: 12 }}>
                  {studentAcceptedApps.map(app => {
                    const company = studentCompanyDirectory.find(c => c.id === app.company_id);
                    return (
                      <div key={`student-accepted-${app.id}`} style={{ background: 'white', padding: 16, borderRadius: 14, border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 800 }}>{company?.name || app.company_name || 'Unknown company'}</div>
                            <div style={{ color: '#64748b', fontSize: 12 }}>{app.department || app.position || 'General'}</div>
                          </div>
                          <StageBadge stage="Placed" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              )}

              {(appStageFilter === 'All' || appStageFilter === 'Waitlisted') && (
                <div style={{ display: 'grid', gap: 16, marginTop: 20 }}>
                <h3>Waitlisted</h3>
                <div style={{ background: '#eef2ff', padding: 16, borderRadius: 12, border: '1px solid #c7d2fe', color: '#312e81' }}>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>What waitlisted means</div>
                  <div style={{ fontSize: 13 }}>
                    Waitlisted means the company is interested, but timing or capacity is limited right now. Your application stays active and may move forward if a spot opens or priorities shift. Keep your profile updated and check back for any follow-up requests.
                  </div>
                </div>
                {studentWaitlistedApps.length === 0 && (
                  <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, color: '#64748b', textAlign: 'center' }}>No waitlisted applications yet.</div>
                )}
                <div style={{ display: 'grid', gap: 12 }}>
                  {studentWaitlistedApps.map(app => {
                    const company = studentCompanyDirectory.find(c => c.id === app.company_id);
                    return (
                      <div key={`student-waitlisted-${app.id}`} style={{ background: 'white', padding: 16, borderRadius: 14, border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 800 }}>{company?.name || app.company_name || 'Unknown company'}</div>
                            <div style={{ color: '#64748b', fontSize: 12 }}>{app.department || app.position || 'General'}</div>
                          </div>
                          <StageBadge stage="Waitlisted" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              )}

              {(appStageFilter === 'All' || appStageFilter === 'Rejected') && (
                <div style={{ display: 'grid', gap: 16, marginTop: 20 }}>
                <h3>Rejected</h3>
                <div style={{ background: '#fff7ed', padding: 16, borderRadius: 12, border: '1px solid #fed7aa', color: '#7c2d12' }}>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>A note from our partner companies</div>
                  <div style={{ fontSize: 13 }}>
                    We know a rejection can feel discouraging, but it does not define your potential. Your effort, growth, and persistence matter. Keep learning and refining your story — the right opportunity is still ahead, and we are rooting for you.
                  </div>
                </div>
                {studentRejectedApps.length === 0 && (
                  <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, color: '#64748b', textAlign: 'center' }}>No rejected applications. Keep going!</div>
                )}
                <div style={{ display: 'grid', gap: 12 }}>
                  {studentRejectedApps.map(app => {
                    const company = studentCompanyDirectory.find(c => c.id === app.company_id);
                    return (
                      <div key={`student-rejected-${app.id}`} style={{ background: 'white', padding: 16, borderRadius: 14, border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 800 }}>{company?.name || app.company_name || 'Unknown company'}</div>
                            <div style={{ color: '#64748b', fontSize: 12 }}>{app.department || app.position || 'General'}</div>
                          </div>
                          <StageBadge stage="Rejected" />
                        </div>
                        <div style={{ marginTop: 10, color: '#64748b', fontSize: 12 }}>Consider refining your resume or tailoring your answers before the next application.</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              )}
            </div>
          )}

          {activeTab === 'support' && (userRole === 'student' || userRole === 'company') && (
            <div style={{ display: 'grid', gap: 16, marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>Support</h3>
                <button onClick={() => setShowSupportModal(true)} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '8px 12px', borderRadius: 8 }}>New Issue</button>
              </div>
              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Admin contact</div>
                <div style={{ color: '#64748b', fontSize: 13 }}>{adminSettings.contact_email || ADMIN_CONTACT_EMAIL}</div>
              </div>
              {supportToast && (
                <div style={{ background: '#ecfeff', border: '1px solid #a5f3fc', color: '#155e75', padding: 12, borderRadius: 12 }}>{supportToast}</div>
              )}
              {supportLoading && <div style={{ color: '#64748b' }}>Loading support tickets...</div>}
              {!supportLoading && supportTickets.length === 0 && (
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, color: '#64748b', textAlign: 'center' }}>No support tickets yet.</div>
              )}
              <div style={{ display: 'grid', gap: 12 }}>
                {supportTickets.map(ticket => (
                  <div key={ticket.id} style={{ background: 'white', padding: 16, borderRadius: 14, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 800 }}>{ticket.subject}</div>
                        <div style={{ color: '#64748b', fontSize: 12 }}>Status: {ticket.status || 'open'}</div>
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{new Date(ticket.created_at).toLocaleString()}</div>
                    </div>
                    <div style={{ marginTop: 10, color: '#0f172a' }}>{ticket.message}</div>
                    {ticket.admin_reply && (
                      <div style={{ marginTop: 12, background: '#eef2ff', padding: 12, borderRadius: 10, border: '1px solid #c7d2fe' }}>
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>Admin reply</div>
                        <div style={{ color: '#312e81' }}>{ticket.admin_reply}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'complaints' && userRole === 'admin' && (
            <div style={{ display: 'grid', gap: 16, marginTop: 20 }}>
              <h3>Complaints Inbox</h3>
              {supportLoading && <div style={{ color: '#64748b' }}>Loading support tickets...</div>}
              {!supportLoading && supportTickets.length === 0 && (
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, color: '#64748b', textAlign: 'center' }}>No complaints yet.</div>
              )}
              <div style={{ display: 'grid', gap: 12 }}>
                {supportTickets.map(ticket => (
                  <div key={ticket.id} style={{ background: 'white', padding: 16, borderRadius: 14, border: `1px solid ${ticket.status === 'closed' ? '#bbf7d0' : ticket.status === 'answered' ? '#bfdbfe' : '#e2e8f0'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 800 }}>{ticket.subject}</div>
                        <div style={{ color: '#64748b', fontSize: 12 }}>From: {ticket.user_role} • User #{ticket.user_id} • {new Date(ticket.created_at).toLocaleString()}</div>
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        <span style={{ padding: '4px 8px', borderRadius: 999, background: ticket.status === 'closed' ? '#dcfce7' : ticket.status === 'answered' ? '#dbeafe' : '#f8fafc', color: ticket.status === 'closed' ? '#166534' : ticket.status === 'answered' ? '#1d4ed8' : '#334155', fontWeight: 700 }}>
                          {(ticket.status || 'open').toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div style={{ marginTop: 10, color: '#0f172a' }}>{ticket.message}</div>
                    <textarea
                      placeholder="Write a reply..."
                      value={supportReplyDrafts[ticket.id] ?? ''}
                      onChange={(e) => setSupportReplyDrafts(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                      style={{ width: '100%', marginTop: 10, minHeight: 70, padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    />
                    <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => replySupportTicket(ticket.id, 'answered')}
                        disabled={ticket.status === 'answered' || ticket.status === 'closed'}
                        style={{ background: ticket.status === 'answered' ? '#94a3b8' : '#2563eb', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 8, cursor: ticket.status === 'answered' || ticket.status === 'closed' ? 'not-allowed' : 'pointer' }}
                      >
                        {ticket.status === 'answered' ? 'Sent' : 'Send Reply'}
                      </button>
                      <button
                        onClick={() => replySupportTicket(ticket.id, 'closed')}
                        disabled={ticket.status === 'closed'}
                        style={{ background: ticket.status === 'closed' ? '#16a34a' : '#0f172a', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 8, cursor: ticket.status === 'closed' ? 'not-allowed' : 'pointer' }}
                      >
                        {ticket.status === 'closed' ? 'Closed' : 'Reply & Close'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'users' && userRole === 'admin' && (
            <div style={{ display: 'grid', gap: 16, marginTop: 20 }}>
              <h3>Users</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
                <input
                  placeholder="Search username or email"
                  value={adminUserSearch}
                  onChange={(e) => setAdminUserSearch(e.target.value)}
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <select value={adminUserRoleFilter} onChange={(e) => setAdminUserRoleFilter(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <option value="all">All roles</option>
                  <option value="student">Student</option>
                  <option value="company">Company</option>
                  <option value="admin">Admin</option>
                </select>
                <select value={adminUserStatusFilter} onChange={(e) => setAdminUserStatusFilter(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <option value="all">All status</option>
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>{adminSelectedUserIds.length} selected</div>
                <button onClick={() => bulkUpdateUsers('enable')} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 8 }}>Enable</button>
                <button onClick={() => bulkUpdateUsers('disable')} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 8 }}>Disable</button>
                <button onClick={bulkResetUsers} style={{ background: '#0f172a', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 8 }}>Send Reset</button>
                <button onClick={bulkMessageUsers} style={{ background: '#f97316', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 8 }}>Send Message</button>
                <button onClick={exportUsersCsv} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#0f172a', padding: '6px 10px', borderRadius: 8 }}>Export CSV</button>
                <button onClick={clearAdminSelection} style={{ background: 'transparent', border: '1px solid #e2e8f0', color: '#64748b', padding: '6px 10px', borderRadius: 8 }}>Clear</button>
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                {filteredAdminUsers.map(user => (
                  <div key={user.id} style={{ background: 'white', borderRadius: 12, padding: 12, border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'auto 2fr 1fr 1fr 1fr auto', gap: 10, alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={adminSelectedUserIds.includes(user.id)}
                      onChange={() => toggleAdminUserSelection(user.id)}
                    />
                    <div>
                      <div style={{ fontWeight: 800 }}>{user.username || user.email || `User #${user.id}`}</div>
                      <div style={{ color: '#64748b', fontSize: 12 }}>{user.email || 'No email'} • ID {user.id}</div>
                    </div>
                    <select
                      value={user.role || 'student'}
                      onChange={(e) => updateAdminUser(user.id, { role: e.target.value })}
                      style={{ padding: 8, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    >
                      <option value="student">Student</option>
                      <option value="company">Company</option>
                      <option value="admin">Admin</option>
                    </select>
                    <select
                      value={user.status || 'active'}
                      onChange={(e) => updateAdminUser(user.id, { status: e.target.value })}
                      style={{ padding: 8, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    >
                      <option value="active">Active</option>
                      <option value="pending">Pending</option>
                      <option value="disabled">Disabled</option>
                    </select>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      {user.student_id ? `Student #${user.student_id}` : user.company_id ? `Company #${user.company_id}` : 'Unlinked'}
                    </div>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button onClick={() => adminSendReset(user.email)} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#0f172a', padding: '6px 10px', borderRadius: 8 }}>Reset</button>
                      <button
                        onClick={async () => {
                          const ok = window.confirm('Delete this user and all linked records? This cannot be undone.');
                          if (!ok) return;
                          try {
                            await axios.delete(`${API}/admin/users/${user.id}`);
                            await loadAdminUsers();
                            await loadAuditLogs();
                            await loadData();
                            clearAdminSelection();
                          } catch (e) {
                            alert(e?.response?.data?.error || 'Could not delete user');
                          }
                        }}
                        style={{ background: '#ef4444', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 8 }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'audit' && userRole === 'admin' && (
            <div style={{ display: 'grid', gap: 16, marginTop: 20 }}>
              <h3>Audit Log</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
                <input
                  placeholder="Search activity"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <select value={auditActionFilter} onChange={(e) => setAuditActionFilter(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <option value="all">All actions</option>
                  {[...new Set(auditLogs.map(l => l.action_type).filter(Boolean))].map(action => (
                    <option key={action} value={action}>{action}</option>
                  ))}
                </select>
                <select value={auditEntityFilter} onChange={(e) => setAuditEntityFilter(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <option value="all">All entities</option>
                  {[...new Set(auditLogs.map(l => l.entity_type).filter(Boolean))].map(entity => (
                    <option key={entity} value={entity}>{entity}</option>
                  ))}
                </select>
              </div>
              {filteredAuditLogs.length === 0 && (
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, color: '#64748b' }}>No audit activity yet.</div>
              )}
              <div style={{ display: 'grid', gap: 10 }}>
                {filteredAuditLogs.map(item => {
                  let details = {};
                  try { details = item.details_json ? JSON.parse(item.details_json) : {}; } catch (e) { details = {}; }
                  return (
                    <div key={item.id} style={{ background: 'white', borderRadius: 12, padding: 12, border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 800 }}>{item.action_type || 'activity'} • {item.entity_type || 'entity'} #{item.entity_id || '-'}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{new Date(item.created_at || Date.now()).toLocaleString()}</div>
                      </div>
                      {Object.keys(details).length > 0 && (
                        <div style={{ marginTop: 8, fontSize: 12, color: '#475569' }}>{JSON.stringify(details)}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'settings' && userRole === 'admin' && (
            <div style={{ display: 'grid', gap: 16, marginTop: 20 }}>
              <h3>Settings</h3>
              <div style={{ background: 'white', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0', display: 'grid', gap: 10 }}>
                <input
                  placeholder="Brand name"
                  value={adminSettings.branding_name || ''}
                  onChange={(e) => setAdminSettings(prev => ({ ...prev, branding_name: e.target.value }))}
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <textarea
                  placeholder="Mission"
                  value={adminSettings.branding_mission || ''}
                  onChange={(e) => setAdminSettings(prev => ({ ...prev, branding_mission: e.target.value }))}
                  style={{ minHeight: 80, padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <textarea
                  placeholder="Vision"
                  value={adminSettings.branding_vision || ''}
                  onChange={(e) => setAdminSettings(prev => ({ ...prev, branding_vision: e.target.value }))}
                  style={{ minHeight: 80, padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <input
                  placeholder="Contact email"
                  value={adminSettings.contact_email || ''}
                  onChange={(e) => setAdminSettings(prev => ({ ...prev, contact_email: e.target.value }))}
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    onClick={saveAdminSettings}
                    disabled={settingsSaving}
                    style={{ background: '#2563eb', color: 'white', border: 'none', padding: '8px 12px', borderRadius: 8 }}
                  >
                    {settingsSaving ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </div>
              <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0', color: '#475569', fontSize: 12 }}>
                <div><strong>Reset email mode:</strong> {adminSettings.reset_email_mode || 'unknown'}</div>
                <div><strong>Reset base URL:</strong> {adminSettings.reset_base_url || 'unknown'}</div>
                <div><strong>SMTP From:</strong> {adminSettings.smtp_from || 'unknown'}</div>
              </div>
            </div>
          )}

          {activeTab === 'applications' && userRole === 'admin' && (
            <div style={{ display: 'grid', gap: 16, marginTop: 20 }}>
              <h3>Applications</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {[
                  { label: 'Total', value: adminApplications.length, color: '#0f172a' },
                  { label: 'Interviewing', value: adminApplications.filter(a => (a.stage || 'Applied') === 'Interviewing').length, color: '#2563eb' },
                  { label: 'Offers', value: adminApplications.filter(a => (a.stage || 'Applied') === 'Offer').length, color: '#f59e0b' },
                  { label: 'Accepted', value: adminApplications.filter(a => (a.stage || 'Applied') === 'Placed').length, color: '#16a34a' }
                ].map(card => (
                  <div key={card.label} style={{ background: 'white', borderRadius: 14, padding: 14, border: '1px solid #e2e8f0' }}>
                    <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 800 }}>{card.label.toUpperCase()}</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: card.color }}>{card.value}</div>
                  </div>
                ))}
              </div>
              {adminApplications.length === 0 && (
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, color: '#64748b', textAlign: 'center' }}>No applications yet.</div>
              )}
              <div style={{ display: 'grid', gap: 14 }}>
                {adminApplications.map(app => {
                  const student = students.find(s => s.id === app.student_id);
                  const company = companies.find(c => c.id === app.company_id);
                  return (
                    <div key={`admin-app-${app.id}`} style={{ background: 'white', padding: 18, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontWeight: 900, fontSize: 16 }}>{student?.full_name || `Student #${app.student_id}`}</div>
                          <div style={{ color: '#64748b', fontSize: 12 }}>{company?.name || `Company #${app.company_id}`} • {formatDateOnly(app.created_at) || 'Date unknown'}</div>
                        </div>
                        <StageBadge stage={app.stage || 'Applied'} />
                      </div>
                      <div style={{ marginTop: 12, display: 'grid', gap: 8, color: '#0f172a' }}>
                        <div><strong>Position:</strong> {app.position || app.department || 'Not provided'}</div>
                        <div><strong>Department:</strong> {app.department || 'Not provided'}</div>
                        <div><strong>Why internship:</strong> {app.why_internship || 'Not provided'}</div>
                        <div><strong>Skills fit:</strong> {app.skills_fit || 'Not provided'}</div>
                        <div><strong>Career goals:</strong> {app.career_goals || 'Not provided'}</div>
                        <div><strong>Relevant experience:</strong> {app.relevant_experience || 'Not provided'}</div>
                      </div>
                      <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {[
                          { id: 'resume', label: 'Resume' },
                          { id: 'cover_letter', label: 'Cover Letter' },
                          { id: 'recommendation_letters', label: 'Recommendations' },
                          { id: 'transcript', label: 'Transcript' },
                          { id: 'student_id', label: 'Student ID' },
                          { id: 'certificates', label: 'Certificates' },
                          { id: 'profile_picture', label: 'Profile Photo' }
                        ].map(doc => (
                          <button
                            key={`${app.id}-${doc.id}`}
                            onClick={() => downloadStudentDoc(app.student_id, doc.id, `${doc.label}_${student?.full_name || app.student_id}`)}
                            style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#0f172a', padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}
                          >
                            {doc.label}
                          </button>
                        ))}
                      </div>
                      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button onClick={() => loadApplicantProfile(app)} style={{ background: '#0f172a', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 8 }}>View Full Profile</button>
                        <button onClick={() => openAdminEdit('application', app)} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 8 }}>Edit Application</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'pipeline' && userRole === 'admin' && (
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              {['Applied', 'Interviewing', 'Offer', 'Placed'].map(col => (
                <div key={col} onDragOver={(e) => e.preventDefault()} onDrop={async (e) => {
                    const id = e.dataTransfer.getData('text/plain');
                    if (!id) return;
                    try { await axios.patch(`${API}/applications/${id}/status`, { stage: col }); const res = await axios.get(`${API}/applications`); setApplications(res.data); } catch (err) { console.error(err); }
                  }} style={{ flex: 1, background: '#f8fafc', padding: 12, borderRadius: 8, minHeight: 200 }}>
                  <h4 style={{ fontWeight: 800, marginBottom: 8 }}>{col}</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {applications.filter(a => (a.stage || 'Applied') === col).map(a => (
                      <div key={a.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', a.id)} style={{ padding: 10, background: 'white', borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                        <div style={{ fontWeight: 700 }}>{a.position || 'Position'}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>Student: {a.student_id} • Company: {a.company_id}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Main content: students / companies listing */}
          {activeTab === 'students' && userRole === 'admin' && (
            <div>
              <h3 style={{ marginBottom: 12 }}>Students</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                <div style={{ background: 'white', padding: 16, borderRadius: 14, border: '1px solid #e2e8f0' }}>
                  <div style={{ color: '#64748b', fontSize: 12, fontWeight: 800 }}>TOTAL STUDENTS</div>
                  <div style={{ fontSize: 24, fontWeight: 900 }}>{students.length}</div>
                </div>
                <div style={{ background: 'white', padding: 16, borderRadius: 14, border: '1px solid #e2e8f0' }}>
                  <div style={{ color: '#64748b', fontSize: 12, fontWeight: 800 }}>AVERAGE GPA</div>
                  <div style={{ fontSize: 24, fontWeight: 900 }}>{studentAvgGpa}</div>
                </div>
                <div style={{ background: 'white', padding: 16, borderRadius: 14, border: '1px solid #e2e8f0' }}>
                  <div style={{ color: '#64748b', fontSize: 12, fontWeight: 800 }}>TOP MAJOR</div>
                  <div style={{ fontSize: 18, fontWeight: 900 }}>{topStudentMajor}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gap: 12 }}>
                {students.map(s => (
                  <div key={s.id} style={{ padding: 12, background: 'white', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '700' }}>{s.full_name}</div>
                      <div style={{ color: '#64748b', fontSize: 13 }}>{s.major} — GPA: {s.gpa}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {userRole === 'admin' && (
                        <>
                          <button onClick={() => openAdminEdit('student', s)} style={{ background: '#0f172a', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 8 }}>Edit</button>
                          <button onClick={() => adminSendReset(s.email)} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#0f172a', padding: '6px 10px', borderRadius: 8 }}>Send Reset</button>
                          <button onClick={async () => { await axios.delete(`${API}/students/${s.id}`); loadData(); }} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}>Delete</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'companies' && userRole === 'admin' && (
            <div>
              <h3 style={{ marginBottom: 12 }}>{userRole === 'company' ? 'My Company' : 'Companies'}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                <div style={{ background: 'white', padding: 16, borderRadius: 14, border: '1px solid #e2e8f0' }}>
                  <div style={{ color: '#64748b', fontSize: 12, fontWeight: 800 }}>TOTAL COMPANIES</div>
                  <div style={{ fontSize: 24, fontWeight: 900 }}>{companies.length}</div>
                </div>
                <div style={{ background: 'white', padding: 16, borderRadius: 14, border: '1px solid #e2e8f0' }}>
                  <div style={{ color: '#64748b', fontSize: 12, fontWeight: 800 }}>OPENINGS LISTED</div>
                  <div style={{ fontSize: 24, fontWeight: 900 }}>{totalOpenings}</div>
                </div>
                <div style={{ background: 'white', padding: 16, borderRadius: 14, border: '1px solid #e2e8f0' }}>
                  <div style={{ color: '#64748b', fontSize: 12, fontWeight: 800 }}>TOP INDUSTRY</div>
                  <div style={{ fontSize: 18, fontWeight: 900 }}>{topCompanyIndustry}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gap: 12 }}>
                {filteredCompanies.map(c => (
                  <div key={c.id} style={{ padding: 12, background: 'white', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '700' }}>{c.name}</div>
                      <div style={{ color: '#64748b', fontSize: 13 }}>{c.industry} — Openings: {c.openings}</div>
                      <div style={{ color: '#64748b', fontSize: 12 }}>{c.location || 'No location'} • {c.contact_email || c.contact_person || 'No contact'}</div>
                      {userRole === 'admin' && (
                        <div style={{ color: '#64748b', fontSize: 12 }}>Subscribers: {subscriptionCountMap[c.id] ?? 0}</div>
                      )}
                      {userRole === 'student' && (
                        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {getDepartmentsForCompany(c).map(dep => (
                            <span key={dep} style={{ background: '#e2e8f0', padding: '4px 8px', borderRadius: 999, fontSize: 12 }}>{dep}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {userRole === 'admin' && (
                        <>
                          <button onClick={() => openAdminEdit('company', c)} style={{ background: '#0f172a', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 8 }}>Edit</button>
                          <button onClick={() => adminSendReset(c.contact_email)} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#0f172a', padding: '6px 10px', borderRadius: 8 }}>Send Reset</button>
                          <button onClick={async () => { await axios.delete(`${API}/companies/${c.id}`); loadData(); }} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}>Delete</button>
                        </>
                      )}
                      {userRole === 'company' && String(userInfo?.companyId) === String(c.id) && <button onClick={async () => {
                        try {
                          const res = await axios.get(`${API}/companies/${c.id}/export`, { responseType: 'blob' });
                          const blob = new Blob([res.data], { type: 'text/csv' });
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a'); a.href = url; a.download = `company_${c.id}_applicants.csv`; a.click();
                        } catch (e) { console.error('Export failed', e); alert('Export failed'); }
                      }} style={{ background: '#111827', color: 'white', border: 'none', padding: '8px 12px', borderRadius: 8 }}>Export CSV</button>}
                    </div>
                  </div>
                ))}
              </div>

              {userRole === 'company' && userInfo?.companyId && (
                <div style={{ marginTop: 20 }}>
                  <h4 style={{ fontWeight: 800 }}>Applicants</h4>
                  <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                    {applications.filter(a => String(a.company_id) === String(userInfo.companyId)).map(a => (
                      <div key={a.id} style={{ padding: 10, background: 'white', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>Application #{a.id} — {a.position || 'Position'}</div>
                          <div style={{ color: '#64748b' }}>Student: {a.student_id} — Stage: {a.stage}</div>
                          {a.department && <div style={{ color: '#64748b' }}>Department: {a.department}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => loadApplicantProfile(a)} style={{ background: '#0f172a', color: 'white', border: 'none', padding: '8px 12px', borderRadius: 8 }}>View Profile</button>
                          <button onClick={async () => { const next = a.stage === 'Applied' ? 'Interviewing' : a.stage === 'Interviewing' ? 'Offer' : 'Placed'; await axios.patch(`${API}/applications/${a.id}/status`, { stage: next }); const res = await axios.get(`${API}/applications`); setApplications(res.data); }} style={{ background: '#10b981', color: 'white', border: 'none', padding: '8px 12px', borderRadius: 8 }}>Advance</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          {activeTab === 'internships' && userRole === 'student' && (
            <div>
              <h3 style={{ marginBottom: 12 }}>Internships</h3>
              <div style={{ marginBottom: 12 }}>
                <input
                  placeholder="Search companies or departments..."
                  value={companySearch}
                  onChange={(e) => setCompanySearch(e.target.value)}
                  style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0' }}
                />
              </div>
              {subscribedCompanyIds.size === 0 && (
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, border: '1px dashed #cbd5f5', color: '#64748b', textAlign: 'center', marginBottom: 12 }}>
                  Follow member companies first to view openings and apply.
                  <div style={{ marginTop: 10 }}>
                    <button onClick={() => setActiveTab('member-companies')} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '8px 12px', borderRadius: 8 }}>Browse Member Companies</button>
                  </div>
                </div>
              )}
              <div style={{ display: 'grid', gap: 12 }}>
                {filteredOpenings.map(opening => {
                  const isRejected = hasRejectionForCompany(opening.company_id);
                  return (
                  <div key={opening.id} style={{ padding: 12, background: 'white', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '700' }}>{opening.company_name}</div>
                      <div style={{ color: '#64748b', fontSize: 13 }}>{opening.department} • {opening.role_title || 'Internship'}</div>
                      <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>Location: {opening.location || opening.company_location || 'TBD'}</div>
                      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {opening.slots && <span style={{ background: '#e0f2fe', padding: '4px 8px', borderRadius: 999, fontSize: 12 }}>{opening.slots} slots</span>}
                        {opening.company_industry && <span style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: 999, fontSize: 12 }}>{opening.company_industry}</span>}
                      </div>
                      {(opening.company_overview || opening.company_mission || opening.company_vision) && (
                        <div style={{ marginTop: 8, background: '#f8fafc', border: '1px solid #e2e8f0', padding: 10, borderRadius: 10, fontSize: 12, color: '#0f172a' }}>
                          {opening.company_overview && <div><strong>What they do:</strong> {summarizeText(opening.company_overview, 120)}</div>}
                          {opening.company_mission && <div><strong>Mission:</strong> {summarizeText(opening.company_mission, 120)}</div>}
                          {opening.company_vision && <div><strong>Vision:</strong> {summarizeText(opening.company_vision, 120)}</div>}
                        </div>
                      )}
                      <div style={{ marginTop: 8, color: '#0f172a', fontSize: 13 }}>{opening.expectations}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => openApplyModal(opening)}
                        disabled={applyingCompany === opening.company_id || isRejected}
                        style={{ background: (applyingCompany === opening.company_id || isRejected) ? '#93c5fd' : '#2563eb', color: 'white', border: 'none', padding: '8px 12px', borderRadius: 8, cursor: (applyingCompany === opening.company_id || isRejected) ? 'not-allowed' : 'pointer' }}
                      >
                        {applyingCompany === opening.company_id ? 'Applying...' : isRejected ? 'Rejected' : 'Apply'}
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'overview' && userRole === 'admin' && (
            <div style={{ marginTop: 20 }}>
              <h3>Recent Activity</h3>
              {adminActivity.length === 0 && (
                <div style={{ marginTop: 12, background: '#f8fafc', padding: 16, borderRadius: 12, color: '#64748b' }}>No recent changes yet.</div>
              )}
              <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                {adminActivity.map(item => (
                  <div key={item.id} style={{ background: 'white', borderRadius: 12, padding: 12, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{item.message}</div>
                      <div style={{ color: '#64748b', fontSize: 12 }}>{new Date(item.ts).toLocaleString()}</div>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>{item.type}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {(userRole === 'student' || userRole === 'company') && showSupportModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
            <div style={{ background: 'white', padding: 24, borderRadius: 16, width: 520, maxHeight: '85vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontWeight: 900, margin: 0 }}>Contact Admin</h3>
                <button onClick={() => setShowSupportModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <div style={{ color: '#64748b', marginBottom: 10 }}>Admin email: {adminSettings.contact_email || ADMIN_CONTACT_EMAIL}</div>
              <div style={{ display: 'grid', gap: 10 }}>
                <input placeholder="Issue subject" value={supportSubject} onChange={(e) => setSupportSubject(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <textarea placeholder="Describe your issue" value={supportMessage} onChange={(e) => setSupportMessage(e.target.value)} style={{ minHeight: 120, padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowSupportModal(false)} style={{ background: 'transparent', border: '1px solid #e2e8f0', padding: '8px 12px', borderRadius: 8 }}>Cancel</button>
                <button onClick={submitSupportTicket} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '8px 12px', borderRadius: 8 }}>Send to Admin</button>
              </div>
            </div>
          </div>
        )}
        {userRole === 'admin' && showAddModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
            <div style={{ background: 'white', padding: 24, borderRadius: 16, width: 640, maxHeight: '85vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontWeight: 900, margin: 0 }}>{activeTab === 'students' ? 'Add Student' : 'Add Company'}</h3>
                <button onClick={() => setShowAddModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <form onSubmit={handleSave} style={{ display: 'grid', gap: 10 }}>
                {activeTab === 'students' && (
                  <>
                    <input name="full_name" placeholder="Full name" required style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                    <input name="major" placeholder="Major" style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                    <input name="gpa" placeholder="GPA" style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                    <input name="age" placeholder="Age" style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                    <input name="university" placeholder="University" style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                    <input name="phone" placeholder="Phone" style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                    <input name="email" placeholder="Email" type="email" style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  </>
                )}
                {activeTab === 'companies' && (
                  <>
                    <input name="name" placeholder="Company name" required style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                    <input name="industry" placeholder="Industry" style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                    <input name="openings" placeholder="Openings" style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                    <input name="location" placeholder="Location" style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                    <input name="contact_person" placeholder="Contact person" style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                    <input name="contact_email" placeholder="Contact email" type="email" style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                    <input name="contact_phone" placeholder="Contact phone" style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                    <textarea name="overview" placeholder="Overview" style={{ minHeight: 70, padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                    <textarea name="mission" placeholder="Mission" style={{ minHeight: 70, padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                    <textarea name="vision" placeholder="Vision" style={{ minHeight: 70, padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  </>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
                  <button type="button" onClick={() => setShowAddModal(false)} style={{ background: 'transparent', border: '1px solid #e2e8f0', padding: '8px 12px', borderRadius: 8 }}>Cancel</button>
                  <button type="submit" style={{ background: '#2563eb', color: 'white', border: 'none', padding: '8px 12px', borderRadius: 8 }}>Save</button>
                </div>
              </form>
            </div>
          </div>
        )}
        {userRole === 'admin' && adminEditType && adminEditItem && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
            <div style={{ background: 'white', padding: 24, borderRadius: 16, width: 620, maxHeight: '85vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontWeight: 900, margin: 0 }}>Edit {adminEditType}</h3>
                <button onClick={closeAdminEdit} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              {adminEditType === 'student' && (
                <div style={{ display: 'grid', gap: 10 }}>
                  <input placeholder="Full name" value={adminEditForm.full_name || ''} onChange={(e) => setAdminEditForm(prev => ({ ...prev, full_name: e.target.value }))} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <input placeholder="Major" value={adminEditForm.major || ''} onChange={(e) => setAdminEditForm(prev => ({ ...prev, major: e.target.value }))} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <input placeholder="GPA" value={adminEditForm.gpa || ''} onChange={(e) => setAdminEditForm(prev => ({ ...prev, gpa: e.target.value }))} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <input placeholder="Age" value={adminEditForm.age || ''} onChange={(e) => setAdminEditForm(prev => ({ ...prev, age: e.target.value }))} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <input placeholder="University" value={adminEditForm.university || ''} onChange={(e) => setAdminEditForm(prev => ({ ...prev, university: e.target.value }))} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <input placeholder="Phone" value={adminEditForm.phone || ''} onChange={(e) => setAdminEditForm(prev => ({ ...prev, phone: e.target.value }))} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <input placeholder="Email" value={adminEditForm.email || ''} onChange={(e) => setAdminEditForm(prev => ({ ...prev, email: e.target.value }))} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                </div>
              )}
              {adminEditType === 'company' && (
                <div style={{ display: 'grid', gap: 10 }}>
                  <input placeholder="Name" value={adminEditForm.name || ''} onChange={(e) => setAdminEditForm(prev => ({ ...prev, name: e.target.value }))} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <input placeholder="Industry" value={adminEditForm.industry || ''} onChange={(e) => setAdminEditForm(prev => ({ ...prev, industry: e.target.value }))} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <input placeholder="Openings" value={adminEditForm.openings || ''} onChange={(e) => setAdminEditForm(prev => ({ ...prev, openings: e.target.value }))} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <input placeholder="Location" value={adminEditForm.location || ''} onChange={(e) => setAdminEditForm(prev => ({ ...prev, location: e.target.value }))} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <input placeholder="Contact person" value={adminEditForm.contact_person || ''} onChange={(e) => setAdminEditForm(prev => ({ ...prev, contact_person: e.target.value }))} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <input placeholder="Contact email" value={adminEditForm.contact_email || ''} onChange={(e) => setAdminEditForm(prev => ({ ...prev, contact_email: e.target.value }))} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <input placeholder="Contact phone" value={adminEditForm.contact_phone || ''} onChange={(e) => setAdminEditForm(prev => ({ ...prev, contact_phone: e.target.value }))} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <textarea placeholder="Overview" value={adminEditForm.overview || ''} onChange={(e) => setAdminEditForm(prev => ({ ...prev, overview: e.target.value }))} style={{ minHeight: 80, padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <textarea placeholder="Mission" value={adminEditForm.mission || ''} onChange={(e) => setAdminEditForm(prev => ({ ...prev, mission: e.target.value }))} style={{ minHeight: 80, padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <textarea placeholder="Vision" value={adminEditForm.vision || ''} onChange={(e) => setAdminEditForm(prev => ({ ...prev, vision: e.target.value }))} style={{ minHeight: 80, padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                </div>
              )}
              {adminEditType === 'application' && (
                <div style={{ display: 'grid', gap: 10 }}>
                  <input placeholder="Student ID" value={adminEditForm.student_id || ''} onChange={(e) => setAdminEditForm(prev => ({ ...prev, student_id: e.target.value }))} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <input placeholder="Company ID" value={adminEditForm.company_id || ''} onChange={(e) => setAdminEditForm(prev => ({ ...prev, company_id: e.target.value }))} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <input placeholder="Position" value={adminEditForm.position || ''} onChange={(e) => setAdminEditForm(prev => ({ ...prev, position: e.target.value }))} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <input placeholder="Department" value={adminEditForm.department || ''} onChange={(e) => setAdminEditForm(prev => ({ ...prev, department: e.target.value }))} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <select value={adminEditForm.stage || 'Applied'} onChange={(e) => setAdminEditForm(prev => ({ ...prev, stage: e.target.value }))} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    {['Applied', 'Interviewing', 'Offer', 'Placed', 'Waitlisted', 'Rejected', 'Withdrawn'].map(stage => (
                      <option key={stage} value={stage}>{stage}</option>
                    ))}
                  </select>
                  <textarea placeholder="Notes" value={adminEditForm.notes || ''} onChange={(e) => setAdminEditForm(prev => ({ ...prev, notes: e.target.value }))} style={{ minHeight: 80, padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                </div>
              )}
              <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={closeAdminEdit} style={{ background: 'transparent', border: '1px solid #e2e8f0', padding: '8px 12px', borderRadius: 8 }}>Cancel</button>
                <button onClick={saveAdminEdit} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '8px 12px', borderRadius: 8 }}>Save Changes</button>
              </div>
            </div>
          </div>
        )}
        {viewingApplicant && applicantProfile && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
            <div style={{ background: 'white', padding: 24, borderRadius: 16, width: 700, maxHeight: '85vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontWeight: 900, margin: 0 }}>Student Profile</h3>
                <button onClick={() => { setViewingApplicant(null); setApplicantProfile(null); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <div style={{ fontWeight: 700 }}>{applicantProfile.full_name || 'Student'}</div>
              <div style={{ color: '#64748b', marginTop: 6 }}>{applicantProfile.degree_program || ''} {applicantProfile.school_name ? `• ${applicantProfile.school_name}` : ''}</div>
              <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
                <div>Email: {applicantProfile.email_address || 'N/A'}</div>
                <div>Phone: {applicantProfile.phone_number || 'N/A'}</div>
                <div>Skills: {(applicantProfile.skills || []).join(', ') || 'N/A'}</div>
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Essay Responses</div>
                <div style={{ color: '#0f172a' }}>Why internship: {viewingApplicant.why_internship || 'N/A'}</div>
                <div style={{ color: '#0f172a', marginTop: 6 }}>Skills fit: {viewingApplicant.skills_fit || 'N/A'}</div>
                <div style={{ color: '#0f172a', marginTop: 6 }}>Career goals: {viewingApplicant.career_goals || 'N/A'}</div>
                <div style={{ color: '#0f172a', marginTop: 6 }}>Relevant experience: {viewingApplicant.relevant_experience || 'N/A'}</div>
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Documents</div>
                {[
                  { key: 'resume', label: 'Resume' },
                  { key: 'cover_letter', label: 'Cover Letter' },
                  { key: 'recommendation_letters', label: 'Recommendation Letters' },
                  { key: 'transcript', label: 'Transcript' },
                  { key: 'student_id', label: 'Student ID' },
                  { key: 'certificates', label: 'Certificates' }
                ].map(doc => (
                  <button
                    key={doc.key}
                    onClick={async () => {
                      try {
                        const res = await axios.get(`${API}/student-profile/${viewingApplicant.student_id}/document/${doc.key}`, { responseType: 'blob' });
                        const url = window.URL.createObjectURL(new Blob([res.data]));
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `${doc.label.replace(/\s+/g, '_')}.bin`;
                        link.click();
                      } catch (e) {
                        console.error('Download failed', e);
                        alert('Document not available');
                      }
                    }}
                    style={{ marginRight: 8, marginBottom: 8, background: '#111827', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 8 }}
                  >
                    Download {doc.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {userRole === 'student' && showApplyModal && applyCompany && applyOpening && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
            <div style={{ background: 'white', padding: 24, borderRadius: 16, width: 640, maxHeight: '85vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontWeight: 900, margin: 0 }}>Apply to {applyCompany.name}</h3>
                <button onClick={() => { setShowApplyModal(false); setApplyOpening(null); setApplyCompany(null); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <div style={{ marginBottom: 12, color: '#64748b' }}>Department: {applyOpening.department} • {applyOpening.role_title || 'Internship'}</div>
              <div style={{ marginBottom: 12, color: '#64748b' }}>Location: {applyOpening.location || applyCompany.location || 'TBD'}</div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>What to expect</div>
                <div style={{ color: '#0f172a' }}>{applyOpening.expectations}</div>
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                <textarea placeholder="Why do you want this internship?" value={applyForm.why_internship} onChange={(e) => setApplyForm(prev => ({ ...prev, why_internship: e.target.value }))} style={{ minHeight: 90, padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <textarea placeholder="What skills make you a good fit?" value={applyForm.skills_fit} onChange={(e) => setApplyForm(prev => ({ ...prev, skills_fit: e.target.value }))} style={{ minHeight: 90, padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <textarea placeholder="Career goals" value={applyForm.career_goals} onChange={(e) => setApplyForm(prev => ({ ...prev, career_goals: e.target.value }))} style={{ minHeight: 90, padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <textarea placeholder="Relevant projects or experiences" value={applyForm.relevant_experience} onChange={(e) => setApplyForm(prev => ({ ...prev, relevant_experience: e.target.value }))} style={{ minHeight: 90, padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => { setShowApplyModal(false); setApplyOpening(null); setApplyCompany(null); }} style={{ background: 'transparent', border: '1px solid #e2e8f0', padding: '8px 12px', borderRadius: 8 }}>Cancel</button>
                <button onClick={saveDraft} style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '8px 12px', borderRadius: 8 }}>Save Draft</button>
                <button onClick={submitApplication} disabled={!applyOpening} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '8px 12px', borderRadius: 8 }}>Submit Application</button>
              </div>
            </div>
          </div>
        )}

        {userRole === 'student' && editApplication && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
            <div style={{ background: 'white', padding: 24, borderRadius: 16, width: 640, maxHeight: '85vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontWeight: 900, margin: 0 }}>Edit Application</h3>
                <button onClick={() => setEditApplication(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                <input placeholder="Department" value={editApplicationForm.department} onChange={(e) => setEditApplicationForm(prev => ({ ...prev, department: e.target.value }))} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <textarea placeholder="Why do you want this internship?" value={editApplicationForm.why_internship} onChange={(e) => setEditApplicationForm(prev => ({ ...prev, why_internship: e.target.value }))} style={{ minHeight: 90, padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <textarea placeholder="What skills make you a good fit?" value={editApplicationForm.skills_fit} onChange={(e) => setEditApplicationForm(prev => ({ ...prev, skills_fit: e.target.value }))} style={{ minHeight: 90, padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <textarea placeholder="Career goals" value={editApplicationForm.career_goals} onChange={(e) => setEditApplicationForm(prev => ({ ...prev, career_goals: e.target.value }))} style={{ minHeight: 90, padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <textarea placeholder="Relevant projects or experiences" value={editApplicationForm.relevant_experience} onChange={(e) => setEditApplicationForm(prev => ({ ...prev, relevant_experience: e.target.value }))} style={{ minHeight: 90, padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setEditApplication(null)} style={{ background: 'transparent', border: '1px solid #e2e8f0', padding: '8px 12px', borderRadius: 8 }}>Cancel</button>
                <button onClick={submitEditApplication} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '8px 12px', borderRadius: 8 }}>Save Changes</button>
              </div>
            </div>
          </div>
        )}
        {(userRole === 'student' || userRole === 'company') && (
          <div style={{ position: 'fixed', right: botPosition.x, bottom: botPosition.y, zIndex: 70 }}>
            {botOpen && (
              <div style={{ width: 280, maxWidth: '85vw', background: 'linear-gradient(135deg, #ffffff, #eef2ff)', borderRadius: 18, boxShadow: '0 16px 40px rgba(15,23,42,0.25)', padding: 14, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontWeight: 800 }}>Bill • Smart Guide</div>
                  <button onClick={() => setBotOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
                </div>
                <input
                  placeholder="Search help topics..."
                  value={botQuery}
                  onChange={(e) => setBotQuery(e.target.value)}
                  style={{ width: '100%', padding: 8, borderRadius: 10, border: '1px solid #c7d2fe', marginBottom: 10 }}
                />
                {botQuery.trim() ? (
                  <div style={{ display: 'grid', gap: 8, maxHeight: 160, overflowY: 'auto' }}>
                    {botResults.length === 0 && <div style={{ color: '#64748b', fontSize: 12 }}>No matches. Try another keyword.</div>}
                    {botResults.map(topic => (
                      <div key={topic.title} style={{ background: 'white', borderRadius: 12, padding: 10, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>{topic.title}</div>
                        <div style={{ fontSize: 12, color: '#475569' }}>{topic.body}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ background: 'white', borderRadius: 12, padding: 10, border: '1px solid #e2e8f0' }}>
                    <div style={{ color: '#64748b', fontSize: 12, marginBottom: 6 }}>Tip of the moment</div>
                    <div style={{ color: '#0f172a', fontSize: 13 }}>{billTip}</div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={() => setBillTipIndex(prev => prev + 1)} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 8 }}>New Tip</button>
                  <button onClick={() => setBotQuery('')} style={{ background: 'transparent', border: '1px solid #c7d2fe', padding: '6px 10px', borderRadius: 8, color: '#4338ca' }}>Clear</button>
                </div>
              </div>
            )}
            <button
              onMouseDown={startBotDrag}
              onTouchStart={startBotDrag}
              onClick={() => { if (!botDragging) setBotOpen(prev => !prev); }}
              style={{
                width: 56,
                height: 56,
                borderRadius: 20,
                border: 'none',
                cursor: 'grab',
                background: 'linear-gradient(135deg, #38bdf8, #6366f1)',
                boxShadow: '0 12px 24px rgba(56,189,248,0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 900
              }}
              aria-label="Open assistant"
            >
              <span style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>AI</span>
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;