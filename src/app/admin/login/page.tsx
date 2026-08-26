import { LoginForm } from './LoginForm';
import { AdminShell } from '../AdminShell';

export default function AdminLoginPage() {
  return <AdminShell><p className="eyebrow-text mb-[7px] font-term text-[10px] uppercase tracking-[.55px] text-black">Private route</p><h1 className="mb-3.5 font-display text-[40px] leading-[.95] font-black uppercase tracking-[.2px] phone:text-[clamp(32px,10vw,44px)]">Admin sign-in</h1><p className="max-w-[620px] font-term text-[13px] leading-[1.55] text-muted">Use your approved administrator account to manage the semester calendar.</p><LoginForm /></AdminShell>;
}
