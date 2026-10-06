import { AuthPage } from '@/features/auth/AuthPage';
export default async function ResetPassword({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <AuthPage mode="reset" token={token} />;
}
