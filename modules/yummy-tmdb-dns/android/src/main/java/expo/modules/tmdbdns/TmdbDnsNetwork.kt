package expo.modules.tmdbdns

import android.content.Context
import android.content.SharedPreferences
import com.facebook.react.modules.network.OkHttpClientFactory
import com.facebook.react.modules.network.OkHttpClientProvider
import java.io.File
import java.io.IOException
import java.net.InetAddress
import java.util.concurrent.TimeUnit
import okhttp3.Cache
import okhttp3.ConnectionPool
import okhttp3.OkHttpClient
import okhttp3.dnsoverhttps.DnsOverHttps
import okhttp3.HttpUrl.Companion.toHttpUrl

internal object TmdbDnsNetwork {
  private lateinit var preferences: SharedPreferences
  private val connectionPool = ConnectionPool()

  @Volatile
  var enabled = false
    private set

  fun initialize(context: Context) {
    preferences = context.getSharedPreferences("yummy_tmdb_dns", Context.MODE_PRIVATE)
    enabled = preferences.getBoolean("enabled", false)

    val dnsClient = OkHttpClient.Builder()
      .connectTimeout(4, TimeUnit.SECONDS)
      .readTimeout(4, TimeUnit.SECONDS)
      .callTimeout(6, TimeUnit.SECONDS)
      .cache(Cache(File(context.cacheDir, "tmdb-dns"), 1024 * 1024))
      .build()
    val cloudflareDns = DnsOverHttps.Builder()
      .client(dnsClient)
      .url("https://cloudflare-dns.com/dns-query".toHttpUrl())
      // Bootstrap without the device resolver, which may be the reason DNS was enabled.
      .bootstrapDnsHosts(
        InetAddress.getByName("1.1.1.1"),
        InetAddress.getByName("1.0.0.1"),
        InetAddress.getByName("2606:4700:4700::1111"),
        InetAddress.getByName("2606:4700:4700::1001"),
      )
      .build()
    val resolver = TmdbDnsResolver({ enabled }, cloudflareDns)

    // Both NetworkingModule (fetch/axios) and Fresco (React Native Image) use this factory.
    OkHttpClientProvider.setOkHttpClientFactory(OkHttpClientFactory {
      OkHttpClientProvider.createClientBuilder()
        .dns(resolver)
        .connectionPool(connectionPool)
        .addInterceptor { chain ->
          val host = chain.request().url.host
          val boundedChain = if (host == "api.themoviedb.org" || host == "image.tmdb.org") {
            chain.withConnectTimeout(4, TimeUnit.SECONDS).withReadTimeout(10, TimeUnit.SECONDS)
          } else chain
          boundedChain.proceed(chain.request())
        }
        .build()
    })
  }

  fun setEnabled(value: Boolean) {
    if (!preferences.edit().putBoolean("enabled", value).commit()) {
      throw IOException("Could not save the DNS preference. Please try again.")
    }
    enabled = value
    connectionPool.evictAll()
  }
}
