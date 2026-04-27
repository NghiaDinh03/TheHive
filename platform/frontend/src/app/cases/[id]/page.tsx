'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { apiFetch } from '@/lib/api';

type User = { login: string; name: string };
type CaseItem = { id: string; number: number; title: string; severity: number; tlp: number; pap: number; status: string; owner: string; assignee: string; tags: string[]; created_at: string; updated_at: string; description?: string };
type CaseCollection = { values: CaseItem[] };

export default function CaseDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [authedLogin, setAuthedLogin] = useState<string | null>(null);
  useEffect(() => { const login = sessionStorage.getItem('thehive.login'); if (!login) router.replace('/login'); else setAuthedLogin(login); }, [router]);
  const me = useQuery({ queryKey: ['me'], queryFn: () => apiFetch<User>('/api/v1/auth/me'), enabled: !!authedLogin });
  const cases = useQuery({ queryKey: ['case-detail', params.id], queryFn: () => apiFetch<CaseCollection>(`/api/v1/cases?filter=id:${params.id}`), enabled: !!authedLogin && !!params.id });
  const item = cases.data?.values?.[0];
  if (!authedLogin) return null;
  return <div className="flex min-h-screen"><Sidebar /><div className="flex-1 flex flex-col"><Topbar user={me.data ?? { login: authedLogin }} /><main className="flex-1 p-4 md:p-6"><div className="case-detail-layout"><section className="thehive-card"><div className="thehive-card-header case-detail-header"><div><h1>#{item?.number ?? '…'} {item?.title ?? 'Case detail'}</h1><p>TheHive 4 style case summary · tabs foundation</p></div><span className="label label-success">{item?.status ?? 'Loading'}</span></div><div className="thehive-card-body"><div className="case-detail-grid"><Info label="Severity" value={item?.severity} /><Info label="TLP" value={item?.tlp} /><Info label="PAP" value={item?.pap} /><Info label="Owner" value={item?.owner || 'None'} /><Info label="Assignee" value={item?.assignee || 'None'} /><Info label="Updated" value={item ? new Date(item.updated_at).toLocaleString() : 'Loading'} /></div><h3 className="detail-section-title">Description</h3><div className="detail-markdown">{item?.description || 'No description yet.'}</div><h3 className="detail-section-title">Tags</h3><div className="case-tags flexwrap">{item?.tags?.length ? item.tags.map((tag) => <span className="tag-item" key={tag}>{tag}</span>) : <span className="text-thehive-muted">None</span>}</div></div></section><aside className="thehive-card"><div className="thehive-card-header">Case tabs</div><div className="thehive-card-body detail-tabs"><button>Tasks</button><button>Observables</button><button>Logs</button><button>Attachments</button><button>Audit</button></div></aside></div></main></div></div>;
}

function Info({ label, value }: { label: string; value: unknown }) { return <div className="detail-info"><span>{label}</span><strong>{String(value ?? '—')}</strong></div>; }
