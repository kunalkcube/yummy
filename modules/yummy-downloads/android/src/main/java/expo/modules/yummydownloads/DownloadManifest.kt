package expo.modules.yummydownloads

import android.net.Uri
import androidx.annotation.OptIn
import androidx.media3.common.StreamKey
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DataSourceInputStream
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.hls.playlist.HlsMediaPlaylist
import androidx.media3.exoplayer.hls.playlist.HlsMultivariantPlaylist
import androidx.media3.exoplayer.hls.playlist.HlsPlaylist
import androidx.media3.exoplayer.hls.playlist.HlsPlaylistParser
import org.json.JSONObject
import java.util.UUID
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap

@OptIn(UnstableApi::class)
internal object DownloadManifest {
  data class Prepared(val input: JSONObject, val playlist: HlsPlaylist, val durationMs: Long, val createdAt: Long)
  private val prepared = ConcurrentHashMap<String, Prepared>()

  private fun trackLabel(name: String, language: String?, channels: Int = 0): String {
    val label = language?.takeIf { it != "und" }?.let { Locale.forLanguageTag(it).getDisplayLanguage(Locale.ENGLISH) }?.takeIf { it.isNotBlank() } ?: name
    return if (channels > 0) "$label · ${channels}ch" else label
  }

  fun uri(value: String): Uri {
    val uri = Uri.parse(value)
    require(uri.scheme == "https" && !uri.host.isNullOrBlank() && uri.userInfo == null) {
      "This source does not provide a supported HTTPS stream."
    }
    return uri
  }

  fun http(referer: String) = DefaultHttpDataSource.Factory()
    .setConnectTimeoutMs(10_000)
    .setReadTimeoutMs(15_000)
    .setDefaultRequestProperties(mapOf("Referer" to referer))

  private fun read(url: Uri, referer: String): HlsPlaylist {
    val source = http(referer).createDataSource()
    val input = DataSourceInputStream(source, DataSpec.Builder().setUri(url).build())
    return input.use {
      it.open()
      HlsPlaylistParser().parse(source.uri ?: url, it)
    }
  }

  private fun vod(playlist: HlsPlaylist): HlsMediaPlaylist {
    require(playlist is HlsMediaPlaylist && playlist.hasEndTag) { "Only complete on-demand videos can be saved offline." }
    require(playlist.protectionSchemes == null) { "This stream does not support offline downloads." }
    return playlist
  }

  fun prepare(json: String): Map<String, Any> {
    val input = JSONObject(json)
    val url = uri(input.getString("url"))
    val referer = uri(input.getString("referer")).toString()
    val playlist = read(url, referer)
    val master = playlist as? HlsMultivariantPlaylist
    require(master == null || (master.variants.isNotEmpty() && master.sessionKeyDrmInitData.isEmpty())) {
      "This stream does not support offline downloads."
    }
    val media = vod(if (master != null) read(master.variants.first().url, referer) else playlist)
    val token = UUID.randomUUID().toString()
    val now = System.currentTimeMillis()
    prepared.entries.removeIf { now - it.value.createdAt > 5 * 60_000 }
    prepared[token] = Prepared(input, playlist, media.durationUs / 1_000, now)
    val qualities = master?.variants?.mapIndexed { index, variant ->
      val format = variant.format
      mapOf(
        "id" to index,
        "label" to if (format.height > 0) "${format.height}p" else "Source ${index + 1}",
        "height" to format.height,
        "audioIds" to master.audios.mapIndexedNotNull { audioIndex, audio ->
          audioIndex.takeIf { audio.groupId == variant.audioGroupId }
        },
        "captionIds" to master.subtitles.mapIndexedNotNull { captionIndex, caption ->
          captionIndex.takeIf { caption.groupId == variant.subtitleGroupId && caption.url != null }
        },
      )
    }?.sortedByDescending { it["height"] as Int }
      ?: listOf(mapOf("id" to -1, "label" to "Source quality", "height" to 0, "audioIds" to emptyList<Int>(), "captionIds" to emptyList<Int>()))
    val audio = master?.audios?.mapIndexed { index, track ->
      mapOf("id" to index, "label" to trackLabel(track.name, track.format.language, track.format.channelCount), "language" to (track.format.language ?: "und"))
    } ?: emptyList()
    val captions = master?.subtitles?.mapIndexedNotNull { index, track ->
      if (track.url == null) null else mapOf("id" to "hls:$index", "label" to trackLabel(track.name, track.format.language), "language" to (track.format.language ?: "und"))
    }?.toMutableList() ?: mutableListOf()
    val external = input.optJSONArray("captions")
    for (index in 0 until minOf(external?.length() ?: 0, 25)) {
      val track = external!!.getJSONObject(index)
      uri(track.getString("url"))
      captions.add(mapOf("id" to "external:$index", "label" to track.optString("label", "Subtitles"), "language" to track.optString("language", "und")))
    }
    return mapOf("token" to token, "qualities" to qualities, "audio" to audio, "captions" to captions, "durationMs" to media.durationUs / 1_000)
  }

