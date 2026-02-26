<script lang="ts">
	import type { FlowProfile, ProfileSwitchConfig, FlowVariable } from '$lib/types/flow';
	import ButtonSelect from '$lib/components/inputs/ButtonSelect.svelte';

	interface Props {
		profiles: FlowProfile[];
		profileSwitch?: ProfileSwitchConfig;
		/** All per-profile variables across the project */
		perProfileVars: FlowVariable[];
		onAddProfile: (name: string) => void;
		onRemoveProfile: (id: string) => void;
		onUpdateProfile: (id: string, updates: Partial<FlowProfile>) => void;
		onSetProfileSwitch: (config: ProfileSwitchConfig | undefined) => void;
	}

	let {
		profiles,
		profileSwitch,
		perProfileVars,
		onAddProfile,
		onRemoveProfile,
		onUpdateProfile,
		onSetProfileSwitch,
	}: Props = $props();

	let newProfileName = $state('');
	let editingProfileId = $state<string | null>(null);
	let editingName = $state('');

	function handleAddProfile() {
		const name = newProfileName.trim();
		if (!name) return;
		onAddProfile(name);
		newProfileName = '';
	}

	function startEditName(profile: FlowProfile) {
		editingProfileId = profile.id;
		editingName = profile.name;
	}

	function commitEditName() {
		if (editingProfileId && editingName.trim()) {
			onUpdateProfile(editingProfileId, { name: editingName.trim() });
		}
		editingProfileId = null;
	}

	function updateOverride(profileId: string, varName: string, value: number) {
		const profile = profiles.find((p) => p.id === profileId);
		if (!profile) return;
		const overrides = { ...profile.variableOverrides, [varName]: value };
		onUpdateProfile(profileId, { variableOverrides: overrides });
	}

	let switchNext = $state('');
	let switchPrev = $state('');
	let switchModifier = $state('');

	$effect(() => {
		switchNext = profileSwitch?.next ?? '';
		switchPrev = profileSwitch?.prev ?? '';
		switchModifier = profileSwitch?.modifier ?? '';
	});

	function commitSwitchConfig() {
		if (!switchNext) {
			onSetProfileSwitch(undefined);
			return;
		}
		onSetProfileSwitch({
			next: switchNext,
			prev: switchPrev || switchNext,
			modifier: switchModifier || undefined,
		});
	}
</script>

<div class="space-y-4 p-3">
	<h3 class="text-sm font-semibold text-zinc-300">Profiles</h3>

	{#if profiles.length === 0}
		<p class="text-xs text-zinc-500">
			No profiles configured. Add profiles to create per-profile variable presets with button
			switching.
		</p>
	{/if}

	<!-- Profile list -->
	{#each profiles as profile, idx}
		<div class="rounded border border-zinc-700 bg-zinc-800/50 p-2">
			<div class="mb-1 flex items-center justify-between">
				{#if editingProfileId === profile.id}
					<input
						class="flex-1 rounded border border-zinc-600 bg-zinc-900 px-2 py-0.5 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
						bind:value={editingName}
						onblur={commitEditName}
						onkeydown={(e) => {
							if (e.key === 'Enter') commitEditName();
						}}
					/>
				{:else}
					<button
						class="text-sm font-medium text-zinc-200 hover:text-emerald-400"
						onclick={() => startEditName(profile)}
						title="Click to rename"
					>
						{idx + 1}. {profile.name}
					</button>
				{/if}
				<button
					class="rounded p-1 text-zinc-500 hover:bg-zinc-700 hover:text-red-400"
					onclick={() => onRemoveProfile(profile.id)}
					title="Remove profile"
				>
					<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			<!-- Per-profile variable overrides -->
			{#if perProfileVars.length > 0}
				<div class="mt-2 space-y-1">
					{#each perProfileVars as v}
						<div class="flex items-center gap-2 text-xs">
							<span class="min-w-0 flex-1 truncate text-zinc-400">{v.name}</span>
							<input
								type="number"
								class="w-16 rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-right text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
								value={profile.variableOverrides[v.name] ?? v.defaultValue}
								onchange={(e) =>
									updateOverride(
										profile.id,
										v.name,
										parseFloat((e.target as HTMLInputElement).value) || 0
									)}
							/>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/each}

	<!-- Add profile -->
	{#if profiles.length < 8}
		<div class="flex gap-1">
			<input
				class="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-200 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
				placeholder="Profile name..."
				bind:value={newProfileName}
				onkeydown={(e) => {
					if (e.key === 'Enter') handleAddProfile();
				}}
			/>
			<button
				class="rounded bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
				onclick={handleAddProfile}
				disabled={!newProfileName.trim()}
			>
				Add
			</button>
		</div>
	{:else}
		<p class="text-xs text-zinc-500">Maximum 8 profiles reached.</p>
	{/if}

	<!-- Profile switch buttons -->
	{#if profiles.length > 1}
		<div class="border-t border-zinc-700 pt-3">
			<h4 class="mb-2 text-xs font-semibold text-zinc-400 uppercase">Profile Switching</h4>
			<div class="space-y-2">
				<div>
					<label class="mb-1 block text-xs text-zinc-500">Next Profile</label>
					<ButtonSelect
						value={switchNext}
						onchange={(v) => {
							switchNext = v;
							commitSwitchConfig();
						}}
						placeholder="Select button..."
					/>
				</div>
				<div>
					<label class="mb-1 block text-xs text-zinc-500">Previous Profile</label>
					<ButtonSelect
						value={switchPrev}
						onchange={(v) => {
							switchPrev = v;
							commitSwitchConfig();
						}}
						placeholder="Select button..."
					/>
				</div>
				<div>
					<label class="mb-1 block text-xs text-zinc-500">Modifier (optional hold)</label>
					<ButtonSelect
						value={switchModifier}
						onchange={(v) => {
							switchModifier = v;
							commitSwitchConfig();
						}}
						placeholder="None (optional)"
					/>
				</div>
			</div>
		</div>
	{/if}
</div>
