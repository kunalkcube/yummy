package expo.modules.yummydownloads

import android.app.Notification
import android.app.PendingIntent
import android.content.Intent
import android.net.Uri
import androidx.annotation.OptIn
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.offline.Download
import androidx.media3.exoplayer.offline.DownloadManager
import androidx.media3.exoplayer.offline.DownloadService
import androidx.media3.exoplayer.scheduler.Scheduler
import androidx.media3.exoplayer.offline.DownloadNotificationHelper

@OptIn(UnstableApi::class)
class YummyDownloadService : DownloadService(3201, 1_000, "yummy_downloads", R.string.yummy_download_channel, R.string.yummy_download_channel_description) {
  override fun getDownloadManager(): DownloadManager {
    DownloadStore.initialize(this)
    return DownloadStore.manager
  }

  override fun getScheduler(): Scheduler? = null

  override fun getForegroundNotification(downloads: List<Download>, notMetRequirements: Int): Notification {
    val intent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
      action = Intent.ACTION_VIEW
      data = Uri.parse("yummy://downloads")
    }
    val pendingIntent = intent?.let { PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE) }
    val notification = DownloadNotificationHelper(this, "yummy_downloads").buildProgressNotification(
      this, android.R.drawable.stat_sys_download, pendingIntent, "Saving videos for offline playback", downloads, notMetRequirements,
    )
    val videos = downloads.mapNotNull { download ->
      runCatching { DownloadStore.metadata(download.request) }.getOrNull()
    }.distinctBy { it.optString("id") }
    val first = videos.firstOrNull()
    val title = first?.optString("title")?.takeIf { it.isNotBlank() } ?: "Yummy downloads"
    val detail = first?.let { "${it.optString("quality")} · ${it.optString("audio")}" } ?: "Preparing offline download…"
    return Notification.Builder.recoverBuilder(this, notification)
      .setContentTitle(if (videos.size > 1) "$title +${videos.size - 1} more" else title)
      .setContentText(if (notMetRequirements != 0) "Waiting for connection · $detail" else detail)
      .build()
  }

  override fun onTimeout(startId: Int, fgsType: Int) {
    DownloadStore.manager.setStopReason(null, 1)
    stopSelf()
  }
}
