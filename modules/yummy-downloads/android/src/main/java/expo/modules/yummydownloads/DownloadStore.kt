package expo.modules.yummydownloads

import android.content.Context
import androidx.annotation.OptIn
import androidx.media3.common.MimeTypes
import androidx.media3.common.MediaItem
import androidx.media3.common.C
import androidx.media3.common.util.UnstableApi
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.datasource.DataSourceInputStream
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.datasource.cache.NoOpCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import androidx.media3.exoplayer.offline.DefaultDownloadIndex
import androidx.media3.exoplayer.offline.DefaultDownloaderFactory
import androidx.media3.exoplayer.offline.Download
import androidx.media3.exoplayer.offline.DownloadManager
import androidx.media3.exoplayer.offline.DownloadRequest
import androidx.media3.exoplayer.offline.DownloadService
import androidx.media3.exoplayer.offline.Downloader
import androidx.media3.exoplayer.offline.DownloaderFactory
import androidx.media3.exoplayer.scheduler.Requirements
import org.json.JSONObject
import java.io.File
import java.util.concurrent.Executors

@OptIn(UnstableApi::class)
internal object DownloadStore {
  lateinit var cache: SimpleCache
    private set
  lateinit var manager: DownloadManager
    private set
  private lateinit var context: Context

  fun initialize(context: Context) {
    if (::manager.isInitialized) return
    this.context = context.applicationContext
    val database = StandaloneDatabaseProvider(context)
    cache = SimpleCache(File(context.filesDir, "offline-videos"), NoOpCacheEvictor(), database)
    val executor = Executors.newFixedThreadPool(3)
    manager = DownloadManager(context, DefaultDownloadIndex(database), object : DownloaderFactory {
      override fun createDownloader(request: DownloadRequest): Downloader {
        val referer = metadata(request).getString("referer")
        val factory = CacheDataSource.Factory().setCache(cache)
          .setUpstreamDataSourceFactory(DownloadManifest.http(referer))
        return DefaultDownloaderFactory(factory, executor).createDownloader(request)
      }
    }).apply {
      maxParallelDownloads = 2
      requirements = Requirements(Requirements.NETWORK)
      addListener(object : DownloadManager.Listener {
        override fun onDownloadChanged(manager: DownloadManager, download: Download, finalException: Exception?) {
          val meta = metadata(download.request)
          if (download.request.id == meta.optString("id") && download.state != Download.STATE_REMOVING) {
            DownloadArtwork.fetch(context, download.request.id, meta.optString("posterUrl")) {
              manager.downloadIndex.getDownload(download.request.id) != null
            }
          }
        }
        override fun onDownloadRemoved(manager: DownloadManager, download: Download) {
          if (download.request.id == metadata(download.request).optString("id")) DownloadArtwork.remove(context, download.request.id)
        }
      })
    }
  }

  fun metadata(request: DownloadRequest) = JSONObject(String(request.data, Charsets.UTF_8))
  fun captionId(id: String) = "${id}_caption"

  fun start(context: Context, selection: DownloadManifest.Selection) {
    initialize(context)
    val metadata = selection.metadata
    val id = metadata.getString("id")
    require(manager.downloadIndex.getDownload(id) == null) { "This video is already in Downloads. Delete it there to choose different tracks." }
    require(context.filesDir.usableSpace > 50L * 1024 * 1024) { "Not enough free storage. Free some space and try again." }
    val bytes = metadata.toString().toByteArray(Charsets.UTF_8)
    val request = DownloadRequest.Builder(id, DownloadManifest.uri(selection.input.getString("url")))
      .setMimeType(MimeTypes.APPLICATION_M3U8)
      .setStreamKeys(selection.keys)
      .setData(bytes).build()
    val captionUrl = metadata.optString("captionUrl")
    // Queue captions first; completion includes both requests, never an incomplete subtitle file.
    if (captionUrl.isNotEmpty()) {
      val caption = DownloadRequest.Builder(captionId(id), DownloadManifest.uri(captionUrl))
        .setMimeType(MimeTypes.APPLICATION_SUBRIP).setData(bytes).build()
      DownloadService.sendAddDownload(context, YummyDownloadService::class.java, caption, true)
    }
    DownloadService.sendAddDownload(context, YummyDownloadService::class.java, request, true)
  }