  fun release(token: String) { prepared.remove(token) }

  data class Selection(val input: JSONObject, val keys: List<StreamKey>, val metadata: JSONObject)

  fun select(json: String): Selection {
    val selection = JSONObject(json)
    val item = prepared.remove(selection.getString("token")) ?: error("Stream options expired. Open Download again.")
    require(System.currentTimeMillis() - item.createdAt <= 5 * 60_000) { "Stream options expired. Open Download again." }
    val master = item.playlist as? HlsMultivariantPlaylist
    val quality = selection.getInt("quality")
    val audio = selection.optInt("audio", -1)
    val caption = selection.optString("caption", "none")
    val keys = mutableListOf<StreamKey>()
    var qualityLabel = "Source quality"
    var audioLabel = "Original audio"
    var captionLabel = "None"
    var captionUrl = ""
    var captionLanguage = "und"
    if (master != null) {
      val variant = master.variants.getOrNull(quality) ?: error("Choose an available resolution.")
      vod(read(variant.url, item.input.getString("referer")))
      keys.add(StreamKey(HlsMultivariantPlaylist.GROUP_INDEX_VARIANT, quality))
      qualityLabel = if (variant.format.height > 0) "${variant.format.height}p" else "Source quality"
      val availableAudio = master.audios.withIndex().filter { it.value.groupId == variant.audioGroupId }
      if (availableAudio.isNotEmpty()) {
        val track = availableAudio.firstOrNull { it.index == audio } ?: error("Choose an available audio track.")
        keys.add(StreamKey(HlsMultivariantPlaylist.GROUP_INDEX_AUDIO, audio))
        audioLabel = trackLabel(track.value.name, track.value.format.language, track.value.format.channelCount)
      } else require(audio == -1) { "This resolution uses its original audio." }
      if (caption.startsWith("hls:")) {
        val index = caption.removePrefix("hls:").toInt()
        val track = master.subtitles.getOrNull(index) ?: error("Choose an available caption track.")
        require(track.groupId == variant.subtitleGroupId && track.url != null) { "Captions are unavailable for this resolution." }
        keys.add(StreamKey(HlsMultivariantPlaylist.GROUP_INDEX_SUBTITLE, index))
        captionLabel = trackLabel(track.name, track.format.language)
        captionLanguage = track.format.language ?: "und"
      }
    } else require(quality == -1 && audio == -1) { "This stream uses its original video and audio." }
    if (caption.startsWith("external:")) {
      val track = item.input.getJSONArray("captions").getJSONObject(caption.removePrefix("external:").toInt())
      captionUrl = uri(track.getString("url")).toString()
      captionLabel = track.optString("label", "Subtitles")
      captionLanguage = track.optString("language", "und")
    } else require(caption == "none" || (master != null && caption.startsWith("hls:"))) { "Choose an available caption track." }
    val id = item.input.getString("id")
    require(id.matches(Regex("[A-Za-z0-9_-]{1,120}"))) { "Invalid download identifier." }
    val metadata = JSONObject().apply {
      put("id", id)
      put("title", item.input.getString("title").take(200))
      put("posterUrl", item.input.optString("posterUrl").takeIf { DownloadArtwork.allowed(it) } ?: "")
      put("tmdbId", item.input.optLong("tmdbId", 0))
      put("mediaType", item.input.optString("mediaType", "movie"))
      put("showTitle", item.input.optString("showTitle").take(200))
      put("season", item.input.optInt("season", 0))
      put("episode", item.input.optInt("episode", 0))
      put("referer", item.input.getString("referer"))
      put("quality", qualityLabel)
      put("audio", audioLabel)
      put("caption", captionLabel)
      put("captionUrl", captionUrl)
      put("captionLanguage", captionLanguage)
      put("durationMs", item.durationMs)
      put("createdAt", System.currentTimeMillis())
    }
    return Selection(item.input, keys, metadata)
  }
}
