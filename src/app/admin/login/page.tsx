import { LoginForm } from './LoginForm';

export default function AdminLoginPage() {
  return <main className="admin-shell"><p className="eyebrow">Private route</p><h1>Admin sign-in</h1><p>Use your approved administrator account to manage the semester calendar.</p><LoginForm /></main>;
}