  fun snapshot(context: Context): List<Map<String, Any>> {
    initialize(context)
    val downloads = linkedMapOf<String, Download>()
    manager.downloadIndex.getDownloads().use { cursor ->
      while (cursor.moveToNext()) downloads[cursor.download.request.id] = cursor.download
    }
    manager.currentDownloads.forEach { downloads[it.request.id] = it }
    return downloads.values.filter { !it.request.id.endsWith("_caption") }.map { download ->
      val meta = metadata(download.request)
      val legacy = Regex("^catalog_(\\d+)_(movie|tv)_").find(download.request.id)
      val legacyTv = Regex("^catalog_(\\d+)_tv_(\\d+)_(\\d+)").find(download.request.id)
      val caption = downloads[captionId(download.request.id)]
      val needsCaption = meta.optString("captionUrl").isNotEmpty()
      val parts = listOfNotNull(download, caption)
      val complete = download.state == Download.STATE_COMPLETED && (!needsCaption || caption?.state == Download.STATE_COMPLETED)
      val state = when {
        parts.any { it.state == Download.STATE_REMOVING } -> "removing"
        complete -> "completed"
        parts.any { it.state == Download.STATE_FAILED } -> "failed"
        manager.downloadsPaused || parts.any { it.stopReason != Download.STOP_REASON_NONE } -> "paused"
        manager.notMetRequirements != 0 -> "waiting"
        parts.any { it.state == Download.STATE_DOWNLOADING } -> "downloading"
        else -> "queued"
      }
      val season = meta.optInt("season", 0).takeIf { it > 0 }
        ?: legacyTv?.groupValues?.get(2)?.toIntOrNull() ?: 0
      val episode = meta.optInt("episode", 0).takeIf { it > 0 }
        ?: legacyTv?.groupValues?.get(3)?.toIntOrNull() ?: 0
      mapOf(
        "id" to download.request.id,
        "title" to meta.optString("title", "Video"),
        "showTitle" to meta.optString("showTitle"),
        "season" to season,
        "episode" to episode,
        "posterUri" to DownloadArtwork.localUri(context, download.request.id),
        "hasPosterSource" to meta.optString("posterUrl").isNotEmpty(),
        "tmdbId" to meta.optLong("tmdbId", 0).takeIf { it > 0 }.let { it ?: legacy?.groupValues?.get(1)?.toLongOrNull() ?: 0L },
        "mediaType" to if (legacy != null) legacy.groupValues[2] else meta.optString("mediaType", "movie"),
        "quality" to meta.optString("quality"),
        "audio" to meta.optString("audio"),
        "caption" to meta.optString("caption", "None"),
        "durationMs" to meta.optLong("durationMs"),
        "createdAt" to meta.optLong("createdAt"),
        "state" to state,
        "bytes" to parts.sumOf { it.bytesDownloaded },
        "percent" to if (complete) 100f else download.percentDownloaded.coerceIn(0f, 99f),
      )
    }.sortedByDescending { it["createdAt"] as Long }
  }

  fun control(context: Context, id: String, action: String) {
    initialize(context)
    require(action in setOf("pause", "resume", "remove")) { "Unknown download action." }
    require(manager.downloadIndex.getDownload(id) != null) { "Download not found." }
    for (key in listOf(id, captionId(id))) {
      val download = manager.downloadIndex.getDownload(key) ?: continue
      when (action) {
        "remove" -> DownloadService.sendRemoveDownload(context, YummyDownloadService::class.java, key, true)
        "pause" -> DownloadService.sendSetStopReason(context, YummyDownloadService::class.java, key, 1, true)
        "resume" -> if (download.state == Download.STATE_FAILED) {
          DownloadService.sendAddDownload(context, YummyDownloadService::class.java, download.request, true)
        } else DownloadService.sendSetStopReason(context, YummyDownloadService::class.java, key, Download.STOP_REASON_NONE, true)
      }
    }
  }

  fun completed(context: Context, id: String): Download {
    initialize(context)
    require(snapshot(context).any { it["id"] == id && it["state"] == "completed" }) { "Finish downloading this video before playing offline." }
    return manager.downloadIndex.getDownload(id) ?: error("Download not found.")
  }

  fun requestPoster(context: Context, id: String, url: String) {
    initialize(context)
    require(manager.downloadIndex.getDownload(id) != null) { "Download not found." }
    val source = url.ifBlank { metadata(manager.downloadIndex.getDownload(id)!!.request).optString("posterUrl") }
    require(DownloadArtwork.allowed(source)) { "Unsupported artwork URL." }
    DownloadArtwork.fetch(context, id, source) { manager.downloadIndex.getDownload(id) != null }
  }

  fun offlineSource() = CacheDataSource.Factory().setCache(cache)
    .setUpstreamDataSourceFactory(null).setCacheWriteDataSinkFactory(null)

  fun offlineItem(context: Context, id: String): MediaItem {
    val download = completed(context, id)
    val meta = metadata(download.request)
    val item = download.request.toMediaItem().buildUpon()
    val captionUrl = meta.optString("captionUrl")
    if (captionUrl.isNotEmpty()) {
      val uri = DownloadManifest.uri(captionUrl)
      val prefix = ByteArray(16)
      val source = DataSourceInputStream(offlineSource().createDataSource(), DataSpec(uri))
      val length = source.use { it.read(prefix) }
      val mime = if (length > 0 && String(prefix, 0, length, Charsets.UTF_8).trimStart('\uFEFF').startsWith("WEBVTT")) MimeTypes.TEXT_VTT else MimeTypes.APPLICATION_SUBRIP
      item.setSubtitleConfigurations(listOf(MediaItem.SubtitleConfiguration.Builder(uri)
        .setMimeType(mime).setLabel(meta.optString("caption"))
        .setLanguage(meta.optString("captionLanguage", "und")).setSelectionFlags(C.SELECTION_FLAG_DEFAULT).build()))
    }
    return item.build()
  }
}
