import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			staleTime: 60 * 1000,
			// Cached pages outlive a detour. Opening a post, a profile or a
			// product and coming back to the feed used to land outside the old
			// five-minute window and refetch the whole thing, so the reader was
			// put back at a loading state they had already waited through.
			gcTime: 30 * 60 * 1000,
		},
	},
});