import { LoginForm } from './LoginForm';
import { AdminShell } from '../AdminShell';

export default function AdminLoginPage() {
  return <AdminShell><p className="eyebrow">Private route</p><h1>Admin sign-in</h1><p>Use your approved administrator account to manage the semester calendar.</p><LoginForm /></AdminShell>;
}
