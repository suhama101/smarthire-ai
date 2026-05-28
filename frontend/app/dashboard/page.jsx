'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { readStoredAuth } from '../../src/lib/auth-session';
import { getSupabaseClient } from '../../src/lib/supabaseClient';
import CandidateWorkbench from '../../src/app/dashboard/components/CandidateWorkbench';

function decodeJwtPayload(token) {
	const rawToken = String(token || '').trim();

	if (!rawToken || !rawToken.includes('.')) {
		return null;
	}

	try {
		const payloadPart = rawToken.split('.')[1];
		const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
		const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
		const json = typeof window !== 'undefined' && typeof window.atob === 'function'
			? window.atob(padded)
			: Buffer.from(padded, 'base64').toString('utf8');

		return JSON.parse(json);
	} catch {
		return null;
	}
}

function resolveRole(source) {
	const directRole = String(
		source?.user?.role ||
			source?.user?.user_metadata?.role ||
			source?.user?.app_metadata?.role ||
			source?.user?.raw_user_meta_data?.role ||
			source?.role ||
			''
	).toLowerCase();

	if (directRole) {
		return directRole;
	}

	return String(decodeJwtPayload(source?.token)?.role || '').toLowerCase();
}

export default function DashboardPage() {
	const router = useRouter();
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [role, setRole] = useState('guest');

	useEffect(() => {
		async function loadRole() {
			const stored = readStoredAuth();

			if (!stored?.token) {
				router.replace('/login');
				return;
			}

			setIsAuthenticated(true);

			let nextRole = resolveRole(stored);

			try {
				const supabase = getSupabaseClient({ allowMissing: true });

				if (supabase) {
					const { data: { user } } = await supabase.auth.getUser();
					const supabaseRole = String(
						user?.role ||
						user?.user_metadata?.role ||
						user?.app_metadata?.role ||
						user?.raw_user_meta_data?.role ||
						''
					).toLowerCase();

					if (supabaseRole) {
						nextRole = supabaseRole;
					}
				}
			} catch {
				// Keep the locally stored role when Supabase auth is unavailable.
			}

			setRole(nextRole || 'candidate');
		}

		loadRole();
	}, [router]);

	if (!isAuthenticated) {
		return (
			<div className="px-4 py-8 md:px-6">
				<div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-[#1A1A24] p-6 shadow-sm">
					<p className="text-sm font-medium text-[#8B8B9E]">Redirecting to sign in...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
				{role === 'recruiter' ? (
					<div className="flex h-64 flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-[#13131A] p-8 text-center">
						<h2 className="text-xl font-semibold text-[#F1F1F3]">Recruiter Workspace</h2>
						<p className="text-sm text-[#6B6B80]">Use Batch Upload to screen multiple candidates at once.</p>
						<a
							href="/batch"
							className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
						>
							Go to Batch Upload
						</a>
					</div>
				) : (
					<CandidateWorkbench />
				)}
			</div>
		</div>
	);
}
