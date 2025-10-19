class anime {
  constructor() {
    this.name = "";
    this.title = "";
    this.episode = "";
    this.saison = 0;
    this.link = "";
    this.duration = 0;
    this.currentTime = 0;
    this.notif = false;
    this.lastUpdate = 0;
    // TMDb and external IDs for better subtitle matching
    this.tmdbId = null;           // TMDb TV show ID
    this.imdbId = null;           // IMDb ID (show or episode level)
    this.episodeTitle = "";       // Episode title in target language (e.g., French)
    this.episodeTmdbId = null;    // TMDb episode ID
    this.tvdbId = null;           // TVDB ID if available
  }
}
