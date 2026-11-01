package expo.modules.yummydownloads

import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class YummyDownloadsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("YummyDownloads")

    AsyncFunction("prepare") { input: String ->
      try { DownloadManifest.prepare(input) } catch (error: Exception) {
        throw IllegalStateException(if (error is IllegalArgumentException) error.message else "Could not inspect this stream. Reload the video and try again.")
      }
    }
    Function("releasePreparation") { token: String -> DownloadManifest.release(token) }
    AsyncFunction("start") { input: String, promise: Promise ->
      try {
        val selection = DownloadManifest.select(input)
        val context = appContext.reactContext ?: error("App is not ready.")
        Handler(Looper.getMainLooper()).post {
          try {
            DownloadStore.start(context, selection)
            promise.resolve(null)
          } catch (error: Exception) {
            promise.reject("DOWNLOAD_NOT_STARTED", error.message ?: "Could not start download.", null)
          }
        }
      } catch (_: Exception) {
        promise.reject("DOWNLOAD_NOT_STARTED", "Could not start download. Open Download again to refresh the stream options.", null)
      }
    }
    AsyncFunction("list") {
      DownloadStore.snapshot(appContext.reactContext ?: error("App is not ready."))
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("control") { id: String, action: String ->
      DownloadStore.control(appContext.reactContext ?: error("App is not ready."), id, action)
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("requestPoster") { id: String, url: String ->
      DownloadStore.requestPoster(appContext.reactContext ?: error("App is not ready."), id, url)
    }.runOnQueue(Queues.MAIN)

    View(OfflineVideoView::class) {
      Events("onPlaybackError", "onReady")
      Prop("downloadId") { view: OfflineVideoView, id: String -> view.load(id) }
      OnViewDestroys { view: OfflineVideoView -> view.release() }
    }
  }
}
