'use client';
import { useState } from 'react';
import { authClient } from './client';
export function Logout() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  return <><button className="logout" disabled={pending} onClick={async () => {
    setPending(true); setError('');
    try { const result = await authClient.signOut(); if (result.error) throw new Error(); window.location.assign('/login'); }
    catch { setError('退出暂时失败，请重试。'); setPending(false); }
  }}>{pending ? '正在退出…' : '退出登录'}</button>{error && <p role="alert">{error}</p>}</>;
}
