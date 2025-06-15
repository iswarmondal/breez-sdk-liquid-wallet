<script lang="ts">
	import { goto } from '$app/navigation';

	function goToCreate() {
		goto('/create');
	}
	function goToImport() {
		goto('/import');
	}
</script>

<div class="flex min-h-[60vh] items-center justify-center">
	<div class="card bg-base-100 w-full max-w-lg shadow-xl">
		<div class="card-body items-center">
			<h2 class="card-title mb-2">Self Custody Bitcoin Lightning Wallet</h2>
			<div
				style="display: flex; flex-direction: column; gap: 1rem; max-width: 300px; margin: 2rem auto;"
			>
				<button onclick={goToCreate} class="btn btn-primary btn-lg">Create Wallet</button>
				<button onclick={goToImport} class="btn btn-secondary btn-lg">Import Wallet</button>
			</div>
		</div>
	</div>
</div>
