package expo.modules.yummydownloads

import android.app.Notification
import android.app.NotificationManager
import android.os.Build
import android.os.ParcelFileDescriptor
import androidx.annotation.OptIn
import androidx.lifecycle.Lifecycle
import androidx.media3.common.Player
import androidx.media3.common.PlaybackException
import androidx.media3.common.StreamKey
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.PlayerView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.Callable
import java.util.concurrent.CountDownLatch
import java.util.concurrent.FutureTask
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

@OptIn(UnstableApi::class)
@RunWith(AndroidJUnit4::class)
class OfflineDownloadTest {
  private val context get() = InstrumentationRegistry.getInstrumentation().targetContext
  private fun <T> main(block: () -> T): T {
    val task = FutureTask(Callable(block))
    InstrumentationRegistry.getInstrumentation().runOnMainSync(task)
    return task.get()
  }

  private fun await(message: String, seconds: Long = 60, condition: () -> Boolean) {
    val end = System.nanoTime() + TimeUnit.SECONDS.toNanos(seconds)
    while (!condition() && System.nanoTime() < end) Thread.sleep(100)
    assertTrue(message, condition())
  }

  @Test
  fun selectedTracksDownloadPauseResumePlayFromCacheAndDelete() {
    val id = "offline_device_verification"
    val scenario = ActivityScenario.launch(DownloadTestActivity::class.java)
    var player: ExoPlayer? = null
    try {
      main { DownloadStore.initialize(context) }
      await("Download index initialized") { main { DownloadStore.manager.isInitialized } }
      if (Build.VERSION.SDK_INT >= 33) {
        val permission = InstrumentationRegistry.getInstrumentation().uiAutomation.executeShellCommand("pm grant ${context.packageName} android.permission.POST_NOTIFICATIONS")
        ParcelFileDescriptor.AutoCloseInputStream(permission).bufferedReader().use { it.readText() }
      }
      val source = JSONObject().apply {
        put("id", id)
        put("title", "Offline verification")
        put("url", "https://storage.googleapis.com/shaka-demo-assets/angel-one-hls/hls.m3u8")
        put("referer", "https://storage.googleapis.com/")
        put("captions", JSONArray())
        put("posterUrl", "https://image.tmdb.org/t/p/w92/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg")
        put("tmdbId", 872585)
        put("mediaType", "movie")
        put("showTitle", "")
        put("season", 0)
        put("episode", 0)
      }
      val options = DownloadManifest.prepare(source.toString())
      @Suppress("UNCHECKED_CAST")
      val qualities = options["qualities"] as List<Map<String, Any>>
      @Suppress("UNCHECKED_CAST")
      val audios = options["audio"] as List<Map<String, Any>>
      @Suppress("UNCHECKED_CAST")
      val captions = options["captions"] as List<Map<String, Any>>
      assertTrue(qualities.size > 1)
      val quality = qualities.last()["id"] as Int
      val audio = audios.first { it["language"] == "de" }["id"] as Int
      val caption = captions.first { it["language"] == "fr" }["id"] as String
      val selection = DownloadManifest.select(JSONObject().apply {
        put("token", options["token"]); put("quality", quality); put("audio", audio); put("caption", caption)
      }.toString())
      assertEquals(listOf(StreamKey(0, quality), StreamKey(1, audio), StreamKey(2, caption.substringAfter(':').toInt())), selection.keys)
      main { DownloadStore.start(context, selection) }
      await("Request persisted") { main { DownloadStore.manager.downloadIndex.getDownload(id) != null } }
      await("Notification displays the video title", 10) {
        context.getSystemService(NotificationManager::class.java).activeNotifications.any {
          it.id == 3201 && it.notification.extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() == "Offline verification"
        }
      }
      main { DownloadStore.control(context, id, "pause") }
      await("Download paused") { main { DownloadStore.snapshot(context).any { it["id"] == id && it["state"] == "paused" } } }
      main { DownloadStore.control(context, id, "resume") }
      scenario.moveToState(Lifecycle.State.CREATED)
      await("Background download completed", 180) {
        main { DownloadStore.snapshot(context).any { it["id"] == id && it["state"] == "completed" } }
      }
      val download = main { DownloadStore.completed(context, id) }
      assertEquals(selection.keys, download.request.streamKeys)
      val snapshot = main { DownloadStore.snapshot(context).single { it["id"] == id } }
      assertTrue((snapshot["bytes"] as Long) > 0)
      assertEquals("144p", snapshot["quality"])
      assertTrue((snapshot["audio"] as String).startsWith("German"))
      assertEquals("French", snapshot["caption"])
      await("Poster stored for offline display", 30) { main { DownloadStore.snapshot(context).single { it["id"] == id }["posterUri"].toString().startsWith("file:") } }
      DownloadArtwork.remove(context, id)
      main { DownloadStore.requestPoster(context, id, "") }
      await("Missing artwork restored from saved source", 30) { DownloadArtwork.localUri(context, id).startsWith("file:") }
      // Cache-only data source has no HTTP upstream: preparation/playback cannot use the network.
      val ready = CountDownLatch(1)
      val failure = AtomicReference<PlaybackException?>()
      scenario.moveToState(Lifecycle.State.RESUMED)
      scenario.onActivity { activity ->
        player = ExoPlayer.Builder(activity).setMediaSourceFactory(DefaultMediaSourceFactory(DownloadStore.offlineSource())).build().also { exo ->
          exo.volume = 0f
          activity.setContentView(PlayerView(activity).apply { this.player = exo })
          exo.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(state: Int) { if (state == Player.STATE_READY) ready.countDown() }
            override fun onPlayerError(error: PlaybackException) { failure.set(error); ready.countDown() }
          })
          exo.setMediaItem(DownloadStore.offlineItem(activity, id)); exo.prepare(); exo.play()
        }
      }
      assertTrue("Offline player ready", ready.await(30, TimeUnit.SECONDS))
      assertNull("No cache-only playback error", failure.get())
      await("Offline playback advances", 15) { main { player!!.currentPosition > 1_000 } }
      main { player?.release(); player = null; DownloadStore.control(context, id, "remove") }
      await("Deleted download removed from index") { main { DownloadStore.manager.downloadIndex.getDownload(id) == null } }
      await("Deleted video frees cached media") { main { DownloadStore.cache.cacheSpace == 0L } }
      assertEquals("", DownloadArtwork.localUri(context, id))
    } finally {
      main {
        player?.release()
        if (DownloadStore.manager.downloadIndex.getDownload(id) != null) DownloadStore.control(context, id, "remove")
      }
      scenario.close()
    }
  }

  @Test
  fun externalCaptionIsSavedAndAttachedToOfflineMedia() {
    val id = "external_caption_verification"
    val scenario = ActivityScenario.launch(DownloadTestActivity::class.java)
    var player: ExoPlayer? = null
    try {
      main { DownloadStore.initialize(context) }
      await("Download index initialized") { main { DownloadStore.manager.isInitialized } }
      val options = DownloadManifest.prepare(JSONObject().apply {
        put("id", id); put("title", "External caption verification · S2 E3")
        put("showTitle", "External caption verification"); put("season", 2); put("episode", 3)
        put("url", "https://storage.googleapis.com/shaka-demo-assets/angel-one-hls/hls.m3u8")
        put("referer", "https://storage.googleapis.com/")
        put("captions", JSONArray().put(JSONObject().apply {
          put("url", "https://storage.googleapis.com/shaka-demo-assets/angel-one-hls/s-en-s1.vtt")
          put("label", "English external"); put("language", "en")
        }))
      }.toString())
      @Suppress("UNCHECKED_CAST")
      val quality = (options["qualities"] as List<Map<String, Any>>).last()
      @Suppress("UNCHECKED_CAST")
      val audio = (quality["audioIds"] as List<Int>).first()
      val selection = DownloadManifest.select(JSONObject().apply {
        put("token", options["token"]); put("quality", quality["id"]); put("audio", audio); put("caption", "external:0")
      }.toString())
      main { DownloadStore.start(context, selection) }
      await("Video and external caption completed", 180) {
        main { DownloadStore.snapshot(context).any { it["id"] == id && it["state"] == "completed" } }
      }
      val grouped = main { DownloadStore.snapshot(context).single { it["id"] == id } }
      assertEquals("External caption verification", grouped["showTitle"])
      assertEquals(2, grouped["season"])
      assertEquals(3, grouped["episode"])
      val item = main { DownloadStore.offlineItem(context, id) }
      assertEquals("English external", item.localConfiguration!!.subtitleConfigurations.single().label)
      assertEquals("text/vtt", item.localConfiguration!!.subtitleConfigurations.single().mimeType)
      val ready = CountDownLatch(1)
      val failure = AtomicReference<PlaybackException?>()
      main {
        player = ExoPlayer.Builder(context).setMediaSourceFactory(DefaultMediaSourceFactory(DownloadStore.offlineSource())).build().also { exo ->
          exo.volume = 0f
          exo.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(state: Int) { if (state == Player.STATE_READY) ready.countDown() }
            override fun onPlayerError(error: PlaybackException) { failure.set(error); ready.countDown() }
          })
          exo.setMediaItem(item); exo.prepare(); exo.play()
        }
      }
      assertTrue("Offline external-caption player ready", ready.await(30, TimeUnit.SECONDS))
      assertNull("External caption loaded entirely from cache", failure.get())
    } finally {
      main {
        player?.release()
        if (DownloadStore.manager.downloadIndex.getDownload(id) != null) DownloadStore.control(context, id, "remove")
      }
      await("Video and sidecar removed") {
        main { DownloadStore.manager.downloadIndex.getDownload(id) == null && DownloadStore.manager.downloadIndex.getDownload(DownloadStore.captionId(id)) == null }
      }
      scenario.close()
    }
  }
}
