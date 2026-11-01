package expo.modules.yummydownloads

import android.content.Context
import android.view.View
import android.widget.LinearLayout
import androidx.annotation.OptIn
import androidx.media3.common.C
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.PlayerView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

@OptIn(UnstableApi::class)
class OfflineVideoView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  override val shouldUseAndroidLayout = true
  val onPlaybackError by EventDispatcher()
  val onReady by EventDispatcher()
  private val video = PlayerView(context).apply {
    setShowSubtitleButton(true)
    layoutParams = LinearLayout.LayoutParams(-1, -1)
  }
  private var player: ExoPlayer? = null
  private var downloadId = ""

  init { addView(video) }

  fun load(id: String) {
    if (downloadId == id && player != null) return
    downloadId = id
    release()
    if (id.isEmpty()) return
    try {
      val download = DownloadStore.completed(context, id)
      val meta = DownloadStore.metadata(download.request)
      val item = DownloadStore.offlineItem(context, id)
      player = ExoPlayer.Builder(context)
        .setMediaSourceFactory(DefaultMediaSourceFactory(DownloadStore.offlineSource()))
        .build().also { exo ->
          video.player = exo
          exo.trackSelectionParameters = exo.trackSelectionParameters.buildUpon()
            .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, meta.optString("caption") == "None").build()
          exo.addListener(object : Player.Listener {
            override fun onPlayerError(error: PlaybackException) {
              onPlaybackError(mapOf("message" to "The offline video could not be played. Try downloading it again."))
            }
            override fun onPlaybackStateChanged(state: Int) {
              if (state == Player.STATE_READY) onReady(mapOf("durationMs" to exo.duration))
            }
          })
          exo.setMediaItem(item)
          exo.prepare()
          exo.playWhenReady = true
        }
    } catch (_: Exception) {
      onPlaybackError(mapOf("message" to "This offline video is incomplete or missing. Download it again."))
    }
  }

  fun release() {
    video.player = null
    player?.release()
    player = null
  }

  override fun onDetachedFromWindow() { release(); super.onDetachedFromWindow() }
  override fun onWindowVisibilityChanged(visibility: Int) {
    super.onWindowVisibilityChanged(visibility)
    if (visibility != View.VISIBLE) player?.pause()
  }
}
