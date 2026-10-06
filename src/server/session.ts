import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from './auth.ts';

export async function currentUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.emailVerified ? session.user : null;
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect('/login');
  return user;
}
