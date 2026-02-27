<script lang="ts">
	import { getNotifications, getUnreadCount, markAllRead, clearNotifications, type Notification } from '$lib/stores/toast.svelte';

	interface Props {
		open: boolean;
		onclose: () => void;
	}

	let { open, onclose }: Props = $props();

	let notifications = $derived(getNotifications());
	let unreadCount = $derived(getUnreadCount());

	$effect(() => {
		if (open && unreadCount > 0) {
			markAllRead();
		}
	});

	function formatTime(ts: number): string {
		const d = new Date(ts);
		const now = new Date();
		const diffMs = now.getTime() - d.getTime();
		const diffMin = Math.floor(diffMs / 60000);
		if (diffMin < 1) return 'just now';
		if (diffMin < 60) return `${diffMin}m ago`;
		const diffHr = Math.floor(diffMin / 60);
		if (diffHr < 24) return `${diffHr}h ago`;
		return d.toLocaleDateString();
	}

	const typeIcons: Record<string, string> = {
		success: 'text-emerald-400',
		error: 'text-red-400',
		warning: 'text-amber-400',
		info: 'text-blue-400'
	};

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-40" onclick={handleBackdropClick}>
		<div class="absolute right-4 bottom-10 w-80 rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl">
			<div class="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
				<span class="text-xs font-semibold text-zinc-300">Notifications</span>
				<div class="flex items-center gap-2">
					{#if notifications.length > 0}
						<button
							class="text-[10px] text-zinc-500 hover:text-zinc-300"
							onclick={clearNotifications}
						>
							Clear all
						</button>
					{/if}
					<button
						class="rounded p-0.5 text-zinc-500 hover:text-zinc-300"
						onclick={onclose}
					>
						<svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
						</svg>
					</button>
				</div>
			</div>
			<div class="max-h-72 overflow-y-auto">
				{#if notifications.length === 0}
					<div class="px-3 py-6 text-center text-xs text-zinc-500">
						No notifications yet
					</div>
				{:else}
					{#each notifications as notif}
						<div class="flex items-start gap-2 border-b border-zinc-800/50 px-3 py-2 last:border-b-0 {notif.read ? '' : 'bg-zinc-800/30'}">
							<div class="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full {typeIcons[notif.type]}"></div>
							<div class="min-w-0 flex-1">
								<p class="text-xs text-zinc-300 break-words">{notif.message}</p>
								<span class="text-[10px] text-zinc-600">{formatTime(notif.timestamp)}</span>
							</div>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	</div>
{/if}
