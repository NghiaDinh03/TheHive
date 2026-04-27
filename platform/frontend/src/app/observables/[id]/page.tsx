'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { apiFetch } from '@/lib/api';

type User = { login: string; name: string };
type ObservableItem = { id: string; data_type: string; data: string; message: string; tlp: number; ioc: boolean; sighted: boolean; tags: string[]; case_number: number; case_title: string; created_by: string; created_at: string };
type ObservableCollection = { values: ObservableItem[] };

export default function ObservableDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [authedLogin, setAuthedLogin] = useState<string | null>(null);
  useEffect(() => { const login = sessionStorage.getItem('thehive.login'); if (!login) router.replace('/login'); else setAuthedLogin(login); }, [router]);
  const me = useQuery({ queryKey: ['me'], queryFn: () => apiFetch<User>('/api/v1/auth/me'), enabled: !!authedLogin });
  const observables = useQuery({ queryKey: ['observable-detail', params.id], queryFn: () => apiFetch<ObservableCollection>(`/api/v1/observables?filter=id:${params.id}`), enabled: !!authedLogin && !!params.id });
  const item = observables.data?.values?.[0];
  if (!authedLogin) return null;
  return <div className="flex min-h-screen"><Sidebar /><div className="flex-1 flex flex-col"><Topbar user={me.data ?? { login: authedLogin }} /><main className="flex-1 p-4 md:p-6"><div className="case-detail-layout"><section className="thehive-card"><div className="thehive-card-header case-detail-header"><div><h1>{item?.data ?? 'Observable detail'}</h1><p>Observable analyzer report foundation · TheHive 4 style</p></div><span className={item?.ioc ? 'label label-danger' : 'label label-default'}>{item?.ioc ? 'IOC' : 'Observable'}</span></div><div className="thehive-card-body"><div className="case-detail-grid"><Info label="Data type" value={item?.data_type} /><Info label="TLP" value={item?.tlp} /><Info label="Sighted" value={item?.sighted ? 'Yes' : 'No'} /><Info label="Case" value={item ? `#${item.case_number} ${item.case_title}` : 'Loading'} /><Info label="Created by" value={item?.created_by} /><Info label="Created" value={item ? new Date(item.created_at).toLocaleString() : 'Loading'} /></div><h3 className="detail-section-title">Analyzer reports</h3><div className="analyzer-report-placeholder">Cortex analyzer reports will render here with taxonomy, summary and full report sections.</div></div></section><aside className="thehive-card"><div className="thehive-card-header">Analyzers</div><div className="thehive-card-body detail-tabs"><button>Run analyzer</button><button>Responder</button><button>Export IOC</button></div></aside></div></main></div></div>;
}

function Info({ label, value }: { label: string; value: unknown }) { return <div className="detail-info"><span>{label}</span><strong>{String(value ?? '—')}</strong></div>; }
