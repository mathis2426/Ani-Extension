

class AnilistManager {

    async AnimeNameToIframe(animeNameFromPage) { // for voiranime.js
        // Call the global function from utils.js (loaded as content script)
        if (typeof sendAnimeNameToIframe === 'function') {
            await sendAnimeNameToIframe(animeNameFromPage);
        } else {
            console.error('sendAnimeNameToIframe is not available');
        }
    }

    async RequestIfAnimeAvailable() { // for voiranime.js
        
        // Call the global function from utils.js (loaded as content script)
        if (typeof sendRequestFindAnime === 'function') {
            let result = await sendRequestFindAnime();
            console.log("Can request anime name:", result);
            
            // Only call RequestAnimeName if success is true
            if (result.success && result.animeName) {
                await this.RequestAnimeName(result.animeName);
            } else {
                console.warn("Failed to get anime name or not ready yet");
            }
        } else {
            console.error('sendRequestFindAnime is not available');
        }
    }

    async RequestAnimeName(animeName) {
        try {
            const animeListSorted = await fetchAllAnimes(animeName); // Get all animes from Anilist
            console.log("Fetched anilist animes:", animeListSorted);
            
            try {
                const filteredAnimeName = animeFilter(animeListSorted, animeName); // Filter to get the best match
                console.log("Filtered animes (only the first one):", filteredAnimeName);

            } catch (filterError) {
                console.error("Error filtering animes:", filterError);
            }
        } 
        catch (error) {
            console.error("Error fetching all animes:", error);
        }
    }

    updateInformation() // update title in extension based on the anilist title
    {
        
    }

    storageDatabaseSync() // sync storage with anilist database
    {
        // Implementation for syncing storage with Anilist database
    }
}