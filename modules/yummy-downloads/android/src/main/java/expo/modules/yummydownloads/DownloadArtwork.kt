package expo.modules.yummydownloads

import android.content.Context
import android.net.Uri
import android.os.SystemClock
import com.facebook.react.modules.network.OkHttpClientProvider
import okhttp3.Request
import java.io.File
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

internal object DownloadArtwork {
  private val executor = Executors.newSingleThreadExecutor()
  private val pending = ConcurrentHashMap.newKeySet<String>()
  private val retryAfter = ConcurrentHashMap<String, Long>()

  fun allowed(url: String): Boolean = runCatching {
    val uri = Uri.parse(url)
    uri.scheme == "https" && uri.host == "image.tmdb.org" && uri.userInfo == null && uri.query == null &&
      uri.path?.matches(Regex("/t/p/(w92|w154|w185|w342|w500)/[^/]+")) == true
  }.getOrDefault(false)

  private fun file(context: Context, id: String): File {
    require(id.matches(Regex("[A-Za-z0-9_-]{1,120}")))
    return File(context.filesDir, "offline-posters/$id.jpg")
  }

  fun localUri(context: Context, id: String): String = file(context, id)
    .takeIf { it.isFile && it.length() > 0 }?.let { Uri.fromFile(it).toString() } ?: ""

  fun fetch(context: Context, id: String, url: String, stillExists: () -> Boolean) {
    if (!allowed(url) || localUri(context, id).isNotEmpty() || SystemClock.elapsedRealtime() < (retryAfter[id] ?: 0) || !pending.add(id)) return
    executor.execute {
      val target = file(context, id)
      val temporary = File(target.parentFile, "${id}.pending")
      try {
        target.parentFile?.mkdirs()
        // Reuse Yummy's TMDB resolver so artwork also works when device DNS blocks TMDB.
        val client = OkHttpClientProvider.getOkHttpClient().newBuilder().callTimeout(15, TimeUnit.SECONDS).build()
        client.newCall(Request.Builder().url(url).build()).execute().use { response ->
          check(response.isSuccessful && response.body?.contentType()?.type == "image")
          val body = response.body ?: error("No artwork")
          body.byteStream().use { input ->
            temporary.outputStream().use { output ->
              val buffer = ByteArray(8_192)
              var total = 0
              while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                total += count
                check(total <= 2 * 1024 * 1024)
                output.write(buffer, 0, count)
              }
              check(total > 0)
            }
          }
        }
        if (stillExists()) check(temporary.renameTo(target))
      } catch (_: Exception) {
        retryAfter[id] = SystemClock.elapsedRealtime() + 60_000
      } finally {
        temporary.delete()
        pending.remove(id)
      }
    }
  }

  fun remove(context: Context, id: String) {
    file(context, id).delete()
    retryAfter.remove(id)
  }
}
